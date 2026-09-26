import type { BlogArticle, BlogArticleSummary, BlogSitemapEntry } from "../types";

export const BLOG_REVALIDATE_SECONDS = 300;

type AllArticlesOptions = {
  publishedOnly?: boolean;
};

class INXGrowthContentClient {
  private readonly baseUrl: string;
  private readonly revalidate: number;

  constructor() {
    this.baseUrl = (
      process.env.GROWTH_CONTENT_API_URL?.trim() ||
      process.env.INX_API_URL?.trim() ||
      "https://social.inaxx.co.uk"
    ).replace(/\/+$/, "");
    this.revalidate = process.env.NODE_ENV === "development" ? 10 : BLOG_REVALIDATE_SECONDS;
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(this.baseUrl + "/api/growth-content" + path, {
      headers: { "User-Agent": "INXSocial-Next-Blog/2.0" },
      next: { revalidate: this.revalidate },
    });

    if (!response.ok) {
      throw new Error("Growth Content API request failed: " + response.status);
    }

    return (await response.json()) as T;
  }

  async getAllArticles(_options: AllArticlesOptions = {}): Promise<BlogArticleSummary[]> {
    const payload = await this.request<{ articles: BlogArticleSummary[] }>("/articles");
    return payload.articles || [];
  }

  async getArticleBySlug(slug: string): Promise<BlogArticle | null> {
    const response = await fetch(
      this.baseUrl + "/api/growth-content/articles/" + encodeURIComponent(slug),
      {
        headers: { "User-Agent": "INXSocial-Next-Blog/2.0" },
        next: { revalidate: this.revalidate },
      },
    );

    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Growth Content API request failed: " + response.status);
    const payload = (await response.json()) as { article: BlogArticle };
    return payload.article || null;
  }

  async getArticlesByTag(tag: string): Promise<BlogArticleSummary[]> {
    const payload = await this.request<{ articles: BlogArticleSummary[] }>(
      "/articles?tag=" + encodeURIComponent(tag),
    );
    return payload.articles || [];
  }

  async getSitemapEntries(): Promise<BlogSitemapEntry[]> {
    const payload = await this.request<{ entries: BlogSitemapEntry[] }>("/sitemap");
    return payload.entries || [];
  }
}

let cachedClient: INXGrowthContentClient | null = null;

export function getBlogClient(): INXGrowthContentClient {
  if (!cachedClient) cachedClient = new INXGrowthContentClient();
  return cachedClient;
}

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || "https://www.inxsocial.co.uk").replace(/\/+$/, "");
}

export function slugify(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}
