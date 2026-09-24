const router = require('express').Router();
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
  ugcAnalyticsSummary,
  ugcOperationsSummary
} = require('../controllers/adminController');
const adminSecurity = require('../controllers/adminSecurityController');
const googleSearchConsole = require('../controllers/googleSearchConsoleController');
const adminSecurityRoutes = require('./adminSecurityRoutes');

router.get('/search-console/oauth/callback', googleSearchConsole.oauthCallback);

router.use(requireAuth, requireAdmin);
router.get('/overview', overview);
router.get('/search-console/status', googleSearchConsole.status);
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
router.get('/ugc-analytics', ugcAnalyticsSummary);
router.get('/ugc-operations', ugcOperationsSummary);
router.patch('/agent-learning/:id', reviewAgentLearning);
router.use('/security', adminSecurityRoutes);

module.exports = router;
