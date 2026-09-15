from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import requests
import yaml
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

ROOT = Path(os.environ.get("OPENMONTAGE_ROOT", "/opt/OpenMontage")).resolve()
PROJECTS = (ROOT / "projects").resolve()
STATE_ROOT = Path(os.environ.get("INX_OPENMONTAGE_STATE_DIR", "/tmp/inx-openmontage-jobs")).resolve()
OPENAI_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
AGENT_MODEL = os.environ.get("OPENMONTAGE_AGENT_MODEL", "gpt-5.6-terra")
MAX_TURNS = max(20, min(200, int(os.environ.get("OPENMONTAGE_AGENT_MAX_TURNS", "100"))))
MAX_JOBS = max(1, min(4, int(os.environ.get("OPENMONTAGE_MAX_JOBS", "1"))))
RETENTION_SECONDS = 10 * 24 * 60 * 60
OPENMONTAGE_COMMIT = os.environ.get("OPENMONTAGE_COMMIT", "unknown")

app = FastAPI(title="INXSocial Full OpenMontage Bridge", version="2.0.0")
pool = ThreadPoolExecutor(max_workers=MAX_JOBS)
jobs: dict[str, dict[str, Any]] = {}
lock = threading.RLock()
capability_cache: dict[str, Any] = {"value": None, "expires": 0.0}


class JobRequest(BaseModel):
    model_config = ConfigDict(extra="allow")
    prompt: str = Field(min_length=2, max_length=12000)
    pipeline: str | None = Field(default=None, max_length=120)
    duration: int | None = Field(default=None, ge=1, le=3600)
    resolution: str | None = Field(default=None, max_length=40)
    aspectRatio: str | None = Field(default=None, max_length=40)
    tone: str | None = Field(default=None, max_length=120)
    voiceover: bool | None = None
    captions: bool | None = None
    fullRunAuthorized: bool = True
    referenceUrls: list[str] = Field(default_factory=list, max_length=16)
    referencePaths: list[str] = Field(default_factory=list, max_length=16)


