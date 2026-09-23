const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('AI Campaign uses one visual builder with text, image and mixed modes', () => {
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const modal = read('frontend/src/components/ai-content-studio/AiPostCampaignModal.tsx');
  const types = read('frontend/src/types/ai-content-studio.ts');

  assert.match(page, /AiPostCampaignModal/);
  assert.match(page, /aiCampaignId/);

  assert.match(modal, /Text Post Only/);
  assert.match(modal, /Image Post Only/);
  assert.match(modal, /Mix Text \+ Image/);
  assert.match(modal, /Content mix/);
  assert.match(modal, /imagePostCount/);
  assert.match(modal, /SocialPlatformIcon/);
  assert.match(modal, /Campaign workspace/);
  assert.match(modal, /Recent work/);
  assert.match(modal, /scrollIntoView/);
  assert.doesNotMatch(modal, />Tone</);

  assert.match(types, /contentMode: 'TEXT' \| 'IMAGE' \| 'MIXED'/);
  assert.match(types, /contentType: 'TEXT' \| 'IMAGE'/);
  assert.match(types, /imagePostCount: number/);
  assert.match(types, /textPostCount: number/);
});

test('AI campaign backend applies campaign skills and exact mixed post counts', () => {
  const service = read('src/services/aiPostCampaignService.js');
  const controller = read('src/controllers/aiContentStudioController.js');
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260923093000_add_mixed_ai_campaign_types/migration.sql');

  assert.match(service, /CAMPAIGN SKILL STACK/);
  assert.match(service, /Hook engineering/);
  assert.match(service, /Brevity discipline/);
  assert.match(service, /Cross-platform fit/);
  assert.match(service, /Campaign sequencing/);
  assert.match(service, /Media intelligence/);
  assert.match(service, /Anti-repetition QA/);
  assert.match(service, /reasoningEffort: 'high'/);
  assert.match(service, /postStudio\.REASONING_MODEL/);
  assert.match(service, /normaliseBusinessUrl/);
  assert.match(service, /https:\/\//);
  assert.match(service, /planCampaign/);
  assert.match(service, /contentType: post\.contentType === 'IMAGE'/);
  assert.match(service, /post\.contentType !== 'IMAGE'/);

  assert.match(controller, /z\.enum\(\['TEXT', 'IMAGE', 'MIXED'\]\)/);
  assert.match(controller, /imagePostCount/);
  assert.match(controller, /Mixed campaigns need at least one image post and one text post/);
  assert.doesNotMatch(controller.match(/const campaignSchema[\s\S]*?\n\};/)?.[0] || '', /tone:/);

  assert.match(schema, /imagePostCount Int/);
  assert.match(schema, /contentType    String/);
  assert.match(migration, /ADD COLUMN "imagePostCount"/);
  assert.match(migration, /ADD COLUMN "contentType"/);
});

test('campaign output is constrained for readability and platform fit', () => {
  const service = read('src/services/aiPostCampaignService.js');

  assert.match(service, /captionLimit/);
  assert.match(service, /return 270/);
  assert.match(service, /return 290/);
  assert.match(service, /trimCaption/);
  assert.match(service, /one clear idea per post/i);
  assert.match(service, /hashtags must be sparse/i);
  assert.match(service, /do not write feature-list essays/i);
});

test('AI campaign handoff is persistent and Bulk Scheduler can reopen saved mixed campaigns', () => {
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const bulk = read('frontend/src/components/bulk-scheduler/BulkSchedulerPage.tsx');
  const panel = read('frontend/src/components/bulk-scheduler/UploadBatchPanel.tsx');

  assert.match(page, /aiCampaignId: campaign\.id/);
  assert.match(page, /navigate\('\/bulk-scheduler'/);

  assert.match(bulk, /ACTIVE_AI_CAMPAIGN_KEY/);
  assert.match(bulk, /getAIPostCampaigns/);
  assert.match(bulk, /getAIPostCampaign/);
  assert.match(bulk, /loadSavedCampaign/);
  assert.match(bulk, /ImportedMixedCampaignItem/);
  assert.match(bulk, /mixedCampaign/);
  assert.match(bulk, /mixedTextDestinations/);
  assert.match(bulk, /TEXT_POST_PLATFORMS/);
  assert.match(bulk, /ai-mixed-text-/);
  assert.match(bulk, /ai-mixed-image-/);
  assert.match(bulk, /publishBulkLibraryMedia/);
  assert.match(bulk, /localStorage\.setItem\(ACTIVE_AI_CAMPAIGN_KEY/);

  assert.match(panel, /AI Campaign/);
  assert.match(panel, /AI Campaign Library/);
  assert.match(panel, /Choose a saved campaign/);
  assert.match(panel, /Create AI Campaign/);
  assert.match(panel, /campaignImport\.posts\.map/);
  assert.match(panel, /Schedule AI Campaign/);
});

test('campaign images open in a full-size preview', () => {
  const modal = read('frontend/src/components/ai-content-studio/AiPostCampaignModal.tsx');

  assert.match(modal, /imagePreview/);
  assert.match(modal, /Open full image for post/);
  assert.match(modal, /View full image/);
  assert.match(modal, /Campaign image preview/);
  assert.match(modal, /max-h-\[72dvh\]/);
});


test('AI Studio creator modals and campaign card use shared motion and centered campaign layout', () => {
  const campaign = read('frontend/src/components/ai-content-studio/AiPostCampaignModal.tsx');
  const page = read('frontend/src/components/ai-content-studio/AiContentStudioPage.tsx');
  const image = read('frontend/src/components/ai-content-studio/ImagePostChatModalV4.tsx');
  const carousel = read('frontend/src/components/ai-content-studio/CarouselChatModalV2.tsx');
  const generation = read('frontend/src/components/ai-content-studio/GenerationModal.tsx');
  const css = read('frontend/src/components/ai-content-studio/studio-controls.css');

  assert.match(css, /@keyframes ai-studio-modal-enter/);
  assert.match(css, /\.ai-studio-modal-enter/);
  assert.match(css, /\.ai-campaign-3d-card/);

  assert.match(image, /ai-studio-modal-enter/);
  assert.match(carousel, /ai-studio-modal-enter/);
  assert.match(generation, /ai-studio-modal-enter/);

  assert.match(campaign, /grid place-items-center/);
  assert.match(campaign, /sm:h-\[min\(94dvh,980px\)\]/);
  assert.match(campaign, /Social platforms/);
  assert.match(campaign, /overflow-x-auto/);
  assert.match(campaign, /text-\[11px\].*Content mix|Content mix[\s\S]*text-\[11px\]/);
  assert.match(campaign, /ai-campaign-3d-card/);

  assert.match(page, /ai-campaign-3d-card group/);
  assert.match(page, /Text posts/);
  assert.match(page, /Image posts/);
  assert.match(page, /Mixed campaigns/);
});
