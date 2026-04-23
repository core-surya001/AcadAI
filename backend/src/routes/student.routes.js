'use strict';

const { Router } = require('express');
const { body, query, param } = require('express-validator');

const studentCtrl  = require('../controllers/student.controller');
const { protect, restrictTo } = require('../middleware/auth');
const validate     = require('../middleware/validate');

const router = Router();

// All student routes require a valid JWT
router.use(protect);

// ─── Validation rules ──────────────────────────────────────────────────────────

const createRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 120 }).withMessage('Name too long'),
  body('email').trim().normalizeEmail()
    .isEmail().withMessage('Valid email is required'),
  body('grade').trim().notEmpty().withMessage('Grade is required'),
  body('major').trim().notEmpty().withMessage('Major is required'),
  body('semester').optional().trim(),
  body('attendance')
    .isFloat({ min: 0, max: 100 }).withMessage('Attendance must be 0–100'),
  body('score')
    .isFloat({ min: 0, max: 10 }).withMessage('Score must be 0–10'),
  body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
];

const updateRules = [
  body('name').optional().trim().isLength({ min: 2, max: 120 }),
  body('email').optional().trim().normalizeEmail().isEmail(),
  body('grade').optional().trim().notEmpty(),
  body('major').optional().trim().notEmpty(),
  body('semester').optional().trim(),
  body('attendance').optional().isFloat({ min: 0, max: 100 }),
  body('score').optional().isFloat({ min: 0, max: 10 }),
  body('avatar').optional().isURL(),
];

const listRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('risk').optional().isIn(['low','medium','high','all']),
  query('sort').optional().isIn(['name','score','attendance','risk_level','created_at','ai_prediction']),
  query('order').optional().isIn(['asc','desc','ASC','DESC']),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET  /api/v1/students/lookups  — dropdown data (majors, grades, semesters)
 * No pagination rules needed.
 */
router.get('/lookups', studentCtrl.getLookups);

/**
 * GET  /api/v1/students          — list (search, filter, paginate)
 * POST /api/v1/students          — create new student
 */
router.route('/')
  .get(listRules, validate, studentCtrl.getAllStudents)
  .post(createRules, validate, studentCtrl.createStudent);

/**
 * POST /api/v1/students/bulk     — bulk create students
 */
router.post('/bulk', studentCtrl.bulkCreateStudents);

/**
 * GET    /api/v1/students/:id    — fetch one (by BIGINT id or student_code)
 * PUT    /api/v1/students/:id    — partial update
 * DELETE /api/v1/students/:id    — soft-delete (admin can hard-delete with ?hard=true)
 */
router.route('/:id')
  .get(studentCtrl.getStudentById)
  .put(updateRules, validate, studentCtrl.updateStudent)
  .delete(studentCtrl.deleteStudent);

module.exports = router;
