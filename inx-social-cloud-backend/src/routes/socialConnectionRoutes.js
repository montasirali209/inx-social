const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const postForMeController = require('../controllers/postForMeController');
const socialPublicationRoutes = require('./socialPublicationRoutes');

// Post for Me owns every active social connection and publishing path.
router.get('/post-for-me/callback', postForMeController.callback);
router.post('/post-for-me/webhook', postForMeController.webhook);
router.use('/publications', socialPublicationRoutes);

router.use(requireAuth);
router.get('/', postForMeController.list);
router.post('/post-for-me/:platform/start', postForMeController.start);
router.post('/post-for-me/sync', postForMeController.sync);
router.delete('/:id', postForMeController.disconnect);

module.exports = router;
