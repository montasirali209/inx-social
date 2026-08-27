const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/socialPlatformController');

router.use(requireAuth);
router.get('/', controller.list);

module.exports = router;
