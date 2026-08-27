const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('customer navigation exposes the focused professional product shell', () => {
  const html = read('studio/index.html'); const css = read('studio/styles.css');
  assert.doesNotMatch(html, /data-view="manual"/); assert.doesNotMatch(html, /data-view="health"/);
  assert.match(html, /data-view="dashboard"><span class="nav-icon">/); assert.match(html, /data-view="pages"><span class="nav-icon">/);
  assert.match(html, /portal-nav-link[^>]*>[\s\S]*Billing &amp; Plans/); assert.match(html, /id="btnCreateNewPost"/);
  assert.doesNotMatch(html, />Inbox</); assert.doesNotMatch(html, />Team Members</); assert.match(css, /\.nav::before\s*\{\s*display:\s*none;/);
});

test('customer Activity Logs exclude administrator system details', () => {
  const html = read('studio/index.html'); const controller = read('src/controllers/studioController.js');
  assert.match(html, /Complete upload &amp; schedule history/); assert.doesNotMatch(html, /System event details/); assert.match(controller, /logs:\s*\[\]/);
});

test('Facebook analytics use live capability detection without inventing unavailable insights', () => {
  const html = read('studio/index.html'); const app = read('studio/app.js'); const routes = read('src/routes/studioRoutes.js');
  assert.match(html, /id="analyticsPlatformSelect"/); assert.match(html, /YouTube — coming soon/); assert.match(html, /TikTok — coming soon/);
  assert.doesNotMatch(html, /read_insights/); assert.match(html, /Exact Meta capability detection/); assert.match(routes, /analytics\/facebook/);
  assert.match(app, /getFacebookAnalytics/); assert.match(html, /Unavailable values are never estimated/); assert.match(app, /function renderAnalyticsTrend/);
  assert.match(app, /analyticsRecentContent/); assert.match(html, /id="analyticsReviewEvidence"/); assert.match(html, /id="btnCopyAnalyticsReviewSteps"/);
  assert.match(app, /renderAnalyticsReviewEvidence/); assert.match(app, /copyAnalyticsReviewSteps/);
});

test('Page pictures use an authenticated Graph image fallback', () => {
  const controller = read('src/controllers/studioController.js');
  assert.match(controller, /facebookPageId\)\}\/picture/); assert.match(controller, /params:\s*\{ type: 'large', access_token: pageAccessToken \}/); assert.match(controller, /responseType:\s*'arraybuffer'/);
});

test('Social Agent exposes AI-led missions, independent Page targets and distinct intelligence views', () => {
  const html = read('studio/index.html'); const app = read('studio/app.js'); const admin = read('public/index.html');
  assert.match(html, /value="AUTOPILOT"/); assert.match(html, /value="HYBRID"/); assert.match(html, /id="agentMissionCore"/);
  assert.match(html, /id="agentLiveFeed"/); assert.match(html, /id="agentMemoryGrid"/); assert.match(html, /Facebook Page targets/);
  assert.match(html, /Every workflow keeps its own destination selection/); assert.match(html, /id="agentPageTargetGrid"/);
  assert.match(html, /Mission intelligence/); assert.match(html, /Live work monitor/); assert.match(html, /Only the task running now and its next system step/);
  assert.match(html, /never private chain-of-thought/); assert.doesNotMatch(html, />Working memory</); assert.doesNotMatch(html, /Media budget mode/);
  assert.match(html, /AI content decision/); assert.match(html, /Let INX Agent decide/); assert.match(app, /resumeAgentPlan/);
  assert.match(admin, /AI Model Routing/); assert.match(admin, /Video generation policy/); assert.match(admin, /Allow paid gateway only if Ollama is unavailable/);
  assert.match(admin, /Agent Learning Control/); assert.match(admin, /Social Agent availability/); assert.match(admin, /Admins only — development mode/);
  assert.match(app, /FIFO · one mission at a time/); assert.match(app, /Agent missions used/); assert.match(app, /targetPageIds/);
  assert.match(app, /renderAgentPageTargets/); assert.match(app, /agent-plan-page-chips/); assert.match(app, /new missions available/);
  assert.match(app, /ACTION CENTER/); assert.match(app, /MISSION TASKS/); assert.match(app, /data-agent-task-detail/); assert.match(app, /openAgentTaskOutputs/);
  assert.match(app, /restoreAgentWorkspaceUi/); assert.doesNotMatch(app, /Disclosed AI route/); assert.doesNotMatch(app, /Maximum estimate/);
  assert.doesNotMatch(app, /Actual paid usage/); assert.match(app, /account\.features\?\.socialAgent\?\.visible/); assert.doesNotMatch(html, /Default daily slots/);
});

test('dependency states are distinct from genuine Ollama provider failures', () => {
  const runtime = read('src/services/agentRuntimeService.js');
  assert.match(runtime, /WAITING_MEDIA_WORKER/); assert.match(runtime, /ACTION_REQUIRED/); assert.match(runtime, /WAITING_PLATFORM/);
  assert.match(runtime, /providerFailure \? 'WAITING_PROVIDER'/); assert.match(runtime, /continue;\s*\n\s*}/); assert.match(runtime, /Independent Ollama tasks continued/);
});
