const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { overview, users, userDetail, updateUserAccess, settings, updateSetting, aiRouting, updateAiRouting, agentAccessPolicy, updateAgentAccessPolicy, agentLearning, reviewAgentLearning } = require('../controllers/adminController');

router.use(requireAuth, requireAdmin);
router.get('/overview', overview);
router.get('/users', users);
router.get('/users/:id', userDetail);
router.patch('/users/:id/access', updateUserAccess);
router.get('/settings', settings);
router.put('/settings', updateSetting);
router.get('/ai-routing', aiRouting);
router.put('/ai-routing', updateAiRouting);
router.get('/agent-access', agentAccessPolicy);
router.put('/agent-access', updateAgentAccessPolicy);
router.get('/agent-learning', agentLearning);
router.patch('/agent-learning/:id', reviewAgentLearning);

module.exports = router;
