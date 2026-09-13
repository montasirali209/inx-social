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

PROFESSIONAL_VIDEO_SOURCES = ("pexels", "pixabay_video")
DISABLED_ARCHIVE_SOURCES = ("wikimedia", "archive_org", "nasa", "nara", "loc")
CREDIT_SCREEN_SECONDS = 1.5
REMOTION_TIMEOUT_MS = max(60_000, min(600_000, int(os.environ.get("OPENMONTAGE_REMOTION_TIMEOUT_MS", "180000"))))


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
    workflow: str = Field(default="inx-stock-montage", max_length=80)


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
    client = OpenAI(timeout=45.0, max_retries=1)
    response = client.chat.completions.create(
        model=os.environ.get("OPENMONTAGE_TEXT_MODEL", "gpt-4o-mini"),
        messages=[{"role": "system", "content": system}, {"role": "user", "content": json.dumps(user)}],
        response_format={"type": "json_object"},
        temperature=0.35,
    )
    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)


def current_us_hashtags(plan: dict[str, Any]) -> list[str]:
    """Resolve current, topic-relevant US tags without ever inventing a trend."""
    fallback = [str(tag).lstrip("#") for tag in plan.get("hashtags", []) if str(tag).strip()][:8]
    if not os.environ.get("OPENAI_API_KEY"):
        return fallback
    try:
        from openai import OpenAI
        client = OpenAI(timeout=35.0, max_retries=1)
        response = client.responses.create(
            model=os.environ.get("OPENMONTAGE_TEXT_MODEL", "gpt-4o-mini"),
            tools=[{"type": "web_search", "user_location": {"type": "approximate", "country": "US"}}],
            input=("Find 3 to 5 currently trending US social hashtags that are directly relevant to this video. "
                   "Never include an unrelated popular tag. Return JSON only as {\"hashtags\":[\"tag\"]}. Topic: "
                   + str(plan.get("title") or plan.get("caption") or "")[:500]),
        )
        raw = str(response.output_text or "{}").replace("```json", "").replace("```", "").strip()
        payload = json.loads(raw[raw.find("{"):raw.rfind("}") + 1])
        values = payload.get("hashtags") if isinstance(payload, dict) else []
        clean = []
        for value in values if isinstance(values, list) else []:
            tag = re.sub(r"[^A-Za-z0-9_]", "", str(value).lstrip("#"))[:60]
            if tag and tag.lower() not in {item.lower() for item in clean}:
                clean.append(tag)
        return clean[:5] or fallback
    except Exception:
        return fallback


def final_caption(plan: dict[str, Any]) -> tuple[str, list[str]]:
    tags = current_us_hashtags(plan)
    base = str(plan.get("caption") or "").strip()
    existing = {token.lower().lstrip("#") for token in re.findall(r"#[A-Za-z0-9_]+", base)}
    suffix = " ".join(f"#{tag}" for tag in tags if tag.lower() not in existing)
    return "\n\n".join(part for part in (base, suffix) if part), tags


def fallback_plan(req: JobRequest) -> dict[str, Any]:
    count = 4 if req.duration <= 15 else 6 if req.duration <= 30 else 8
    hold = max(1.0, (req.duration - CREDIT_SCREEN_SECONDS) / count)
    subject = re.sub(r"^(?:please\s+)?(?:make|create|generate)(?:\s+me)?\s+(?:a\s+)?(?:\d+[- ]?second\s+)?(?:short\s+)?video\s+(?:about|of|showing)?\s*", "", req.prompt.strip(), flags=re.I)
    subject = subject.rstrip(".!? ") or "a meaningful human story"
    subject = " ".join(subject.split()[:18])
    if re.search(r"\bkarma|revenge|wrong(?:doing| doing)|mean (?:woman|character)\b", subject, re.I):
        title = "When Her Cruelty Came Back Around"
        caption = "She treated kindness like weakness—until every choice returned to her. A short story about consequences, accountability and change."
        hashtags = ["karma", "lifeLesson", "shortStory", "accountability", "INXSocial"]
        scene_narration = [
            "She confused cruelty with strength, using every room to make other people feel small.",
            "At work, she dismissed warnings and humiliated the people who had once supported her.",
            "One by one, trust disappeared, and the doors she controlled began closing around her.",
            "When she finally needed help, nobody was willing to risk believing her promises.",
            "Alone with the consequences, she understood that karma was not magic, but memory.",
            "Her apology could not erase the harm, but changing her actions became a beginning.",
            "She began repairing trust through quiet choices, without expecting immediate forgiveness.",
            "For the first time, she treated respect as strength and carried the lesson forward.",
        ]
        searches = ["confident woman office", "woman arguing coworker", "sad colleague alone", "tense business meeting",
                    "woman rejected doorway", "regretful woman alone", "woman sincere apology", "peaceful woman sunrise"]
    else:
        keywords = [word.lower() for word in re.findall(r"[A-Za-z0-9]+", subject)
                    if word.lower() not in {"a", "an", "the", "and", "or", "to", "for", "with", "from", "that", "this", "video"}][:5]
        topic = " ".join(keywords) or "people everyday life"
        title = subject[:90].capitalize()
        caption = f"A concise visual story exploring {subject}, why it matters, and what viewers can take from it."
        hashtags = [*keywords[:3], "story", "INXSocial"]
        scene_narration = [
            f"Our story begins with {subject}, seen first through one clear and familiar moment.",
            "Looking closer reveals the people, choices, and small details that shape what happens next.",
            "The first challenge changes the direction of the story and raises the stakes.",
            "A deliberate response replaces hesitation, turning a difficult moment into forward motion.",
            "Progress arrives through several small decisions rather than one sudden transformation.",
            "By the end, the lesson is practical: understand the moment, then choose the next step with purpose.",
            "The people involved carry that change into the way they face the next challenge.",
            "A final quiet image leaves viewers with one clear action they can remember.",
        ]
        searches = [f"{topic} people", f"{topic} close up", f"{topic} daily life", f"{topic} action",
                    f"{topic} challenge", f"{topic} reflection", f"{topic} positive change", f"{topic} hopeful ending"]
    scene_narration = scene_narration[:count]
    if req.duration >= 60:
        extensions = [
            "Its meaning has time to settle.",
            "A closer detail changes perspective.",
            "The change becomes clearly visible.",
            "That consequence carries into the next scene.",
        ]
        scene_narration = [f"{line} {extensions[index % len(extensions)]}" for index, line in enumerate(scene_narration)]
    target_words = max(count * 5, round((req.duration - CREDIT_SCREEN_SECONDS) * 2.35))
    words_per_scene = max(5, round(target_words / count))
    scene_narration = [" ".join(line.split()[:words_per_scene]).rstrip(",;:.") + "." for line in scene_narration]
    narration = " ".join(scene_narration)
    return {
        "title": title, "hook": narration.split(".", 1)[0], "caption": caption, "hashtags": hashtags,
        "narration": narration, "thematicQuestion": f"What can {subject[:80]} teach us?",
        "scenes": [{"description": f"Cinematic real footage: {query}", "query": query, "queries": [query],
                    "narration": scene_narration[index], "seconds": hold}
                   for index, query in enumerate(searches[:count])],
    }


