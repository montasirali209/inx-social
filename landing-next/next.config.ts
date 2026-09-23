import type { NextConfig } from "next";

const backend = "https://social.inaxx.co.uk";

const seoRoutes = [
  "social-media-scheduler",
  "bulk-social-media-scheduler",
  "social-media-content-calendar",
  "social-media-analytics",
  "ai-social-media-tools",
  "ai-social-media-campaign-generator",
  "ai-social-media-post-generator",
  "ai-carousel-post-generator",
  "ai-video-post-generator",
  "ai-ugc-ad-generator",
  "pricing"
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  async redirects() {
    return [
      ...seoRoutes.map(slug => ({
        source: `/${slug}.html`,
        destination: `/${slug}`,
        permanent: true
      })),
      {
        source: "/generate-and-schedule-social-media-posts.html",
        destination: "/social-media-scheduler",
        permanent: true
      },
      {
        source: "/30-day-social-media-content-planner.html",
        destination: "/social-media-content-calendar",
        permanent: true
      },
      {
        source: "/free-social-media-tools.html",
        destination: "/ai-social-media-tools",
        permanent: true
      },
      {
        source: "/social-media-caption-generator.html",
        destination: "/ai-social-media-post-generator",
        permanent: true
      }
    ];
  },
  async rewrites() {
    return [
      ...seoRoutes.map(slug => ({
        source: `/${slug}`,
        destination: `/seo/${slug}`
      })),
      { source: "/assets/:path*", destination: `${backend}/assets/:path*` },
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/app/:path*", destination: `${backend}/app/:path*` },
      { source: "/portal/:path*", destination: `${backend}/portal/:path*` },
      { source: "/privacy.html", destination: `${backend}/privacy.html` },
      { source: "/terms.html", destination: `${backend}/terms.html` },
      { source: "/data-deletion.html", destination: `${backend}/data-deletion.html` },
      { source: "/site.webmanifest", destination: `${backend}/site.webmanifest` }
    ];
  }
};

export default nextConfig;
