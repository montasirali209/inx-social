const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/socialConnectionController');

router.get('/oauth/:platform/callback', controller.oauthCallback);
router.use(requireAuth);
router.get('/', controller.list);
router.post('/oauth/:platform/start', controller.startOAuth);
router.post('/instagram/sync', controller.syncInstagram);
router.delete('/:id', controller.disconnect);

module.exports = router;
