'use strict';

/**
 * migrate.js — Run once per environment to set up the full production schema.
 * Usage: node src/db/migrate.js
 *
 * Schema version: 2.0
 * Changes from v1:
 *  - Normalized lookup tables: majors, grades, semesters
 *  - students: BIGSERIAL PK, student_code display field, FK to lookups, no ai_prediction/risk_level
 *  - prediction_logs: BIGSERIAL PK, NOT NULL student_id, confidence col, quarterly partitioning
 *  - Materialized view: student_risk_summary (latest prediction per student)
 *  - user_student_assignments: teacher → student ownership model
 *  - student_audit_log: full change history with quarterly partitioning
 *  - Connection pool config fixed (raised max, allowExitOnIdle)
 */

require('dotenv').config();
const db     = require('./index');
const logger = require('../utils/logger');

// ─── Step 1: Extensions ────────────────────────────────────────────────────────
const SQL_EXTENSIONS = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for trigram fuzzy search on names
`;

// ─── Step 1b: Drop old v1 schema objects (safe on first run too) ───────────────
// Drop in reverse dependency order. CASCADE handles any leftover FK references.
const SQL_DROP_V1 = `
DROP MATERIALIZED VIEW IF EXISTS student_risk_summary CASCADE;
DROP VIEW               IF EXISTS dashboard_stats    CASCADE;
DROP TABLE              IF EXISTS student_audit_log  CASCADE;
DROP TABLE              IF EXISTS user_student_assignments CASCADE;
DROP TABLE              IF EXISTS prediction_logs    CASCADE;
DROP TABLE              IF EXISTS students           CASCADE;
DROP TABLE              IF EXISTS semesters          CASCADE;
DROP TABLE              IF EXISTS grades             CASCADE;
DROP TABLE              IF EXISTS majors             CASCADE;
DROP FUNCTION           IF EXISTS refresh_student_risk_summary() CASCADE;
DROP FUNCTION           IF EXISTS log_student_changes()          CASCADE;
DROP FUNCTION           IF EXISTS update_updated_at_column()     CASCADE;
`;


// ─── Step 2: Users table (unchanged structure, clean definition) ───────────────
const SQL_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(120) NOT NULL,
  email        VARCHAR(255) NOT NULL UNIQUE,
  password     VARCHAR(255),             -- NULL for OAuth-only users
  role         VARCHAR(30)  NOT NULL DEFAULT 'teacher'
                  CHECK (role IN ('admin', 'teacher', 'counselor')),
  google_id    VARCHAR(255) UNIQUE,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users(role);
`;

// ─── Step 3: Lookup tables ─────────────────────────────────────────────────────
const SQL_LOOKUPS = `
CREATE TABLE IF NOT EXISTS majors (
  id         SMALLSERIAL  PRIMARY KEY,
  name       VARCHAR(80)  NOT NULL UNIQUE,
  department VARCHAR(80),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grades (
  id    SMALLSERIAL PRIMARY KEY,
  label VARCHAR(30) NOT NULL UNIQUE    -- e.g. "Grade 11-A"
);

CREATE TABLE IF NOT EXISTS semesters (
  id    SMALLSERIAL PRIMARY KEY,
  label VARCHAR(30) NOT NULL UNIQUE    -- e.g. "4th / Spring"
);
`;

// ─── Step 4: Students table (normalized, no mutable prediction state) ──────────
const SQL_STUDENTS = `
CREATE TABLE IF NOT EXISTS students (
  id           BIGSERIAL    PRIMARY KEY,
  student_code VARCHAR(20)  NOT NULL UNIQUE,   -- display-only "STU-YYXXXXX"
  name         VARCHAR(120) NOT NULL,
  email        VARCHAR(255) NOT NULL UNIQUE,
  avatar_url   VARCHAR(500),                   -- URL only — no base64 blobs
  grade_id     SMALLINT     NOT NULL REFERENCES grades(id)   ON UPDATE CASCADE,
  major_id     SMALLINT     NOT NULL REFERENCES majors(id)   ON UPDATE CASCADE,
  semester_id  SMALLINT     NOT NULL REFERENCES semesters(id) ON UPDATE CASCADE,
  attendance   NUMERIC(5,2) NOT NULL DEFAULT 0
                  CHECK (attendance BETWEEN 0 AND 100),
  score        NUMERIC(4,2) NOT NULL DEFAULT 0
                  CHECK (score BETWEEN 0 AND 10),
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  -- risk_level and ai_prediction are REMOVED — derived from prediction_logs via materialized view
);

CREATE INDEX IF NOT EXISTS idx_students_major_id   ON students(major_id);
CREATE INDEX IF NOT EXISTS idx_students_grade_id   ON students(grade_id);
CREATE INDEX IF NOT EXISTS idx_students_score      ON students(score);
CREATE INDEX IF NOT EXISTS idx_students_attendance ON students(attendance);
CREATE INDEX IF NOT EXISTS idx_students_email      ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_student_code ON students(student_code);

-- Trigram index for fast ILIKE name search (replaces slower GIN tsvector for partial match)
CREATE INDEX IF NOT EXISTS idx_students_name_trgm
  ON students USING GIN(name gin_trgm_ops);
`;

