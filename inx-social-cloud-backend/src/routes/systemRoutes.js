const router = require('express').Router();
const controller = require('../controllers/systemController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
router.use(requireAuth, requireAdmin);
router.get('/status', controller.status);
router.post('/test-email', controller.testEmail);
module.exports = router;
