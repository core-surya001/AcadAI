'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');

const predictCtrl  = require('../controllers/predict.controller');
const { protect }  = require('../middleware/auth');
const validate     = require('../middleware/validate');

const router = Router();

// All prediction routes require authentication
router.use(protect);

// ─── Validation rules ─────────────────────────────────────────────────────────

const predictRules = [
  body('attendance')
    .isFloat({ min: 0, max: 100 }).withMessage('Attendance must be 0–100'),
  body('score')
    .isFloat({ min: 0, max: 10 }).withMessage('Score must be 0–10'),
  body('grade').trim().notEmpty().withMessage('Grade is required'),
  body('major').trim().notEmpty().withMessage('Major is required'),
  body('semester').optional().trim(),
  body('studentId').optional().isString(),
];

const batchRules = [
  body('studentIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('studentIds must be a non-empty array of up to 50 IDs'),
  body('studentIds.*')
    .isString().withMessage('Each studentId must be a string'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/predict
 * Run a single prediction (with optional studentId to persist).
 */
router.post('/', predictRules, validate, predictCtrl.predict);

/**
 * POST /api/v1/predict/batch
 * Run predictions for multiple students and save results.
 */
router.post('/batch', batchRules, validate, predictCtrl.batchPredict);

/**
 * GET /api/v1/predict/student/:id/history
 * Retrieve the prediction history for a specific student.
 */
router.get(
  '/student/:id/history',
  [param('id').isString().notEmpty()],
  validate,
  predictCtrl.getPredictionHistory
);

module.exports = router;
