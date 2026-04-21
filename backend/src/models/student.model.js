'use strict';

const db          = require('../db');
const LookupModel = require('./lookup.model');

/**
 * StudentModel — all SQL for the `students` table.
 *
 * v2.0 changes:
 *  - Primary key is now BIGINT (BIGSERIAL). student_code is the display ID.
 *  - grade, major, semester are FK integers resolved via lookup tables.
 *  - risk_level and ai_prediction are NOT stored on students — they come from
 *    the `student_risk_summary` materialized view (latest prediction_log).
 *  - All list/search queries hit the materialized view for zero live aggregation cost.
 *  - Audit trail is trigger-driven; model sets app.current_user_id per connection.
 */

/** Flat shape the API returns for every student */
function formatStudent(row) {
  return {
    id           : row.student_id || row.id,
    studentCode  : row.student_code,
    name         : row.name,
    email        : row.email,
    avatarUrl    : row.avatar_url || null,
    grade        : row.grade,
    major        : row.major,
    semester     : row.semester,
    attendance   : parseFloat(row.attendance),
    score        : parseFloat(row.score),
    riskLevel    : row.risk_level   || 'unscored',
    aiPrediction : row.ai_prediction ? parseFloat(row.ai_prediction) : null,
    confidence   : row.confidence   ? parseFloat(row.confidence)     : null,
    predictedAt  : row.predicted_at || null,
    createdAt    : row.created_at,
    updatedAt    : row.updated_at,
  };
}