def normalize_queries(raw: Any, fallback: str = "") -> list[str]:
    values = raw if isinstance(raw, list) else [raw]
    queries: list[str] = []
    for value in values:
        cleaned = re.sub(r"[^A-Za-z0-9' -]+", " ", str(value or ""))
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if cleaned and cleaned.lower() not in {item.lower() for item in queries}:
            queries.append(" ".join(cleaned.split()[:5]))
    if not queries and fallback:
        queries = [" ".join(re.sub(r"[^A-Za-z0-9' -]+", " ", fallback).split()[:5])]
    return queries[:3]


def normalize_plan(plan: dict[str, Any], req: JobRequest) -> dict[str, Any]:
    raw_scenes = plan.get("scenes")
    if not isinstance(raw_scenes, list) or len(raw_scenes) < 3:
        raise ValueError("invalid scene plan")
    scenes: list[dict[str, Any]] = []
    for raw in raw_scenes[:8]:
        if not isinstance(raw, dict):
            continue
        description = str(raw.get("description") or raw.get("query") or "").strip()
        queries = normalize_queries(raw.get("queries") or raw.get("query"), description)
        if not queries:
            continue
        if any(re.search(r"\b(?:make|create|generate)\b.*\bvideo\b", query, re.I) for query in queries):
            raise ValueError("planner returned production instructions as a footage query")
        scenes.append({
            "description": description or queries[0],
            "query": queries[0],
            "queries": queries,
            "narration": str(raw.get("narration") or "").strip(),
        })
    if len(scenes) < 3:
        raise ValueError("planner returned too few usable scenes")

    narration = str(plan.get("narration") or "").strip()
    scene_script = " ".join(scene["narration"] for scene in scenes if scene["narration"]).strip()
    if not narration:
        narration = scene_script
    spoken_duration = max(10.0, req.duration - CREDIT_SCREEN_SECONDS)
    minimum_words = max(24, int(spoken_duration * 1.9))
    maximum_words = int(spoken_duration * 2.75)
    normalized_prompt = re.sub(r"\W+", " ", req.prompt).strip().lower()
    normalized_narration = re.sub(r"\W+", " ", narration).strip().lower()
    if len(narration.split()) < minimum_words or len(narration.split()) > maximum_words or normalized_narration == normalized_prompt:
        raise ValueError("planner returned narration with invalid timing")

    if any(not scene["narration"] for scene in scenes):
        sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", narration) if part.strip()]
        buckets = ["" for _ in scenes]
        for index, sentence in enumerate(sentences):
            slot = min(len(scenes) - 1, int(index * len(scenes) / max(1, len(sentences))))
            buckets[slot] = f"{buckets[slot]} {sentence}".strip()
        for index, scene in enumerate(scenes):
            scene["narration"] = scene["narration"] or buckets[index]
    if any(not scene["narration"] for scene in scenes):
        raise ValueError("planner did not map narration to every scene")
    final_narration = " ".join(scene["narration"] for scene in scenes)
    if len(final_narration.split()) < minimum_words or len(final_narration.split()) > maximum_words:
        raise ValueError("scene narration does not match the requested duration")

    # Spoken-word weight drives the cut timing so the picture, voice, and captions
    # advance together instead of letting narration finish early over unrelated B-roll.
    weights = [max(1, len(scene["narration"].split())) for scene in scenes]
    floor = min(2.5, spoken_duration / len(scenes))
    free = max(0.0, spoken_duration - floor * len(scenes))
    weight_total = sum(weights)
    assigned = 0.0
    for index, scene in enumerate(scenes):
        seconds = floor + free * weights[index] / weight_total
        if index == len(scenes) - 1:
            seconds = spoken_duration - assigned
        scene["seconds"] = round(seconds, 3)
        assigned += scene["seconds"]
    plan["scenes"] = scenes
    plan["narration"] = final_narration
    return plan


def create_plan(req: JobRequest) -> dict[str, Any]:
    if not os.environ.get("OPENAI_API_KEY"):
        return normalize_plan(fallback_plan(req), req)
    try:
        plan = json_completion(
            "You are a professional short-form stock-video scriptwriter and scene director. Return JSON only with title, hook, caption, hashtags (without #), narration, thematicQuestion, and scenes. Produce 4-8 chronological story beats. Every scene must have description, queries (an array of 2-3 alternative concrete stock-search phrases of 2-5 words each), narration (the exact spoken line for that scene), and seconds. The narration must form a complete hook, setup, development, turn, and landing; never repeat the user's production instruction. Write 1.9-2.5 spoken words per requested second and use a measured natural voice. Each scene's footage must literally illustrate its own narration using searchable people, actions, places, and objects—not abstract feelings. Avoid factual claims that require sources. Caption is a polished social post, not the prompt. Hashtags must be specific and relevant.",
            {**req.model_dump(), "targetNarrationWords": round((req.duration - CREDIT_SCREEN_SECONDS) * 2.2)},
        )
        return normalize_plan(plan, req)
    except Exception:
        return normalize_plan(fallback_plan(req), req)


