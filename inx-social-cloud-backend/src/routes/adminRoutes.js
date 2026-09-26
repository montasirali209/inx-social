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
  ugcAnalyticsSummary,
  ugcOperationsSummary
} = require('../controllers/adminController');
const adminSecurity = require('../controllers/adminSecurityController');
const googleSearchConsole = require('../controllers/googleSearchConsoleController');
const growthIntelligence = require('../controllers/growthIntelligenceController');
const growthContent = require('../controllers/growthContentController');
const adminSecurityRoutes = require('./adminSecurityRoutes');

router.get('/search-console/oauth/callback', googleSearchConsole.oauthCallback);

router.use(requireAuth, requireAdmin);
router.get('/overview', overview);
router.get('/search-console/status', googleSearchConsole.status);
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
router.post('/ugc-avatars/upload', express.raw({ type: ['image/png','image/jpeg','image/webp'], limit: '12mb' }), uploadUgcAvatar);
router.get('/ugc-analytics', ugcAnalyticsSummary);
router.get('/ugc-operations', ugcOperationsSummary);
router.patch('/agent-learning/:id', reviewAgentLearning);
router.use('/security', adminSecurityRoutes);

module.exports = router;