const StudentModel = {

  // ─── LIST (search, filter, sort, paginate) ──────────────────────────────────
  // Hits the materialized view — no live aggregates, no full table scan.
  async findAll({ search, grade, major, risk, sort = 'created_at', order = 'DESC', page = 1, limit = 20 } = {}) {
    const conditions = ['is_active = TRUE'];
    const params     = [];
    let   pIdx       = 1;

    if (search) {
      // Trigram similarity search — tolerant to typos, fast on GIN index
      conditions.push(`(name % $${pIdx} OR name ILIKE $${pIdx + 1} OR email ILIKE $${pIdx + 1} OR student_code ILIKE $${pIdx + 1})`);
      params.push(search, `%${search}%`);
      pIdx += 2;
    }

    if (grade && grade !== 'all') {
      conditions.push(`grade ILIKE $${pIdx}`);
      params.push(`%${grade}%`);
      pIdx++;
    }

    if (major && major !== 'all') {
      conditions.push(`major ILIKE $${pIdx}`);
      params.push(`%${major}%`);
      pIdx++;
    }

    if (risk && risk !== 'all') {
      conditions.push(`risk_level = $${pIdx}`);
      params.push(risk);
      pIdx++;
    }

    const WHERE = `WHERE ${conditions.join(' AND ')}`;

    const SORTABLE = {
      name        : 'name',
      score       : 'score',
      attendance  : 'attendance',
      risk_level  : 'risk_level',
      created_at  : 'created_at',
      ai_prediction: 'ai_prediction',
    };
    const sortCol = SORTABLE[sort] || 'created_at';
    const sortDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const offset  = (page - 1) * limit;

    // NULLS LAST so unscored students don't rise to top on ai_prediction sort
    const dataSQL = `
      SELECT *
        FROM student_risk_summary
       ${WHERE}
       ORDER BY ${sortCol} ${sortDir} NULLS LAST
       LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;
    params.push(limit, offset);

    const countSQL = `SELECT COUNT(*) FROM student_risk_summary ${WHERE}`;

    const [dataResult, countResult] = await Promise.all([
      db.query(dataSQL,  params),
      db.query(countSQL, params.slice(0, pIdx - 1)),
    ]);

    return {
      students : dataResult.rows.map(formatStudent),
      total    : parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    };
  },

  // ─── FIND BY BIGINT ID ──────────────────────────────────────────────────────
  async findById(id) {
    const { rows } = await db.query(
      `SELECT * FROM student_risk_summary WHERE student_id = $1`,
      [id],
    );
    return rows[0] ? formatStudent(rows[0]) : null;
  },

  // ─── FIND BY student_code (display ID e.g. "STU-24012") ────────────────────
  async findByCode(code) {
    const { rows } = await db.query(
      `SELECT * FROM student_risk_summary WHERE student_code = $1`,
      [code],
    );
    return rows[0] ? formatStudent(rows[0]) : null;
  },

  // ─── FIND MULTIPLE BY IDs (used by batch prediction) ───────────────────────
  async findByIds(ids) {
    if (!ids.length) return [];
    const { rows } = await db.query(
      `SELECT * FROM student_risk_summary WHERE student_id = ANY($1)`,
      [ids],
    );
    return rows.map(formatStudent);
  },

  // ─── FIND BY ID — queries base tables directly (no materialized view) ────────
  // Use this immediately after INSERT/UPDATE before the view has been refreshed.
  async findByIdLive(id) {
    const { rows } = await db.query(
      `SELECT
         s.id          AS student_id,
         s.student_code,
         s.name,
         s.email,
         s.avatar_url,
         s.attendance,
         s.score,
         s.is_active,
         s.created_at,
         s.updated_at,
         g.label   AS grade,
         m.name    AS major,
         sem.label AS semester,
         pl.prediction   AS ai_prediction,
         pl.risk_level,
         pl.model_version,
         pl.confidence,
         pl.created_at   AS predicted_at,
         pl.requested_by AS predicted_by
       FROM students s
       JOIN grades    g   ON g.id   = s.grade_id
       JOIN majors    m   ON m.id   = s.major_id
       JOIN semesters sem ON sem.id = s.semester_id
       LEFT JOIN LATERAL (
         SELECT prediction, risk_level, model_version, confidence, created_at, requested_by
         FROM prediction_logs
         WHERE student_id = s.id
         ORDER BY created_at DESC
         LIMIT 1
       ) pl ON TRUE
       WHERE s.id = $1`,
      [id],
    );
    return rows[0] ? formatStudent(rows[0]) : null;
  },

  // ─── CREATE ─────────────────────────────────────────────────────────────────
  async create({ studentCode, name, email, avatarUrl, grade, major, semester, attendance, score }, userId = null) {
    const gradeId    = await LookupModel.resolveGradeId(grade);
    const majorId    = await LookupModel.resolveMajorId(major);
    const semesterId = await LookupModel.resolveSemesterId(semester || '1st / Fall');

    const client = await db.getClient();
    try {
      // Set session variable for audit trigger
      if (userId) {
        await client.query(`SELECT set_config('app.current_user_id', $1, TRUE)`, [userId]);
      }

      const { rows } = await client.query(
        `INSERT INTO students
           (student_code, name, email, avatar_url, grade_id, major_id, semester_id, attendance, score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [studentCode, name, email, avatarUrl || null, gradeId, majorId, semesterId,
         attendance, score],
      );

      const studentId = rows[0].id;

      // Assign student to creating user
      if (userId) {
        await client.query(
          `INSERT INTO user_student_assignments (user_id, student_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, studentId],
        );
      }

      return this.findByIdLive(studentId);
    } finally {
      client.release();
    }
  },

  // ─── UPDATE (partial) ───────────────────────────────────────────────────────
  async update(id, fields, userId = null) {
    const allowed = ['name','email','avatar_url','attendance','score','is_active'];
    const lookupFields = { grade: null, major: null, semester: null };

    // Resolve any lookup label changes
    if (fields.grade)    lookupFields.grade_id    = await LookupModel.resolveGradeId(fields.grade);
    if (fields.major)    lookupFields.major_id    = await LookupModel.resolveMajorId(fields.major);
    if (fields.semester) lookupFields.semester_id = await LookupModel.resolveSemesterId(fields.semester);

    const setClauses = [];
    const params     = [];
    let   pIdx       = 1;

    // Scalar fields
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        setClauses.push(`${key} = $${pIdx}`);
        params.push(val);
        pIdx++;
      }
    }

    // Lookup FK fields
    for (const [key, val] of Object.entries(lookupFields)) {
      if (val !== null) {
        setClauses.push(`${key} = $${pIdx}`);
        params.push(val);
        pIdx++;
      }
    }

    if (setClauses.length === 0) return this.findByIdLive(id);

    params.push(id);

    const client = await db.getClient();
    try {
      if (userId) {
        await client.query(`SELECT set_config('app.current_user_id', $1, TRUE)`, [userId]);
      }
      await client.query(
        `UPDATE students SET ${setClauses.join(', ')} WHERE id = $${pIdx}`,
        params,
      );
    } finally {
      client.release();
    }

    return this.findByIdLive(id);
  },

  // ─── DELETE (soft by default) ───────────────────────────────────────────────
  async delete(id, userId = null) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const client = await db.getClient();
    try {
      if (userId) {
        await client.query(`SELECT set_config('app.current_user_id', $1, TRUE)`, [userId]);
      }
      // Soft delete — set is_active = FALSE
      await client.query(
        `UPDATE students SET is_active = FALSE WHERE id = $1`,
        [id],
      );
    } finally {
      client.release();
    }

    return existing;
  },

  // ─── HARD DELETE (admin only) ────────────────────────────────────────────────
  async hardDelete(id, userId = null) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const client = await db.getClient();
    try {
      if (userId) {
        await client.query(`SELECT set_config('app.current_user_id', $1, TRUE)`, [userId]);
      }
      await client.query(`DELETE FROM students WHERE id = $1`, [id]);
    } finally {
      client.release();
    }

    return existing;
  },

  // ─── STATS (from materialized view — zero table scan cost) ─────────────────
  async getStats() {
    const { rows } = await db.query(`SELECT * FROM dashboard_stats`);
    return rows[0];
  },

  // ─── CLASS DISTRIBUTION (from materialized view) ────────────────────────────
  async getClassDistribution() {
    const { rows } = await db.query(`
      SELECT
        major                 AS name,
        COUNT(*)::int         AS students,
        ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 0)::int AS percent
      FROM student_risk_summary
      WHERE is_active = TRUE
      GROUP BY major
      ORDER BY students DESC
    `);
    return rows;
  },

  // ─── RISK DISTRIBUTION (for charts) ─────────────────────────────────────────
  async getRiskDistribution() {
    const { rows } = await db.query(`
      SELECT
        COALESCE(risk_level, 'unscored') AS risk_level,
        COUNT(*)::int                    AS count
      FROM student_risk_summary
      WHERE is_active = TRUE
      GROUP BY risk_level
    `);
    return rows;
  },
};

module.exports = StudentModel;
