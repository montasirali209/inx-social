const router = require('express').Router();
const controller = require('../controllers/adminAuthController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.post('/login', controller.login);
router.post('/logout', controller.logout);
router.get('/me', requireAuth, requireAdmin, controller.me);

module.exports = router;