// ─── Step 5: Prediction logs (partitioned by quarter) ─────────────────────────
const SQL_PREDICTION_LOGS = `
CREATE TABLE IF NOT EXISTS prediction_logs (
  id            BIGSERIAL    NOT NULL,
  student_id    BIGINT       NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  requested_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  input_data    JSONB        NOT NULL,
  prediction    NUMERIC(5,2) NOT NULL CHECK (prediction BETWEEN 0 AND 100),
  risk_level    VARCHAR(10)  NOT NULL CHECK (risk_level IN ('low','medium','high')),
  model_version VARCHAR(30)  NOT NULL DEFAULT 'local-v1.0',
  confidence    NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Quarterly partitions — extend these annually (or use pg_partman in production)
CREATE TABLE IF NOT EXISTS prediction_logs_2025_q4
  PARTITION OF prediction_logs
  FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS prediction_logs_2026_q1
  PARTITION OF prediction_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS prediction_logs_2026_q2
  PARTITION OF prediction_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS prediction_logs_2026_q3
  PARTITION OF prediction_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS prediction_logs_2026_q4
  PARTITION OF prediction_logs
  FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS prediction_logs_2027_q1
  PARTITION OF prediction_logs
  FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');

-- Indexes apply to all partitions automatically
CREATE INDEX IF NOT EXISTS idx_pred_logs_student_created
  ON prediction_logs(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pred_logs_risk
  ON prediction_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_pred_logs_requested_by
  ON prediction_logs(requested_by);
CREATE INDEX IF NOT EXISTS idx_pred_logs_model
  ON prediction_logs(model_version);
`;

// ─── Step 6: User → Student assignment (ownership / RBAC at data layer) ────────
const SQL_ASSIGNMENTS = `
CREATE TABLE IF NOT EXISTS user_student_assignments (
  user_id     UUID    NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  student_id  BIGINT  NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_usa_student_id ON user_student_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_usa_user_id    ON user_student_assignments(user_id);
`;

// ─── Step 7: Student audit log (partitioned by quarter) ───────────────────────
const SQL_AUDIT_LOG = `
CREATE TABLE IF NOT EXISTS student_audit_log (
  id          BIGSERIAL   NOT NULL,
  student_id  BIGINT      REFERENCES students(id) ON DELETE SET NULL,   -- nullable: preserved when student is deleted
  changed_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  operation   VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  old_values  JSONB,
  new_values  JSONB,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, changed_at)
) PARTITION BY RANGE (changed_at);

CREATE TABLE IF NOT EXISTS student_audit_log_2025_q4
  PARTITION OF student_audit_log
  FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS student_audit_log_2026_q1
  PARTITION OF student_audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS student_audit_log_2026_q2
  PARTITION OF student_audit_log
  FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS student_audit_log_2026_q3
  PARTITION OF student_audit_log
  FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS student_audit_log_2026_q4
  PARTITION OF student_audit_log
  FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS student_audit_log_2027_q1
  PARTITION OF student_audit_log
  FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');

CREATE INDEX IF NOT EXISTS idx_audit_student_time
  ON student_audit_log(student_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by
  ON student_audit_log(changed_by);
`;

// ─── Step 8: Triggers ─────────────────────────────────────────────────────────
const SQL_TRIGGERS = `
-- Auto-update updated_at on any UPDATE
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

-- Audit trigger — fires on INSERT / UPDATE / DELETE on students
CREATE OR REPLACE FUNCTION log_student_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO student_audit_log(student_id, changed_by, operation, old_values, new_values)
    VALUES (OLD.id, v_user_id, 'DELETE', to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO student_audit_log(student_id, changed_by, operation, old_values, new_values)
    VALUES (NEW.id, v_user_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO student_audit_log(student_id, changed_by, operation, old_values, new_values)
    VALUES (NEW.id, v_user_id, 'INSERT', NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_students ON students;
CREATE TRIGGER audit_students
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION log_student_changes();

`;