def authorize(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("OPENMONTAGE_INTERNAL_TOKEN", "")
    if not expected or authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def _safe_job(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if key not in {"outputPath", "projectPath"}}


def _persist(job: dict[str, Any]) -> None:
    STATE_ROOT.mkdir(parents=True, exist_ok=True)
    serializable = {key: value for key, value in job.items() if key != "thread"}
    (STATE_ROOT / f"{job['id']}.json").write_text(json.dumps(serializable, indent=2, default=str), encoding="utf-8")


def save(job: dict[str, Any], **changes: Any) -> None:
    with lock:
        job.update(changes)
        job["updatedAt"] = time.time()
        _persist(job)


def _redact(text: str) -> str:
    value = str(text or "")
    names = (
        "OPENAI_API_KEY", "FAL_KEY", "FAL_AI_API_KEY", "ATLASCLOUD_API_KEY", "MINIMAX_API_KEY",
        "REPLICATE_API_TOKEN", "HIGGSFIELD_API_KEY", "HIGGSFIELD_API_SECRET", "KLING_API_KEY",
        "ARK_API_KEY", "HEYGEN_API_KEY", "RUNWAY_API_KEY", "SUNO_API_KEY", "ELEVENLABS_API_KEY",
        "XAI_API_KEY", "GOOGLE_API_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY", "UNSPLASH_ACCESS_KEY",
        "AZURE_SPEECH_KEY", "FISH_AUDIO_API_KEY", "TENCENT_TOKENHUB_API_KEY", "OPENMONTAGE_INTERNAL_TOKEN",
    )
    for name in names:
        secret = os.environ.get(name)
        if secret and len(secret) >= 6:
            value = value.replace(secret, f"[REDACTED:{name}]")
    value = re.sub(r"(?i)(api[_-]?key|token|secret)\s*[:=]\s*['\"]?[\w\-./+=]{12,}", r"\1=[REDACTED]", value)
    return value[-60000:]


_BLOCKED = [
    re.compile(pattern, re.I) for pattern in (
        r"(^|[;&|]\s*)\s*(env|printenv)\b",
        r"\b(cat|sed|awk|grep|head|tail|less|more)\s+[^;\n]*(?:/proc/|/etc/|\.env\b)",
        r"\b(?:curl|wget|nc|netcat|socat|ssh|scp)\b",
        r"\b(?:OPENAI_API_KEY|FAL_KEY|API_KEY|TOKEN|SECRET)\b",
        r"\brm\s+-rf\s+/(?:\s|$)",
        r"\bshutdown\b|\breboot\b|\bmkfs\b|\bdd\s+if=",
    )
]


def _validate_command(command: str) -> None:
    if not command or len(command) > 30000:
        raise ValueError("Invalid command length.")
    for pattern in _BLOCKED:
        if pattern.search(command):
            raise ValueError("Command blocked by INXSocial production sandbox policy.")
    absolute_paths = re.findall(r"(?<![\w.-])(/[\w@%+=:,./-]+)", command)
    allowed = (str(ROOT), str(PROJECTS), "/tmp/", "/usr/bin/", "/opt/venv/", "/dev/null")
    for candidate in absolute_paths:
        clean = candidate.rstrip("'\"),;")
        if clean.startswith(allowed) or clean in {"/bin/bash", "/bin/sh", "/usr/bin/env"}:
            continue
        raise ValueError(f"Absolute path outside OpenMontage workspace is blocked: {clean}")


def _stage_from_command(command: str) -> str:
    lower = command.lower()
    for token, stage in (
        ("post-render", "post_render_review"), ("ffprobe", "quality_review"), ("render", "render"),
        ("compose", "compose"), ("subtitle", "subtitles"), ("caption", "subtitles"), ("audio", "audio"),
        ("music", "music"), ("tts", "narration"), ("clip", "footage"), ("corpus", "footage"),
        ("image", "visuals"), ("script", "script"), ("research", "research"),
        ("checkpoint", "checkpoint"), ("preflight", "preflight"),
    ):
        if token in lower:
            return stage
    return "production"


def _run_command(job: dict[str, Any], command: str, timeout_seconds: int) -> str:
    _validate_command(command)
    timeout = max(5, min(900, int(timeout_seconds or 300)))
    stage = _stage_from_command(command)
    turn = int(job.get("agentTurns", 0)) + 1
    progress = min(94, max(int(job.get("progress", 4)), 5 + int(88 * min(turn, MAX_TURNS) / MAX_TURNS)))
    save(job, stage=stage, progress=progress, agentTurns=turn)
    started = time.time()
    completed = subprocess.run(
        command, cwd=str(ROOT), shell=True, executable="/bin/bash", capture_output=True, text=True,
        timeout=timeout, env=os.environ.copy(),
    )
    output = _redact(
        f"$ {command}\nexit={completed.returncode}\nstdout:\n{completed.stdout[-40000:]}\nstderr:\n{completed.stderr[-16000:]}"
    )
    events = list(job.get("events") or [])
    events.append({
        "at": time.time(), "stage": stage, "command": _redact(command)[:2000], "exitCode": completed.returncode,
        "durationSeconds": round(time.time() - started, 2), "output": output[-12000:],
    })
    save(job, events=events[-80:])
    print(json.dumps({
        "event": "stock_video_stage_complete", "jobId": job.get("id"), "stage": stage,
        "seconds": round(time.time() - started, 2), "exitCode": completed.returncode,
    }), flush=True)
    return output


def _tool_schema() -> list[dict[str, Any]]:
    return [{
        "type": "function",
        "name": "run_command",
        "description": (
            "Run a shell command inside the unchanged upstream OpenMontage repository at /opt/OpenMontage. "
            "Use it to inspect AGENT_GUIDE.md, pipeline manifests and skills, and execute OpenMontage's own "
            "Python tools, Backlot/checkpoint helpers, FFmpeg, Remotion, HyperFrames and validation commands. "
            "Never read environment variables or secret files."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string"},
                "timeout_seconds": {"type": "integer", "minimum": 5, "maximum": 900},
            },
            "required": ["command", "timeout_seconds"],
            "additionalProperties": False,
        },
        "strict": True,
    }]


def _pipeline_names() -> list[str]:
    return sorted(path.stem for path in (ROOT / "pipeline_defs").glob("*.yaml"))


