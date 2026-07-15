const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { listPages, connectPage, revokePage } = require('../controllers/pageController');

router.get('/', requireAuth, listPages);
router.post('/connect', requireAuth, connectPage);
router.post('/:id/revoke', requireAuth, revokePage);

module.exports = router;
