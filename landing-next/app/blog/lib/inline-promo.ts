/** Split only at a top-level article section boundary, never inside a paragraph. */
export function splitArticleForPromo(html: string) {
  if (!html || /plan,\s*publish,\s*(?:and|&amp;)\s*learn in one place|inx-blog-inline-promo/i.test(html)) return null;

  const headings = [...html.matchAll(/<h2(?:\s[^>]*)?>/gi)];
  if (headings.length < 2) return null;

  // Use reading position, not section count: individual sections vary widely
  // in length and a count-based midpoint can place the card near the end.
  const candidates = headings.slice(1).filter((heading) => heading.index != null && heading.index / html.length < 0.78);
  if (!candidates.length) return null;
  const closest = candidates.reduce((best, heading) =>
    Math.abs((heading.index || 0) / html.length - 0.45) < Math.abs((best.index || 0) / html.length - 0.45) ? heading : best
  );
  const boundary = closest.index;
  if (boundary == null) return null;
  return { before: html.slice(0, boundary), after: html.slice(boundary) };
}
