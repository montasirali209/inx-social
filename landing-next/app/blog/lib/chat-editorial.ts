import type { BlogArticle, BlogArticleSummary, BlogSitemapEntry } from "../types";

const SITE = "https://www.inxsocial.co.uk";

type ChatEditorialInput = Omit<
  BlogArticle,
  "id" | "editorial" | "jsonLd" | "faqJsonLd"
>;

/**
 * Independent ChatGPT editorial lane.
 *
 * Articles in this array are repository-owned website content. They do not use
 * the Growth Content Engine, Growth Autopilot article records, or backend AI
 * generation APIs. The scheduled ChatGPT SEO operator may add or update entries
 * here through the normal protected-branch PR/CI/deploy workflow.
 */
const rawChatEditorialArticles: ChatEditorialInput[] = [];

function iso(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toArticle(input: ChatEditorialInput): BlogArticle {
  const published = iso(input.published_at || input.created_at);
  const updated = iso(input.updated_at || input.published_at || input.created_at);
  const canonical = `${SITE}/blog/${input.slug}`;
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const faq = Array.isArray(input.faq) ? input.faq : [];

  return {
    ...input,
    id: `chatgpt:${input.slug}`,
    editorial: {
      method: "ChatGPT repository editorial",
      sourceCount: sources.length,
      updatedAt: updated || null,
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: input.title,
      description: input.meta_description || input.excerpt || undefined,
      datePublished: published,
      dateModified: updated || published,
      mainEntityOfPage: canonical,
      url: canonical,
      author: {
        "@type": "Organization",
        name: "INXSocial Editorial",
        url: SITE,
      },
      publisher: {
        "@type": "Organization",
        name: "INXSocial",
        url: SITE,
      },
      image: input.featured_image_url || undefined,
    },
    faqJsonLd: faq.length
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }
      : null,
  };
}

function articleTime(article: BlogArticleSummary) {
  const value = article.published_at || article.updated_at || article.created_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export const chatEditorialArticles: BlogArticle[] = rawChatEditorialArticles
  .map(toArticle)
  .sort((a, b) => articleTime(b) - articleTime(a));

export function getChatEditorialArticleBySlug(slug: string): BlogArticle | null {
  return chatEditorialArticles.find((article) => article.slug === slug) || null;
}

export function getChatEditorialArticles(): BlogArticleSummary[] {
  return chatEditorialArticles;
}

export function getChatEditorialArticlesByTag(tag: string): BlogArticleSummary[] {
  const normalized = String(tag || "").trim().toLowerCase();
  return chatEditorialArticles.filter((article) =>
    (article.keywords || []).some((keyword) => {
      const slug = String(keyword || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 90);
      return slug === normalized;
    }),
  );
}

export function getChatEditorialSitemapEntries(): BlogSitemapEntry[] {
  return chatEditorialArticles.map((article) => ({
    slug: article.slug,
    published_at: article.published_at || null,
    created_at: article.created_at || null,
    updated_at: article.updated_at || null,
  }));
}

export function mergeBlogArticles(
  remote: BlogArticleSummary[],
  local: BlogArticleSummary[],
): BlogArticleSummary[] {
  const bySlug = new Map<string, BlogArticleSummary>();
  for (const article of remote || []) {
    if (article?.slug) bySlug.set(article.slug, article);
  }
  for (const article of local || []) {
    if (article?.slug) bySlug.set(article.slug, article);
  }
  return [...bySlug.values()].sort((a, b) => articleTime(b) - articleTime(a));
}

export function mergeBlogSitemapEntries(
  remote: BlogSitemapEntry[],
  local: BlogSitemapEntry[],
): BlogSitemapEntry[] {
  const bySlug = new Map<string, BlogSitemapEntry>();
  for (const entry of remote || []) {
    if (entry?.slug) bySlug.set(entry.slug, entry);
  }
  for (const entry of local || []) {
    if (entry?.slug) bySlug.set(entry.slug, entry);
  }
  return [...bySlug.values()];
}
