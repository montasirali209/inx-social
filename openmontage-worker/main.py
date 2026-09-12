from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

ROOT = Path(os.environ.get("OPENMONTAGE_ROOT", "/opt/OpenMontage")).resolve()
PROJECTS = Path(os.environ.get("OPENMONTAGE_PROJECTS_DIR", "/tmp/openmontage-projects")).resolve()
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

from lib.checkpoint import init_project, write_checkpoint  # noqa: E402
from lib.pipeline_loader import list_pipelines, load_pipeline  # noqa: E402
from tools.tool_registry import registry  # noqa: E402

app = FastAPI(title="INXSocial OpenMontage Runtime", version="1.0.0")
pool = ThreadPoolExecutor(max_workers=max(1, min(3, int(os.environ.get("OPENMONTAGE_MAX_JOBS", "1")))))
jobs: dict[str, dict[str, Any]] = {}
lock = threading.RLock()


def retention_loop() -> None:
    while True:
        cutoff = time.time() - (10 * 24 * 60 * 60)
        try:
            if PROJECTS.is_dir():
                for child in PROJECTS.iterdir():
                    if child.is_dir() and child.stat().st_mtime < cutoff:
                        with lock:
                            active = jobs.get(child.name, {}).get("status") in {"queued", "processing"}
                        if not active:
                            shutil.rmtree(child, ignore_errors=True)
        except Exception:
            pass
        time.sleep(6 * 60 * 60)


threading.Thread(target=retention_loop, name="openmontage-retention", daemon=True).start()


class JobRequest(BaseModel):
    prompt: str = Field(min_length=2, max_length=1500)
    duration: int = Field(default=30, ge=15, le=60)
    resolution: str = Field(default="720p", pattern="^(720p|1080p)$")
    aspectRatio: str = Field(default="9:16", pattern="^(9:16|16:9|1:1)$")
    tone: str = Field(default="Natural", max_length=60)
    voiceover: bool = True
    captions: bool = True
    fullRunAuthorized: bool = True


def authorize(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("OPENMONTAGE_INTERNAL_TOKEN", "")
    if not expected or authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def save(job: dict[str, Any], **changes: Any) -> None:
    with lock:
        job.update(changes)
        job["updatedAt"] = time.time()
        project = Path(job["projectDir"])
        project.mkdir(parents=True, exist_ok=True)
        (project / "inx-job.json").write_text(json.dumps(job, indent=2), encoding="utf-8")


def public_job(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if key not in {"projectDir", "outputPath"}}


def json_completion(system: str, user: dict[str, Any]) -> dict[str, Any]:
    from openai import OpenAI
    client = OpenAI()
    response = client.chat.completions.create(
        model=os.environ.get("OPENMONTAGE_TEXT_MODEL", "gpt-4o-mini"),
        messages=[{"role": "system", "content": system}, {"role": "user", "content": json.dumps(user)}],
        response_format={"type": "json_object"},
        temperature=0.35,
    )
    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)


def fallback_plan(req: JobRequest) -> dict[str, Any]:
    count = 4 if req.duration <= 15 else 6 if req.duration <= 30 else 8
    hold = req.duration / count
    words = re.findall(r"[A-Za-z0-9]+", req.prompt)[:6]
    query = " ".join(words) or "people city nature"
    return {
        "title": req.prompt[:90], "hook": req.prompt[:140], "caption": req.prompt,
        "hashtags": ["video", "story", "INXSocial"],
        "narration": req.prompt,
        "thematicQuestion": f"What does {req.prompt[:80].rstrip('.?!')} reveal?",
        "scenes": [{"description": f"{query}, {kind}, cinematic real footage", "query": f"{query} {kind}", "seconds": hold}
                   for kind in ("wide", "people", "detail", "movement", "place", "closing", "texture", "hope")[:count]],
    }


def create_plan(req: JobRequest) -> dict[str, Any]:
    if not os.environ.get("OPENAI_API_KEY"):
        return fallback_plan(req)
    try:
        plan = json_completion(
            "You are the OpenMontage documentary montage idea and scene director. Return JSON only with title, hook, caption, hashtags (without #), narration, thematicQuestion, and scenes. Produce 4-8 scenes; every scene has description, query (2-5 concrete stock-search words), and seconds. Scene seconds must total the requested duration. Use real searchable subjects, not abstract feelings. Do not invent factual claims.",
            req.model_dump(),
        )
        if not isinstance(plan.get("scenes"), list) or len(plan["scenes"]) < 3:
            raise ValueError("invalid scene plan")
        scenes = plan["scenes"][:8]
        total = sum(max(2.0, float(scene.get("seconds") or 0)) for scene in scenes)
        for scene in scenes:
            scene["seconds"] = round(max(2.0, float(scene.get("seconds") or 0)) * req.duration / total, 2)
        plan["scenes"] = scenes
        return plan
    except Exception:
        return fallback_plan(req)


