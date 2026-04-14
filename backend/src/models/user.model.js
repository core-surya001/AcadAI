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

  /**
   * Find a user by their Google ID (used for OAuth login).
   */
  async findByGoogleId(googleId) {
    const { rows } = await db.query(
      `SELECT id, name, email, role, is_active, google_id
         FROM users WHERE google_id = $1`,
      [googleId]
    );
    return rows[0] || null;
  },

  /**
   * Create a new user from Google OAuth (no password required).
   */
  async createFromGoogle({ name, email, googleId, role = 'teacher' }) {
    const { rows } = await db.query(
      `INSERT INTO users (name, email, google_id, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, googleId, role]
    );
    return rows[0];
  },

  /**
   * Link a Google ID to an existing user account.
   */
  async linkGoogleId(userId, googleId) {
    const { rows } = await db.query(
      `UPDATE users SET google_id = $1 WHERE id = $2
       RETURNING id, name, email, role`,
      [googleId, userId]
    );
    return rows[0];
  },
};

module.exports = UserModel;