def _pipeline_catalog() -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for path in sorted((ROOT / "pipeline_defs").glob("*.yaml")):
        if path.stem == "framework-smoke":
            continue
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            result.append({
                "id": path.stem,
                "name": str(data.get("display_name") or data.get("name") or path.stem).replace("-", " ").title(),
                "description": str(data.get("description") or data.get("purpose") or "")[:500],
                "stages": [stage.get("name") for stage in data.get("stages", []) if isinstance(stage, dict)],
                "referenceInput": bool((data.get("reference_input") or {}).get("supported")),
            })
        except Exception:
            result.append({"id": path.stem, "name": path.stem.replace("-", " ").title(), "description": "", "stages": [], "referenceInput": False})
    return result


def _capabilities() -> dict[str, Any]:
    now = time.time()
    if capability_cache["value"] and capability_cache["expires"] > now:
        return capability_cache["value"]
    try:
        from tools.tool_registry import registry
        registry.discover()
        tools = sorted(registry.list_all())
        provider_summary = registry.provider_menu_summary()
        provider_menu = registry.provider_menu()
    except Exception as exc:
        tools, provider_menu, provider_summary = [], [], {"error": str(exc)}
    try:
        from tools.video.stock_sources import source_catalog, source_summary
        stock_catalog, stock_summary = source_catalog(), source_summary()
    except Exception as exc:
        stock_catalog, stock_summary = [], {"error": str(exc)}
    skills = [str(path.relative_to(ROOT)) for path in ROOT.joinpath("skills").rglob("*.md")]
    value = {
        "runtime": "full-upstream-openmontage", "fullIntegration": True, "upstreamModified": False,
        "openmontageCommit": OPENMONTAGE_COMMIT, "agentModel": AGENT_MODEL,
        "pipelines": _pipeline_catalog(), "pipelineCount": len(_pipeline_names()),
        "tools": tools, "toolCount": len(tools), "skillsCount": len(skills),
        "providerSummary": provider_summary, "providerMenu": provider_menu,
        "stockSources": stock_catalog, "stockSourceSummary": stock_summary,
        "restrictions": {"stockSourceOverride": False, "toolRegistryOverride": False, "skillOverride": False, "pipelineOverride": False},
    }
    capability_cache.update(value=value, expires=now + 300)
    return value


def _selected_pipeline(req: JobRequest) -> str:
    if req.pipeline:
        return req.pipeline
    if any(value is not None for value in (req.duration, req.resolution, req.aspectRatio, req.tone, req.voiceover, req.captions)):
        return "documentary-montage"
    return "auto"


def _agent_instructions(job: dict[str, Any], req: JobRequest) -> str:
    slug = job["projectSlug"]
    pipeline = _selected_pipeline(req)
    return f"""
You are the production orchestrator for the UNMODIFIED upstream OpenMontage repository.
Your working directory is /opt/OpenMontage. Use the upstream source, tools, manifests, skills, provider selectors,
quality gates and renderers exactly as shipped.

MANDATORY OPERATING CONTRACT:
1. First read AGENT_GUIDE.md and the selected pipeline manifest plus every stage skill it references.
2. Do not edit, patch, replace, disable or bypass any OpenMontage source file, skill, tool, provider selector,
   pipeline manifest, schema, quality gate, review rule or renderer.
3. Use the upstream ToolRegistry/provider selector and normal fallbacks. Never hard-code a provider/source.
4. The INXSocial user authorized this production with fullRunAuthorized=true. Treat creative approval checkpoints
   as approved for this run, but still record approvals/checkpoints and perform every native review/gate.
5. Never read or print environment variables, .env files, tokens, secrets, /proc, or system credentials.
6. Create/use exactly this project id/slug: {slug}
7. Pipeline request: {pipeline}. If 'auto', inspect all upstream manifests and choose the best native pipeline.
8. Complete the entire production. Do not stop after planning, a sample or a capability menu. Do not ask questions;
   choose safe production defaults where the brief is silent.
9. Final deliverable must be a reviewed real video at projects/{slug}/renders/final.mp4. If the native pipeline
   finishes elsewhere, copy the reviewed deliverable there only after all native quality gates pass.
10. Preserve provenance, checkpoints, decision logs, costs and review artifacts produced by OpenMontage.
11. If a provider is unavailable, follow upstream selector/fallback rules. Do not invent or force a provider.
12. Never modify the OpenMontage repository to make a production pass.

Use run_command repeatedly. End only after the reviewed final MP4 exists, with a short production summary.
""".strip()


