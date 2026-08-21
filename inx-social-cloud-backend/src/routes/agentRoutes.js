const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/agentController');

router.use(requireAuth);
router.get('/overview', controller.overview);
router.get('/plans', controller.listPlans);
router.post('/plans', controller.createPlan);
router.post('/plans/:id/approve', controller.approvePlan);
router.post('/plans/:id/cancel', controller.cancelPlan);

module.exports = router;
