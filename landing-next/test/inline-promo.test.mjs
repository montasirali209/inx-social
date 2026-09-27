import test from "node:test";
import assert from "node:assert/strict";
import { splitArticleForPromo } from "../app/blog/lib/inline-promo.ts";

test("articles without a promo get one at a section boundary without losing content", () => {
  const html = "<p>Introduction</p><h2>First</h2><p>First section</p><h2>Second</h2><p>Second section</p><h2>Third</h2><p>Conclusion</p>";
  const split = splitArticleForPromo(html);
  assert.ok(split);
  assert.equal(split.before + split.after, html);
  assert.equal(split.after.startsWith("<h2>Second</h2>"), true);
});

test("imported articles with a promotion do not receive a duplicate", () => {
  const html = "<h2>One</h2><p>Plan, Publish, And Learn In One Place</p><h2>Two</h2>";
  assert.equal(splitArticleForPromo(html), null);
  assert.equal(splitArticleForPromo("<h2>One</h2><p>No second section</p>"), null);
});

test("uneven sections place the card near the middle of the reading experience", () => {
  const section = (name, size) => `<h2>${name}</h2><p>${"x".repeat(size)}</p>`;
  const html = section("Intro", 200) + section("Long", 1200) + section("Middle", 800) + section("End", 800);
  const split = splitArticleForPromo(html);
  assert.ok(split);
  assert.equal(split.after.startsWith("<h2>Middle</h2>"), true);
});
