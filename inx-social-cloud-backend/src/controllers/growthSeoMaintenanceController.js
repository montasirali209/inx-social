'use strict';

const seoMaintenance = require('../services/growthSeoMaintenanceService');

async function status(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await seoMaintenance.status());
  } catch (error) {
    next(error);
  }
}

async function runNow(req, res, next) {
  try {
    const result = await seoMaintenance.run({ maxPages: 120 });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  status,
  runNow
};
