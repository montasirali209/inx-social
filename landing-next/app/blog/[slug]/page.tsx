import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IntegrationPending } from "../components/IntegrationPending";
import { getBlogClient, getSiteUrl, slugify } from "../lib/blog-client";
import type { BlogArticle } from "../types";

export const revalidate = 86400;

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
            <Image
              src={article.featured_image_url}
              alt=""
              fill
              priority
              sizes="(max-width: 900px) 100vw, 920px"
            />
          </div>
        )}

        <div
          className="inx-blog-content"
          dangerouslySetInnerHTML={{ __html: article.content_html || "" }}
        />
      </article>
    </main>
  );
}
