const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin, requireSuperAdmin } = require('../middleware/authMiddleware');
const {
  overview,
  users,
  userDetail,
  createUser,
  updateUserAccess,
  updateCommercialPlan,
  adjustUserCredits,
  settings,
  aiStudioPolicyStatus,
  updateAiStudioPolicy,
  aiRouting,
  updateAiRouting,
  agentAccessPolicy,
  updateAgentAccessPolicy,
  agentLearning,
  reviewAgentLearning,
  ugcAvatars,
  uploadUgcAvatar,
  ugcAvatarContent,
  downloadUgcAvatars,
  deleteUgcAvatars,
  ugcAnalyticsSummary,
  ugcOperationsSummary
} = require('../controllers/adminController');
const adminSecurity = require('../controllers/adminSecurityController');
const googleSearchConsole = require('../controllers/googleSearchConsoleController');
const growthIntelligence = require('../controllers/growthIntelligenceController');
const growthContent = require('../controllers/growthContentController');
const growthAutopilot = require('../controllers/growthAutopilotController');
const growthSeoMaintenance = require('../controllers/growthSeoMaintenanceController');
const growthAuthority = require('../controllers/growthAuthorityController');
const growthOptimization = require('../controllers/growthOptimizationController');
const growthDashboard = require('../controllers/growthDashboardController');
const websiteMedia = require('../controllers/websiteMediaAdminController');
const uiStudio = require('../controllers/uiStudioController');
const adminSecurityRoutes = require('./adminSecurityRoutes');

router.get('/search-console/oauth/callback', googleSearchConsole.oauthCallback);

