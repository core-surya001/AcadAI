'use strict';

/**
 * migrate.js — Run this once to set up the database schema.
 * Usage: node src/db/migrate.js
 */

require('dotenv').config();
const db     = require('./index');
const logger = require('../utils/logger');

const SQL = `
-- Enable uuid extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users (faculty / admins) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(120) NOT NULL,
  email        VARCHAR(255) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  role         VARCHAR(30)  NOT NULL DEFAULT 'teacher'
                  CHECK (role IN ('admin', 'teacher', 'counselor')),
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Students ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id           VARCHAR(20)  PRIMARY KEY,          -- e.g. STU-24012
  name         VARCHAR(120) NOT NULL,
  email        VARCHAR(255) NOT NULL UNIQUE,
  avatar       TEXT,
  grade        VARCHAR(30)  NOT NULL,
  major        VARCHAR(60)  NOT NULL,
  semester     VARCHAR(30)  NOT NULL DEFAULT '1st / Fall',
  attendance   NUMERIC(5,2) NOT NULL DEFAULT 0
                  CHECK (attendance >= 0 AND attendance <= 100),
  score        NUMERIC(4,2) NOT NULL DEFAULT 0
                  CHECK (score >= 0 AND score <= 10),
  risk_level   VARCHAR(10)  NOT NULL DEFAULT 'low'
                  CHECK (risk_level IN ('low', 'medium', 'high')),
  ai_prediction NUMERIC(5,2)
                  CHECK (ai_prediction >= 0 AND ai_prediction <= 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Prediction logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prediction_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    VARCHAR(20) REFERENCES students(id) ON DELETE SET NULL,
  input_data    JSONB       NOT NULL,
  prediction    NUMERIC(5,2),
  risk_level    VARCHAR(10),
  model_version VARCHAR(30),
  requested_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── OAuth support ────────────────────────────────────────────────────────────
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_risk_level  ON students(risk_level);
CREATE INDEX IF NOT EXISTS idx_students_grade        ON students(grade);
CREATE INDEX IF NOT EXISTS idx_students_name         ON students USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_pred_logs_student     ON prediction_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_pred_logs_created     ON prediction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_google_id       ON users(google_id);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_students_updated_at ON students;
CREATE TRIGGER set_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

(async () => {
  try {
    logger.info('Running migrations…');
    await db.query(SQL);
    logger.info('✅  Migrations complete');
    process.exit(0);
  } catch (err) {
    logger.error('Migration failed:', err.message);
    process.exit(1);
  }
})();
