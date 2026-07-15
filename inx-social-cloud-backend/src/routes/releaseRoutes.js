const express = require('express');
const {
  publishRelease,
  getLatestRelease
} = require('../controllers/releaseController');
const {
  requireReleaseApiKey
} = require('../middleware/releaseAuthMiddleware');

const router = express.Router();

// GitHub Actions uses this protected endpoint.
router.post('/publish', requireReleaseApiKey, publishRelease);

// Public metadata only. The protected download URL comes later.
router.get('/latest', getLatestRelease);

module.exports = router;