"""INXSocial compatibility surface for the full, unchanged OpenMontage engine.

This module keeps the existing INXSocial backend contract stable while routing
new productions through the complete upstream pipeline/tool/skill/provider
catalog exposed by full_bridge.

The compatibility layer also protects long-running productions from temporary
LLM orchestration throttling and keeps tool transcripts compact enough that
multi-turn agent runs do not unnecessarily consume the organisation TPM budget.
The upstream OpenMontage repository itself remains unchanged.
"""
from __future__ import annotations

import re
import time
from typing import Any

from fastapi import HTTPException

import full_bridge as bridge

_native_capabilities = bridge._capabilities
_native_openai_response = bridge._openai_response
_native_run_command = bridge._run_command

MAX_ORCHESTRATION_RETRIES = 8
MAX_TOOL_CONTEXT_CHARS = 8000


def _retry_delay(message: str, attempt: int) -> float:
    """Honor provider retry hints, otherwise use bounded exponential backoff."""
    match = re.search(r"try again in\s+([0-9]+(?:\.[0-9]+)?)s", message, re.I)
    if match:
        try:
            return min(90.0, max(1.0, float(match.group(1)) + 1.0))
        except ValueError:
            pass
    return min(60.0, max(2.0, float(2 ** min(attempt, 5))))


def _resilient_openai_response(payload: dict[str, Any]) -> dict[str, Any]:
    """Retry transient OpenAI orchestration failures instead of killing the video job."""
    last_error: Exception | None = None
    for attempt in range(MAX_ORCHESTRATION_RETRIES):
        try:
            return _native_openai_response(payload)
        except RuntimeError as exc:
            last_error = exc
            message = str(exc)
            transient = any(
                marker in message
                for marker in ("(408)", "(409)", "(429)", "(500)", "(502)", "(503)", "(504)")
            )
            if not transient or attempt >= MAX_ORCHESTRATION_RETRIES - 1:
                raise
            time.sleep(_retry_delay(message, attempt))
    if last_error:
        raise last_error
    raise RuntimeError("OpenAI orchestration failed without a response.")


def _compact_run_command(job: dict[str, Any], command: str, timeout_seconds: int) -> str:
    """Keep full job event logs, but send only a compact transcript back into the LLM context."""
    result = _native_run_command(job, command, timeout_seconds)
    if len(result) <= MAX_TOOL_CONTEXT_CHARS:
        return result

    head_chars = 1800
    tail_chars = MAX_TOOL_CONTEXT_CHARS - head_chars - 220
    omitted = max(0, len(result) - head_chars - tail_chars)
    return (
        result[:head_chars]
        + f"\n\n[INXSocial compacted {omitted} characters from this tool transcript. "
          "The complete transcript remains stored in the job event log.]\n\n"
        + result[-tail_chars:]
    )


def _compatible_capabilities() -> dict[str, Any]:
    native = dict(_native_capabilities())
    pipeline_catalog = list(native.get("pipelines") or [])
    pipeline_ids = [
        str(item.get("id"))
        for item in pipeline_catalog
        if isinstance(item, dict) and item.get("id") and item.get("id") != "framework-smoke"
    ]
    stock_catalog = list(native.get("stockSources") or [])
    active_sources = [
        str(item.get("name"))
        for item in stock_catalog
        if isinstance(item, dict) and item.get("name") and item.get("status") == "available"
    ]

    native.update({
        "commit": native.get("openmontageCommit"),
        "pipelines": pipeline_ids,
        "pipelineCatalog": pipeline_catalog,
        "professionalSources": active_sources,
        "providerMenu": native.get("providerMenu") or {},
        "studioWorkflow": {
            "name": "native-auto-routing",
            "version": "2.1",
            "stageCount": 0,
            "stages": [],
        },
        "orchestrationResilience": {
            "rateLimitRetries": MAX_ORCHESTRATION_RETRIES,
            "maxToolContextChars": MAX_TOOL_CONTEXT_CHARS,
        },
        "fullIntegration": True,
        "upstreamModified": False,
    })
    return native


def _auto_pipeline(req: bridge.JobRequest) -> str:
    """Use all upstream pipelines by default; honor an explicit pipeline choice."""
    if req.pipeline and str(req.pipeline).strip():
        return str(req.pipeline).strip()
    return "auto"


bridge._capabilities = _compatible_capabilities
bridge._selected_pipeline = _auto_pipeline
bridge._openai_response = _resilient_openai_response
bridge._run_command = _compact_run_command
app = bridge.app


@app.get("/ready")
def ready() -> dict[str, Any]:
    capabilities = _compatible_capabilities()
    pipelines = list(capabilities.get("pipelineCatalog") or [])
    tool_count = int(capabilities.get("toolCount") or 0)
    if not pipelines or tool_count <= 0:
        raise HTTPException(status_code=503, detail={
            "ready": False,
            "pipelineCount": len(pipelines),
            "toolCount": tool_count,
        })
    return {
        "ready": True,
        "runtime": capabilities.get("runtime"),
        "commit": capabilities.get("commit"),
        "pipelineCount": len(pipelines),
        "toolCount": tool_count,
        "skillsCount": int(capabilities.get("skillsCount") or 0),
        "availableStockSources": len(capabilities.get("professionalSources") or []),
        "orchestrationResilience": capabilities.get("orchestrationResilience"),
        "fullIntegration": True,
    }
