'use strict';

const StudentModel     = require('../models/student.model');
const PredictionLogModel = require('../models/prediction.model');
const { AppError }     = require('../utils/appError');
const logger           = require('../utils/logger');

// ─── Rule-based fallback when no ML service is configured ────────────────────
function localPredict({ attendance, score, grade, major }) {
  // Simple weighted formula — replace with real model output
  const normalizedScore      = (parseFloat(score)      / 10) * 100;
  const normalizedAttendance = parseFloat(attendance);

  const prediction = Math.round(
    normalizedScore * 0.6 + normalizedAttendance * 0.4
  );

  let riskLevel = 'low';
  if (prediction < 50) riskLevel = 'high';
  else if (prediction < 70) riskLevel = 'medium';

  return {
    prediction  : Math.min(Math.max(prediction, 0), 100),
    riskLevel,
    modelVersion: 'local-v1.0',
    confidence  : 0.72,
    factors     : {
      academicScore  : `${Math.round(normalizedScore)}%`,
      attendance     : `${normalizedAttendance}%`,
      grade,
      major,
    },
  };
}

// ─── Call external ML service ─────────────────────────────────────────────────
async function callExternalModel(payload) {
  const serviceUrl = process.env.PREDICTION_SERVICE_URL;
  if (!serviceUrl) return null;

  try {
    const response = await globalThis.fetch(`${serviceUrl}/predict`, {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify(payload),
      signal  : AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`ML service returned ${response.status}`);
    return await response.json();
  } catch (err) {
    logger.warn(`External ML service unavailable — using local model. (${err.message})`);
    return null;
  }
}

// ─── POST /predict ────────────────────────────────────────────────────────────
/**
 * Body: { studentId?, attendance, score, grade, major, semester }
 * If studentId is supplied the result is stored and the student's ai_prediction is updated.
 */
exports.predict = async (req, res, next) => {
  try {
    const { studentId, attendance, score, grade, major, semester } = req.body;

    const inputData = { attendance, score, grade, major, semester };

    // Try ML microservice first, fall back to local heuristic
    const extResult = await callExternalModel(inputData);
    const result    = extResult ?? localPredict(inputData);

    // Persist log
    await PredictionLogModel.create({
      studentId   : studentId || null,
      inputData,
      prediction  : result.prediction,
      riskLevel   : result.riskLevel,
      modelVersion: result.modelVersion,
      requestedBy : req.user?.id || null,
    });

    // If tied to a real student, update their record
    if (studentId) {
      await StudentModel.update(studentId, {
        ai_prediction: result.prediction,
        risk_level   : result.riskLevel,
      });
    }

    res.json({
      success: true,
      data   : {
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

// ─── GET /predict/student/:id/history ────────────────────────────────────────
exports.getPredictionHistory = async (req, res, next) => {
  try {
    const student = await StudentModel.findById(req.params.id);
    if (!student) throw new AppError('Student not found', 404);

    const logs = await PredictionLogModel.findByStudentId(req.params.id);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

// ─── POST /predict/batch ──────────────────────────────────────────────────────
/**
 * Run predictions for multiple students at once.
 * Body: { studentIds: ['STU-24012', ...] }
 */
exports.batchPredict = async (req, res, next) => {
  try {
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError('studentIds must be a non-empty array', 400);
    }
    if (studentIds.length > 50) {
      throw new AppError('Cannot process more than 50 students per batch', 400);
    }

    const results = [];

    for (const id of studentIds) {
      const student = await StudentModel.findById(id);
      if (!student) {
        results.push({ studentId: id, error: 'Not found' });
        continue;
      }

      const inputData = {
        attendance: student.attendance,
        score     : student.score,
        grade     : student.grade,
        major     : student.major,
        semester  : student.semester,
      };

      const extResult = await callExternalModel(inputData);
      const result    = extResult ?? localPredict(inputData);

      await PredictionLogModel.create({
        studentId   : id,
        inputData,
        prediction  : result.prediction,
        riskLevel   : result.riskLevel,
        modelVersion: result.modelVersion,
        requestedBy : req.user?.id || null,
      });

      await StudentModel.update(id, {
        ai_prediction: result.prediction,
        risk_level   : result.riskLevel,
      });

      results.push({
        studentId  : id,
        name       : student.name,
        prediction : result.prediction,
        riskLevel  : result.riskLevel,
      });
    }

    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    next(err);
  }
};
