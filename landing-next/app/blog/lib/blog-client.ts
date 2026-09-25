import { BlogClient, slugify } from "babylovegrowth-next-js-blog";

export const BLOG_REVALIDATE_SECONDS = 86_400;

let cachedClient: BlogClient | null | undefined;

export function getBlogClient(): BlogClient | null {
  const apiKey = process.env.BABYLOVEGROWTH_BLOG_API_KEY?.trim();

  if (!apiKey) return null;
  if (cachedClient) return cachedClient;

  cachedClient = new BlogClient({
    apiKey,
    baseUrl: process.env.BABYLOVEGROWTH_BLOG_API_URL?.trim() || undefined,
    revalidate: process.env.NODE_ENV === "development" ? 10 : BLOG_REVALIDATE_SECONDS,
  });

  return cachedClient;
}

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || "https://www.inxsocial.co.uk").replace(/\/+$/, "");
}

export { slugify };
