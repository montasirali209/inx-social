const test = require('node:test');
const assert = require('node:assert/strict');

const research = require('../src/services/creativeFlowResearchService');

test('rendered HTML extraction keeps product identity headings and same-domain links', () => {
  const context = research.contextFromHtml('https://inxready.co.uk/', `
    <!doctype html><html><head>
      <title>INXReady – AI Interview Practice</title>
      <meta property="og:site_name" content="INXReady">
      <meta name="description" content="Practice job and visa interviews with AI.">
      <script type="application/ld+json">{"@type":"SoftwareApplication","name":"INXReady"}</script>
    </head><body>
      <h1>Practice interviews before the real one</h1>
      <h2>Job interview preparation</h2>
      <a href="/features">Features</a>
      <a href="https://example.com/not-ours">External</a>
      <p>${'Useful product evidence '.repeat(80)}</p>
    </body></html>`);

  assert.equal(context.siteName, 'INXReady');
  assert.match(context.title, /INXReady/);
  assert.ok(context.text.length > 500);
  assert.deepEqual(context.structuredNames, ['INXReady']);
  assert.equal(context.links.length, 1);
  assert.match(context.links[0], /inxready\.co\.uk\/features/);
});

test('identity validation rejects nonsense model names and carries evidence quality', () => {
  const output = research.validateAnalysisIdentity({
    productName: 'Qqe',
    summary: 'Interview practice product',
    cautions: [],
    sources: [{ type: 'url', label: 'old', ok: true }],
  }, {
    canonicalName: 'INXReady',
    evidenceScore: 82,
    evidenceConfidence: 'high',
    sourceCoverage: 4,
    researchMode: 'browser-assisted-crawl',
    pages: [
      { url: 'https://inxready.co.uk/', title: 'INXReady', ok: true },
      { url: 'https://inxready.co.uk/features', title: 'Features', ok: true },
    ],
  });

  assert.equal(output.productName, 'INXReady');
  assert.equal(output.evidenceConfidence, 'high');
  assert.equal(output.evidenceScore, 82);
  assert.equal(output.sourceCoverage, 4);
  assert.equal(output.researchMode, 'browser-assisted-crawl');
  assert.equal(output.sources.length, 2);
});

test('low evidence is explicit instead of silently being treated as trustworthy', () => {
  const output = research.validateAnalysisIdentity({
    productName: '',
    cautions: [],
    sources: [],
  }, {
    canonicalName: 'Example Product',
    evidenceScore: 20,
    evidenceConfidence: 'low',
    sourceCoverage: 1,
    researchMode: 'fast-fetch',
    pages: [{ url: 'https://example.com/', title: 'Example Product', ok: true }],
  });

  assert.equal(output.productName, 'Example Product');
  assert.equal(output.evidenceConfidence, 'low');
  assert.match(output.cautions.join(' '), /evidence coverage is limited/i);
});
