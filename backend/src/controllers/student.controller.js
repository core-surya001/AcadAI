'use strict';

const StudentModel  = require('../models/student.model');
const LookupModel   = require('../models/lookup.model');
const { AppError }  = require('../utils/appError');

/**
 * Derive a risk level from score and attendance.
 * Used only at creation time before any ML prediction is run.
 */
function deriveRiskLevel(score, attendance) {
  if (score < 5 || attendance < 65) return 'high';
  if (score < 7 || attendance < 80) return 'medium';
  return 'low';
}

/**
 * Generate a student display code: STU-YYXXXXX
 * This is now just a display label — the real PK is BIGSERIAL.
 * Collision on student_code is handled by the UNIQUE constraint + ON CONFLICT.
 */
function generateStudentCode() {
  const year = new Date().getFullYear().toString().slice(-2);
  const seq  = Math.floor(10000 + Math.random() * 90000);
  return `STU-${year}${seq}`;
}

/**
 * Resolve a student by either its numeric BIGINT id or its student_code string.
 * Uses findByIdLive (base tables, not materialized view) so newly created
 * or updated students are visible immediately without waiting for a view refresh.
 */
async function resolveStudent(rawId) {
  const numId = parseInt(rawId, 10);
  if (!isNaN(numId)) {
    return StudentModel.findByIdLive(numId);
  }
  // student_code lookup — still needs a live query
  const { rows } = await require('../db').query(
    `SELECT
       s.id AS student_id, s.student_code, s.name, s.email, s.avatar_url,
       s.attendance, s.score, s.is_active, s.created_at, s.updated_at,
       g.label AS grade, m.name AS major, sem.label AS semester,
       pl.prediction AS ai_prediction, pl.risk_level,
       pl.model_version, pl.confidence,
       pl.created_at AS predicted_at
     FROM students s
     JOIN grades g ON g.id = s.grade_id
     JOIN majors m ON m.id = s.major_id
     JOIN semesters sem ON sem.id = s.semester_id
     LEFT JOIN LATERAL (
       SELECT prediction,risk_level,model_version,confidence,created_at
       FROM prediction_logs WHERE student_id=s.id ORDER BY created_at DESC LIMIT 1
     ) pl ON TRUE
     WHERE s.student_code = $1 AND s.is_active = TRUE`,
    [rawId],
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].student_id, studentCode: rows[0].student_code, name: rows[0].name,
    email: rows[0].email, avatarUrl: rows[0].avatar_url, grade: rows[0].grade,
    major: rows[0].major, semester: rows[0].semester,
    attendance: parseFloat(rows[0].attendance), score: parseFloat(rows[0].score),
    riskLevel: rows[0].risk_level || 'unscored',
    aiPrediction: rows[0].ai_prediction ? parseFloat(rows[0].ai_prediction) : null,
    confidence: rows[0].confidence ? parseFloat(rows[0].confidence) : null,
    predictedAt: rows[0].predicted_at || null,
    createdAt: rows[0].created_at, updatedAt: rows[0].updated_at,
  };
}


// ─── GET /students ─────────────────────────────────────────────────────────────
exports.getAllStudents = async (req, res, next) => {
  try {
    const {
      search, grade, major, risk, sort, order,
      page  = 1,
      limit = 20,
    } = req.query;

    const result = await StudentModel.findAll({
      search, grade, major, risk, sort, order,
      page : parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10) || 20, 100),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// ─── GET /students/lookups ─────────────────────────────────────────────────────
exports.getLookups = async (req, res, next) => {
  try {
    const [majors, grades, semesters] = await Promise.all([
      LookupModel.getMajors(),
      LookupModel.getGrades(),
      LookupModel.getSemesters(),
    ]);
    res.json({ success: true, data: { majors, grades, semesters } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /students/:id ─────────────────────────────────────────────────────────
exports.getStudentById = async (req, res, next) => {
  try {
    const student = await resolveStudent(req.params.id);
    if (!student) throw new AppError('Student not found', 404);
    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
};

// ─── POST /students ────────────────────────────────────────────────────────────
exports.createStudent = async (req, res, next) => {
  try {
    const {
      name, email, grade, major,
      semester  = '1st / Fall',
      attendance,
      score,
      avatar,
    } = req.body;

    const studentCode = generateStudentCode();
    const userId      = req.user?.id || null;

    const student = await StudentModel.create({
      studentCode,
      name,
      email,
      avatarUrl  : avatar || null,
      grade,
      major,
      semester,
      attendance : parseFloat(attendance),
      score      : parseFloat(score),
    }, userId);

    res.status(201).json({ success: true, data: student });
  } catch (err) {
    if (err.code === '23505') {
      return next(new AppError('A student with this email already exists', 409));
    }
    next(err);
  }
};

// ─── PUT /students/:id ─────────────────────────────────────────────────────────
exports.updateStudent = async (req, res, next) => {
  try {
    const existing = await resolveStudent(req.params.id);
    if (!existing) throw new AppError('Student not found', 404);

    const fields = { ...req.body };

    // Map API key "avatar" → db col "avatar_url"
    if (fields.avatar !== undefined) {
      fields.avatar_url = fields.avatar;
      delete fields.avatar;
    }

    const updated = await StudentModel.update(
      parseInt(existing.id, 10),
      fields,
      req.user?.id || null,
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    if (err.code === '23505') {
      return next(new AppError('A student with this email already exists', 409));
    }
    next(err);
  }
};

// ─── DELETE /students/:id ──────────────────────────────────────────────────────
const PredictionLogModel = require('../models/prediction.model');

exports.deleteStudent = async (req, res, next) => {
  try {
    const existing = await resolveStudent(req.params.id);
    if (!existing) throw new AppError('Student not found', 404);

    const userId = req.user?.id || null;
    if (req.user?.role === 'admin' && req.query.hard === 'true') {
      await StudentModel.hardDelete(parseInt(existing.id, 10), userId);
      await PredictionLogModel.refreshRiskCache();
      return res.json({ success: true, message: 'Student permanently deleted' });
    }

    await StudentModel.delete(parseInt(existing.id, 10), userId);
    await PredictionLogModel.refreshRiskCache();
    res.json({ success: true, message: 'Student deactivated successfully' });
  } catch (err) {
    next(err);
  }
};
