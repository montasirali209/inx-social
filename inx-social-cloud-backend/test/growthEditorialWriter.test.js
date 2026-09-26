const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('editorial writer requires answer-first structure, takeaways and source-backed comparisons', () => {
  const service = read('src/services/growthContentService.js');

  assert.match(service, /quick_answer/);
  assert.match(service, /key_takeaways/);
  assert.match(service, /comparison/);
  assert.match(service, /source_refs/);
  assert.match(service, /Use the source IDs exactly as \[S1\]/);
  assert.match(service, /specialist publication, not a generic SEO content generator/);
  assert.match(service, /never pad to a word count/);
});

test('research desk prioritises primary and reputable sources instead of thin SEO pages', () => {
  const service = read('src/services/growthContentService.js');

  assert.match(service, /Prefer primary sources/);
  assert.match(service, /official documentation/);
  assert.match(service, /Avoid scraped listicles, thin affiliate roundups/);
  assert.match(service, /professionalSourceTitle/);
  assert.match(service, /normalizeSources/);
});

test('article quality gate scores inline citations and meaningful source labels', () => {
  const service = read('src/services/growthContentService.js');

  assert.match(service, /citationCount/);
  assert.match(service, /namedSourceCount/);
  assert.match(service, /Important factual claims need inline source citations/);
  assert.match(service, /Every source needs a meaningful title or publisher label/);
});

test('public blog renders quick answers, comparisons, recommendations and professional sources', () => {
  const page = read('../landing-next/app/blog/[slug]/page.tsx');
  const css = read('../landing-next/app/blog/blog.css');

  assert.match(page, /Quick answer/);
  assert.match(page, /Key takeaways/);
  assert.match(page, /Comparison overview/);
  assert.match(page, /Recommended INXSocial tools/);
  assert.match(page, /source\.domain/);
  assert.match(page, /source_refs/);
  assert.match(css, /inx-blog-answer-box/);
  assert.match(css, /inx-blog-recommendation-card/);
});

test('self-hosted blog is crawlable and advertises its sitemap', () => {
  const robots = read('../landing-next/public/robots.txt');

  assert.match(robots, /Allow: \//);
  assert.doesNotMatch(robots, /Disallow: \/$/m);
  assert.match(robots, /blog\/sitemap\.xml/);
});

test('article structured data exposes BlogPosting, citations and word count', () => {
  const service = read('src/services/growthContentService.js');

  assert.match(service, /'@type': 'BlogPosting'/);
  assert.match(service, /wordCount:/);
  assert.match(service, /citation: normalizeSources/);
  assert.match(service, /inLanguage: 'en-GB'/);
});


test('research facts are bound to verified web-search sources before writing', () => {
  const service = read('src/services/growthContentService.js');

  assert.match(service, /source_url/);
  assert.match(service, /bindResearchEvidence/);
  assert.match(service, /source_ref/);
  assert.match(service, /CONTENT_RESEARCH_EVIDENCE_WEAK/);
  assert.match(service, /facts\.length < 3/);
});

test('independent critic may verify consequential claims with live web search', () => {
  const strategist = read('src/services/growthStrategyService.js');

  assert.match(strategist, /independently verify a consequential factual or product claim/);
  assert.match(strategist, /type: 'web_search'/);
  assert.match(strategist, /tool_choice: 'auto'/);
});

test('BlogPosting author URL resolves to the canonical site instead of a nonexistent profile page', () => {
  const service = read('src/services/growthContentService.js');

  assert.match(service, /name: 'INXSocial Editorial', url: SITE_URL/);
  assert.doesNotMatch(service, /SITE_URL \+ '\/about'/);
});
