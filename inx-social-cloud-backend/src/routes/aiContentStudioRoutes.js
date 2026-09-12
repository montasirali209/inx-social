const router = require('express').Router();
const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/aiContentStudioController');
const nextController = require('../controllers/aiStudioNextController');

router.use(requireAuth);
router.get('/access', controller.access);
router.get('/credits/balance', controller.balance);
router.get('/credits/packs', controller.packs);
router.post('/credits/checkout', controller.createTopupCheckout);
router.post('/estimate', controller.estimate);
router.post('/references', express.raw({
  type: ['image/*', 'application/pdf', 'text/*', 'application/json', 'application/xml', 'application/rtf', 'application/octet-stream'],
  limit: '20mb'
}), controller.uploadReference);
router.post('/assistant/message', controller.assistantMessage);
router.post('/generate/conversational-image-post', controller.generateConversationalImagePost);
router.post('/generate/conversational-carousel', nextController.generateCarousel);
router.get('/video/models', nextController.videoModels);
router.post('/video/recommend', nextController.videoRecommend);
router.post('/video/estimate', nextController.videoEstimate);
router.post('/generate/video-studio', nextController.generateVideo);
router.get('/stock-video/access', nextController.stockVideoAccess);
router.post('/generate/stock-video', nextController.generateStockVideo);
router.post('/generate/image-post', controller.generateImagePost);
router.post('/generate/carousel-post', controller.generateCarouselPost);
router.post('/generate/short-video', controller.generateShortVideo);
router.post('/generate/ugc-ad', controller.generateUGCAd);
router.get('/generations/:id', controller.generationStatus);
router.post('/generations/:id/cancel', controller.cancelGeneration);
router.get('/drafts', controller.recentDrafts);
router.post('/drafts', controller.saveDraft);
router.delete('/drafts/:id', controller.deleteDraft);
router.post('/drafts/:id/send-to-posts', controller.sendDraftToPosts);
router.get('/history', controller.generationHistory);
router.get('/brand-kits', controller.brandKits);

module.exports = router;
