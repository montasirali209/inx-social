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
      signal: AbortSignal.timeout(2500),
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

const APPROVED_HOMEPAGE_MODELS = [
  {
    provider: "seedance",
    providerLogo: "/assets/video-catalogue/seedance-logo.png",
    name: "Seedance 2.5",
    poster: "/assets/video-catalogue/seedance.png",
    duration: "0:15",
    description: "Seedance 2.5 delivers cinematic, high-fidelity video generation with natural motion, realistic details and professional grade aesthetics.",
    capabilities: ["Text to video", "Image to video", "Video to video"]
  },
  {
    provider: "google",
    providerLogo: "/assets/video-catalogue/google-logo.png",
    name: "Gemini Veo 3.1",
    poster: "/assets/video-catalogue/veo.png",
    duration: "0:14",
    description: "Gemini Veo 3.1 excels at long-form, high-quality video generation with strong world consistency, natural motion and cinematic storytelling.",
    capabilities: ["Text to video", "Image to video", "Video to video"]
  },
  {
    provider: "google",
    providerLogo: "/assets/video-catalogue/google-logo.png",
    name: "Gemini Omni 1.1",
    poster: "/assets/video-catalogue/omni.png",
    duration: "0:12",
    description: "Gemini Omni 1.1 offers native multimodal generation with audio and advanced editing, supporting text, image and video inputs for highly coherent results.",
    capabilities: ["Text to video", "Image to video", "Video to video"]
  },
  {
    provider: "minimax",
    providerLogo: "/assets/video-catalogue/minimax-logo.png",
    name: "H3 Minimax",
    poster: "/assets/video-catalogue/h3.png",
    duration: "0:16",
    description: "H3 Minimax delivers advanced video generation with superior visual quality, coherent motion and a rich cinematic style for realistic and imaginative scenes.",
    capabilities: ["Text to video", "Image to video", "Video to video"]
  },
  {
    provider: "kling",
    providerLogo: "/assets/video-catalogue/kling-logo.png",
    name: "Kling 3.0",
    poster: "/assets/video-catalogue/kling.png",
    duration: "0:13",
    description: "Kling 3.0 generates high-quality, dynamic videos with excellent motion modeling, realistic physics and detailed visual rendering.",
    capabilities: ["Text to video", "Image to video", "Video to video"]
  },
  {
    provider: "wan",
    providerLogo: "/assets/video-catalogue/wan-logo.png",
    name: "Wan 3.0",
    poster: "/assets/video-catalogue/wan.png",
    duration: "0:15",
    description: "Wan 3.0 produces high-quality, visually stunning videos with strong prompt adherence, natural motion and rich cinematic composition.",
    capabilities: ["Text to video", "Image to video", "Video to video"]
  }
] as const;

function renderApprovedHomepageModelCards() {
  return APPROVED_HOMEPAGE_MODELS.map((model, index) => {
    const capabilities = model.capabilities.map(capability => `<span>${escapeHtml(capability)}</span>`).join("");
    const compactClass = index >= 3 ? " is-compact" : "";
    return `<article class="approved-video-model-card reveal">
      <div class="approved-video-provider">
        <img src="${escapeHtml(model.providerLogo)}" alt="" width="24" height="24" loading="lazy" decoding="async">
        <span>${escapeHtml(model.provider)}</span>
        <b>Latest</b>
      </div>
      <h3>${escapeHtml(model.name)}</h3>
      <div class="approved-video-poster${compactClass}">
        <img src="${escapeHtml(model.poster)}" alt="${escapeHtml(model.name)} preview" loading="lazy" decoding="async">
        <span class="approved-video-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8.2 5.8v12.4L18.6 12 8.2 5.8Z"/></svg></span>
        <span class="approved-video-duration">${escapeHtml(model.duration)}</span>
      </div>
      <p>${escapeHtml(model.description)}</p>
      <div class="approved-video-capabilities">${capabilities}</div>
    </article>`;
  }).join("");
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
  const bars = [28,38,50,62,76,90,100].map(height => `<i style="height:${height}%"></i>`).join("");
  return `<section class="video-model-showcase-section approved-video-catalogue" id="ai-video-models">
    <span class="approved-video-glow" aria-hidden="true"></span>
    <span class="approved-video-ring" aria-hidden="true"></span>
    <div class="shell">
      <div class="approved-video-header">
        <div class="approved-video-copy reveal">
          <span class="approved-video-kicker"><i></i>Live AI Video Catalogue</span>
          <h2>One studio. ${escapeHtml(label)} generation-ready AI video models.</h2>
          <p>Use AI Recommended to let INXSocial choose a suitable model, or browse the live catalogue yourself. New generation-ready models can appear automatically after capability and pricing validation.</p>
        </div>
        <div class="approved-video-stat reveal">
          <span class="approved-video-stack" aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="m24 7 15 8-15 8L9 15 24 7Zm0 11 15 8-15 8L9 26l15-8Zm0 11 15 8-15 8-15-8 15-8Z"/></svg>
          </span>
          <div class="approved-video-stat-copy">
            <span>Available now</span>
            <strong>${escapeHtml(showcase.generationReady)}</strong>
            <small>models in the live video catalogue</small>
          </div>
          <span class="approved-video-bars" aria-hidden="true">${bars}</span>
        </div>
      </div>
      <div class="approved-video-grid">${renderApprovedHomepageModelCards()}</div>
      <div class="approved-video-actions reveal">
        <a class="approved-video-primary" href="/ai-video-models">Explore AI video models <span>→</span></a>
        <a class="approved-video-secondary app-entry" href="/portal/login.html?return=/app/ai-content-studio">
          <span class="approved-video-open-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/></svg></span>
          Open Video Studio
        </a>
      </div>
    </div>
  </section>`;
}
