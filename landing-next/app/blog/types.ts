export type BlogArticleSummary = {
  id: string | number;
  slug: string;
  title: string;
  excerpt?: string | null;
  meta_description?: string | null;
  featured_image_url?: string | null;
  keywords?: string[] | null;
  language?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BlogArticle = BlogArticleSummary & {
  content_html?: string | null;
  content_markdown?: string | null;
  sources?: Array<{ title: string; url: string }> | null;
  internalLinks?: Array<{ label: string; url: string }> | null;
  faq?: Array<{ question: string; answer: string }> | null;
  jsonLd?: unknown;
  faqJsonLd?: unknown;
};

export type BlogTag = {
  name?: string | null;
  label?: string | null;
  slug: string;
  count?: number | null;
};

export type BlogSitemapEntry = {
  slug: string;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};