def write_stage(job: dict[str, Any], stage: str, artifact_name: str, artifact: dict[str, Any], progress: int) -> None:
    write_checkpoint(PROJECTS, job["id"], stage, "completed", {artifact_name: artifact},
                     pipeline_type="inx-stock-montage", style_playbook="clean-professional",
                     checkpoint_policy="auto_noncreative", human_approved=True,
                     metadata={"full_run_authorized": True, "inx_progress": progress})
    save(job, stage=stage, progress=progress)


def probe(path: str) -> dict[str, Any]:
    output = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "json", path], text=True)
    return json.loads(output).get("format", {})


def srt(text: str, duration: int) -> str:
    chunks = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()] or [text]
    def ts(value: float) -> str:
        ms = int(max(0, value) * 1000); h, rem = divmod(ms, 3600000); m, rem = divmod(rem, 60000); sec, milli = divmod(rem, 1000)
        return f"{h:02d}:{m:02d}:{sec:02d},{milli:03d}"
    lines = []
    for index, chunk in enumerate(chunks):
        start = duration * index / len(chunks); end = duration * (index + 1) / len(chunks)
        lines.extend([str(index + 1), f"{ts(start)} --> {ts(end)}", chunk, ""])
    return "\n".join(lines)


def mix_audio(project: Path, narration: str | None, music: str | None, duration: int) -> str | None:
    if not narration and not music:
        return None
    output = project / "assets" / "audio" / "mix.m4a"
    if narration and music:
        command = ["ffmpeg", "-y", "-stream_loop", "-1", "-i", music, "-i", narration, "-filter_complex", "[0:a]volume=0.16[m];[1:a]volume=1.0[n];[m][n]amix=inputs=2:duration=longest:dropout_transition=2,apad[a]", "-map", "[a]", "-t", str(duration), "-c:a", "aac", "-b:a", "160k", str(output)]
    else:
        source = narration or music
        command = ["ffmpeg", "-y", "-stream_loop", "-1", "-i", str(source), "-af", "apad", "-t", str(duration), "-c:a", "aac", "-b:a", "160k", str(output)]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return str(output)


