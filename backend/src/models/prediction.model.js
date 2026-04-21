'use strict';

const db = require('../db');

/**
 * PredictionLogModel — v2.0
 *
 * Key changes from v1:
 *  - student_id is NOT NULL (anonymous predictions not stored here)
 *  - bulkCreate: single multi-row INSERT for batch predictions (replaces N serial inserts)
 *  - refreshRiskCache: triggers REFRESH MATERIALIZED VIEW CONCURRENTLY after batch ops
 *  - confidence column stored
 *  - All inserts are atomic within a transaction provided by the caller
 */
const PredictionLogModel = {

  // ─── Single prediction log insert ──────────────────────────────────────────
  async create({ studentId, inputData, prediction, riskLevel, modelVersion, requestedBy, confidence }, client = null) {
    const run = client || db;
    const { rows } = await run.query(
      `INSERT INTO prediction_logs
         (student_id, requested_by, input_data, prediction, risk_level, model_version, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        studentId,
        requestedBy || null,
        JSON.stringify(inputData),
        prediction,
        riskLevel,
        modelVersion || 'local-v1.0',
        confidence   || null,
      ],
    );
    return rows[0];
  },

  /**
   * Bulk insert prediction logs for multiple students in a SINGLE round-trip.
   * This replaces the N-serial-INSERT anti-pattern in the old batchPredict.
   *
   * @param {Array} predictions  Array of prediction objects
   * @param {Object} client      A pg PoolClient in an active transaction
   */
  async bulkCreate(predictions, client) {
    if (!predictions.length) return [];

    // Build a single multi-row parameterised INSERT
    const valuePlaceholders = [];
    const params = [];
    let pIdx = 1;

    for (const p of predictions) {
      valuePlaceholders.push(`($${pIdx},$${pIdx+1},$${pIdx+2},$${pIdx+3},$${pIdx+4},$${pIdx+5},$${pIdx+6})`);
      params.push(
        p.studentId,
        p.requestedBy || null,
        JSON.stringify(p.inputData),
        p.prediction,
        p.riskLevel,
        p.modelVersion || 'local-v1.0',
        p.confidence   || null,
      );
      pIdx += 7;
    }

    const { rows } = await client.query(
      `INSERT INTO prediction_logs
         (student_id, requested_by, input_data, prediction, risk_level, model_version, confidence)
       VALUES ${valuePlaceholders.join(', ')}
       RETURNING id, student_id, prediction, risk_level`,
      params,
    );
    return rows;
  },

  // ─── History for a single student ──────────────────────────────────────────
  async findByStudentId(studentId, limit = 20) {
    const { rows } = await db.query(
      `SELECT id, student_id, input_data, prediction, risk_level,
              model_version, confidence, created_at
         FROM prediction_logs
        WHERE student_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [studentId, limit],
    );
    return rows;
  },

  /**
   * Refresh the materialized view so dashboard stats reflect new predictions.
   * Uses CONCURRENTLY to avoid blocking reads during refresh.
   * Should be called AFTER all prediction inserts in a batch are committed.
   */
  async refreshRiskCache() {
    await db.query('SELECT refresh_student_risk_summary()');
  },
};

module.exports = PredictionLogModel;
