const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/studioController');

router.use(requireAuth);
router.get('/capabilities', controller.capabilities);
router.get('/desktop-state', controller.desktopState);
router.get('/pages/:id/picture', controller.pagePicture);
router.put('/preferences', controller.savePreferences);
router.post('/preferences/reset-ui-texts', controller.resetUiTexts);
router.get('/overview', controller.overview);
router.get('/facebook/test', controller.testActivePage);
router.get('/facebook/scheduled-posts', controller.scheduledPosts);
router.get('/analytics/facebook', controller.facebookAnalytics);
router.get('/jobs', controller.listJobs);
router.post('/jobs', controller.createDraft);
router.post('/direct-posts', controller.createDirectPosts);
router.put('/direct-posts/:id/media', controller.uploadDirectPostMedia);
router.put('/jobs/:id/video', controller.uploadVideo);
router.patch('/jobs/:id', controller.updateDraft);
router.post('/jobs/:id/cancel', controller.cancelJob);

module.exports = router;