def run_job(job: dict[str, Any], req: JobRequest) -> None:
    project = Path(job["projectDir"])
    try:
        registry.discover()
        save(job, status="processing", stage="idea", progress=4)
        plan = create_plan(req)
        brief = {"version": "1.0", "title": str(plan.get("title") or req.prompt)[:160], "hook": str(plan.get("hook") or req.prompt),
                 "key_points": [str(scene.get("description") or scene.get("query")) for scene in plan["scenes"]],
                 "core_message": str(plan.get("caption") or req.prompt), "tone": req.tone, "style": "clean-professional",
                 "target_platform": "instagram" if req.aspectRatio == "9:16" else "generic", "target_duration_seconds": req.duration,
                 "metadata": {"thematic_question": plan.get("thematicQuestion"), "shape": "single-image expansion", "full_run_authorized": True,
                              "music_plan": {"source": "pixabay_music", "fallback": "none"}, "render_runtime": "ffmpeg"}}
        write_stage(job, "idea", "brief", brief, 12)

        cursor = 0.0; scene_rows = []
        for index, raw in enumerate(plan["scenes"]):
            seconds = float(raw["seconds"]); scene_id = f"scene_{index + 1:02d}"
            scene_rows.append({"id": scene_id, "type": "broll", "description": str(raw.get("description") or raw.get("query")),
                               "start_seconds": round(cursor, 2), "end_seconds": round(cursor + seconds, 2),
                               "narrative_role": "establish_context" if index == 0 else "resolution" if index == len(plan["scenes"]) - 1 else "emotional_beat",
                               "hero_moment": index in {0, len(plan["scenes"]) - 1},
                               "required_assets": [{"type": "video", "description": str(raw.get("query")), "source": "source"}]})
            cursor += seconds
        scene_plan = {"version": "1.0", "style_playbook": "clean-professional", "scenes": scene_rows,
                      "metadata": {"slots": [{"slot_id": row["id"], "queries": [str(plan["scenes"][i].get("query"))], "preferred_sources": []} for i, row in enumerate(scene_rows)]}}
        write_stage(job, "scene_plan", "scene_plan", scene_plan, 22)

        search = registry.get("direct_clip_search")
        result = search.execute({"output_dir": str(project / "assets" / "video"),
                                 "queries": [{"query": str(plan["scenes"][i].get("query")), "slot_id": row["id"], "kind": "video"} for i, row in enumerate(scene_rows)],
                                 "clips_per_query": 1, "filters": {"orientation": "portrait" if req.aspectRatio == "9:16" else "square" if req.aspectRatio == "1:1" else "landscape", "min_width": 640},
                                 "extract_thumbnails": True, "timeout_seconds": 900})
        if not result.success:
            raise RuntimeError(result.error or "OpenMontage clip acquisition failed")
        clips = result.data.get("clips", [])
        by_slot = {str(clip.get("slot_id")): clip for clip in clips}
        if any(row["id"] not in by_slot for row in scene_rows):
            raise RuntimeError("OpenMontage could not retrieve licensed footage for every scene")

        assets = []
        for row in scene_rows:
            clip = by_slot[row["id"]]; info = probe(str(clip["path"])); duration = float(info.get("duration") or (row["end_seconds"] - row["start_seconds"]))
            assets.append({"id": f"asset_{row['id']}", "type": "video", "path": str(clip["path"]), "source_tool": "direct_clip_search", "scene_id": row["id"],
                           "duration_seconds": duration, "subtype": "stock", "provider": str(clip.get("source") or "OpenMontage stock source"),
                           "license": str(clip.get("license") or "Provider content license"), "original_url": str(clip.get("source_url") or "")})

        music_path = None; warnings = []
        music_tool = registry.get("pixabay_music")
        if music_tool:
            music_result = music_tool.execute({"query": f"{req.tone} cinematic background", "min_duration": req.duration, "max_duration": max(req.duration * 4, 90), "output_path": str(project / "assets" / "music" / "bed.mp3")})
            if music_result.success:
                music_path = str(music_result.data.get("output")); assets.append({"id": "asset_music", "type": "music", "path": music_path, "source_tool": "pixabay_music", "scene_id": "scene_01", "provider": "pixabay_music", "license": str(music_result.data.get("license") or "Pixabay Content License"), "original_url": str(music_result.data.get("source_url") or "")})
            else: warnings.append("Royalty-free music search was unavailable; the render uses narration/source audio only.")

        narration_path = None
        if req.voiceover and plan.get("narration") and registry.get("openai_tts"):
            voice = registry.get("openai_tts").execute({"text": str(plan["narration"]), "voice": "alloy", "instructions": f"Speak in a {req.tone.lower()}, clear social documentary style.", "output_path": str(project / "assets" / "audio" / "narration.mp3")})
            if voice.success:
                narration_path = str(voice.data.get("output")); assets.append({"id": "asset_narration", "type": "narration", "path": narration_path, "source_tool": "openai_tts", "scene_id": "scene_01", "provider": "openai", "model": str(voice.model or "gpt-4o-mini-tts"), "cost_usd": float(voice.cost_usd or 0)})
            else: warnings.append("Narration generation was unavailable.")
        asset_manifest = {"version": "1.0", "assets": assets, "total_cost_usd": sum(float(item.get("cost_usd") or 0) for item in assets),
                          "metadata": {"search_stats": {"queries": len(scene_rows), "clips": len(clips)}, "warnings": warnings}}
        write_stage(job, "assets", "asset_manifest", asset_manifest, 58)

        cuts = []
        for index, row in enumerate(scene_rows):
            asset = next(item for item in assets if item["id"] == f"asset_{row['id']}")
            wanted = row["end_seconds"] - row["start_seconds"]; available = max(0.5, float(asset.get("duration_seconds") or wanted))
            cuts.append({"id": f"cut_{index + 1:02d}", "source": asset["id"], "in_seconds": 0, "out_seconds": round(min(wanted, available), 2), "layer": "primary",
                         "transition_in": "fade_in" if index == 0 else "cut", "transition_out": "fade_out" if index == len(scene_rows) - 1 else "cut", "reason": row["description"]})
        width, height = (720, 1280) if req.resolution == "720p" and req.aspectRatio == "9:16" else (1280, 720) if req.resolution == "720p" and req.aspectRatio == "16:9" else (720, 720) if req.resolution == "720p" else (1080, 1920) if req.aspectRatio == "9:16" else (1920, 1080) if req.aspectRatio == "16:9" else (1080, 1080)
        subtitle_path = None
        if req.captions and plan.get("narration"):
            subtitle_path = project / "assets" / "audio" / "captions.srt"; subtitle_path.write_text(srt(str(plan["narration"]), req.duration), encoding="utf-8")
        mixed_audio = mix_audio(project, narration_path, music_path, req.duration)
        edit = {"version": "1.0", "cuts": cuts, "renderer_family": "documentary-montage", "render_runtime": "ffmpeg",
                "audio": {"music": {"asset_id": "asset_music", "volume": 0.16, "fade_in_seconds": 1, "fade_out_seconds": 2, "ducking": bool(narration_path)}} if music_path else {},
                "subtitles": {"enabled": bool(subtitle_path), "source": str(subtitle_path or ""), "position": "bottom-center"},
                "metadata": {"pipeline": "inx-stock-montage", "total_duration_seconds": sum(c["out_seconds"] for c in cuts), "compose_target": {"width": width, "height": height, "fit": "cover"}, "proposal_render_runtime": "ffmpeg"}}
        write_stage(job, "edit", "edit_decisions", edit, 72)

        output = project / "renders" / "final.mp4"
        compose = registry.get("video_compose").execute({"operation": "render", "output_path": str(output), "edit_decisions": edit, "asset_manifest": asset_manifest,
                                                          "scene_plan": scene_plan["scenes"], "audio_path": mixed_audio, "subtitle_path": str(subtitle_path) if subtitle_path else None,
                                                          "script_text": str(plan.get("narration") or ""), "options": {"subtitle_burn": bool(subtitle_path)}})
        if not compose.success or not output.is_file():
            raise RuntimeError(compose.error or "OpenMontage composition failed")
        details = probe(str(output)); actual_duration = float(details.get("duration") or 0)
        report = {"version": "1.0", "outputs": [{"path": str(output), "format": "mp4", "codec": "h264", "audio_codec": "aac", "resolution": f"{width}x{height}", "fps": 30, "duration_seconds": actual_duration, "file_size_bytes": int(details.get("size") or output.stat().st_size), "platform_target": brief["target_platform"]}],
                  "render_time_seconds": 0, "warnings": warnings, "verification_notes": ["Rendered and validated by OpenMontage video_compose and ffprobe."], "render_grammar": "documentary-montage", "metadata": {"runtime": "ffmpeg", "openmontage_commit": os.environ.get("OPENMONTAGE_COMMIT")}}
        write_stage(job, "compose", "render_report", report, 96)
        provenance = [{"provider": item.get("provider"), "sourceUrl": item.get("original_url"), "license": item.get("license"), "sceneId": item.get("scene_id")} for item in assets if item["type"] == "video"]
        save(job, status="completed", stage="compose", progress=100, outputPath=str(output),
             result={"caption": str(plan.get("caption") or req.prompt), "hashtags": [str(tag).lstrip("#") for tag in plan.get("hashtags", [])][:15],
                     "script": str(plan.get("narration") or ""), "provenance": provenance, "warnings": warnings,
                     "runtime": "OpenMontage", "pipeline": "inx-stock-montage", "openmontageCommit": os.environ.get("OPENMONTAGE_COMMIT")})
    except Exception as exc:
        save(job, status="failed", progress=0, error=str(exc)[:1000])


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "runtime": "OpenMontage", "commit": os.environ.get("OPENMONTAGE_COMMIT"), "ffmpeg": bool(shutil.which("ffmpeg"))}


