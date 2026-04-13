'use strict';

const { Router }     = require('express');
const dashboardCtrl  = require('../controllers/dashboard.controller');
const { protect }    = require('../middleware/auth');

const router = Router();

router.use(protect);

/**
 * GET /api/v1/dashboard/stats
 * Aggregate KPIs for the overview cards.
 */
router.get('/stats', dashboardCtrl.getStats);

/**
 * GET /api/v1/dashboard/class-distribution
 * Student counts grouped by major.
 */
router.get('/class-distribution', dashboardCtrl.getClassDistribution);

module.exports = router;
