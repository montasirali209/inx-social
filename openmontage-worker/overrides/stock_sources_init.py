"""INXSocial production stock registry: Pexels and Pixabay Video only."""
from __future__ import annotations

from .base import Candidate, SearchFilters, StockSource
from .pexels import PexelsSource
from .pixabay_video import PixabayVideoSource

__all__ = [
    "Candidate", "SearchFilters", "StockSource", "all_sources",
    "available_sources", "get_source", "source_catalog", "source_summary",
]

_SOURCE_CLASSES = (PexelsSource, PixabayVideoSource)


def all_sources() -> list[StockSource]:
    return [source() for source in _SOURCE_CLASSES]


def available_sources() -> list[StockSource]:
    return [source for source in all_sources() if source.is_available()]


def source_catalog() -> list[dict[str, object]]:
    return [{
        "name": source.name,
        "display_name": getattr(source.__class__, "display_name", source.name),
        "provider": getattr(source.__class__, "provider", source.name),
        "status": "available" if source.is_available() else "unavailable",
        "install_instructions": getattr(source.__class__, "install_instructions", ""),
        "supports": getattr(source.__class__, "supports", {}),
    } for source in all_sources()]


def source_summary() -> dict[str, object]:
    catalog = source_catalog()
    available = [entry["name"] for entry in catalog if entry["status"] == "available"]
    unavailable = [entry["name"] for entry in catalog if entry["status"] != "available"]
    return {"configured": len(available), "total": len(catalog),
            "available_source_names": available, "unavailable_source_names": unavailable}


def get_source(name: str) -> StockSource:
    for source in all_sources():
        if source.name == name:
            return source
    raise KeyError(f"INXSocial professional registry does not permit source={name!r}")
