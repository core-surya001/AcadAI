'use strict';

const db = require('../db');

/**
 * LookupModel — read-only access to the three lookup tables.
 * Used by the frontend dropdowns (grade, major, semester selectors).
 */
const LookupModel = {

  async getMajors() {
    const { rows } = await db.query(
      `SELECT id, name, department FROM majors ORDER BY name`,
    );
    return rows;
  },

  async getGrades() {
    const { rows } = await db.query(
      `SELECT id, label FROM grades ORDER BY label`,
    );
    return rows;
  },

  async getSemesters() {
    const { rows } = await db.query(
      `SELECT id, label FROM semesters ORDER BY id`,
    );
    return rows;
  },

  /**
   * Resolve a grade label like "Grade 11-A" to its SMALLSERIAL id.
   * Inserts if not found (admin convenience — prevents inserts failing on unknown labels).
   */
  async resolveGradeId(label) {
    const { rows } = await db.query(
      `INSERT INTO grades (label) VALUES ($1)
       ON CONFLICT (label) DO UPDATE SET label = EXCLUDED.label
       RETURNING id`,
      [label],
    );
    return rows[0].id;
  },

  async resolveMajorId(name, department = null) {
    const { rows } = await db.query(
      `INSERT INTO majors (name, department) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [name, department],
    );
    return rows[0].id;
  },

  async resolveSemesterId(label) {
    const { rows } = await db.query(
      `INSERT INTO semesters (label) VALUES ($1)
       ON CONFLICT (label) DO UPDATE SET label = EXCLUDED.label
       RETURNING id`,
      [label],
    );
    return rows[0].id;
  },
};

module.exports = LookupModel;
