const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Phase 13.4 makes Content Calendar a first-class responsive React route', () => {
  const router = read('frontend/src/router.tsx');
  const sidebar = read('frontend/src/components/layout/Sidebar.tsx');
  const page = read('frontend/src/components/calendar/ContentCalendarPage.tsx');
  const toolbar = read('frontend/src/components/calendar/CalendarToolbar.tsx');

  assert.match(router, /content-calendar.*ContentCalendarPage/);
  assert.match(sidebar, /label: 'Content Calendar'.*reactPath: '\/content-calendar'/);
  assert.match(page, /CalendarGrid/);
  assert.match(page, /CalendarAgenda/);
  assert.match(page, /SelectedDatePanel/);
  assert.match(toolbar, /CalendarFilterMenu/);
  assert.match(toolbar, /Every platform/);
  assert.match(toolbar, /All connected Pages/);
  assert.match(toolbar, /Any status/);
  assert.doesNotMatch(toolbar, /<select/);
  assert.match(toolbar, /Schedule Content/);
  assert.match(toolbar, /Import Batch/);
  assert.match(toolbar, /md:hidden/);
});

test('Phase 13.4 uses live cloud and selected-Page Meta data without sample calendar posts', () => {
  const api = read('frontend/src/lib/calendar-api.ts');
  const page = read('frontend/src/components/calendar/ContentCalendarPage.tsx');
  const bestTime = read('frontend/src/components/calendar/BestTimeCard.tsx');

  assert.match(api, /\/api\/studio\/overview/);
  assert.match(api, /calendarFetchRange/);
  assert.match(api, /limit: '1000'/);
  assert.match(api, /\/api\/studio\/facebook\/scheduled-posts/);
  assert.match(api, /pagesToSync = selectedPageId/);
  assert.match(page, /syncWarnings/);
  assert.match(page, /monthKey.*queryKey|queryKey: \['content-calendar', timezone, pageId, monthKey\]/);
  assert.match(bestTime, /Analytics required/);
  assert.doesNotMatch(`${api}${page}`, /Product Update|Customer Story|Industry Insight|May 12, 2025/);
});

test('Phase 13.4 calendar actions hand selected date and time to the real post composer', () => {
  const actions = read('frontend/src/components/calendar/CalendarQuickActionsCard.tsx');
  const studio = read('studio/app.js');
  const slots = read('frontend/src/components/calendar/AvailableSlotsCard.tsx');

  assert.match(actions, /scheduleDate=/);
  assert.match(actions, /scheduleTime=/);
  assert.match(studio, /applyRequestedPostComposerState/);
  assert.match(studio, /directPublishMode/);
  assert.match(studio, /directPostDate/);
  assert.match(studio, /directPostTime/);
  assert.match(slots, /disabled={!slot\.available}/);
});
