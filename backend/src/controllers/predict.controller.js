'use strict';

const StudentModel        = require('../models/student.model');
const PredictionLogModel  = require('../models/prediction.model');
const { AppError }        = require('../utils/appError');
const logger              = require('../utils/logger');
const db                  = require('../db');

// ─── Rule-based fallback when no ML service is configured ─────────────────────
function localPredict({ attendance, score, grade, major }) {
  const normalizedScore      = (parseFloat(score)      / 10) * 100;
  const normalizedAttendance =  parseFloat(attendance);

  const prediction = Math.min(Math.max(
    Math.round(normalizedScore * 0.6 + normalizedAttendance * 0.4),
    0,
  ), 100);

  let riskLevel = 'low';
  if (prediction < 50) riskLevel = 'high';
  else if (prediction < 70) riskLevel = 'medium';

  return {
    prediction,
    riskLevel,
    modelVersion: 'local-v1.0',
    confidence  : 0.72,
    factors     : {
      academicScore: `${Math.round(normalizedScore)}%`,
      attendance   : `${normalizedAttendance}%`,
      grade,
      major,
    },
  };
}

// ─── Call external ML service ──────────────────────────────────────────────────
async function callExternalModel(payload) {
  const serviceUrl = process.env.PREDICTION_SERVICE_URL;
  if (!serviceUrl) return null;

  try {
    const response = await globalThis.fetch(`${serviceUrl}/predict`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(payload),
      signal : AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`ML service returned ${response.status}`);
    return await response.json();
  } catch (err) {
    logger.warn(`External ML service unavailable — using local model. (${err.message})`);
    return null;
  }
}

// ─── POST /predict ─────────────────────────────────────────────────────────────
/**
 * Single prediction. studentId is optional; if omitted, result is not persisted.
 * Body: { studentId?, attendance, score, grade, major, semester }
 */
exports.predict = async (req, res, next) => {
  try {
    const { studentId, attendance, score, grade, major, semester } = req.body;
    const requestedBy = req.user?.id || null;

    const inputData = { attendance, score, grade, major, semester };
    const extResult = await callExternalModel(inputData);
    const result    = extResult ?? localPredict(inputData);

    // Only persist if a real student ID was supplied
    if (studentId) {
      const numId   = parseInt(studentId, 10);
      const student = (!isNaN(numId) ? await StudentModel.findByIdLive(numId) : null)
                   || await StudentModel.findByCode(String(studentId));

      if (!student) throw new AppError('Student not found', 404);

      // Single insert + refresh view (no need for a full transaction on a single row)
      await PredictionLogModel.create({
        studentId   : parseInt(student.id, 10),
        requestedBy,
        inputData,
        prediction  : result.prediction,
        riskLevel   : result.riskLevel,
        modelVersion: result.modelVersion,
        confidence  : result.confidence ?? null,
      });

      // Async refresh — don't block the HTTP response
      PredictionLogModel.refreshRiskCache().catch(err =>
        logger.warn('Materialized view refresh failed (non-fatal):', err.message),
      );
    }

    res.json({
      success: true,
      data: {
        studentId   : studentId || null,
        prediction  : result.prediction,
        riskLevel   : result.riskLevel,
        modelVersion: result.modelVersion,
        confidence  : result.confidence ?? null,
        factors     : result.factors    ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /predict/student/:id/history ──────────────────────────────────────────
exports.getPredictionHistory = async (req, res, next) => {
  try {
    // Support both BIGINT numeric ID and student_code string
    const rawId = req.params.id;
    const numId = parseInt(rawId, 10);
    const student = isNaN(numId)
      ? await StudentModel.findByCode(rawId)
      : await StudentModel.findById(numId);

    if (!student) throw new AppError('Student not found', 404);

    const logs = await PredictionLogModel.findByStudentId(parseInt(student.id, 10));
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

// ─── POST /predict/batch ───────────────────────────────────────────────────────
/**
 * FIX: was 150 serial round-trips, no transaction, partial commit on crash.
 *
 * Now:
 *  1. Fetch all students in ONE query (WHERE id = ANY($1))
 *  2. Run all external ML calls in parallel (Promise.all)
 *  3. Insert ALL prediction logs in ONE multi-row INSERT (bulkCreate)
 *  4. Wrap steps 3 in a DB transaction — all-or-nothing
 *  5. Refresh materialized view ONCE after commit
 *
 * Body: { studentIds: [1, 2, 3, ...] }  (BIGINT numeric IDs)
 */
exports.batchPredict = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError('studentIds must be a non-empty array', 400);
    }
    if (studentIds.length > 50) {
      throw new AppError('Cannot process more than 50 students per batch', 400);
    }

    const requestedBy = req.user?.id || null;

    // ── 1. Fetch all students in one query ────────────────────────────────────
    const numIds   = studentIds.map(id => parseInt(id, 10)).filter(n => !isNaN(n));
    const students = await StudentModel.findByIds(numIds);

    const foundIds  = new Set(students.map(s => String(s.id)));
    const notFound  = studentIds.filter(id => !foundIds.has(String(id)));

    // ── 2. Run ML predictions in parallel ─────────────────────────────────────
    const predictionWork = students.map(async (student) => {
      const inputData = {
        attendance: student.attendance,
        score     : student.score,
        grade     : student.grade,
        major     : student.major,
        semester  : student.semester,
      };

      const extResult = await callExternalModel(inputData);
      const result    = extResult ?? localPredict(inputData);

      return {
        student,
        inputData,
        studentId   : parseInt(student.id, 10),
        requestedBy,
        prediction  : result.prediction,
        riskLevel   : result.riskLevel,
        modelVersion: result.modelVersion,
        confidence  : result.confidence ?? null,
      };
    });

    const predictions = await Promise.all(predictionWork);

    // ── 3 & 4. Bulk insert inside a transaction ────────────────────────────────
    await client.query('BEGIN');
    const insertedLogs = await PredictionLogModel.bulkCreate(predictions, client);
    await client.query('COMMIT');

    // ── 5. Refresh materialized view once after all writes are committed ───────
    PredictionLogModel.refreshRiskCache().catch(err =>
      logger.warn('Materialized view refresh failed (non-fatal):', err.message),
    );

    // ── Shape response ─────────────────────────────────────────────────────────
    const logMap = new Map(insertedLogs.map(l => [String(l.student_id), l]));

    const results = [
      ...predictions.map(p => ({
        studentId  : p.studentId,
        studentCode: p.student.studentCode,
        name       : p.student.name,
        prediction : p.prediction,
        riskLevel  : p.riskLevel,
        confidence : p.confidence,
        status     : 'ok',
      })),
      ...notFound.map(id => ({ studentId: id, status: 'not_found' })),
    ];

    res.json({
      success : true,
      data    : results,
      count   : predictions.length,
      skipped : notFound.length,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};
