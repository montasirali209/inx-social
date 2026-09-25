import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "../../components/ArticleCard";
import { IntegrationPending } from "../../components/IntegrationPending";
import { BLOG_REVALIDATE_SECONDS, getBlogClient, getSiteUrl } from "../../lib/blog-client";
import type { BlogArticleSummary } from "../../types";

export const revalidate = BLOG_REVALIDATE_SECONDS;

function labelFromSlug(slug: string) {
  return decodeURIComponent(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const label = labelFromSlug(slug);
  return {
    title: `${label} Articles | INXSocial Blog`,
    description: `INXSocial articles about ${label}.`,
    alternates: { canonical: `${getSiteUrl()}/blog/tag/${slug}` },
  };
}

export default async function BlogTagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const label = labelFromSlug(slug);
  const client = getBlogClient();

  if (!client) {
    return (
      <main className="inx-blog-main">
        <section className="inx-blog-wrap inx-blog-index">
          <IntegrationPending />
        </section>
      </main>
    );
  }

  let articles: BlogArticleSummary[] = [];
  let loadError = false;

  try {
    articles = (await client.getArticlesByTag(slug)) as unknown as BlogArticleSummary[];
  } catch {
    loadError = true;
  }

  return (
    <main className="inx-blog-main">
      <section className="inx-blog-tag-hero">
        <div className="inx-blog-wrap">
          <Link className="inx-blog-back" href="/blog">
            ← All articles
          </Link>
          <span className="inx-blog-kicker">Topic</span>
          <h1>{label}</h1>
          <p>{articles.length > 0 ? `${articles.length} published article${articles.length === 1 ? "" : "s"}` : "INXSocial blog topic"}</p>
        </div>
      </section>

      <section className="inx-blog-wrap inx-blog-index">
        {loadError ? (
          <IntegrationPending
            title="Blog connection needs attention"
            message="Articles for this topic could not be loaded. Check the server-side blog connection."
          />
        ) : articles.length === 0 ? (
          <section className="inx-blog-status">
            <span className="inx-blog-status-dot" aria-hidden="true" />
            <div>
              <h2>No articles in this topic yet</h2>
              <p>More INXSocial guides will appear here as they are published.</p>
            </div>
          </section>
        ) : (
          <div className="inx-blog-grid">
            {articles.map((article) => (
              <ArticleCard key={String(article.id)} article={article} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
