const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const { overview, users, userDetail, updateUserAccess, settings, updateSetting } = require('../controllers/adminController');

router.use(requireAuth, requireAdmin);
router.get('/overview', overview);
router.get('/users', users);
router.get('/users/:id', userDetail);
router.patch('/users/:id/access', updateUserAccess);
router.get('/settings', settings);
router.put('/settings', updateSetting);

module.exports = router;
