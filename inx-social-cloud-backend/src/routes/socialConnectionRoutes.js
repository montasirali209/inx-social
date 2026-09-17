const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/socialConnectionController');
const postForMeController = require('../controllers/postForMeController');

// Post for Me redirects and webhooks must remain public. The provider callback
// never receives the INXSocial API key; account ownership is mapped by external_id.
router.get('/post-for-me/callback', postForMeController.callback);
router.post('/post-for-me/webhook', postForMeController.webhook);

// Legacy callbacks remain available during the rollback window.
router.get('/oauth/:platform/callback', controller.oauthCallback);
router.get('/linkedin/callback', controller.linkedinCallback);

router.use(requireAuth);
router.get('/', controller.list);
router.post('/post-for-me/:platform/start', postForMeController.start);
router.post('/post-for-me/sync', postForMeController.sync);

// Native connectors are intentionally retained as rollback paths while the full
// Post for Me migration is validated in production.
router.post('/facebook/start', controller.startFacebook);
router.post('/facebook/complete', controller.completeFacebook);
router.post('/linkedin/start', controller.startLinkedIn);
router.post('/linkedin/posts', controller.createLinkedInPosts);
router.get('/linkedin/publications', controller.listLinkedInPublications);
router.post('/linkedin/publications/:id/library-media', controller.publishLinkedInLibraryMedia);
router.put('/linkedin/publications/:id/media', controller.uploadLinkedInMedia);
router.post('/oauth/:platform/start', controller.startOAuth);
router.post('/instagram/sync', controller.syncInstagram);
router.delete('/:id', controller.disconnect);

module.exports = router;
