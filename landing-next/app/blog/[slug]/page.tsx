import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IntegrationPending } from "../components/IntegrationPending";
import { getBlogClient, getSiteUrl, slugify } from "../lib/blog-client";
import type { BlogArticle } from "../types";

export const revalidate = 300;

function asSchema(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = getBlogClient();
  if (!client) return { title: "INXSocial Blog" };

  try {
    const article = (await client.getArticleBySlug(slug)) as unknown as BlogArticle | null;
    if (!article) return { title: "Article not found | INXSocial" };

    const description = article.meta_description || article.excerpt || undefined;
    const canonical = `${getSiteUrl()}/blog/${article.slug}`;

    return {
      title: `${article.title} | INXSocial Blog`,
      description,
      alternates: { canonical },
      openGraph: {
        type: "article",
        url: canonical,
        title: article.title,
        description,
        publishedTime: article.published_at || undefined,
        modifiedTime: article.updated_at || undefined,
        images: article.featured_image_url ? [{ url: article.featured_image_url }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description,
        images: article.featured_image_url ? [article.featured_image_url] : undefined,
      },
    };
  } catch {
    return { title: "INXSocial Blog" };
  }
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = getBlogClient();

  if (!client) {
    return (
      <main className="inx-blog-main">
        <section className="inx-blog-wrap inx-blog-article-wrap">
          <IntegrationPending />
        </section>
      </main>
    );
  }

  let article: BlogArticle | null = null;
  try {
    article = (await client.getArticleBySlug(slug)) as unknown as BlogArticle | null;
  } catch {
    return (
      <main className="inx-blog-main">
        <section className="inx-blog-wrap inx-blog-article-wrap">
          <IntegrationPending
            title="Article service unavailable"
            message="This article could not be loaded right now. Please try again shortly."
          />
        </section>
      </main>
    );
  }

  if (!article) notFound();

  const published = formatDate(article.published_at || article.created_at);
  const schemas = [asSchema(article.jsonLd), asSchema(article.faqJsonLd)].filter(
    (value): value is string => Boolean(value),
  );
  const tags = Array.isArray(article.keywords) ? article.keywords : [];
  const sources = Array.isArray(article.sources) ? article.sources : [];
  const internalLinks = Array.isArray(article.internalLinks) ? article.internalLinks : [];
  const faq = Array.isArray(article.faq) ? article.faq : [];
  const takeaways = Array.isArray(article.key_takeaways) ? article.key_takeaways : [];
  const comparison = Array.isArray(article.comparison) ? article.comparison : [];
  const quickAnswer = article.quick_answer || article.excerpt || article.meta_description || null;

  return (
    <main className="inx-blog-main">
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: schema }}
        />
      ))}

      <article className="inx-blog-wrap inx-blog-article-wrap">
        <Link className="inx-blog-back" href="/blog">
          ← Back to blog
        </Link>

        <header className="inx-blog-article-header">
          {published && <time dateTime={article.published_at || article.created_at || undefined}>{published}</time>}
          <h1>{article.title}</h1>
          {(article.excerpt || article.meta_description) && (
            <p>{article.excerpt || article.meta_description}</p>
          )}
          {article.editorial && (
            <div className="inx-blog-editorial-meta">
              <span>INXSocial Editorial</span>
              <span aria-hidden="true">•</span>
              <span>{article.editorial.sourceCount} verified source{article.editorial.sourceCount === 1 ? "" : "s"}</span>
              <span aria-hidden="true">•</span>
              <span>AI-assisted, independently reviewed</span>
            </div>
          )}
          {tags.length > 0 && (
            <div className="inx-blog-tags inx-blog-article-tags">
              {tags.slice(0, 6).map((tag) => (
                <Link key={tag} href={`/blog/tag/${slugify(tag)}`}>
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </header>

        {article.featured_image_url && (
          <div className="inx-blog-article-image">
            <img
              src={article.featured_image_url}
              alt={article.title}
              loading="eager"
              fetchPriority="high"
            />
          </div>
        )}

        {(quickAnswer || takeaways.length > 0) && (
          <section className="inx-blog-answer-box" aria-label="Article summary">
            {quickAnswer && (
              <div className="inx-blog-quick-answer">
                <span className="inx-blog-kicker">Quick answer</span>
                <p>{quickAnswer}</p>
              </div>
            )}
            {takeaways.length > 0 && (
              <div className="inx-blog-takeaways">
                <h2>Key takeaways</h2>
                <ul>
                  {takeaways.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}

        {comparison.length >= 2 && (
          <section className="inx-blog-comparison">
            <span className="inx-blog-kicker">At a glance</span>
            <h2>Comparison overview</h2>
            <div className="inx-blog-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Option</th>
                    <th>Best for</th>
                    <th>Strength</th>
                    <th>Consideration</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.name}>
                      <th scope="row">{row.name}</th>
                      <td>{row.best_for}</td>
                      <td>{row.strength}</td>
                      <td>{row.consideration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div
          className="inx-blog-content"
          dangerouslySetInnerHTML={{ __html: article.content_html || "" }}
        />

        {internalLinks.length > 0 && (
          <aside className="inx-blog-related" aria-label="Recommended INXSocial tools">
            <span className="inx-blog-kicker">Recommended</span>
            <h2>Useful INXSocial tools for the next step</h2>
            <div className="inx-blog-recommendation-grid">
              {internalLinks.map((link) => (
                <Link key={link.url} href={link.url} className="inx-blog-recommendation-card">
                  <span>
                    <strong>{link.label}</strong>
                    {link.description && <small>{link.description}</small>}
                  </span>
                  <b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>
          </aside>
        )}

        {faq.length > 0 && (
          <section className="inx-blog-faq">
            <span className="inx-blog-kicker">Frequently asked questions</span>
            <h2>Questions about {article.title}</h2>
            <div className="inx-blog-faq-list">
              {faq.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {sources.length > 0 && (
          <section className="inx-blog-sources">
            <span className="inx-blog-kicker">Research sources</span>
            <h2>Sources used for this guide</h2>
            <ol>
              {sources.map((source, index) => (
                <li key={source.url} id={`source-${String(source.id || `S${index + 1}`).toLowerCase()}`}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    <strong>{source.title || source.domain || source.url}</strong>
                    {source.domain && <small>{source.domain}</small>}
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>
    </main>
  );
}
