const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const controller = require('../controllers/agentController');

router.use(requireAuth);
router.get('/overview', controller.overview);
router.get('/plans', controller.listPlans);
router.post('/assets', controller.uploadAsset);
router.get('/assets/:id/content', controller.assetContent);
router.delete('/assets/:id', controller.deleteAsset);
router.post('/plans', controller.createPlan);
router.post('/preflight', controller.preflightMission);
router.post('/plans/:id/approve', controller.approvePlan);
router.post('/plans/:id/resume', controller.resumePlan);
router.post('/plans/:id/cancel', controller.cancelPlan);
router.get('/campaigns/:campaignId', controller.campaignDetails);
router.patch('/campaigns/:campaignId/posts/:postId', controller.updateCampaignPost);
router.post('/campaigns/:campaignId/posts/:postId/approve', controller.approveCampaignPost);
router.post('/campaigns/:campaignId/posts/:postId/regenerate-image', controller.regenerateCampaignPostImage);
router.post('/campaigns/:campaignId/approve', controller.approveCampaign);
router.post('/campaigns/:campaignId/schedule', controller.scheduleCampaign);

module.exports = router;
