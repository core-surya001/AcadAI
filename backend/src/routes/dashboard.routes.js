'use strict';

const { Router }      = require('express');
const dashboardCtrl   = require('../controllers/dashboard.controller');
const { protect, restrictTo } = require('../middleware/auth');

const router = Router();

router.use(protect);

/**
 * GET /api/v1/dashboard/stats
 * Aggregate KPIs — served from dashboard_stats VIEW (hits materialized view).
 */
router.get('/stats', dashboardCtrl.getStats);

/**
 * GET /api/v1/dashboard/class-distribution
 * Student counts grouped by major — from materialized view.
 */
router.get('/class-distribution', dashboardCtrl.getClassDistribution);

/**
 * GET /api/v1/dashboard/risk-distribution
 * Breakdown of low / medium / high / unscored students.
 */
router.get('/risk-distribution', dashboardCtrl.getRiskDistribution);

/**
 * POST /api/v1/dashboard/refresh-cache
 * Manually refresh the student_risk_summary materialized view.
 * Restricted to admins — this is a write operation that can be expensive.
 */
router.post('/refresh-cache', restrictTo('admin'), dashboardCtrl.refreshCache);

module.exports = router;
