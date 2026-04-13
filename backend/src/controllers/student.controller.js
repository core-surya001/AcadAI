'use strict';

const StudentModel = require('../models/student.model');
const { AppError } = require('../utils/appError');

/**
 * Derive a risk level from score and attendance — fallback when no ML model.
 */
function deriveRiskLevel(score, attendance) {
  if (score < 5 || attendance < 65)  return 'high';
  if (score < 7 || attendance < 80)  return 'medium';
  return 'low';
}

/**
 * Generate a sequential-style student ID: STU-YYXXXXX
 */
function generateStudentId() {
  const year = new Date().getFullYear().toString().slice(-2);
  const seq  = Math.floor(10000 + Math.random() * 90000);
  return `STU-${year}${seq}`;
}

// ─── GET /students ────────────────────────────────────────────────────────────
exports.getAllStudents = async (req, res, next) => {
  try {
    const {
      search, grade, risk, sort, order,
      page  = 1,
      limit = 20,
    } = req.query;

    const result = await StudentModel.findAll({
      search, grade, risk, sort, order,
      page : parseInt(page),
      limit: Math.min(parseInt(limit) || 20, 100),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// ─── GET /students/:id ────────────────────────────────────────────────────────
exports.getStudentById = async (req, res, next) => {
  try {
    const student = await StudentModel.findById(req.params.id);
    if (!student) throw new AppError('Student not found', 404);
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
};

// ─── POST /students ───────────────────────────────────────────────────────────
exports.createStudent = async (req, res, next) => {
  try {
    const { name, email, grade, major, semester, attendance, score, avatar } = req.body;

    const risk_level = deriveRiskLevel(parseFloat(score), parseFloat(attendance));
    const id         = generateStudentId();

    const student = await StudentModel.create({
      id, name, email, avatar,
      grade, major,
      semester : semester || '1st / Fall',
      attendance: parseFloat(attendance),
      score     : parseFloat(score),
      risk_level,
      ai_prediction: null,
    });

    res.status(201).json({ success: true, data: student });
  } catch (err) {
    if (err.code === '23505') {            // PG unique violation
      return next(new AppError('Email already exists', 409));
    }
    next(err);
  }
};

// ─── PUT /students/:id ────────────────────────────────────────────────────────
exports.updateStudent = async (req, res, next) => {
  try {
    const existing = await StudentModel.findById(req.params.id);
    if (!existing) throw new AppError('Student not found', 404);

    const fields = { ...req.body };
    // Recalculate risk if score or attendance changed
    const score      = parseFloat(fields.score      ?? existing.score);
    const attendance = parseFloat(fields.attendance ?? existing.attendance);
    fields.risk_level = deriveRiskLevel(score, attendance);

    const updated = await StudentModel.update(req.params.id, fields);
    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === '23505') {
      return next(new AppError('Email already exists', 409));
    }
    next(err);
  }
};

// ─── DELETE /students/:id ─────────────────────────────────────────────────────
exports.deleteStudent = async (req, res, next) => {
  try {
    const deleted = await StudentModel.delete(req.params.id);
    if (!deleted) throw new AppError('Student not found', 404);
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    next(err);
  }
};
