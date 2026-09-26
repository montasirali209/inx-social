import type { MetadataRoute } from "next";
import { seoPageSlugs } from "@/lib/seo-pages";

const SITE = "https://www.inxsocial.co.uk";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: SITE,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1
    },
    ...seoPageSlugs.map((slug) => ({
      url: `${SITE}/${slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: slug === "pricing" ? 0.9 : 0.8
    }))
  ];
}
