const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/agentController');

router.use(requireAuth);
router.get('/overview', controller.overview);
router.get('/plans', controller.listPlans);
router.post('/assets', controller.uploadAsset);
router.get('/assets/:id/content', controller.assetContent);
router.delete('/assets/:id', controller.deleteAsset);
router.post('/plans', controller.createPlan);
router.post('/preflight', controller.preflightMission);
router.post('/plans/:id/approve', controller.approvePlan);
router.post('/plans/:id/resume', controller.resumePlan);
router.post('/plans/:id/cancel', controller.cancelPlan);

module.exports = router;
