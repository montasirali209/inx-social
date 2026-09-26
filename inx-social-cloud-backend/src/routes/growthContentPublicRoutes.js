'use strict';

const express = require('express');
const controller = require('../controllers/growthContentPublicController');

const router = express.Router();

router.get('/articles', controller.listArticles);
router.get('/articles/:slug', controller.articleBySlug);
router.get('/sitemap', controller.sitemap);
router.get('/media/:id', controller.media);

module.exports = router;
