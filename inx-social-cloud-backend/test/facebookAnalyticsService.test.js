const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getFacebookAnalytics,
  resetAnalyticsState,
  capabilityFromError
} = require('../src/services/facebookAnalyticsService');

function ok(data, headers = {}) {
  return { status: 200, data, headers };
}

function mockHttp({ unsupported = [] } = {}) {
  const calls = [];
  return {
    calls,
    async get(url, config) {
      calls.push({ url, params: config.params });
      if (/\/published_posts$/.test(url)) {
        return ok({ data: [
          { id: 'p1', message: 'First post', created_time: '2026-08-10T10:00:00+0000', reactions: { summary: { total_count: 12 } }, comments: { summary: { total_count: 3 } }, shares: { count: 2 } },
          { id: 'p2', message: 'Second post', created_time: '2026-08-11T10:00:00+0000', reactions: { summary: { total_count: 8 } }, comments: { summary: { total_count: 1 } }, shares: { count: 1 } }
        ] });
      }
      if (/\/insights$/.test(url)) {
        if (unsupported.includes(config.params.metric)) {
          return { status: 400, headers: {}, data: { error: { code: 100, message: `Metric ${config.params.metric} is not valid.` } } };
        }
        return ok({ data: [{ name: config.params.metric, values: [
          { end_time: '2026-08-10T08:00:00+0000', value: 4 },
          { end_time: '2026-08-11T08:00:00+0000', value: 6 }
        ] }] });
      }
      return ok({ id: 'page-1', name: 'Test Page', followers_count: 321, fan_count: 300, picture: { data: { url: 'https://example.test/page.jpg' } } });
    }
  };
}

test('Facebook analytics aggregates real Page and post engagement data', async () => {
  resetAnalyticsState();
  const http = mockHttp();
  const result = await getFacebookAnalytics({ pageId: 'page-1', accessToken: 'token', graphVersion: 'v25.0', days: 30 }, { http });
  assert.equal(result.page.name, 'Test Page');
  assert.equal(result.summary.followers, 321);
  assert.equal(result.summary.posts, 2);
  assert.equal(result.summary.reactions, 20);
  assert.equal(result.summary.comments, 4);
  assert.equal(result.summary.shares, 3);
  assert.equal(result.summary.engagements, 27);
  assert.equal(result.summary.views, 10);
  assert.equal(result.capabilities.basicEngagement.available, true);
  assert.equal(result.capabilities.pageInsights.available, true);
  assert.equal(http.calls.length, 5);
});

test('unsupported Meta insight metrics stay unavailable without failing the analytics page', async () => {
  resetAnalyticsState();
  const http = mockHttp({ unsupported: ['page_media_view', 'page_follows'] });
  const result = await getFacebookAnalytics({ pageId: 'page-2', accessToken: 'token', graphVersion: 'v25.0', days: 7 }, { http });
  assert.equal(result.summary.views, null);
  assert.equal(result.capabilities.metrics.views.available, false);
  assert.equal(result.capabilities.metrics.views.state, 'unsupported_metric');
  assert.equal(result.capabilities.metrics.engagements.available, true);
  assert.equal(result.content.length, 2);
  assert.equal(result.warnings.length, 2);
});

test('analytics results are cached so dashboard rendering cannot repeatedly call Meta', async () => {
  resetAnalyticsState();
  const http = mockHttp();
  await getFacebookAnalytics({ pageId: 'page-3', accessToken: 'token', graphVersion: 'v25.0', days: 30 }, { http });
  const callsAfterFirstRequest = http.calls.length;
  const cached = await getFacebookAnalytics({ pageId: 'page-3', accessToken: 'token', graphVersion: 'v25.0', days: 30 }, { http });
  assert.equal(cached.cache.hit, true);
  assert.equal(http.calls.length, callsAfterFirstRequest);
});

test('Meta rate limits are identified for quota-aware cooldown handling', () => {
  const error = new Error('Application request limit reached');
  error.response = { status: 429, data: { error: { code: 4, message: error.message } } };
  assert.deepEqual(capabilityFromError(error), {
    state: 'rate_limited',
    available: false,
    reason: 'Meta temporarily limited analytics requests. INX Social will wait before checking again.',
    metaCode: 4
  });
});
