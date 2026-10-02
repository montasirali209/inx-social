const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Creative Flow rebuild Stage 1 persists projects before workflow execution', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20261002090000_add_creative_flow_projects/migration.sql');
  const service = read('src/services/creativeFlowProjectService.js');

  assert.match(schema, /model CreativeFlowProject/);
  assert.match(schema, /creativeFlowProjects\s+CreativeFlowProject\[\]/);
  assert.match(schema, /currentStage\s+String\s+@default\("PROJECT_CREATED"\)/);
  assert.match(schema, /activeJobType\s+String\?/);
  assert.match(schema, /workflowJson\s+String\?/);
  assert.match(schema, /renderCampaignId\s+String\?/);
  assert.match(schema, /handoffCampaignId\s+String\?/);

  assert.match(migration, /CreativeFlowProject_one_active_job_per_user/);
  assert.match(migration, /WHERE "activeJobType" IS NOT NULL AND "archivedAt" IS NULL/);

  assert.match(service, /async function createProject/);
  assert.match(service, /async function listProjects/);
  assert.match(service, /async function openProject/);
  assert.match(service, /async function claimActiveJob/);
  assert.match(service, /CREATIVE_FLOW_JOB_ALREADY_ACTIVE/);
  assert.match(service, /This project is saved and can start when the active job finishes/);
});

test('Creative Flow Project Hub uses authenticated project CRUD APIs', () => {
  const routes = read('src/routes/aiContentStudioRoutes.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const api = read('frontend/src/lib/creative-flow-api.ts');

  assert.match(routes, /get\('\/creative-flow\/projects'/);
  assert.match(routes, /post\('\/creative-flow\/projects'/);
  assert.match(routes, /post\('\/creative-flow\/projects\/:projectId\/open'/);
  assert.match(routes, /patch\('\/creative-flow\/projects\/:projectId'/);
  assert.match(routes, /delete\('\/creative-flow\/projects\/:projectId'/);

  assert.match(controller, /creativeFlowProjectService\.listProjects/);
  assert.match(controller, /creativeFlowProjectService\.createProject/);
  assert.match(controller, /creativeFlowProjectService\.openProject/);
  assert.match(controller, /creativeFlowProjectService\.archiveProject/);

  assert.match(api, /listCreativeFlowProjects/);
  assert.match(api, /createCreativeFlowProject/);
  assert.match(api, /openCreativeFlowProject/);
  assert.match(api, /archiveCreativeFlowProject/);
});

test('Project Hub stays INXSocial-native and does not start the motion canvas early', () => {
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const hub = read('frontend/src/components/ai-content-studio/CreativeFlowProjectHubModal.tsx');

  assert.match(page, /CreativeFlowProjectLaunchCard/);
  assert.match(page, /CreativeFlowProjectHubModal/);
  assert.doesNotMatch(page, /<CreativeFlowModal/);

  assert.match(hub, /Creative Flow Projects/);
  assert.match(hub, /New project/);
  assert.match(hub, /Name your project/);
  assert.match(hub, /Only one Creative Flow AI job can actively process at a time/);
  assert.match(hub, /Project persistence is ready/);
  assert.doesNotMatch(hub, /@rive-app|gsap|@xyflow\/react/);
});

test('Stage 1 does not change existing scheduler, billing, publishing or generation models', () => {
  const migration = read('prisma/migrations/20261002090000_add_creative_flow_projects/migration.sql');

  assert.doesNotMatch(migration, /ALTER TABLE "AiPostCampaign"/);
  assert.doesNotMatch(migration, /ALTER TABLE "ScheduleJob"/);
  assert.doesNotMatch(migration, /ALTER TABLE "Subscription"/);
  assert.doesNotMatch(migration, /ALTER TABLE "SocialPublication"/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN/);
});
