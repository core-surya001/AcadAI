'use strict';

const db = require('../db');

/**
 * User model — thin data-access layer over the `users` table.
 * All SQL lives here; controllers only call these methods.
 */

const UserModel = {
  /**
   * Find a user by email (used for login).
   */
  async findByEmail(email) {
    const { rows } = await db.query(
      `SELECT id, name, email, password, role, is_active
         FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Find a user by primary key (used for JWT verification).
   */
  async findById(id) {
    const { rows } = await db.query(
      `SELECT id, name, email, role, is_active
         FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Create a new user account.
   */
  async create({ name, email, hashedPassword, role = 'teacher' }) {
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, hashedPassword, role]
    );
    return rows[0];
  },
};

module.exports = UserModel;
