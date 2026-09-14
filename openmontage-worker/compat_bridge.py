"""INXSocial compatibility surface for the full, unchanged OpenMontage engine.

This module keeps the existing INXSocial backend contract stable while routing
new productions through the complete upstream pipeline/tool/skill/provider
catalog exposed by full_bridge.
"""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException

import full_bridge as bridge

_native_capabilities = bridge._capabilities


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
            "version": "2.0",
            "stageCount": 0,
            "stages": [],
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
        "fullIntegration": True,
    }