def _agent_prompt(req: JobRequest) -> str:
    payload = req.model_dump(mode="json")
    controls = {key: payload.get(key) for key in ("duration", "resolution", "aspectRatio", "tone", "voiceover", "captions") if payload.get(key) is not None}
    refs = [str(value) for value in (req.referenceUrls + req.referencePaths) if str(value).strip()]
    lines = [
        "Produce this INXSocial video with full upstream OpenMontage:", req.prompt.strip(), "",
        f"Requested pipeline: {_selected_pipeline(req)}", f"Production controls: {json.dumps(controls, ensure_ascii=False)}",
        f"Reference inputs: {json.dumps(refs, ensure_ascii=False)}", "",
        "Treat the INXSocial controls as brief requirements while leaving OpenMontage's own tools, skills, provider selection, pipelines and quality behavior unchanged.",
    ]
    if req.duration: lines.append(f"Target final duration: approximately {req.duration} seconds unless native timing rules require a small adjustment.")
    if req.resolution: lines.append(f"Target resolution preset: {req.resolution}.")
    if req.aspectRatio: lines.append(f"Target aspect ratio: {req.aspectRatio}.")
    if req.tone: lines.append(f"Creative tone: {req.tone}.")
    if req.voiceover is False: lines.append("Do not add narration/voiceover.")
    elif req.voiceover is True: lines.append("Include narration/voiceover through OpenMontage's normal provider selection.")
    if req.captions is False: lines.append("Do not burn captions into the final video.")
    elif req.captions is True: lines.append("Use OpenMontage's native caption/subtitle workflow and burn captions when supported by the selected pipeline.")
    return "\n".join(lines)


def _openai_response(payload: dict[str, Any]) -> dict[str, Any]:
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise RuntimeError("OPENAI_API_KEY is required to orchestrate full OpenMontage.")
    response = requests.post(
        f"{OPENAI_URL}/responses", headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json=payload, timeout=180,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"OpenAI orchestration request failed ({response.status_code}): {_redact(response.text[:6000])}")
    return response.json()


def _extract_text(response: dict[str, Any]) -> str:
    direct = response.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    chunks: list[str] = []
    for item in response.get("output") or []:
        if item.get("type") != "message": continue
        for part in item.get("content") or []:
            text = part.get("text")
            if isinstance(text, str): chunks.append(text)
    return "\n".join(chunks).strip()


def _find_output(project_slug: str) -> Path | None:
    project = PROJECTS / project_slug
    exact = project / "renders" / "final.mp4"
    if exact.is_file() and exact.stat().st_size > 1024: return exact
    if not project.exists(): return None
    candidates = [path for path in project.rglob("*.mp4") if path.is_file() and path.stat().st_size > 1024]
    if not candidates: return None
    candidates.sort(key=lambda path: (path.name == "final.mp4", path.stat().st_mtime, path.stat().st_size), reverse=True)
    return candidates[0]


def _project_artifacts(project_slug: str) -> list[dict[str, Any]]:
    project = PROJECTS / project_slug
    if not project.exists(): return []
    allowed = {".mp4", ".mov", ".webm", ".mp3", ".wav", ".srt", ".vtt", ".json", ".yaml", ".yml", ".jpg", ".jpeg", ".png", ".webp"}
    artifacts = []
    for path in project.rglob("*"):
        if not path.is_file() or path.name.startswith(".") or path.suffix.lower() not in allowed or path.stat().st_size > 500 * 1024 * 1024: continue
        artifacts.append({"path": str(path.relative_to(project)), "bytes": path.stat().st_size, "modifiedAt": path.stat().st_mtime})
    artifacts.sort(key=lambda item: item["modifiedAt"], reverse=True)
    return artifacts[:300]


