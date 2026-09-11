const router = require('express').Router();
const controller = require('../controllers/adminSecurityController');
const { requireSuperAdmin } = require('../middleware/authMiddleware');

router.get('/administrators', requireSuperAdmin, controller.administrators);
router.post('/administrators', requireSuperAdmin, controller.createAdministrator);
router.patch('/administrators/:id', requireSuperAdmin, controller.updateAdministrator);
router.post('/administrators/:id/setup-link', requireSuperAdmin, controller.resendAdministratorSetup);
router.post('/change-password', controller.changeOwnPassword);
router.get('/audit', requireSuperAdmin, controller.auditLogs);
router.get('/settings', controller.systemSettings);
router.put('/settings/:key', requireSuperAdmin, controller.updateSystemSetting);

module.exports = router;