router.use(requireAuth, requireAdmin);
router.get('/overview', overview);
router.get('/ui-studio/projects', uiStudio.list);
router.post('/ui-studio/projects', requireSuperAdmin, uiStudio.create);
router.get('/ui-studio/projects/:projectId', uiStudio.detail);
router.post('/ui-studio/projects/:projectId/analyse', requireSuperAdmin, uiStudio.analyse);
router.post('/ui-studio/projects/:projectId/generate', requireSuperAdmin, uiStudio.generate);
router.post('/ui-studio/projects/:projectId/production-code', requireSuperAdmin, uiStudio.finalizeProductionCode);
router.get('/ui-studio/projects/:projectId/agent/messages', uiStudio.agentMessages);
router.post('/ui-studio/projects/:projectId/agent/messages', requireSuperAdmin, uiStudio.askAgent);
router.get('/ui-studio/generations/:generationId', uiStudio.generation);
router.get('/ui-studio/projects/:projectId/phase5', uiStudio.phase5Status);
router.post('/ui-studio/projects/:projectId/phase5/run', requireSuperAdmin, uiStudio.startConvergence);
router.get('/ui-studio/projects/:projectId/phase5/batches/:batchId', uiStudio.convergenceBatch);
router.post(
  '/ui-studio/projects/:projectId/phase5/assets',
  requireSuperAdmin,
  express.raw({ type: ['image/png','image/jpeg','image/webp','image/avif','video/mp4','video/webm','video/quicktime'], limit: '30mb' }),
  uiStudio.uploadAssetBinding
);
router.delete('/ui-studio/projects/:projectId/phase5/assets/:bindingId', requireSuperAdmin, uiStudio.deleteAssetBinding);
router.post('/ui-studio/projects/:projectId/phase5/masks', requireSuperAdmin, uiStudio.createIgnoreMask);
router.delete('/ui-studio/projects/:projectId/phase5/masks/:maskId', requireSuperAdmin, uiStudio.deleteIgnoreMask);
router.post('/ui-studio/projects/:projectId/phase5/accept/:generationId', requireSuperAdmin, uiStudio.acceptGeneration);
router.get('/ui-studio/projects/:projectId/phase6', uiStudio.phase6Status);
router.post('/ui-studio/projects/:projectId/phase6/deliveries', requireSuperAdmin, uiStudio.createDelivery);
router.get('/ui-studio/projects/:projectId/phase6/deliveries/:deliveryId/export', uiStudio.deliveryExport);
router.post('/ui-studio/projects/:projectId/phase6/deliveries/:deliveryId/pr', requireSuperAdmin, uiStudio.createDeliveryPullRequest);
router.post('/ui-studio/projects/:projectId/phase6/deliveries/:deliveryId/approve', requireSuperAdmin, uiStudio.approveDelivery);
router.post('/ui-studio/projects/:projectId/phase6/deliveries/:deliveryId/deploy', requireSuperAdmin, uiStudio.deployDelivery);
router.get('/ui-studio/projects/:projectId/responsive-preview/:viewport', uiStudio.responsivePreview);
router.post('/ui-studio/projects/:projectId/render', requireSuperAdmin, uiStudio.prepareRender);
router.get('/ui-studio/renders/:renderId', uiStudio.renderDetail);
router.get('/ui-studio/renders/:renderId/preview', uiStudio.renderPreview);
router.get('/ui-studio/renders/:renderId/assets/:kind', uiStudio.renderAsset);
router.post(
  '/ui-studio/renders/:renderId/capture',
  requireSuperAdmin,
  express.raw({ type: ['image/png'], limit: '30mb' }),
  uiStudio.captureRender
);
router.post('/ui-studio/renders/:renderId/repair', requireSuperAdmin, uiStudio.repairRender);
router.post(
  '/ui-studio/projects/:projectId/references/:viewport/upload',
  requireSuperAdmin,
  express.raw({ type: ['image/png','image/jpeg','image/webp','image/avif'], limit: '50mb' }),
  uiStudio.upload
);
router.get('/ui-studio/references/:referenceId/content', uiStudio.content);
router.get('/website-media', websiteMedia.list);
router.get('/website-media/:key', websiteMedia.detail);
router.post('/website-media/:key/upload', requireSuperAdmin, express.raw({ type: ['image/png','image/jpeg','image/webp','image/avif'], limit: '25mb' }), websiteMedia.upload);
router.patch('/website-media/:key', requireSuperAdmin, websiteMedia.update);
router.post('/website-media/:key/restore/:versionId', requireSuperAdmin, websiteMedia.restore);
router.post('/website-media/:key/use-fallback', requireSuperAdmin, websiteMedia.useFallback);
router.get('/search-console/status', googleSearchConsole.status);
router.get('/growth-dashboard', growthDashboard.snapshot);
router.get('/growth-intelligence/overview', growthIntelligence.overview);
router.post('/growth-intelligence/site-audit', requireSuperAdmin, growthIntelligence.runSiteAudit);
router.post('/growth-intelligence/openai-visibility', requireSuperAdmin, growthIntelligence.runOpenAIVisibility);
router.post('/growth-intelligence/provider-visibility', requireSuperAdmin, growthIntelligence.runExternalVisibility);
router.get('/growth-intelligence/analytics/status', growthIntelligence.analyticsStatus);
router.post('/growth-intelligence/analytics/property', requireSuperAdmin, growthIntelligence.selectAnalyticsProperty);
router.get('/growth-intelligence/analytics/realtime', growthIntelligence.analyticsRealtime);
router.get('/growth-intelligence/analytics/performance', growthIntelligence.analyticsPerformance);
router.get('/growth-intelligence/opportunities', growthIntelligence.opportunityStatus);
router.post('/growth-intelligence/opportunities/build', requireSuperAdmin, growthIntelligence.buildOpportunities);
router.post('/growth-intelligence/reddit-opportunities', requireSuperAdmin, growthIntelligence.discoverReddit);
router.get('/content-engine/overview', growthContent.overview);
router.get('/content-engine/articles', growthContent.list);
router.get('/content-engine/articles/:id', growthContent.detail);
router.post('/content-engine/drafts', requireSuperAdmin, growthContent.createDraft);
router.patch('/content-engine/articles/:id', requireSuperAdmin, growthContent.update);
router.post('/content-engine/articles/:id/approve', requireSuperAdmin, growthContent.approve);
router.post('/content-engine/articles/:id/publish', requireSuperAdmin, growthContent.publish);
router.post('/content-engine/articles/:id/unpublish', requireSuperAdmin, growthContent.unpublish);
router.post('/content-engine/articles/:id/archive', requireSuperAdmin, growthContent.archive);
router.post('/content-engine/articles/:id/featured-image', requireSuperAdmin, growthContent.featuredImage);
router.get('/growth-autopilot/status', growthAutopilot.status);
router.patch('/growth-autopilot/config', requireSuperAdmin, growthAutopilot.updateConfig);
router.post('/growth-autopilot/run-now', requireSuperAdmin, growthAutopilot.runNow);
router.get('/growth-seo-maintenance/status', growthSeoMaintenance.status);
router.post('/growth-seo-maintenance/run-now', requireSuperAdmin, growthSeoMaintenance.runNow);
router.get('/growth-authority/status', growthAuthority.status);
router.post('/growth-authority/run-now', requireSuperAdmin, growthAuthority.runNow);
router.post('/growth-authority/prospects/:id/action', requireSuperAdmin, growthAuthority.prospectAction);
router.get('/growth-optimization/status', growthOptimization.status);
router.post('/growth-optimization/run-now', requireSuperAdmin, growthOptimization.runNow);
router.post('/growth-optimization/actions/:id', requireSuperAdmin, growthOptimization.action);
router.post('/search-console/oauth/start', requireSuperAdmin, googleSearchConsole.startOAuth);
router.post('/search-console/site', requireSuperAdmin, googleSearchConsole.selectSite);
router.get('/search-console/performance', googleSearchConsole.performance);
router.delete('/search-console', requireSuperAdmin, googleSearchConsole.disconnect);
router.get('/users', users);
router.post('/users', createUser);
router.get('/users/:id', userDetail);
router.patch('/users/:id/access', updateUserAccess);
router.patch('/users/:id/commercial-plan', updateCommercialPlan);
router.post('/users/:id/credits', adjustUserCredits);
router.get('/settings', settings);
router.put('/settings', requireSuperAdmin, adminSecurity.secureLegacySettingUpdate);
router.get('/ai-studio-policy', aiStudioPolicyStatus);
router.put('/ai-studio-policy', requireSuperAdmin, updateAiStudioPolicy);
router.get('/ai-routing', aiRouting);
router.put('/ai-routing', updateAiRouting);
router.get('/agent-access', agentAccessPolicy);
router.put('/agent-access', updateAgentAccessPolicy);
router.get('/agent-learning', agentLearning);
router.get('/ugc-avatars', ugcAvatars);
router.get('/ugc-avatars/:avatarId/content', ugcAvatarContent);
router.post('/ugc-avatars/download', downloadUgcAvatars);
router.post('/ugc-avatars/delete', deleteUgcAvatars);
router.post('/ugc-avatars/upload', express.raw({ type: ['image/png','image/jpeg','image/webp'], limit: '12mb' }), uploadUgcAvatar);
router.get('/ugc-analytics', ugcAnalyticsSummary);
router.get('/ugc-operations', ugcOperationsSummary);
router.patch('/agent-learning/:id', reviewAgentLearning);
router.use('/security', adminSecurityRoutes);

module.exports = router;