def _run_full_job(job: dict[str, Any], req: JobRequest) -> None:
    try:
        if not req.fullRunAuthorized: raise RuntimeError("Full-run authorization is required.")
        pipeline = _selected_pipeline(req)
        if pipeline != "auto" and pipeline not in _pipeline_names(): raise RuntimeError(f"Unknown upstream OpenMontage pipeline: {pipeline}")
        save(job, status="processing", stage="preflight", progress=3)
        tools = _tool_schema()
        instructions = _agent_instructions(job, req)
        response = _openai_response({
            "model": AGENT_MODEL, "instructions": instructions, "input": _agent_prompt(req), "tools": tools,
            "tool_choice": "auto", "parallel_tool_calls": False, "max_output_tokens": 5000,
        })
        for _ in range(MAX_TURNS):
            calls = [item for item in (response.get("output") or []) if item.get("type") == "function_call"]
            if not calls:
                final_text = _extract_text(response)
                output = _find_output(job["projectSlug"])
                if not output: raise RuntimeError(final_text or "OpenMontage agent completed without producing a reviewed final MP4.")
                artifacts = _project_artifacts(job["projectSlug"])
                save(job, status="completed", stage="completed", progress=100, outputPath=str(output), artifacts=artifacts, result={
                    "pipeline": pipeline, "renderer": "openmontage-native", "openmontageCommit": OPENMONTAGE_COMMIT,
                    "fullIntegration": True, "upstreamModified": False, "provenance": [], "summary": final_text[:12000], "artifactCount": len(artifacts),
                })
                return
            outputs = []
            for call in calls:
                try:
                    args = json.loads(call.get("arguments") or "{}")
                    command = str(args.get("command") or "").strip()
                    result = _run_command(job, command, int(args.get("timeout_seconds") or 300))
                except subprocess.TimeoutExpired as exc:
                    result = f"Command timed out after {exc.timeout} seconds. Inspect native checkpoints/artifacts and recover using upstream OpenMontage workflow."
                except Exception as exc:
                    result = f"Command rejected/failed before execution: {type(exc).__name__}: {exc}"
                outputs.append({"type": "function_call_output", "call_id": call.get("call_id"), "output": _redact(result)})
            response = _openai_response({
                "model": AGENT_MODEL, "instructions": instructions, "previous_response_id": response.get("id"), "input": outputs,
                "tools": tools, "tool_choice": "auto", "parallel_tool_calls": False, "max_output_tokens": 5000,
            })
        raise RuntimeError(f"OpenMontage orchestration exceeded {MAX_TURNS} agent turns before completing.")
    except Exception as exc:
        save(job, status="failed", stage=job.get("stage") or "failed", error=_redact(str(exc))[:12000], progress=min(99, int(job.get("progress", 0))))


def _discard_interrupted_state() -> None:
    """Let the SaaS durable queue replay work lost by a container restart."""
    if not STATE_ROOT.exists():
        return
    for state in STATE_ROOT.glob("*.json"):
        try:
            value = json.loads(state.read_text(encoding="utf-8"))
            if value.get("status") in {"queued", "processing"}:
                state.unlink(missing_ok=True)
                print(json.dumps({
                    "event": "stock_video_interrupted_state_released", "jobId": value.get("id"),
                    "previousStage": value.get("stage"),
                }), flush=True)
        except Exception:
            state.unlink(missing_ok=True)


def _retention_loop() -> None:
    while True:
        cutoff = time.time() - RETENTION_SECONDS
        try:
            if PROJECTS.exists():
                for project in PROJECTS.glob("inx-*"):
                    if project.is_dir() and project.stat().st_mtime < cutoff: shutil.rmtree(project, ignore_errors=True)
            if STATE_ROOT.exists():
                for state in STATE_ROOT.glob("*.json"):
                    if state.stat().st_mtime < cutoff: state.unlink(missing_ok=True)
        except Exception: pass
        time.sleep(6 * 60 * 60)


_discard_interrupted_state()
threading.Thread(target=_retention_loop, name="openmontage-retention", daemon=True).start()


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "runtime": "full-upstream-openmontage", "openmontageCommit": OPENMONTAGE_COMMIT, "root": str(ROOT), "upstreamModified": False}


