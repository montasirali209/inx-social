const router = require('express').Router();
const controller = require('../controllers/portalController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/plans', controller.plans);
router.get('/dashboard', requireAuth, controller.dashboard);
router.get('/download', requireAuth, controller.download);
router.patch('/preferences', requireAuth, controller.preferences);
router.delete('/account', requireAuth, controller.deleteAccount);

module.exports = router;
