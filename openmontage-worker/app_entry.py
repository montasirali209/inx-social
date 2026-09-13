"""Schema-compatible entrypoint for the INXSocial OpenMontage worker.

The pinned OpenMontage runtime validates a handful of checkpoint artifacts against
strict JSON schemas.  INXSocial keeps richer runtime-only fields in its working
objects, so this adapter writes a schema-safe checkpoint copy without mutating
those richer objects used later by the render pipeline.
"""
from __future__ import annotations

from typing import Any

import main as worker

_original_write_stage = worker.write_stage


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _script(artifact: dict[str, Any]) -> dict[str, Any]:
    cursor = 0.0
    sections: list[dict[str, Any]] = []
    for index, raw in enumerate(artifact.get("sections") or []):
        if not isinstance(raw, dict):
            continue
        start = _number(raw.get("start_seconds"), cursor)
        duration = _number(raw.get("duration_seconds"), 0.0)
        end = _number(raw.get("end_seconds"), start + duration)
        if end < start:
            end = start
        section = {
            "id": str(raw.get("id") or f"section_{index + 1:02d}"),
            "text": str(raw.get("text") or ""),
            "start_seconds": round(start, 3),
            "end_seconds": round(end, 3),
        }
        if raw.get("label"):
            section["label"] = str(raw["label"])
        sections.append(section)
        cursor = end

    total = cursor
    if total < 1:
        total = max(1.0, _number(artifact.get("total_duration_seconds") or artifact.get("target_duration_seconds"), 1.0))
    metadata = dict(artifact.get("metadata") or {})
    if artifact.get("word_count") is not None:
        metadata["word_count"] = artifact.get("word_count")
    if artifact.get("target_duration_seconds") is not None:
        metadata["target_duration_seconds"] = artifact.get("target_duration_seconds")
    return {
        "version": "1.0",
        "title": str(artifact.get("title") or "Untitled"),
        "total_duration_seconds": round(total, 3),
        "sections": sections,
        "metadata": metadata,
    }


def _scene_plan(artifact: dict[str, Any]) -> dict[str, Any]:
    allowed_types = {"talking_head", "broll", "animation", "character_scene", "diagram", "text_card", "transition", "generated", "screen_recording"}
    allowed_sizes = {"extreme_wide", "wide", "medium_wide", "medium", "medium_close", "close_up", "extreme_close_up", "over_shoulder", "insert", "establishing"}
    allowed_movement = {"static", "pan_left", "pan_right", "tilt_up", "tilt_down", "dolly_in", "dolly_out", "tracking_left", "tracking_right", "crane_up", "crane_down", "handheld", "steadicam", "whip_pan", "orbital", "zoom_in", "zoom_out", "rack_focus"}
    movement_alias = {"slow_push": "dolly_in", "tracking": "tracking_right"}
    allowed_roles = {"establish_context", "introduce_subject", "build_tension", "deliver_payload", "transition", "emotional_beat", "evidence", "comparison", "resolution", "call_to_action"}
    scenes: list[dict[str, Any]] = []
    for index, raw in enumerate(artifact.get("scenes") or []):
        if not isinstance(raw, dict):
            continue
        scene = {
            "id": str(raw.get("id") or f"scene_{index + 1:02d}"),
            "type": raw.get("type") if raw.get("type") in allowed_types else "broll",
            "description": str(raw.get("description") or "Stock footage scene"),
            "start_seconds": max(0.0, _number(raw.get("start_seconds"))),
            "end_seconds": max(0.0, _number(raw.get("end_seconds"))),
        }
        for key in ("script_section_id", "framing", "movement", "transition_in", "transition_out", "overlay_notes", "shot_intent", "information_role"):
            if raw.get(key) is not None:
                scene[key] = str(raw[key])
        if raw.get("narrative_role") in allowed_roles:
            scene["narrative_role"] = raw["narrative_role"]
        if isinstance(raw.get("hero_moment"), bool):
            scene["hero_moment"] = raw["hero_moment"]
        shot = raw.get("shot_language") if isinstance(raw.get("shot_language"), dict) else {}
        safe_shot: dict[str, Any] = {}
        if shot.get("shot_size") in allowed_sizes:
            safe_shot["shot_size"] = shot["shot_size"]
        movement = movement_alias.get(str(shot.get("camera_movement") or ""), shot.get("camera_movement"))
        if movement in allowed_movement:
            safe_shot["camera_movement"] = movement
        if safe_shot:
            scene["shot_language"] = safe_shot
        required_assets = []
        for item in raw.get("required_assets") or []:
            if not isinstance(item, dict):
                continue
            source = item.get("source") if item.get("source") in {"generate", "source", "provided", "record"} else "source"
            required_assets.append({
                "type": str(item.get("type") or "video"),
                "description": str(item.get("description") or scene["description"]),
                "source": source,
            })
        if required_assets:
            scene["required_assets"] = required_assets
        scenes.append(scene)
    safe = {"version": "1.0", "scenes": scenes}
    if artifact.get("style_playbook"):
        safe["style_playbook"] = str(artifact["style_playbook"])
    if isinstance(artifact.get("metadata"), dict):
        safe["metadata"] = artifact["metadata"]
    return safe


