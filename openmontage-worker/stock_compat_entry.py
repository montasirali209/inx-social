"""INXSocial Stock Video Creator profile layered over full upstream OpenMontage.

The upstream OpenMontage checkout remains unchanged. This module only selects the
native documentary montage pipeline and adds product-level output requirements.
"""
from __future__ import annotations

from typing import Any

import compat_bridge
import full_bridge as bridge

STOCK_PIPELINE = "documentary-montage"
_base_instructions = bridge._agent_instructions
_base_prompt = bridge._agent_prompt
_base_capabilities = bridge._capabilities


def _stock_pipeline(req: bridge.JobRequest) -> str:
    if req.pipeline and str(req.pipeline).strip():
        return str(req.pipeline).strip()
    return STOCK_PIPELINE


def _stock_instructions(job: dict[str, Any], req: bridge.JobRequest) -> str:
    base = _base_instructions(job, req)
    caption_rule = (
        "Captions are requested. Create a timed SRT from the final narration, then use the upstream remotion_caption_burn tool with force_ffmpeg=true and overlays=[]. This deliberately uses the bottom-subtitle fallback: small bottom-centred text, maximum two lines, inside the lower safe margin, white text with dark outline/shadow. Never place narration text in the centre of the frame and never use large word-by-word/karaoke captions."
        if req.captions is not False
        else "Captions are disabled, so render no visible text overlays."
    )
    voice_rule = (
        "Use exactly one continuous narration track for the complete video and mix it once. Do not duplicate, restart, loop, echo or stack narration segments. Verify the encoded final file has clean continuous speech."
        if req.voiceover is not False
        else "Voiceover is disabled, so create no narration track."
    )
    return base + f"""

INXSOCIAL STOCK VIDEO CREATOR PROFILE:
- This output must be a real moving stock-footage montage, not a slideshow, presentation, infographic or text-led explainer.
- Every narrative scene must contain moving video footage. Prefer Pexels and Pixabay Video via OpenMontage's native stock retrieval tools. Do not use still images as scene content.
- Do not create title cards, end cards, CTA cards, statistic cards, report cards, hero-title graphics or full-screen typography frames.
- For documentary-montage, explicitly record an INXSocial product opt-out for the normal end tag so the final video has no end-card graphic.
- The only visible text permitted is the requested subtitle track. {caption_rule}
- {voice_rule}
- Use several relevant clips with normal editorial cuts and keep footage moving through the requested duration apart from ordinary transitions.
- Before completion, review the final MP4. If a static slide, large centre-screen text or duplicated narration is present, correct it before returning the video.
""".strip()


def _stock_prompt(req: bridge.JobRequest) -> str:
    return _base_prompt(req) + "\n\nProduct format: real moving stock footage throughout; no slide/title/end cards; one narration track; captions only as small bottom subtitles."


def _stock_capabilities() -> dict[str, Any]:
    value = dict(_base_capabilities())
    value["studioWorkflow"] = {
        "name": "inx-stock-footage-profile",
        "version": "3.1",
        "pipeline": STOCK_PIPELINE,
        "realMovingFootageOnly": True,
        "subtitleLayout": "small-bottom-centre",
        "presentationCards": False,
        "captionBurn": "remotion_caption_burn:force_ffmpeg",
    }
    return value


bridge._selected_pipeline = _stock_pipeline
bridge._agent_instructions = _stock_instructions
bridge._agent_prompt = _stock_prompt
bridge._capabilities = _stock_capabilities
compat_bridge._compatible_capabilities = _stock_capabilities

app = compat_bridge.app
