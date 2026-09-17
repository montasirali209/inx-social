const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/socialPublicationController');

router.use(requireAuth);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/carousel', controller.createCarousel);
router.get('/feeds/:profileId', controller.feed);
router.post('/:publicationId/library-media', controller.libraryMedia);
router.put('/:publicationId/media', controller.uploadMedia);

module.exports = router;