// ─── Step 9: Materialized view for risk summary (dashboard stats) ──────────────
// This replaces the full-table-scan aggregate queries.
// Refresh with: SELECT refresh_student_risk_summary(); (or on a pg_cron schedule)
const SQL_MATERIALIZED_VIEW = `
CREATE MATERIALIZED VIEW IF NOT EXISTS student_risk_summary AS
SELECT
  s.id                   AS student_id,
  s.student_code,
  s.name,
  s.email,
  s.attendance,
  s.score,
  s.is_active,
  g.label                AS grade,
  m.name                 AS major,
  sem.label              AS semester,
  s.avatar_url,
  s.created_at,
  s.updated_at,
  pl.prediction          AS ai_prediction,
  pl.risk_level,
  pl.model_version,
  pl.confidence,
  pl.created_at          AS predicted_at,
  pl.requested_by        AS predicted_by
FROM students s
LEFT JOIN grades    g   ON g.id   = s.grade_id
LEFT JOIN majors    m   ON m.id   = s.major_id
LEFT JOIN semesters sem ON sem.id = s.semester_id
LEFT JOIN LATERAL (
  SELECT prediction, risk_level, model_version, confidence, created_at, requested_by
  FROM prediction_logs
  WHERE student_id = s.id
  ORDER BY created_at DESC
  LIMIT 1
) pl ON TRUE
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_srs_student_id   ON student_risk_summary(student_id);
CREATE INDEX        IF NOT EXISTS idx_srs_risk_level   ON student_risk_summary(risk_level);
CREATE INDEX        IF NOT EXISTS idx_srs_major         ON student_risk_summary(major);
CREATE INDEX        IF NOT EXISTS idx_srs_grade         ON student_risk_summary(grade);
CREATE INDEX        IF NOT EXISTS idx_srs_score         ON student_risk_summary(score);
CREATE INDEX        IF NOT EXISTS idx_srs_attendance    ON student_risk_summary(attendance);
CREATE INDEX        IF NOT EXISTS idx_srs_name_trgm
  ON student_risk_summary USING GIN(name gin_trgm_ops);

-- Convenience function so callers don't have to remember the CONCURRENTLY syntax
CREATE OR REPLACE FUNCTION refresh_student_risk_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY student_risk_summary;
END;
$$ LANGUAGE plpgsql;
`;

// ─── Step 10: Dashboard stats view (pre-aggregated, hits materialized view) ────
const SQL_STATS_VIEW = `
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  COUNT(*)                                                             AS total_students,
  ROUND(AVG(score) * 10, 1)                                           AS average_score,
  COUNT(*) FILTER (WHERE risk_level IN ('medium','high'))             AS at_risk_students,
  COUNT(*) FILTER (WHERE risk_level = 'high')                         AS high_risk_count,
  ROUND(AVG(attendance), 1)                                           AS avg_attendance,
  COUNT(*) FILTER (WHERE risk_level IS NULL)                          AS unscored_students
FROM student_risk_summary
WHERE is_active = TRUE;
`;

// ─── Runner ───────────────────────────────────────────────────────────────────
(async () => {
  try {
    logger.info('▶  Running AcadAI schema migrations (v2.0)…');

    await db.query(SQL_EXTENSIONS);
    logger.info('  ✓ Extensions');

    await db.query(SQL_DROP_V1);
    logger.info('  ✓ Old v1 schema dropped (if existed)');

    await db.query(SQL_USERS);
    logger.info('  ✓ users table');

    await db.query(SQL_LOOKUPS);
    logger.info('  ✓ lookup tables (majors, grades, semesters)');


    await db.query(SQL_STUDENTS);
    logger.info('  ✓ students table');

    await db.query(SQL_PREDICTION_LOGS);
    logger.info('  ✓ prediction_logs table (partitioned by quarter)');

    await db.query(SQL_ASSIGNMENTS);
    logger.info('  ✓ user_student_assignments table');

    await db.query(SQL_AUDIT_LOG);
    logger.info('  ✓ student_audit_log table (partitioned by quarter)');

    await db.query(SQL_TRIGGERS);
    logger.info('  ✓ triggers (updated_at, audit log)');

    await db.query(SQL_MATERIALIZED_VIEW);
    logger.info('  ✓ materialized view: student_risk_summary');

    await db.query(SQL_STATS_VIEW);
    logger.info('  ✓ view: dashboard_stats');

    logger.info('✅  All migrations complete (v2.0)');
    process.exit(0);
  } catch (err) {
    logger.error('❌  Migration failed:', err.message);
    logger.error(err.stack);
    process.exit(1);
  }
})();
