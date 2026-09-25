import { getBlogClient, getSiteUrl } from "../lib/blog-client";
import type { BlogSitemapEntry } from "../types";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const client = getBlogClient();
  const siteUrl = getSiteUrl();
  let entries: BlogSitemapEntry[] = [];

  if (client) {
    try {
      entries = (await client.getSitemapEntries()) as unknown as BlogSitemapEntry[];
    } catch {
      entries = [];
    }
  }

  const urls = [
    `  <url><loc>${escapeXml(`${siteUrl}/blog`)}</loc></url>`,
    ...entries.map((entry) => {
      const lastModified =
        entry.updated_at ||
        entry.updatedAt ||
        entry.published_at ||
        entry.publishedAt ||
        entry.created_at ||
        entry.createdAt;
      const lastmod = lastModified
        ? `<lastmod>${escapeXml(new Date(lastModified).toISOString())}</lastmod>`
        : "";
      return `  <url><loc>${escapeXml(`${siteUrl}/blog/${entry.slug}`)}</loc>${lastmod}</url>`;
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
