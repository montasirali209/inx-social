'use strict';

const router = require('express').Router();
const controller = require('../controllers/websiteMediaPublicController');

router.get('/:key', controller.metadata);
router.get('/:key/content', controller.content);

module.exports = router;
