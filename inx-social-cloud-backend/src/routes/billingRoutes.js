const router = require('express').Router();
const controller = require('../controllers/billingController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/status', requireAuth, controller.billingStatus);
router.get('/checkout/:sessionId', requireAuth, controller.checkoutSessionStatus);
router.post('/checkout', requireAuth, controller.createCheckoutSession);
router.post('/portal', requireAuth, controller.createCustomerPortalSession);

module.exports = router;
