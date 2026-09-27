export type PublicVideoModel = {
  name: string;
  creator: string | null;
  description: string;
  coverImage: string | null;
  releasedAt: string | null;
  modes: string[];
  resolutions: string[];
  durations: number[];
  audioSupported: boolean;
  draftSupported: boolean;
  firstFrameSupported: boolean;
  lastFrameSupported: boolean;
  referenceImagesSupported: boolean;
  baselineCredits: number | null;
  tags: string[];
};

export type VideoModelShowcase = {
  version: string;
  source: string;
  syncedAt: string;
  generationReady: number;
  catalogueTotal: number;
  creatorCount: number;
  modeCounts: {
    textToVideo: number;
    imageToVideo: number;
    referenceToVideo: number;
    nativeAudio: number;
  };
  latest: PublicVideoModel[];
};

const FALLBACK: VideoModelShowcase = {
  version: "fallback",
  source: "static-fallback",
  syncedAt: "",
  generationReady: 60,
  catalogueTotal: 100,
  creatorCount: 0,
  modeCounts: { textToVideo: 0, imageToVideo: 0, referenceToVideo: 0, nativeAudio: 0 },
  latest: [
    { name: "P-Video-2", creator: "Pruna AI", description: "Quality-focused social video generation with audio, draft previews and frame guidance.", coverImage: null, releasedAt: null, modes: ["TEXT_TO_VIDEO","IMAGE_TO_VIDEO"], resolutions: ["720p"], durations: [5,10], audioSupported: true, draftSupported: true, firstFrameSupported: true, lastFrameSupported: true, referenceImagesSupported: false, baselineCredits: null, tags: [] },
    { name: "Kling VIDEO 3.0", creator: "Kling AI", description: "Balanced video generation with strong prompt following and optional synchronized audio.", coverImage: null, releasedAt: null, modes: ["TEXT_TO_VIDEO","IMAGE_TO_VIDEO"], resolutions: ["720p"], durations: [5,8,10,12], audioSupported: true, draftSupported: false, firstFrameSupported: true, lastFrameSupported: true, referenceImagesSupported: false, baselineCredits: null, tags: [] },
    { name: "Wan 3.0", creator: "Alibaba", description: "High-fidelity generation for polished product stories and cinematic social video.", coverImage: null, releasedAt: null, modes: ["TEXT_TO_VIDEO","IMAGE_TO_VIDEO","REFERENCE_TO_VIDEO"], resolutions: ["480p","720p","1080p"], durations: [5,10,15], audioSupported: true, draftSupported: false, firstFrameSupported: false, lastFrameSupported: false, referenceImagesSupported: true, baselineCredits: null, tags: [] },
    { name: "Runway Gen-4.5", creator: "Runway", description: "Cinematic realistic motion and strong composition for premium visual storytelling.", coverImage: null, releasedAt: null, modes: ["TEXT_TO_VIDEO","IMAGE_TO_VIDEO"], resolutions: ["720p"], durations: [5,8,10], audioSupported: false, draftSupported: false, firstFrameSupported: true, lastFrameSupported: false, referenceImagesSupported: false, baselineCredits: null, tags: [] }
  ]
};

export function countLabel(count: number) {
  const safe = Math.max(0, Number(count) || 0);
  if (safe < 10) return String(safe);
  return `${Math.floor(safe / 10) * 10}+`;
}

export function modeLabel(mode: string) {
  if (mode === "TEXT_TO_VIDEO") return "Text to video";
  if (mode === "IMAGE_TO_VIDEO") return "Image to video";
  if (mode === "REFERENCE_TO_VIDEO") return "Reference video";
  if (mode === "VIDEO_TO_VIDEO") return "Video to video";
  if (mode === "AUDIO_TO_VIDEO") return "Audio to video";
  return mode.replaceAll("_", " ").toLowerCase();
}

export async function getVideoModelShowcase(limit = 12): Promise<VideoModelShowcase> {
  const origin = String(process.env.INXSOCIAL_API_ORIGIN || "https://social.inaxx.co.uk").replace(/\/+$/, "");
  try {
    const response = await fetch(`${origin}/api/public/video-models?limit=${Math.max(1, Math.min(100, limit))}`, {
      next: { revalidate: 300 },
      headers: { "user-agent": "INXSocial-Landing-Model-Showcase/1.0" }
    });
    if (!response.ok) return FALLBACK;
    const payload = await response.json() as VideoModelShowcase;
    if (!payload || !Array.isArray(payload.latest) || !Number.isFinite(Number(payload.generationReady))) return FALLBACK;
    return payload;
  } catch {
    return FALLBACK;
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderHomepageModelCards(showcase: VideoModelShowcase, limit = 6) {
  return showcase.latest.slice(0, limit).map((model, index) => {
    const modes = model.modes.slice(0, 3).map(mode => `<span>${escapeHtml(modeLabel(mode))}</span>`).join("");
    const creator = model.creator ? `<small>${escapeHtml(model.creator)}</small>` : "";
    const newest = index < 3 ? '<b class="live-model-new">Latest</b>' : "";
    return `<article class="live-model-card reveal">
      <div class="live-model-card-top">${newest}${creator}</div>
      <h3>${escapeHtml(model.name)}</h3>
      <p>${escapeHtml(model.description || "Available in the INXSocial AI Video Studio.")}</p>
      <div class="live-model-modes">${modes}</div>
    </article>`;
  }).join("");
}

export function homepageModelShowcaseMarkup(showcase: VideoModelShowcase) {
  const label = countLabel(showcase.generationReady);
  return `<section class="video-model-showcase-section" id="ai-video-models">
    <div class="shell">
      <div class="video-model-showcase-heading reveal">
        <div>
          <span class="kicker">Live AI video catalogue</span>
          <h2>One studio. ${escapeHtml(label)} generation-ready AI video models.</h2>
          <p>Use AI Recommended to let INXSocial choose a suitable model, or browse the live catalogue yourself. New generation-ready models can appear automatically after capability and pricing validation.</p>
        </div>
        <div class="video-model-stat">
          <strong>${escapeHtml(showcase.generationReady)}</strong>
          <span>available now</span>
          <small>${escapeHtml(showcase.catalogueTotal)} tracked in the live video catalogue</small>
        </div>
      </div>
      <div class="live-model-grid">${renderHomepageModelCards(showcase, 6)}</div>
      <div class="video-model-showcase-actions reveal">
        <a class="button button-primary button-large" href="/ai-video-models">Explore AI video models <span>→</span></a>
        <a class="button button-secondary button-large app-entry" href="/portal/login.html?return=/app/ai-content-studio">Open Video Studio</a>
      </div>
    </div>
  </section>`;
}
