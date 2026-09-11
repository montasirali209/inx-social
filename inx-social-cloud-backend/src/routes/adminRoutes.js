const router = require('express').Router();
const { requireAuth, requireAdmin, requireSuperAdmin } = require('../middleware/authMiddleware');
const {
  overview,
  users,
  userDetail,
  createUser,
  updateUserAccess,
  settings,
  aiRouting,
  updateAiRouting,
  agentAccessPolicy,
  updateAgentAccessPolicy,
  agentLearning,
  reviewAgentLearning
} = require('../controllers/adminController');
const adminSecurity = require('../controllers/adminSecurityController');
const adminSecurityRoutes = require('./adminSecurityRoutes');

router.use(requireAuth, requireAdmin);
router.get('/overview', overview);
router.get('/users', users);
router.post('/users', createUser);
router.get('/users/:id', userDetail);
router.patch('/users/:id/access', updateUserAccess);
router.get('/settings', settings);
router.put('/settings', requireSuperAdmin, adminSecurity.secureLegacySettingUpdate);
router.get('/ai-routing', aiRouting);
router.put('/ai-routing', updateAiRouting);
router.get('/agent-access', agentAccessPolicy);
router.put('/agent-access', updateAgentAccessPolicy);
router.get('/agent-learning', agentLearning);
router.patch('/agent-learning/:id', reviewAgentLearning);
router.use('/security', adminSecurityRoutes);

module.exports = router;