def normalize_script_payload(payload: dict[str, Any], selected_ui_duration: Any = None) -> dict[str, Any]:
    """Guarantee the upstream script schema before any checkpoint validator sees it."""
    normalized = dict(payload or {})
    applied = False
    normalized.setdefault("version", "1.0")
    normalized.setdefault("title", "Untitled video")
    if not isinstance(normalized.get("sections"), list):
        normalized["sections"] = []
        applied = True

    duration = normalized.get("total_duration_seconds")
    if duration is None:
        duration = normalized.get("target_duration_seconds")
    if duration is None:
        duration = selected_ui_duration
    if duration is None:
        duration = sum(float(section.get("duration_seconds") or 0) for section in normalized["sections"] if isinstance(section, dict))
    try:
        duration = float(duration)
    except (TypeError, ValueError):
        duration = 0.0
    if duration <= 0:
        raise ValueError("Script duration could not be resolved from the request or generated sections")
    if normalized.get("total_duration_seconds") != duration:
        normalized["total_duration_seconds"] = duration
        applied = True

    print(json.dumps({
        "event": "script_schema_normalization",
        "normalization_applied": applied,
        "selected_ui_duration": selected_ui_duration,
        "normalized_script_payload": normalized,
    }, ensure_ascii=False), flush=True)
    return normalized


def write_stage(job: dict[str, Any], stage: str, artifact_name: str, artifact: dict[str, Any], progress: int) -> None:
    if artifact_name == "script":
        artifact = normalize_script_payload(artifact, (job.get("request") or {}).get("duration"))
    write_checkpoint(PROJECTS, job["id"], stage, "completed", {artifact_name: artifact},
                     pipeline_type="inx-stock-montage", style_playbook="clean-professional",
                     checkpoint_policy="auto_noncreative", human_approved=True,
                     metadata={"full_run_authorized": True, "inx_progress": progress})
    save(job, stage=stage, progress=progress)


def probe(path: str) -> dict[str, Any]:
    output = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "json", path], text=True)
    return json.loads(output).get("format", {})


def timestamp(value: float) -> str:
    ms = int(max(0, value) * 1000)
    hours, remainder = divmod(ms, 3600000)
    minutes, remainder = divmod(remainder, 60000)
    seconds, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def scene_srt(scenes: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    cue = 1
    for scene in scenes:
        words = str(scene.get("narration") or "").split()
        if not words:
            continue
        chunks = [" ".join(words[index:index + 4]) for index in range(0, len(words), 4)]
        start = float(scene["start_seconds"])
        end = float(scene["end_seconds"])
        speaking_end = max(start + 0.2, end - 0.15)
        elapsed = 0
        for chunk in chunks:
            cue_start = start + (speaking_end - start) * elapsed / len(words)
            elapsed += len(chunk.split())
            cue_end = start + (speaking_end - start) * elapsed / len(words)
            lines.extend([str(cue), f"{timestamp(cue_start)} --> {timestamp(cue_end)}", chunk, ""])
            cue += 1
    return "\n".join(lines)


def atempo_chain(factor: float) -> str:
    parts: list[str] = []
    while factor < 0.5:
        parts.append("atempo=0.5")
        factor /= 0.5
    while factor > 2.0:
        parts.append("atempo=2.0")
        factor /= 2.0
    parts.append(f"atempo={factor:.4f}")
    return ",".join(parts)


def fit_narration(project: Path, narration_path: str, duration: float) -> tuple[str, float, float]:
    source_duration = float(probe(narration_path).get("duration") or 0)
    if source_duration <= 0:
        return narration_path, source_duration, source_duration
    target = max(1.0, float(duration))
    output = project / "assets" / "audio" / "narration-timed.m4a"
    output.parent.mkdir(parents=True, exist_ok=True)
    tempo = source_duration / target
    command = [
        "ffmpeg", "-y", "-i", narration_path, "-af",
        f"{atempo_chain(tempo)},apad=pad_dur={target:.3f},atrim=duration={target:.3f}",
        "-c:a", "aac", "-b:a", "160k", str(output),
    ]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    timed_duration = float(probe(str(output)).get("duration") or 0)
    return str(output), source_duration, timed_duration


def professional_query(value: Any) -> str:
    base = re.sub(r"\s+", " ", str(value or "")).strip()
    base = re.sub(r"(?:\+?cinematic|\+?4k)\b", "", base, flags=re.I).strip()
    return f"{base} +cinematic +4k".strip()


def available_professional_sources() -> list[str]:
    from tools.video.stock_sources import available_sources
    available = {source.name for source in available_sources()}
    return [name for name in PROFESSIONAL_VIDEO_SOURCES if name in available]


def clip_relevance(clip: dict[str, Any], scene: dict[str, Any]) -> float:
    query_tokens = {
        token.lower() for token in re.findall(r"[A-Za-z]{3,}", " ".join(scene.get("queries") or []))
        if token.lower() not in {"with", "from", "into", "real", "footage", "cinematic"}
    }
    tags = str(clip.get("source_tags") or "").lower()
    matches = sum(1 for token in query_tokens if token in tags)
    provider = str(clip.get("source") or "").lower()
    provider_bonus = {"pexels": 4.0, "pixabay_video": 3.5}.get(provider, -20.0)
    human_scene = bool(query_tokens & {"woman", "man", "people", "person", "worker", "colleague", "family", "customer"})
    abstract_terms = ("animation", "simulation", "diagram", "geometric", "topological", "spin ice", "wikidata", "logo", "map")
    abstract_penalty = 8.0 if human_scene and any(term in tags for term in abstract_terms) else 0.0
    dimensions = min(int(clip.get("width") or 0), int(clip.get("height") or 0))
    quality_bonus = 1.0 if dimensions >= 720 else 0.0
    return provider_bonus + matches * 2.0 + quality_bonus - abstract_penalty


def provider_label(value: Any) -> str:
    labels = {
        "pexels": "Pexels", "pixabay_video": "Pixabay",
        "openmontage": "OpenMontage professional stock",
    }
    key = str(value or "openmontage").lower()
    return labels.get(key, str(value or "OpenMontage stock source"))


def prepare_exact_clip(project: Path, source: str, scene_id: str, seconds: float) -> str:
    """Loop short source media, then trim it to an exact millisecond cut."""
    output = project / "assets" / "video" / "prepared" / f"{scene_id}.mp4"
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-y", "-stream_loop", "-1", "-i", source, "-an",
        "-t", f"{seconds:.3f}", "-c:v", "libx264", "-preset", "veryfast",
        "-crf", "19", "-pix_fmt", "yuv420p", str(output),
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    actual = float(probe(str(output)).get("duration") or 0)
    if abs(actual - seconds) > 0.08:
        raise RuntimeError(f"Prepared clip {scene_id} missed its duration by {abs(actual - seconds):.3f}s")
    return str(output)


def pre_compose_gate(scene_rows: list[dict[str, Any]], assets: list[dict[str, Any]], duration: float) -> dict[str, Any]:
    videos = [item for item in assets if item.get("type") == "video"]
    providers = {str(item.get("provider") or "").lower() for item in videos}
    unique_sources = {str(item.get("original_url") or item.get("path") or "") for item in videos}
    coverage = {str(item.get("scene_id") or "") for item in videos}
    archive_hits = sorted(provider for provider in providers if any(term in provider for term in ("wikimedia", "archive", "nasa")))
    average_cut = sum(float(row["end_seconds"]) - float(row["start_seconds"]) for row in scene_rows) / max(1, len(scene_rows))
    slideshow_risk = round(max(0.0, min(1.0, (average_cut - 7.0) / 8.0 + max(0, len(videos) - len(unique_sources)) * 0.15)), 3)
    issues = []
    if archive_hits:
        issues.append("Disabled archive provider entered the asset manifest")
    if len(coverage) != len(scene_rows):
        issues.append("Not every scene has a prepared motion asset")
    if not providers or not all(provider in {"pexels", "pixabay"} for provider in providers):
        issues.append("Asset manifest contains a non-professional provider")
    if slideshow_risk >= 0.5:
        issues.append("Slideshow-risk threshold failed")
    report = {"version": "1.0", "passed": not issues, "issues": issues, "slideshow_risk": slideshow_risk,
              "delivery_promise": {"passed": not issues, "motion_required": True, "professional_sources_only": True,
                                   "scene_coverage": len(coverage), "scene_count": len(scene_rows), "target_duration_ms": round(duration * 1000)}}
    if issues:
        raise RuntimeError("OpenMontage pre-compose validation failed: " + "; ".join(issues))
    return report


def render_safety_gate(path: Path, width: int, height: int, target_duration: float, captions_required: bool,
                       caption_method: str | None) -> dict[str, Any]:
    raw = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size:stream=codec_type,width,height,codec_name", "-of", "json", str(path),
    ], text=True)
    details = json.loads(raw)
    streams = details.get("streams") or []
    video = next((item for item in streams if item.get("codec_type") == "video"), {})
    has_audio = any(item.get("codec_type") == "audio" for item in streams)
    actual = float((details.get("format") or {}).get("duration") or 0)
    black = subprocess.run([
        "ffmpeg", "-hide_banner", "-i", str(path), "-vf", "blackdetect=d=0.45:pix_th=0.04",
        "-an", "-f", "null", "-",
    ], capture_output=True, text=True, check=False).stderr
    black_seconds = sum(float(value) for value in re.findall(r"black_duration:([0-9.]+)", black))
    levels = subprocess.run([
        "ffmpeg", "-hide_banner", "-i", str(path), "-vn", "-af", "volumedetect", "-f", "null", "-",
    ], capture_output=True, text=True, check=False).stderr
    peak_match = re.search(r"max_volume:\s*(-?[0-9.]+) dB", levels)
    max_volume = float(peak_match.group(1)) if peak_match else None
    issues = []
    if video.get("width") != width or video.get("height") != height:
        issues.append("resolution mismatch")
    if abs(actual - target_duration) > 0.12:
        issues.append(f"duration mismatch ({actual:.3f}s)")
    if not has_audio:
        issues.append("missing audio")
    if black_seconds > 0.75:
        issues.append(f"black frames detected ({black_seconds:.2f}s)")
    if max_volume is not None and max_volume >= -0.05:
        issues.append("clipped audio peak")
    if captions_required and caption_method not in {"remotion", "ffmpeg_resilient"}:
        issues.append("missing burned-in subtitles")
    return {"passed": not issues, "issues": issues, "duration": actual, "duration_ms": round(actual * 1000),
            "black_seconds": round(black_seconds, 3), "max_volume_db": max_volume,
            "caption_engine": caption_method, "has_audio": has_audio}