def _asset_manifest(artifact: dict[str, Any]) -> dict[str, Any]:
    allowed_types = {"image", "video", "audio", "narration", "music", "sfx", "diagram", "animation", "3d_asset", "3d_world", "code_snippet", "subtitle", "font", "lut"}
    optional = {"prompt", "seed", "model", "cost_usd", "duration_seconds", "resolution", "format", "quality_score", "subtype", "generation_summary", "provider", "license", "original_url"}
    assets: list[dict[str, Any]] = []
    for index, raw in enumerate(artifact.get("assets") or []):
        if not isinstance(raw, dict):
            continue
        asset = {
            "id": str(raw.get("id") or f"asset_{index + 1:02d}"),
            "type": raw.get("type") if raw.get("type") in allowed_types else "video",
            "path": str(raw.get("path") or ""),
            "source_tool": str(raw.get("source_tool") or "inxsocial"),
            "scene_id": str(raw.get("scene_id") or "scene_01"),
        }
        for key in optional:
            if raw.get(key) is not None:
                asset[key] = raw[key]
        assets.append(asset)
    safe = {"version": "1.0", "assets": assets}
    if artifact.get("total_cost_usd") is not None:
        safe["total_cost_usd"] = max(0.0, _number(artifact["total_cost_usd"]))
    if isinstance(artifact.get("metadata"), dict):
        safe["metadata"] = artifact["metadata"]
    return safe


def _edit_decisions(artifact: dict[str, Any]) -> dict[str, Any]:
    cuts: list[dict[str, Any]] = []
    allowed_cut = {"id", "source", "in_seconds", "out_seconds", "speed", "layer", "transition_in", "transition_out", "transition_duration", "backgroundColor", "reason"}
    for raw in artifact.get("cuts") or []:
        if not isinstance(raw, dict):
            continue
        cut = {key: raw[key] for key in allowed_cut if key in raw}
        cut.setdefault("id", f"cut_{len(cuts) + 1:02d}")
        cut.setdefault("source", "")
        cut["in_seconds"] = max(0.0, _number(cut.get("in_seconds")))
        cut["out_seconds"] = max(0.0, _number(cut.get("out_seconds")))
        if cut.get("layer") not in {None, "primary", "overlay", "background"}:
            cut["layer"] = "primary"
        cuts.append(cut)
    safe: dict[str, Any] = {
        "version": "1.0",
        "cuts": cuts,
        "render_runtime": artifact.get("render_runtime") if artifact.get("render_runtime") in {"remotion", "hyperframes", "ffmpeg"} else "remotion",
    }
    if artifact.get("renderer_family") in {"explainer-data", "explainer-teacher", "cinematic-trailer", "documentary-montage", "product-reveal", "screen-demo", "presenter", "animation-first"}:
        safe["renderer_family"] = artifact["renderer_family"]
    audio = artifact.get("audio") if isinstance(artifact.get("audio"), dict) else {}
    music = audio.get("music") if isinstance(audio.get("music"), dict) else None
    if music:
        safe["audio"] = {"music": {key: music[key] for key in ("asset_id", "volume", "fade_in_seconds", "fade_out_seconds", "ducking") if key in music}}
    subtitles = artifact.get("subtitles") if isinstance(artifact.get("subtitles"), dict) else {}
    if subtitles:
        style = subtitles.get("style") if isinstance(subtitles.get("style"), dict) else {}
        safe["subtitles"] = {
            "enabled": bool(subtitles.get("enabled")),
            "style": "sentence",
            "source": str(subtitles.get("source") or ""),
            "position": subtitles.get("position") if subtitles.get("position") in {"top-center", "bottom-center", "center"} else "bottom-center",
            "font": str(style.get("font") or "DejaVu Sans"),
            "font_size": int(style.get("font_size") or 16),
            "color": str(style.get("primary_color") or "#FFFFFF"),
            "outline_color": str(style.get("outline_color") or "#000000"),
            "background": str(style.get("back_color") or "#00000088"),
            "max_words_per_line": 4,
        }
    if isinstance(artifact.get("metadata"), dict):
        safe["metadata"] = artifact["metadata"]
    return safe


def _render_report(artifact: dict[str, Any]) -> dict[str, Any]:
    output_keys = {"path", "format", "codec", "audio_codec", "resolution", "fps", "duration_seconds", "file_size_bytes", "platform_target"}
    outputs = []
    for raw in artifact.get("outputs") or []:
        if isinstance(raw, dict):
            outputs.append({key: raw[key] for key in output_keys if key in raw})
    safe: dict[str, Any] = {"version": "1.0", "outputs": outputs}
    for key in ("render_time_seconds", "warnings", "verification_notes", "metadata"):
        if key in artifact:
            safe[key] = artifact[key]
    grammar = artifact.get("render_grammar")
    allowed = {"explainer-data", "explainer-teacher", "cinematic-trailer", "documentary-montage", "product-reveal", "screen-demo", "presenter", "animation-first"}
    safe["render_grammar"] = grammar if grammar in allowed else "documentary-montage"
    return safe


def _schema_safe_artifact(name: str, artifact: dict[str, Any]) -> dict[str, Any]:
    if name == "script":
        return _script(artifact)
    if name == "scene_plan":
        return _scene_plan(artifact)
    if name == "asset_manifest":
        return _asset_manifest(artifact)
    if name == "edit_decisions":
        return _edit_decisions(artifact)
    if name == "render_report":
        return _render_report(artifact)
    return artifact


def write_stage(job: dict[str, Any], stage: str, artifact_name: str, artifact: dict[str, Any], progress: int) -> None:
    return _original_write_stage(job, stage, artifact_name, _schema_safe_artifact(artifact_name, artifact), progress)


# Functions in main.py resolve this global at call time, so replacing it here
# fixes every checkpoint write while leaving the render-time working structures
# unchanged for the rest of the pipeline.
worker.write_stage = write_stage
app = worker.app
