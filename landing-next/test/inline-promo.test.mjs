import test from "node:test";
import assert from "node:assert/strict";
import { splitArticleForPromo } from "../app/blog/lib/inline-promo.ts";

const promo = { title: "Use the scheduler", description: "Prepare relevant posts.", label: "See scheduler", url: "/seo/bulk-social-media-scheduler", before_heading: "Second" };

test("an approved editorial placement preserves the article content", () => {
  const html = "<p>Introduction</p><h2>First</h2><p>First section</p><h2>Second</h2><p>Second section</p><h2>Third</h2><p>Conclusion</p>";
  const split = splitArticleForPromo(html, promo);
  assert.ok(split);
  assert.equal(split.before + split.after, html);
  assert.equal(split.after.startsWith("<h2>Second</h2>"), true);
});

test("imported articles with a promotion do not receive a duplicate", () => {
  const html = "<h2>One</h2><p>Plan, Publish, And Learn In One Place</p><h2>Two</h2>";
  assert.equal(splitArticleForPromo(html, promo), null);
  assert.equal(splitArticleForPromo("<h2>One</h2><p>No second section</p>", promo), null);
});

test("legacy and unrelated articles receive no automatic promotion", () => {
  const html = "<h2>First</h2><p>Helpful text</p><h2>Second</h2>";
  assert.equal(splitArticleForPromo(html, null), null);
  assert.equal(splitArticleForPromo(html, { ...promo, before_heading: "Unknown" }), null);
  assert.equal(splitArticleForPromo(html, { ...promo, before_heading: "First" }), null);
});