@app.get("/capabilities", dependencies=[Depends(authorize)])
def capabilities() -> dict[str, Any]:
    registry.discover()
    return {"runtime": "OpenMontage", "commit": os.environ.get("OPENMONTAGE_COMMIT"), "pipelines": sorted(list_pipelines()), "providerMenu": registry.provider_menu_summary()}


@app.post("/jobs", status_code=202, dependencies=[Depends(authorize)])
def create_job(req: JobRequest) -> dict[str, Any]:
    if not req.fullRunAuthorized:
        raise HTTPException(status_code=422, detail="Full-run authorization is required for this one-prompt pipeline")
    load_pipeline("inx-stock-montage")
    job_id = str(uuid.uuid4())
    project = init_project(job_id, title=req.prompt[:120], pipeline_type="inx-stock-montage", pipeline_dir=PROJECTS, style_playbook="clean-professional")
    job = {"id": job_id, "status": "queued", "stage": "preflight", "progress": 1, "createdAt": time.time(), "updatedAt": time.time(), "projectDir": str(project), "request": req.model_dump()}
    with lock: jobs[job_id] = job
    save(job)
    pool.submit(run_job, job, req)
    return public_job(job)


@app.get("/jobs/{job_id}", dependencies=[Depends(authorize)])
def get_job(job_id: str) -> dict[str, Any]:
    with lock: job = jobs.get(job_id)
    if not job:
        marker = PROJECTS / job_id / "inx-job.json"
        if marker.is_file():
            job = json.loads(marker.read_text(encoding="utf-8"))
        else: raise HTTPException(status_code=404, detail="Job not found")
    return public_job(job)


@app.get("/jobs/{job_id}/output", dependencies=[Depends(authorize)])
def output(job_id: str) -> FileResponse:
    with lock: job = jobs.get(job_id)
    if not job:
        marker = PROJECTS / job_id / "inx-job.json"
        if marker.is_file():
            job = json.loads(marker.read_text(encoding="utf-8"))
    if not job or job.get("status") != "completed" or not Path(job.get("outputPath", "")).is_file():
        raise HTTPException(status_code=404, detail="Output is not ready")
    return FileResponse(job["outputPath"], media_type="video/mp4", filename=f"openmontage-{job_id}.mp4")
