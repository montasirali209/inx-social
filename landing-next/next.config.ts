import type { NextConfig } from "next";

const backend = "https://social.inaxx.co.uk";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
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
