'use strict';

const db = require('../db');

/**
 * Student model — all SQL for the `students` table.
 */

const StudentModel = {
  /**
   * List students with optional search, filter, sort, and pagination.
   */
  async findAll({ search, grade, risk, sort = 'created_at', order = 'DESC', page = 1, limit = 20 } = {}) {
    const conditions = [];
    const params     = [];
    let   pIdx       = 1;

    if (search) {
      conditions.push(
        `(name ILIKE $${pIdx} OR id ILIKE $${pIdx} OR email ILIKE $${pIdx})`
      );
      params.push(`%${search}%`);
      pIdx++;
    }

    if (grade && grade !== 'all') {
      conditions.push(`grade ILIKE $${pIdx}`);
      params.push(`%${grade}%`);
      pIdx++;
    }

    if (risk && risk !== 'all') {
      conditions.push(`risk_level = $${pIdx}`);
      params.push(risk);
      pIdx++;
    }

    const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Whitelist sortable columns
    const SORTABLE = ['name', 'score', 'attendance', 'risk_level', 'created_at'];
    const sortCol  = SORTABLE.includes(sort) ? sort : 'created_at';
    const sortDir  = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const offset = (page - 1) * limit;

    const dataSQL = `
      SELECT id, name, email, avatar, grade, major, semester,
             attendance, score, risk_level, ai_prediction, created_at
        FROM students
       ${WHERE}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;
    params.push(limit, offset);

    const countSQL = `SELECT COUNT(*) FROM students ${WHERE}`;

    const [dataResult, countResult] = await Promise.all([
      db.query(dataSQL,  params),
      db.query(countSQL, params.slice(0, pIdx - 1)), // exclude LIMIT/OFFSET
    ]);

    return {
      students : dataResult.rows,
      total    : parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    };
  },

  /**
   * Fetch a single student by their string ID (e.g. "STU-24012").
   */
  async findById(id) {
    const { rows } = await db.query(
      `SELECT id, name, email, avatar, grade, major, semester,
              attendance, score, risk_level, ai_prediction,
              created_at, updated_at
         FROM students WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Insert a new student. The caller must supply a generated ID.
   */
  async create({ id, name, email, avatar, grade, major, semester, attendance, score, risk_level, ai_prediction }) {
    const { rows } = await db.query(
      `INSERT INTO students
         (id, name, email, avatar, grade, major, semester, attendance, score, risk_level, ai_prediction)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [id, name, email, avatar || null, grade, major, semester,
       attendance, score, risk_level, ai_prediction || null]
    );
    return rows[0];
  },

  /**
   * Partial update — only columns provided in `fields` are changed.
   */
  async update(id, fields) {
    const allowed = ['name','email','avatar','grade','major','semester',
                     'attendance','score','risk_level','ai_prediction'];

    const setClauses = [];
    const params     = [];
    let   pIdx       = 1;

    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        setClauses.push(`${key} = $${pIdx}`);
        params.push(val);
        pIdx++;
      }
    }

    if (setClauses.length === 0) return this.findById(id);

    params.push(id);
    const { rows } = await db.query(
      `UPDATE students SET ${setClauses.join(', ')}
        WHERE id = $${pIdx}
       RETURNING *`,
      params
    );
    return rows[0] || null;
  },

  /**
   * Delete a student by ID. Returns the deleted row.
   */
  async delete(id) {
    const { rows } = await db.query(
      `DELETE FROM students WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Aggregate counts for the dashboard stats endpoint.
   */
  async getStats() {
    const { rows } = await db.query(`
      SELECT
        COUNT(*)                                                    AS total_students,
        ROUND(AVG(score) * 10, 1)                                  AS average_score,
        COUNT(*) FILTER (WHERE risk_level IN ('medium','high'))    AS at_risk_students,
        COUNT(*) FILTER (WHERE risk_level = 'high')                AS high_risk_count,
        ROUND(AVG(attendance), 1)                                  AS avg_attendance
      FROM students
    `);
    return rows[0];
  },

  /**
   * Distribution of students per major.
   */
  async getClassDistribution() {
    const { rows } = await db.query(`
      SELECT
        major                 AS name,
        COUNT(*)::int         AS students,
        ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 0)::int AS percent
      FROM students
      GROUP BY major
      ORDER BY students DESC
    `);
    return rows;
  },
};

module.exports = StudentModel;
