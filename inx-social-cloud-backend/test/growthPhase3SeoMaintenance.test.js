const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 3 SEO maintenance performs live technical checks and builds a persistent link graph', () => {
  const service = read('src/services/growthSeoMaintenanceService.js');

  assert.match(service, /growth_seo_maintenance_state_v1/);
  assert.match(service, /growth_seo_internal_link_graph_v1/);
  assert.match(service, /MISSING_CANONICAL/);
  assert.match(service, /BROKEN_INTERNAL_LINK/);
  assert.match(service, /ORPHAN_PAGE/);
  assert.match(service, /INVALID_JSON_LD/);
  assert.match(service, /DUPLICATE_TITLE/);
  assert.match(service, /rebuildInternalLinkGraph/);
  assert.match(service, /User-Agent': 'INXSocial-SEO-Maintenance\/1\.0'/);
});

test('Growth Autopilot runs Phase 3 automatically during intelligence refresh', () => {
  const autopilot = read('src/services/growthAutopilotService.js');

  assert.match(autopilot, /growthSeoMaintenanceService/);
  assert.match(autopilot, /seoMaintenance\.run\(\{ maxPages: 120 \}\)/);
  assert.match(autopilot, /summary\.seoScore/);
  assert.match(autopilot, /summary\.internalArticleLinks/);
  assert.match(autopilot, /seoMaintenance: seoStatus/);
});

test('Published blog pages consume the Phase 3 article-to-article link graph dynamically', () => {
  const content = read('src/services/growthContentService.js');

  assert.match(content, /SEO_LINK_GRAPH_KEY/);
  assert.match(content, /mergePublicInternalLinks/);
  assert.match(content, /graph\?\.graph\?\.\[article\.id\]/);
  assert.match(content, /kind: normalizeSpace\(link\?\.kind \|\| 'product'\)/);
});

test('Phase 3 admin endpoints and dashboard remain optional overrides around automatic operation', () => {
  const routes = read('src/routes/adminRoutes.js');
  const html = read('public/index.html');
  const js = read('public/admin.js');

  assert.match(routes, /growth-seo-maintenance\/status/);
  assert.match(routes, /growth-seo-maintenance\/run-now/);
  assert.match(html, /SEO Maintenance Autopilot/);
  assert.match(html, /Runs automatically with the daily Growth Autopilot cycle/);
  assert.match(js, /renderGrowthSeoMaintenance/);
  assert.match(js, /runGrowthSeoMaintenanceNow/);
});

test('canonical sitemap is source-driven and both crawler surfaces allow public indexing', () => {
  const backendSitemap = read('public/sitemap.xml');
  const backendRobots = read('public/robots.txt');
  const landingRobots = read('../landing-next/public/robots.txt');
  const nextSitemap = read('../landing-next/app/sitemap.ts');

  assert.match(nextSitemap, /seoPageSlugs/);
  assert.match(backendSitemap, /https:\/\/www\.inxsocial\.co\.uk\/social-media-scheduler/);
  assert.match(backendSitemap, /https:\/\/www\.inxsocial\.co\.uk\/blog/);
  assert.match(backendRobots, /Allow: \//);
  assert.match(landingRobots, /Allow: \//);
  assert.doesNotMatch(backendRobots, /Disallow: \/$/m);
  assert.doesNotMatch(landingRobots, /Disallow: \/$/m);
});

test('scheduled safe source maintenance is constrained to robots and sitemap files and preserves PR checks', () => {
  const workflow = read('../.github/workflows/seo-maintenance.yml');
  const script = read('../scripts/phase3-seo-source-maintenance.js');

  assert.match(workflow, /schedule:/);
  assert.match(workflow, /gh pr create/);
  assert.match(workflow, /gh workflow run ci\.yml/);
  assert.match(workflow, /gh pr merge --auto --squash/);
  assert.match(workflow, /inx-social-cloud-backend\/public\/robots\.txt/);
  assert.match(workflow, /inx-social-cloud-backend\/public\/sitemap\.xml/);
  assert.match(script, /expectedRobots/);
  assert.match(script, /expectedSitemap/);
  assert.doesNotMatch(workflow, /git push origin deployment\/railway-postgres/);
});
