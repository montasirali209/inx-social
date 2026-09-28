import type { BlogArticle } from "../types";

/** Only display the editorial next step at its approved section boundary. */
export function splitArticleForPromo(html: string, promo: BlogArticle["editorial_promo"]) {
  if (!html || !promo || !promo.before_heading || !promo.url ||
    /plan,\s*publish,\s*(?:and|&amp;)\s*learn in one place|inx-blog-inline-promo/i.test(html)) return null;

  const headings = [...html.matchAll(/<h2(?:\s[^>]*)?>([^<]*)<\/h2>/gi)];
  const heading = headings.slice(1).find((match) => match[1].trim() === promo.before_heading);
  if (heading?.index == null) return null;
  return { before: html.slice(0, heading.index), after: html.slice(heading.index) };
}
