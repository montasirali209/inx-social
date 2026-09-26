import Link from "next/link";
import { slugify } from "../lib/blog-client";
import type { BlogArticleSummary } from "../types";

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function ArticleCard({ article }: { article: BlogArticleSummary }) {
  const published = formatDate(article.published_at || article.created_at);
  const summary = article.excerpt || article.meta_description;
  const tags = Array.isArray(article.keywords) ? article.keywords.slice(0, 3) : [];

  return (
    <article className="inx-blog-card">
      {article.featured_image_url ? (
        <Link className="inx-blog-card-image" href={`/blog/${article.slug}`} aria-label={article.title}>
          <img
            src={article.featured_image_url}
            alt=""
            loading="lazy"
          />
        </Link>
      ) : (
        <Link className="inx-blog-card-image inx-blog-card-image-placeholder" href={`/blog/${article.slug}`}>
          <span>INXSocial</span>
        </Link>
      )}

      <div className="inx-blog-card-body">
        {published && <time dateTime={article.published_at || article.created_at || undefined}>{published}</time>}
        <h2>
          <Link href={`/blog/${article.slug}`}>{article.title}</Link>
        </h2>
        {summary && <p>{summary}</p>}

        <div className="inx-blog-card-footer">
          <div className="inx-blog-tags" aria-label="Article tags">
            {tags.map((tag) => (
              <Link key={tag} href={`/blog/tag/${slugify(tag)}`}>
                {tag}
              </Link>
            ))}
          </div>
          <Link className="inx-blog-read-link" href={`/blog/${article.slug}`}>
            Read article <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
