"""Resilient production entrypoint for INXSocial stock-video retrieval.

This wrapper leaves the pinned OpenMontage runtime intact but makes provider
retrieval tolerant of sparse search results. It keeps Pexels/Pixabay as the only
video sources, corrects portrait/square resolution filtering, retries missing
scene slots with broader stock-friendly queries, and finally lets unused clips
from the same professional-source pool fill otherwise empty slots.
"""
from __future__ import annotations

import json
import re
from typing import Any

import app_entry as schema_entry
import main as worker

_original_registry_get = worker.registry.get

_ROLE_FALLBACKS = (
    "people city daily life",
    "concerned family indoors",
    "serious people discussion",
    "public safety city street",
    "family support home",
    "community awareness people",
    "people working together",
    "hopeful family outdoors",
)


def _clean_query(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"(?:\+?cinematic|\+?4k)\b", " ", text, flags=re.I)
    text = re.sub(r"[^A-Za-z0-9' -]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _clip_key(clip: dict[str, Any]) -> str:
    provider = str(clip.get("source") or "")
    source_url = str(clip.get("source_url") or "")
    source_id = str(clip.get("source_id") or clip.get("clip_id") or "")
    path = str(clip.get("path") or "")
    return "|".join((provider, source_url or source_id or path))


def _merge_clips(current: list[dict[str, Any]], extra: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged = list(current)
    seen = {(_clip_key(item), str(item.get("slot_id") or "")) for item in merged}
    for clip in extra:
        key = (_clip_key(clip), str(clip.get("slot_id") or ""))
        if key in seen:
            continue
        seen.add(key)
        merged.append(clip)
    return merged


def _slot_queries(payload: dict[str, Any]) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {}
    for item in payload.get("queries") or []:
        if not isinstance(item, dict):
            continue
        slot = str(item.get("slot_id") or "").strip()
        query = _clean_query(item.get("query"))
        if not slot:
            continue
        grouped.setdefault(slot, [])
        if query and query.lower() not in {value.lower() for value in grouped[slot]}:
            grouped[slot].append(query)
    return grouped


def _covered_slots(clips: list[dict[str, Any]]) -> set[str]:
    return {
        str(clip.get("slot_id") or "")
        for clip in clips
        if str(clip.get("slot_id") or "") and clip.get("path")
    }


def _relaxed_filters(payload: dict[str, Any]) -> dict[str, Any]:
    filters = dict(payload.get("filters") or {})
    orientation = str(filters.get("orientation") or "").lower()
    minimum = int(filters.get("min_width") or 0)

    # The base worker used landscape-width thresholds for every aspect ratio.
    # That incorrectly rejects normal 720x1280 and 1080x1920 portrait footage.
    if orientation in {"portrait", "square"}:
        if minimum >= 1900:
            filters["min_width"] = 1080
        elif minimum >= 1200:
            filters["min_width"] = 720

    filters["min_duration"] = min(float(filters.get("min_duration") or 3), 2)
    filters["max_duration"] = max(float(filters.get("max_duration") or 45), 60)
    return filters


def _supplemental_queries(
    grouped: dict[str, list[str]],
    missing: list[str],
) -> list[dict[str, str]]:
    result: list[dict[str, str]] = []
    slot_order = list(grouped)
    for slot in missing:
        originals = grouped.get(slot) or []
        index = slot_order.index(slot) if slot in slot_order else len(result)
        broad = _ROLE_FALLBACKS[index % len(_ROLE_FALLBACKS)]
        candidates: list[str] = []

        for original in originals:
            if original:
                candidates.append(original)
                tokens = [
                    token for token in re.findall(r"[A-Za-z0-9']+", original)
                    if token.lower() not in {
                        "story", "about", "video", "cinematic", "footage", "increased",
                        "increase", "showing", "scene", "real", "close", "action",
                    }
                ]
                if tokens:
                    candidates.append(" ".join(tokens[:3] + ["people"]))

        candidates.extend((broad, "people daily life", "city people outdoors"))

        seen: set[str] = set()
        for query in candidates:
            clean = _clean_query(query)
            if not clean or clean.lower() in seen:
                continue
            seen.add(clean.lower())
            result.append({"query": clean, "slot_id": slot, "kind": "video"})
            if len(seen) >= 4:
                break
    return result


class _ResilientDirectClipSearch:
    def __init__(self, tool: Any) -> None:
        self._tool = tool

    def execute(self, payload: dict[str, Any]) -> Any:
        working = dict(payload)
        working["filters"] = _relaxed_filters(payload)
        working["clips_per_query"] = max(5, int(payload.get("clips_per_query") or 3))

        result = self._tool.execute(working)
        if not getattr(result, "success", False):
            return result

        data = getattr(result, "data", None)
        if not isinstance(data, dict):
            return result

        clips = list(data.get("clips") or [])
        grouped = _slot_queries(working)
        missing = [slot for slot in grouped if slot not in _covered_slots(clips)]

        if missing:
            retry_payload = dict(working)
            retry_payload["queries"] = _supplemental_queries(grouped, missing)
            retry_payload["clips_per_query"] = max(6, int(working.get("clips_per_query") or 5))
            retry = self._tool.execute(retry_payload)
            if getattr(retry, "success", False) and isinstance(getattr(retry, "data", None), dict):
                clips = _merge_clips(clips, list(retry.data.get("clips") or []))

        missing = [slot for slot in grouped if slot not in _covered_slots(clips)]
        if missing:
            # Last-resort reassignment uses only already-downloaded Pexels/Pixabay
            # clips and never invents or enables another source. Main.py still
            # applies its licence, relevance and unique-source checks afterwards.
            professional = [
                clip for clip in clips
                if str(clip.get("source") or "").lower() in {"pexels", "pixabay_video"}
                and clip.get("path")
            ]
            for slot in missing:
                for clip in professional:
                    clone = dict(clip)
                    clone["slot_id"] = slot
                    clips = _merge_clips(clips, [clone])

        data["clips"] = clips
        print(json.dumps({
            "event": "stock_retrieval_resilience",
            "scene_slots": len(grouped),
            "clips_returned": len(clips),
            "covered_slots": len(_covered_slots(clips)),
            "orientation": (working.get("filters") or {}).get("orientation"),
            "min_width": (working.get("filters") or {}).get("min_width"),
        }), flush=True)
        return result


def _registry_get(name: str) -> Any:
    tool = _original_registry_get(name)
    if name == "direct_clip_search" and tool is not None:
        return _ResilientDirectClipSearch(tool)
    return tool


worker.registry.get = _registry_get
app = schema_entry.app
