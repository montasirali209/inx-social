"""INXSocial HTTP compatibility surface for the full, unchanged OpenMontage engine.

This module does not patch upstream OpenMontage. It only keeps the existing
INXSocial backend contract stable while exposing the complete capability
catalog produced by full_bridge.
"""
from __future__ import annotations

from typing import Any

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
        # Legacy fields consumed by the current INXSocial backend.
        "commit": native.get("openmontageCommit"),
        "pipelines": pipeline_ids,
        "pipelineCatalog": pipeline_catalog,
        "professionalSources": active_sources,
        "providerMenu": native.get("providerMenu") or [],
        "studioWorkflow": {
            "name": "full-video-production",
            "version": "2.0",
            "stageCount": 0,
            "stages": [],
        },
        # Explicit full-engine metadata for new clients.
        "fullIntegration": True,
        "upstreamModified": False,
    })
    return native


bridge._capabilities = _compatible_capabilities
app = bridge.app
