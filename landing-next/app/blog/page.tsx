import Link from "next/link";
import { ArticleCard } from "./components/ArticleCard";
import { IntegrationPending } from "./components/IntegrationPending";
import { getBlogClient } from "./lib/blog-client";
import type { BlogArticleSummary } from "./types";

export const revalidate = 300;

const PAGE_SIZE = 12;

export default async function BlogIndex({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const client = getBlogClient();
  const resolved = await searchParams;
  const requestedPage = Number.parseInt(resolved.page || "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let articles: BlogArticleSummary[] = [];
  let loadError = false;

  if (client) {
    try {
      articles = (await client.getAllArticles({ publishedOnly: true })) as unknown as BlogArticleSummary[];
    } catch {
      loadError = true;
    }
  }

  const pageCount = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visibleArticles = articles.slice(start, start + PAGE_SIZE);

  return (
    <main className="inx-blog-main">
      <section className="inx-blog-hero">
        <div className="inx-blog-wrap">
          <span className="inx-blog-kicker">INXSocial insights</span>
          <h1>Practical ideas for smarter social media growth.</h1>
          <p>
            Guides on content creation, scheduling, AI workflows, analytics and the systems behind consistent social publishing.
          </p>
        </div>
      </section>

      <section className="inx-blog-wrap inx-blog-index">
        {!client ? (
          <IntegrationPending />
        ) : loadError ? (
          <IntegrationPending
            title="Blog connection needs attention"
            message="The self-hosted INXSocial article service could not be reached. Check the backend Content Engine status and redeploy."
          />
        ) : articles.length === 0 ? (
          <section className="inx-blog-status">
            <span className="inx-blog-status-dot" aria-hidden="true" />
            <div>
              <h2>No published articles yet</h2>
              <p>Articles approved and published from the INXSocial Content Engine will appear here automatically.</p>
            </div>
          </section>
        ) : (
          <>
            <div className="inx-blog-grid">
              {visibleArticles.map((article) => (
                <ArticleCard key={String(article.id)} article={article} />
              ))}
            </div>

            {pageCount > 1 && (
              <nav className="inx-blog-pagination" aria-label="Blog pagination">
                {safePage > 1 ? (
                  <Link href={safePage === 2 ? "/blog" : `/blog?page=${safePage - 1}`}>← Previous</Link>
                ) : (
                  <span />
                )}
                <span>
                  Page {safePage} of {pageCount}
                </span>
                {safePage < pageCount ? <Link href={`/blog?page=${safePage + 1}`}>Next →</Link> : <span />}
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  );
}
