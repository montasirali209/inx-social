const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  discoverAccount,
  connectAccount,
  listAccounts,
  syncAccount,
  disconnectAccount,
  listPages,
  selectPage,
  connectPage,
  revokePage
} = require('../controllers/pageController');

router.use(requireAuth);

// Buffer-style Meta account management.
router.get('/accounts', listAccounts);
router.post('/accounts/discover', discoverAccount);
router.post('/accounts/connect', connectAccount);
router.post('/accounts/:accountId/sync', syncAccount);
router.delete('/accounts/:accountId', disconnectAccount);

// Connected Page workspace management.
router.get('/', listPages);
router.post('/connect', connectPage); // backwards compatibility
router.post('/:id/select', selectPage);
router.post('/:id/revoke', revokePage); // backwards compatibility
router.delete('/:id', revokePage);

module.exports = router;
