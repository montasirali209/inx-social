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

// Public metadata only. The authenticated portal endpoint returns the download URL.
router.get('/latest', getLatestRelease);

module.exports = router;
