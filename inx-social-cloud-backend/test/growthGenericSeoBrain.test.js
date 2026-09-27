const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const skills = require('../src/services/growthSeoSkillRegistry');
const sites = require('../src/services/growthSiteService');
const siteIntelligence = require('../src/services/growthSiteIntelligenceService');
const externalVisibility = require('../src/services/externalVisibilityService');
const seoMaintenance = require('../src/services/growthSeoMaintenanceService');
const gsc = require('../src/services/googleSearchConsoleService');

test('SEO/GEO brain hardcodes professional skills rather than product facts', () => {
  assert.equal(skills.VERSION, 'seo-geo-expert-skills-v1');
  assert.ok(skills.SKILLS.length >= 10);
  for (const key of ['DISCOVERY','TECHNICAL','INFORMATION_ARCHITECTURE','SEARCH_INTENT','ON_PAGE','CONTENT_STRATEGY','COMPETITIVE_RESEARCH','AEO_GEO','AUTHORITY','MEASUREMENT','EXPERIMENTATION','GOVERNANCE']) {
    assert.ok(skills.SKILLS.some(skill => skill.key === key), key);
  }
  const prompt = skills.expertOperatingInstructions();
  assert.match(prompt, /business facts are not/i);
  assert.match(prompt, /Discover the business/);
  assert.match(prompt, /keyword cannibalisation/i);
  assert.match(prompt, /AI-search visibility/i);
  assert.doesNotMatch(prompt, /Buffer|Hootsuite|INXSocial/);
});

test('Growth site registry creates stable independent site identities', () => {
  const a = sites.siteIdForOrigin('https://example.com/');
  const b = sites.siteIdForOrigin('https://example.org/');
  assert.equal(a, sites.siteIdForOrigin('https://example.com'));
  assert.notEqual(a, b);
  assert.equal(sites.normaliseOrigin('https://example.com/path?q=1'), 'https://example.com');
  assert.match(sites.settingKey('profile', a), new RegExp('^profile:' + a + '$'));
});

test('semantic snapshot diff detects new, removed and materially changed pages', () => {
  const site = { id: 'site-a', origin: 'https://example.com', hostname: 'example.com' };
  const first = siteIntelligence.snapshotFromCrawl(site, {
    pages: [
      { path: '/', status: 200, title: 'Example', description: 'Home', h1: 'Home', headings: [], textSample: 'Product A' },
      { path: '/pricing', status: 200, title: 'Pricing', description: 'Plans', h1: 'Pricing', headings: [], textSample: '£10' }
    ]
  });
  const second = siteIntelligence.snapshotFromCrawl(site, {
    pages: [
      { path: '/', status: 200, title: 'Example', description: 'Home', h1: 'Home', headings: [], textSample: 'Product B' },
      { path: '/features', status: 200, title: 'Features', description: 'Features', h1: 'Features', headings: [], textSample: 'Feature list' }
    ]
  });
  const diff = siteIntelligence.diffSnapshots(first, second);
  assert.deepEqual(diff.added, ['/features']);
  assert.deepEqual(diff.removed, ['/pricing']);
  assert.deepEqual(diff.changed, ['/']);
  assert.equal(diff.material, true);
});

test('crawler URL normalization works for arbitrary managed origins', () => {
  assert.equal(seoMaintenance.canonicalPath('https://example.com/a/', 'https://example.com'), '/a');
  assert.equal(seoMaintenance.normalizeUrl('/pricing?ref=x#top', 'https://example.com'), 'https://example.com/pricing');
  assert.equal(seoMaintenance.normalizeUrl('https://other.example/a', 'https://example.com'), '');
});

test('AI visibility uses dynamically supplied competitors and monitored site identity', () => {
  const answer = 'Acme and Bravo are often compared, while ExampleBrand is another option.';
  assert.equal(externalVisibility.brandMentioned(answer, 'ExampleBrand'), true);
  assert.deepEqual(
    externalVisibility.competitorMentions(answer, [{ name: 'Acme' }, { name: 'Bravo' }, { name: 'Unseen' }], 'ExampleBrand'),
    ['Acme','Bravo']
  );
  assert.equal(
    externalVisibility.sourceMentionsSite([{ url: 'https://docs.example.com/page' }], 'https://example.com'),
    true
  );
});

test('Search Console property selection is based on the managed site origin', () => {
  const available = [
    { siteUrl: 'sc-domain:example.com' },
    { siteUrl: 'https://www.other.com/' }
  ];
  assert.equal(gsc.siteForOrigin(available, 'https://www.example.com'), 'sc-domain:example.com');
  assert.equal(gsc.siteForOrigin(available, 'https://missing.example'), null);
});

test('Growth pipeline consumes discovered profile and reusable skills instead of fixed topic lists', () => {
  const intelligence = read('src/services/growthIntelligenceService.js');
  const strategy = read('src/services/growthStrategyService.js');
  const autopilot = read('src/services/growthAutopilotService.js');
  const content = read('src/services/growthContentService.js');
  const authority = read('src/services/growthAuthorityService.js');
  const optimization = read('src/services/growthOptimizationService.js');
  const visibility = read('src/services/externalVisibilityService.js');

  assert.match(intelligence, /siteIntelligence\.latest/);
  assert.match(intelligence, /dynamicPrompts/);
  assert.doesNotMatch(intelligence, /Buffer alternatives|Hootsuite alternative|best AI social media scheduler/);
  assert.match(strategy, /seoSkills\.strategyInstructions/);
  assert.match(strategy, /DISCOVERED SITE PROFILE/);
  assert.match(autopilot, /siteIntelligence\.refresh/);
  assert.match(autopilot, /profile\?\.visibilityPrompts/);
  assert.match(content, /seoSkills\.writerInstructions/);
  assert.match(authority, /DISCOVERED SITE PROFILE/);
  assert.match(optimization, /seoSkills\.expertOperatingInstructions/);
  assert.doesNotMatch(visibility, /KNOWN_COMPETITORS/);
});

test('UGC ad campaign system is outside the generic Growth brain refactor', () => {
  for (const file of [
    'src/services/growthSeoSkillRegistry.js',
    'src/services/growthSiteIntelligenceService.js',
    'src/services/growthSiteService.js'
  ]) {
    assert.doesNotMatch(read(file), /ugcStudio|ugcModelRouter|ugcProviderAdapters|ugcEngine/i);
  }
});
