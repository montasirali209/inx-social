'use strict';

const dashboard = require('../services/growthDashboardService');

async function snapshot(req, res, next) {
  try {
    const force = String(req.query?.force || '').toLowerCase() === 'true';
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await dashboard.snapshot({ force }));
  } catch (error) {
    next(error);
  }
}

module.exports = { snapshot };
