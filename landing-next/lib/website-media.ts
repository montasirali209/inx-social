export const SITE_ORIGIN = "https://www.inxsocial.co.uk";

export const WEBSITE_MEDIA = {
  landingHeroDashboard: "landing.hero.dashboard",
  landingDashboardShowcase: "landing.dashboard.showcase",
  landingSocialPreview: "landing.social.preview",
  seoDefaultDashboard: "seo.default.dashboard",
  seoDefaultAiStudio: "seo.default.ai-studio",
  seoAiVideoHero: "seo.ai-video.hero"
} as const;

const SEO_HERO_SLOTS: Record<string, string> = {
  "social-media-scheduler": "seo.social-media-scheduler.hero",
  "bulk-social-media-scheduler": "seo.bulk-social-media-scheduler.hero",
  "social-media-content-calendar": "seo.social-media-content-calendar.hero",
  "social-media-analytics": "seo.social-media-analytics.hero",
  pricing: "seo.pricing.hero",
  "ai-social-media-tools": "seo.ai-social-media-tools.hero",
  "ai-social-media-campaign-generator": "seo.ai-social-media-campaign-generator.hero",
  "ai-social-media-post-generator": "seo.ai-social-media-post-generator.hero",
  "ai-carousel-post-generator": "seo.ai-carousel-post-generator.hero",
  "ai-video-post-generator": "seo.ai-video.hero",
  "ai-ugc-ad-generator": "seo.ai-ugc-ad-generator.hero"
};

export function websiteMediaPath(key: string) {
  return `/api/website-media/${encodeURIComponent(key)}/content`;
}

export function websiteMediaAbsoluteUrl(key: string) {
  return `${SITE_ORIGIN}${websiteMediaPath(key)}`;
}

export function seoHeroSlot(slug: string) {
  return SEO_HERO_SLOTS[slug] || WEBSITE_MEDIA.seoDefaultDashboard;
}