def configure_remotion_timeout(tool: Any) -> None:
    """Give Chromium enough time without changing the pinned upstream source."""
    if getattr(tool, "_inx_timeout_wrapped", False):
        return
    original = tool.run_command

    def run_command(command: list[str], *, timeout: int | None = None, cwd: Path | str | None = None):
        updated = list(command)
        is_remotion_render = len(updated) >= 3 and updated[1:3] == ["remotion", "render"]
        if is_remotion_render:
            if not any(str(value).startswith("--timeout=") for value in updated):
                updated.append(f"--timeout={REMOTION_TIMEOUT_MS}")
            timeout = max(int(timeout or 0), (REMOTION_TIMEOUT_MS // 1000) + 120)
        return original(updated, timeout=timeout, cwd=cwd)

    tool.run_command = run_command
    tool._inx_timeout_wrapped = True


def grouped_credit_fallback(input_path: Path, output_path: Path, credit_text: str, duration: float) -> None:
    """Retain one grouped end-credit screen when Chromium cannot complete."""
    start = max(0.0, duration - CREDIT_SCREEN_SECONDS)
    def ass_time(seconds: float) -> str:
        centiseconds = max(0, round(seconds * 100))
        return f"{centiseconds // 360000}:{(centiseconds // 6000) % 60:02d}:{(centiseconds // 100) % 60:02d}.{centiseconds % 100:02d}"

    safe_text = credit_text.replace("{", "(").replace("}", ")").replace("\n", r"\N")
    ass_path = output_path.with_suffix(".credits.ass")
    ass_path.write_text(
        "[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n"
        "[V4+ Styles]\n"
        "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,"
        "Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,"
        "Alignment,MarginL,MarginR,MarginV,Encoding\n"
        "Style: Credits,Arial,38,&H00F8FAFC,&H00F8FAFC,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,1,0,5,80,80,80,1\n"
        "[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n"
        f"Dialogue: 0,{ass_time(start)},{ass_time(duration)},Credits,,0,0,0,,{safe_text}\n",
        encoding="utf-8",
    )
    escaped = str(ass_path).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")
    subprocess.run([
        "ffmpeg", "-y", "-i", str(input_path), "-vf",
        f"drawbox=x=0:y=0:w=iw:h=ih:color=0x073B3A@1:t=fill:enable='gte(t,{start:.3f})',subtitles='{escaped}'",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "copy", str(output_path),
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def generated_music_bed(project: Path, duration: int) -> str:
    output = project / "assets" / "music" / "generated-bed.m4a"
    output.parent.mkdir(parents=True, exist_ok=True)
    fade_out = max(0, duration - 2)
    command = [
        "ffmpeg", "-y", "-f", "lavfi", "-i",
        f"sine=frequency=110:duration={duration}:sample_rate=44100",
        "-f", "lavfi", "-i", f"sine=frequency=165:duration={duration}:sample_rate=44100",
        "-filter_complex",
        f"[0:a]volume=0.035,lowpass=f=450[a0];[1:a]volume=0.018,lowpass=f=550[a1];"
        f"[a0][a1]amix=inputs=2:duration=longest,afade=t=in:st=0:d=1,afade=t=out:st={fade_out}:d=2[a]",
        "-map", "[a]", "-t", str(duration), "-c:a", "aac", "-b:a", "128k", str(output),
    ]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return str(output)


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
                              "music_plan": {"source": "pixabay_music", "fallback": "generated_original"}, "render_runtime": "remotion"}}
        write_stage(job, "idea", "brief", brief, 12)

        script_artifact = {"version": "1.0", "title": brief["title"], "total_duration_seconds": req.duration, "target_duration_seconds": req.duration,
                           "word_count": len(str(plan.get("narration") or "").split()),
                           "sections": [{"id": f"beat_{index + 1:02d}", "text": str(scene.get("narration") or ""),
                                         "duration_seconds": float(scene.get("seconds") or 0), "visual_direction": str(scene.get("description") or "")}
                                        for index, scene in enumerate(plan["scenes"])],
                           "voice_performance": {"tone": req.tone, "pace": "measured social documentary", "target_lufs": -14}}
        write_stage(job, "script", "script", script_artifact, 17)

        cursor = 0.0; scene_rows = []
        for index, raw in enumerate(plan["scenes"]):
            seconds = float(raw["seconds"]); scene_id = f"scene_{index + 1:02d}"
            scene_rows.append({"id": scene_id, "type": "broll", "description": str(raw.get("description") or raw.get("query")),
                               "start_seconds": round(cursor, 3), "end_seconds": round(cursor + seconds, 3),
                               "narration": str(raw.get("narration") or ""),
                               "narrative_role": "establish_context" if index == 0 else "resolution" if index == len(plan["scenes"]) - 1 else "emotional_beat",
                               "information_role": "illustrate the current spoken story beat",
                               "shot_intent": str(raw.get("description") or raw.get("query")),
                               "shot_language": {"shot_size": ["wide", "medium", "close_up"][index % 3],
                                                 "camera_movement": ["slow_push", "static", "tracking"][index % 3]},
                               "hero_moment": index in {0, len(plan["scenes"]) - 1},
                               "required_assets": [{"type": "video", "description": str(raw.get("query")), "source": "source"}]})
            cursor += seconds
        scene_plan = {"version": "1.0", "style_playbook": "clean-professional", "scenes": scene_rows,
                      "metadata": {"slots": [{"slot_id": row["id"], "queries": [professional_query(query) for query in (plan["scenes"][i].get("queries") or [str(plan["scenes"][i].get("query"))])], "preferred_sources": list(PROFESSIONAL_VIDEO_SOURCES)} for i, row in enumerate(scene_rows)]}}
        write_stage(job, "scene_plan", "scene_plan", scene_plan, 22)

        search = registry.get("direct_clip_search")
        professional_sources = available_professional_sources()
        if not professional_sources:
            raise RuntimeError("Professional stock is not configured. Add PEXELS_API_KEY and/or PIXABAY_API_KEY to the OpenMontage worker.")
        search_queries = []
        for index, row in enumerate(scene_rows):
            for query in (plan["scenes"][index].get("queries") or [plan["scenes"][index].get("query")])[:2]:
                search_queries.append({"query": professional_query(query), "slot_id": row["id"], "kind": "video"})
        result = search.execute({"output_dir": str(project / "assets" / "video"),
                                 "queries": search_queries,
                                 "sources": professional_sources, "clips_per_query": 3,
                                 "filters": {"orientation": "portrait" if req.aspectRatio == "9:16" else "square" if req.aspectRatio == "1:1" else "landscape", "min_width": 1280 if req.resolution == "720p" else 1920, "min_duration": 3, "max_duration": 45},
                                 "extract_thumbnails": True, "timeout_seconds": 900})
        if not result.success:
            raise RuntimeError(result.error or "OpenMontage clip acquisition failed")
        clips = result.data.get("clips", [])
        by_slot: dict[str, dict[str, Any]] = {}
        used_urls: set[str] = set()
        unsafe_license = re.compile(r"(?:^|[- /])(?:NC|ND)(?:$|[- /])|noncommercial|no derivatives", re.I)
        safe_clips = [clip for clip in clips if not unsafe_license.search(str(clip.get("license") or ""))]
        for scene_index, row in enumerate(scene_rows):
            scene = plan["scenes"][scene_index]
            candidates = [clip for clip in safe_clips if str(clip.get("slot_id")) == row["id"]]
            ranked = sorted(candidates, key=lambda clip: clip_relevance(clip, scene), reverse=True)
            selected = next((clip for clip in ranked if clip_relevance(clip, scene) >= 2.0 and str(clip.get("source_url") or "") not in used_urls), None)
            if selected is not None:
                by_slot[row["id"]] = selected
                source_url = str(selected.get("source_url") or "")
                if source_url: used_urls.add(source_url)
        missing_rows = [row for row in scene_rows if row["id"] not in by_slot]
        if any(row["id"] not in by_slot for row in scene_rows):
            raise RuntimeError(f"OpenMontage professional-source gate could not fill {len(missing_rows)} scene(s) with unique Pexels/Pixabay footage")
        footage_warnings: list[str] = []
        write_stage(job, "stock_retrieval", "retrieval_report", {"version": "1.0", "sources": professional_sources,
                    "disabled_sources": list(DISABLED_ARCHIVE_SOURCES), "query_suffix": "+cinematic +4k",
                    "clips_considered": len(clips), "scenes_filled": len(by_slot)}, 42)

        assets = []
        for row in scene_rows:
            clip = by_slot[row["id"]]; info = probe(str(clip["path"])); duration = float(info.get("duration") or (row["end_seconds"] - row["start_seconds"]))
            wanted = float(row["end_seconds"]) - float(row["start_seconds"])
            prepared = prepare_exact_clip(project, str(clip["path"]), row["id"], wanted)
            assets.append({"id": f"asset_{row['id']}", "type": "video", "path": prepared, "source_tool": "direct_clip_search", "scene_id": row["id"],
                           "duration_seconds": wanted, "source_duration_seconds": duration, "subtype": "stock", "provider": provider_label(clip.get("source")),
                           "provider_id": str(clip.get("source_id") or clip.get("clip_id") or ""),
                           "creator": re.sub(r"<[^>]+>", "", str(clip.get("creator") or "")).strip(),
                           "search_query": str(clip.get("query") or ""),
                           "license": str(clip.get("license") or "Provider content license"), "original_url": str(clip.get("source_url") or "")})

        music_path = None; warnings = footage_warnings
        music_tool = registry.get("pixabay_music")
        if music_tool:
            music_result = music_tool.execute({"query": f"{req.tone} cinematic background", "min_duration": req.duration, "max_duration": max(req.duration * 4, 90), "output_path": str(project / "assets" / "music" / "bed.mp3")})
            if music_result.success:
                music_path = str(music_result.data.get("output")); assets.append({"id": "asset_music", "type": "music", "path": music_path, "source_tool": "pixabay_music", "scene_id": "scene_01", "provider": "pixabay_music", "license": str(music_result.data.get("license") or "Pixabay Content License"), "original_url": str(music_result.data.get("source_url") or "")})
            else: warnings.append("Royalty-free music search was unavailable; an original ambient music bed was generated for this render.")
        if not music_path:
            music_path = generated_music_bed(project, req.duration)
            assets.append({"id": "asset_music", "type": "music", "path": music_path, "source_tool": "inx_generated_music", "scene_id": "scene_01",
                           "provider": "INXSocial", "license": "Original generated audio", "original_url": ""})
        write_stage(job, "music", "music_report", {"version": "1.0", "ready": bool(music_path), "path": music_path}, 48)

        narration_path = None
        narration_duration = 0.0
        if req.voiceover and plan.get("narration") and registry.get("openai_tts"):
            voice = registry.get("openai_tts").execute({"text": str(plan["narration"]), "voice": "alloy", "instructions": f"Speak in a {req.tone.lower()}, clear documentary style at a measured 145 to 155 words per minute. Respect sentence pauses, keep the story expressive, and do not rush.", "output_path": str(project / "assets" / "audio" / "narration.mp3")})
            if voice.success:
                narration_path, original_voice_duration, narration_duration = fit_narration(project, str(voice.data.get("output")), req.duration - CREDIT_SCREEN_SECONDS)
                assets.append({"id": "asset_narration", "type": "narration", "path": narration_path, "source_tool": "openai_tts", "scene_id": "scene_01", "provider": "openai", "model": str(voice.model or "gpt-4o-mini-tts"), "cost_usd": float(voice.cost_usd or 0), "original_duration_seconds": original_voice_duration, "timed_duration_seconds": narration_duration, "timed_duration_ms": round(narration_duration * 1000)})
            else: warnings.append("Narration generation was unavailable.")
        if req.voiceover and not narration_path:
            raise RuntimeError("OpenMontage native TTS did not produce the required narration asset")
        write_stage(job, "tts", "tts_report", {"version": "1.0", "ready": bool(narration_path), "duration_seconds": narration_duration,
                    "duration_ms": round(narration_duration * 1000), "ffprobe_verified": bool(narration_path)}, 54)
        asset_manifest = {"version": "1.0", "assets": assets, "total_cost_usd": sum(float(item.get("cost_usd") or 0) for item in assets),
                          "metadata": {"search_stats": {"queries": len(scene_rows), "clips": len(clips)}, "warnings": warnings}}
        write_stage(job, "asset_ready", "asset_manifest", asset_manifest, 58)
        validation_report = pre_compose_gate(scene_rows, assets, req.duration)
        validation_report["audio_ready"] = not req.voiceover or bool(narration_path)
        validation_report["text_ready"] = bool(plan.get("narration") and plan.get("caption"))
        if not validation_report["audio_ready"] or not validation_report["text_ready"]:
            raise RuntimeError("OpenMontage pre-compose validation halted because internal text/audio assets are incomplete")
        write_stage(job, "pre_compose_validation", "validation_report", validation_report, 64)

        cuts = []
        for index, row in enumerate(scene_rows):
            asset = next(item for item in assets if item["id"] == f"asset_{row['id']}")
            wanted = row["end_seconds"] - row["start_seconds"]
            cuts.append({"id": f"cut_{index + 1:02d}", "source": asset["id"], "in_seconds": 0, "out_seconds": round(wanted, 3), "layer": "primary",
                         "transition_in": "fade_in" if index == 0 else "cut", "transition_out": "fade_out" if index == len(scene_rows) - 1 else "cut", "reason": row["description"]})
        cuts.append({"id": "cut_credits", "source": cuts[-1]["source"], "in_seconds": 0,
                     "out_seconds": CREDIT_SCREEN_SECONDS, "layer": "primary", "transition_in": "cut",
                     "transition_out": "fade_out", "reason": "Grouped source credits"})
        width, height = (720, 1280) if req.resolution == "720p" and req.aspectRatio == "9:16" else (1280, 720) if req.resolution == "720p" and req.aspectRatio == "16:9" else (720, 720) if req.resolution == "720p" else (1080, 1920) if req.aspectRatio == "9:16" else (1920, 1080) if req.aspectRatio == "16:9" else (1080, 1080)
        subtitle_path = None
        if req.captions and plan.get("narration"):
            subtitle_path = project / "assets" / "audio" / "captions.srt"; subtitle_path.write_text(scene_srt(scene_rows), encoding="utf-8")

        # The manifest requires the editorial timeline before the audio mix.
        # Keep checkpoint writes in the exact manifest order: the upstream
        # prerequisite gate deliberately rejects any stage that jumps ahead.
        edit = {"version": "1.0", "cuts": cuts, "renderer_family": "documentary-montage", "render_runtime": "remotion",
                "audio": {"music": {"asset_id": "asset_music", "volume": 0.16, "fade_in_seconds": 1, "fade_out_seconds": 2, "ducking": bool(narration_path)}} if music_path else {},
                "subtitles": {"enabled": bool(subtitle_path), "source": str(subtitle_path or ""), "position": "bottom-center",
                              "style": {"font": "DejaVu Sans", "font_size": 13 if req.aspectRatio == "9:16" else 16, "bold": True,
                                        "primary_color": "&H00FFFFFF", "outline_color": "&H00000000", "back_color": "&H78000000",
                                        "border_style": 1, "outline_width": 1.2, "shadow": 0, "margin_v": 24, "alignment": 2}},
                "metadata": {"pipeline": "inx-stock-montage", "total_duration_seconds": sum(c["out_seconds"] for c in cuts), "target_duration_seconds": req.duration,
                             "compose_target": {"width": width, "height": height, "fit": "cover"}, "proposal_render_runtime": "remotion",
                             "delivery_promise": {"promise_type": "hybrid", "motion_required": True, "source_required": True,
                                                  "tone_mode": req.tone.lower(), "quality_floor": "presentable", "approved_fallback": None}}}
        write_stage(job, "edit", "edit_decisions", edit, 68)

        mixed_audio = None
        mixer = registry.get("audio_mixer")
        mix_tracks = []
        if narration_path:
            mix_tracks.append({"path": narration_path, "role": "speech", "volume": 1.0})
        if music_path:
            mix_tracks.append({"path": music_path, "role": "music", "volume": 0.24, "fade_in_seconds": 0.8, "fade_out_seconds": 1.8})
        if mixer and mix_tracks:
            mix_result = mixer.execute({"operation": "full_mix", "tracks": mix_tracks,
                                        "ducking": {"enabled": bool(narration_path and music_path), "music_volume_during_speech": 0.14,
                                                    "attack_ms": 120, "release_ms": 650},
                                        "normalize": True, "loudnorm_target": -14, "target_duration": req.duration,
                                        "output_path": str(project / "assets" / "audio" / "mix.m4a")})
            if mix_result.success:
                mixed_audio = str(mix_result.data.get("output"))
            else:
                warnings.append("OpenMontage audio mixer fell back to the basic mix path.")
        if not mixed_audio:
            mixed_audio = mix_audio(project, narration_path, music_path, req.duration)
        if not mixed_audio or abs(float(probe(mixed_audio).get("duration") or 0) - req.duration) > 0.12:
            raise RuntimeError("OpenMontage audio mix did not match the requested duration")
        write_stage(job, "audio_mix", "audio_report", {"version": "1.0", "path": mixed_audio,
                    "duration_ms": round(float(probe(mixed_audio).get("duration") or 0) * 1000), "target_duration_ms": req.duration * 1000}, 74)

        composed_output = project / "renders" / "assembled.mp4"
        graded_output = project / "renders" / "graded.mp4"
        output = project / "renders" / "final.mp4"
        # The source assembly only needs deterministic cutting/scaling/muxing.
        # Remotion remains the preferred final caption and overlay renderer.
        assembly_edit = json.loads(json.dumps(edit))
        assembly_edit["render_runtime"] = "ffmpeg"
        assembly_edit["metadata"]["assembly_runtime"] = "ffmpeg"
        assembly_edit["metadata"]["final_overlay_runtime"] = "remotion"
        assembly_edit["metadata"]["delivery_promise"]["approved_fallback"] = "ffmpeg-source-assembly-remotion-final"
        compose = registry.get("video_compose").execute({"operation": "render", "output_path": str(composed_output), "edit_decisions": assembly_edit, "asset_manifest": asset_manifest,
                                                          "scene_plan": scene_plan["scenes"], "audio_path": mixed_audio, "subtitle_path": None,
                                                          "script_text": str(plan.get("narration") or ""), "options": {"subtitle_burn": False}})
        if not compose.success or not composed_output.is_file():
            raise RuntimeError(compose.error or "OpenMontage assembly failed")
        write_stage(job, "assembly", "assembly_report", {"version": "1.0", "path": str(composed_output),
                    "duration_ms": round(float(probe(str(composed_output)).get("duration") or 0) * 1000)}, 82)
        grade_profiles = {"cinematic": "cinematic_warm", "energetic": "high_contrast", "professional": "neutral",
                          "natural": "neutral", "friendly": "bright_clean", "confident": "cinematic_cool"}
        grade = registry.get("color_grade")
        if grade:
            grade_result = grade.execute({"input_path": str(composed_output), "output_path": str(graded_output),
                                          "profile": grade_profiles.get(req.tone.lower(), "neutral"), "intensity": 1.0,
                                          "codec": "libx264", "crf": 19})
            if not grade_result.success:
                raise RuntimeError(grade_result.error or "OpenMontage color-grade stage failed")
        else:
            raise RuntimeError("OpenMontage color-grade tool is unavailable")
        write_stage(job, "color_grade", "grade_report", {"version": "1.0", "path": str(graded_output),
                    "profile": grade_profiles.get(req.tone.lower(), "neutral")}, 87)

        providers = sorted({str(item.get("provider") or "") for item in assets if item.get("type") == "video"})
        creators = sorted({str(item.get("creator") or "Source contributor") for item in assets if item.get("type") == "video"})
        credit_text = "Footage: " + " + ".join(providers) + "\nCreators: " + ", ".join(creators[:5])
        credit_overlay = {"id": "grouped_sources", "type": "text_card", "in_seconds": req.duration - CREDIT_SCREEN_SECONDS,
                          "out_seconds": req.duration, "position": "full_overlay", "text": credit_text,
                          "backgroundColor": "#073B3A", "color": "#F8FAFC", "accentColor": "#2DD4BF", "fontSize": 32}
        remotion = registry.get("remotion_caption_burn")
        if not remotion:
            raise RuntimeError("OpenMontage Remotion caption engine is unavailable")
        configure_remotion_timeout(remotion)
        render_srt = subtitle_path
        if not render_srt:
            render_srt = project / "assets" / "audio" / "caption-placeholder.srt"
            render_srt.write_text("1\n00:00:00,000 --> 00:00:00,010\n\u200b\n", encoding="utf-8")
        try:
            caption_result = remotion.execute({"input_path": str(graded_output), "output_path": str(output),
                                               "srt_path": str(render_srt), "words_per_page": 4,
                                               "font_size": 30 if req.aspectRatio == "9:16" else 26,
                                               "highlight_color": "#2DD4BF", "overlays": [credit_overlay], "force_ffmpeg": False})
        except Exception as remotion_error:
            caption_result = type("RenderFailure", (), {"success": False, "data": {}, "error": str(remotion_error)})()
        caption_method = str(caption_result.data.get("method") or "") if caption_result.success else ""
        if not caption_result.success or not output.is_file() or caption_method != "remotion":
            fallback_captioned = project / "renders" / "final-caption-fallback.mp4"
            fallback_result = remotion.execute({"input_path": str(graded_output), "output_path": str(fallback_captioned),
                                                "srt_path": str(render_srt), "words_per_page": 4,
                                                "font_size": 30 if req.aspectRatio == "9:16" else 26,
                                                "highlight_color": "#2DD4BF", "overlays": [], "force_ffmpeg": True})
            if not fallback_result.success or not fallback_captioned.is_file():
                raise RuntimeError(fallback_result.error or caption_result.error or "Final caption render failed")
            grouped_credit_fallback(fallback_captioned, output, credit_text, float(req.duration))
            caption_method = "ffmpeg_resilient"
            warnings.append("The animated caption renderer timed out; a professional burned-in caption render was delivered instead.")
        write_stage(job, "caption_credits", "caption_report", {"version": "1.0", "engine": caption_method,
                    "words_per_screen": 4, "layout": "compact-semitransparent-lower-third", "grouped_sources": providers}, 92)

        qa_summary: dict[str, Any] = {}
        for attempt in range(2):
            qa_summary = render_safety_gate(output, width, height, req.duration, bool(req.captions and plan.get("narration")),
                                            caption_method)
            if qa_summary["passed"]:
                break
            if attempt == 0:
                retry_output = project / "renders" / "final-rebuild.mp4"
                try:
                    caption_result = remotion.execute({"input_path": str(graded_output), "output_path": str(retry_output),
                                                       "srt_path": str(render_srt), "words_per_page": 4,
                                                       "font_size": 28 if req.aspectRatio == "9:16" else 24,
                                                       "highlight_color": "#2DD4BF", "overlays": [credit_overlay], "force_ffmpeg": False})
                except Exception:
                    caption_result = type("RenderFailure", (), {"success": False, "data": {}, "error": "Remotion rebuild failed"})()
                if caption_result.success and retry_output.is_file():
                    retry_method = str(caption_result.data.get("method") or "")
                    if retry_method == "remotion":
                        shutil.move(str(retry_output), str(output))
                        caption_method = retry_method
        if not qa_summary.get("passed"):
            raise RuntimeError("OpenMontage final quality review failed after rebuild: " + "; ".join(qa_summary.get("issues") or []))
        details = probe(str(output)); actual_duration = float(details.get("duration") or 0)
        report = {"version": "1.0", "outputs": [{"path": str(output), "format": "mp4", "codec": "h264", "audio_codec": "aac", "resolution": f"{width}x{height}", "fps": 30, "duration_seconds": actual_duration, "file_size_bytes": int(details.get("size") or output.stat().st_size), "platform_target": brief["target_platform"]}],
                  "render_time_seconds": 0, "warnings": warnings, "verification_notes": [f"Deterministic source assembly, color grading, {caption_method} captions/grouped credits, and ffprobe/blackdetect/volumedetect validation completed."], "render_grammar": "narrated-stock-story", "metadata": {"runtime": caption_method, "openmontage_commit": os.environ.get("OPENMONTAGE_COMMIT"), "quality_review": qa_summary}}
        write_stage(job, "final_qa", "render_report", report, 98)
        provenance = [{"provider": item.get("provider"), "providerId": item.get("provider_id"), "sourceUrl": item.get("original_url"),
                       "creator": item.get("creator") or "Source contributor", "searchQuery": item.get("search_query"),
                       "license": item.get("license"), "sceneId": item.get("scene_id")} for item in assets if item["type"] == "video"]
        caption, hashtags = final_caption(plan)
        save(job, status="completed", stage="final_qa", progress=100, outputPath=str(output),
             result={"caption": caption, "hashtags": hashtags,
                     "script": str(plan.get("narration") or ""), "provenance": provenance, "warnings": warnings,
                     "runtime": "OpenMontage", "renderer": caption_method, "pipeline": "inx-stock-montage", "openmontageCommit": os.environ.get("OPENMONTAGE_COMMIT")})
    except Exception as exc:
        print(json.dumps({"event": "stock_video_failed", "jobId": job.get("id"), "stage": job.get("stage"),
                          "error": str(exc)[:4000]}), flush=True)
        save(job, status="failed", progress=0, error=str(exc)[:1000])


@app.get("/health")
def health() -> dict[str, Any]:
    remotion_ready = (ROOT / "remotion-composer" / "node_modules").is_dir() and bool(shutil.which("npx"))
    return {"ok": bool(shutil.which("ffmpeg")) and remotion_ready, "runtime": "OpenMontage",
            "commit": os.environ.get("OPENMONTAGE_COMMIT"), "ffmpeg": bool(shutil.which("ffmpeg")),
            "remotion": remotion_ready, "professionalSources": available_professional_sources()}


@app.get("/capabilities", dependencies=[Depends(authorize)])
def capabilities() -> dict[str, Any]:
    registry.discover()
    manifest = load_pipeline("inx-stock-montage")
    return {"runtime": "OpenMontage", "commit": os.environ.get("OPENMONTAGE_COMMIT"), "pipelines": sorted(list_pipelines()),
            "studioWorkflow": {"name": manifest["name"], "version": manifest["version"],
                               "stageCount": len(manifest["stages"]), "stages": [stage["name"] for stage in manifest["stages"]]},
            "professionalSources": available_professional_sources(), "disabledSources": list(DISABLED_ARCHIVE_SOURCES),
            "tools": sorted(registry.list_all()), "toolTiers": registry.tier_summary(), "providerMenu": registry.provider_menu_summary()}


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
