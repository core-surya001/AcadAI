'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');
const rateLimit  = require('express-rate-limit');

const authCtrl   = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const validate   = require('../middleware/validate');

const router = Router();

// ─── Strict rate limit for auth routes ────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max     : 10,
  message : { success: false, message: 'Too many auth attempts, please try again later.' },
});

// ─── Validation rules ─────────────────────────────────────────────────────────
const registerRules = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 120 }).withMessage('Name must be 2–120 characters'),
  body('email')
    .trim().normalizeEmail()
    .isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('role')
    .optional()
    .isIn(['admin','teacher','counselor']).withMessage('Invalid role'),
];

const loginRules = [
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Create a new staff account.
 */
router.post('/register', authLimiter, registerRules, validate, authCtrl.register);

/**
 * POST /api/v1/auth/login
 * Authenticate and receive a JWT.
 */
router.post('/login', authLimiter, loginRules, validate, authCtrl.login);

/**
 * GET /api/v1/auth/me
 * Return the current user's profile (protected).
 */
router.get('/me', protect, authCtrl.getMe);

/**
 * POST /api/v1/auth/refresh
 * Issue a fresh token (protected — must still have a valid token).
 */
router.post('/refresh', protect, authCtrl.refresh);

/**
 * POST /api/v1/auth/google
 * Verify a Google ID token and return a JWT.
 */
router.post('/google', authLimiter, authCtrl.googleLogin);

module.exports = router;
