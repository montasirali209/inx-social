const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/socialPublicationController');

router.use(requireAuth);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/carousel', controller.createCarousel);
router.get('/feeds/:profileId', controller.feed);
router.patch('/bulk-edit', controller.bulkEditScheduled);
router.post('/:publicationId/library-media', controller.libraryMedia);
router.put('/:publicationId/media', controller.uploadMedia);
router.put('/:publicationId/scheduled-media', controller.replaceScheduledMedia);
router.patch('/:publicationId', controller.updateScheduled);
router.put('/:publicationId/schedule', controller.reschedule);
router.post('/:publicationId/retry', controller.retry);
router.delete('/:publicationId', controller.remove);

module.exports = router;
