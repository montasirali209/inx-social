const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { status, activateDevice } = require('../controllers/licenseController');

router.get('/status', requireAuth, status);
router.post('/device/activate', requireAuth, activateDevice);

module.exports = router;
