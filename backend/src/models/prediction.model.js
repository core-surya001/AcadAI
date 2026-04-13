'use strict';

const db = require('../db');

/**
 * PredictionLog model — records every call to the AI prediction service.
 */

const PredictionLogModel = {
  async create({ studentId, inputData, prediction, riskLevel, modelVersion, requestedBy }) {
    const { rows } = await db.query(
      `INSERT INTO prediction_logs
         (student_id, input_data, prediction, risk_level, model_version, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [studentId || null, JSON.stringify(inputData), prediction || null,
       riskLevel || null, modelVersion || null, requestedBy || null]
    );
    return rows[0];
  },

  async findByStudentId(studentId, limit = 10) {
    const { rows } = await db.query(
      `SELECT id, student_id, input_data, prediction, risk_level,
              model_version, created_at
         FROM prediction_logs
        WHERE student_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [studentId, limit]
    );
    return rows;
  },
};

module.exports = PredictionLogModel;