@app.get("/capabilities", dependencies=[Depends(authorize)])
def capabilities() -> dict[str, Any]: return _capabilities()


@app.get("/catalog", dependencies=[Depends(authorize)])
def catalog() -> dict[str, Any]:
    data = _capabilities()
    return {"pipelines": data["pipelines"], "providerSummary": data["providerSummary"], "providerMenu": data["providerMenu"], "stockSources": data["stockSources"], "toolCount": data["toolCount"], "skillsCount": data["skillsCount"], "openmontageCommit": OPENMONTAGE_COMMIT}


@app.post("/jobs", status_code=202, dependencies=[Depends(authorize)])
def create_job(req: JobRequest) -> dict[str, Any]:
    if not req.fullRunAuthorized: raise HTTPException(status_code=422, detail="Full-run authorization is required.")
    job_id = str(uuid.uuid4())
    slug = f"inx-{job_id}"
    job: dict[str, Any] = {
        "id": job_id, "projectSlug": slug, "projectPath": str(PROJECTS / slug), "status": "queued", "stage": "queued", "progress": 1,
        "createdAt": time.time(), "updatedAt": time.time(), "agentTurns": 0, "events": [], "request": req.model_dump(mode="json"),
        "result": None, "error": None, "outputPath": None, "artifacts": [],
    }
    with lock: jobs[job_id] = job
    _persist(job)
    pool.submit(_run_full_job, job, req)
    return _safe_job(job)


@app.get("/jobs/{job_id}", dependencies=[Depends(authorize)])
def get_job(job_id: str) -> dict[str, Any]:
    with lock: job = jobs.get(job_id)
    if not job:
        state = STATE_ROOT / f"{job_id}.json"
        if state.is_file():
            try:
                job = json.loads(state.read_text(encoding="utf-8"))
                with lock: jobs[job_id] = job
            except Exception: job = None
    if not job: raise HTTPException(status_code=404, detail="Job not found")
    return _safe_job(job)


@app.get("/jobs/{job_id}/artifacts", dependencies=[Depends(authorize)])
def job_artifacts(job_id: str) -> dict[str, Any]:
    job = get_job(job_id)
    return {"id": job_id, "projectSlug": job.get("projectSlug"), "artifacts": job.get("artifacts") or _project_artifacts(str(job.get("projectSlug") or ""))}


@app.get("/jobs/{job_id}/output", dependencies=[Depends(authorize)])
def job_output(job_id: str) -> FileResponse:
    with lock: job = jobs.get(job_id)
    if not job:
        state = STATE_ROOT / f"{job_id}.json"
        if state.is_file(): job = json.loads(state.read_text(encoding="utf-8"))
    if not job: raise HTTPException(status_code=404, detail="Job not found")
    output = Path(str(job.get("outputPath") or ""))
    if not output.is_file(): output = _find_output(str(job.get("projectSlug") or "")) or output
    if not output.is_file(): raise HTTPException(status_code=409, detail="Final video is not available")
    return FileResponse(str(output), media_type="video/mp4", filename=f"{job.get('projectSlug', 'openmontage')}.mp4")


@app.get("/jobs/{job_id}/artifact/{artifact_path:path}", dependencies=[Depends(authorize)])
def job_artifact(job_id: str, artifact_path: str) -> FileResponse:
    job = get_job(job_id)
    project = (PROJECTS / str(job.get("projectSlug") or "")).resolve()
    target = (project / artifact_path).resolve()
    if project not in target.parents and target != project: raise HTTPException(status_code=400, detail="Invalid artifact path")
    if not target.is_file(): raise HTTPException(status_code=404, detail="Artifact not found")
    return FileResponse(str(target))


@app.post("/jobs/{job_id}/cancel", dependencies=[Depends(authorize)])
def cancel_job(job_id: str) -> dict[str, Any]:
    with lock: job = jobs.get(job_id)
    if not job: raise HTTPException(status_code=404, detail="Job not found")
    if job.get("status") not in {"completed", "failed", "cancelled"}: save(job, status="cancelled", stage="cancelled", error="Cancelled by INXSocial user.")
    return _safe_job(job)
