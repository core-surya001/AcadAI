'use strict';
require('dotenv').config();
const db = require('./src/db');

const STEPS = [
  // 1. Disable trigger first so pending DELETEs don't fire the broken audit trigger
  `DROP TRIGGER IF EXISTS audit_students ON students`,

  // 2. Purge old test data while trigger is disabled
  `DELETE FROM students WHERE email LIKE '%test%'`,

  // 3. Drop all audit partitions + parent
  `DROP TABLE IF EXISTS student_audit_log_2025_q4 CASCADE`,
  `DROP TABLE IF EXISTS student_audit_log_2026_q1 CASCADE`,
  `DROP TABLE IF EXISTS student_audit_log_2026_q2 CASCADE`,
  `DROP TABLE IF EXISTS student_audit_log_2026_q3 CASCADE`,
  `DROP TABLE IF EXISTS student_audit_log_2026_q4 CASCADE`,
  `DROP TABLE IF EXISTS student_audit_log_2027_q1 CASCADE`,
  `DROP TABLE IF EXISTS student_audit_log CASCADE`,

  // 4. Recreate with nullable FK
  `CREATE TABLE student_audit_log (
    id          BIGSERIAL   NOT NULL,
    student_id  BIGINT      REFERENCES students(id) ON DELETE SET NULL,
    changed_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    operation   VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
    old_values  JSONB,
    new_values  JSONB,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, changed_at)
  ) PARTITION BY RANGE (changed_at)`,

  `CREATE TABLE student_audit_log_2025_q4
     PARTITION OF student_audit_log FOR VALUES FROM ('2025-10-01') TO ('2026-01-01')`,
  `CREATE TABLE student_audit_log_2026_q1
     PARTITION OF student_audit_log FOR VALUES FROM ('2026-01-01') TO ('2026-04-01')`,
  `CREATE TABLE student_audit_log_2026_q2
     PARTITION OF student_audit_log FOR VALUES FROM ('2026-04-01') TO ('2026-07-01')`,
  `CREATE TABLE student_audit_log_2026_q3
     PARTITION OF student_audit_log FOR VALUES FROM ('2026-07-01') TO ('2026-10-01')`,
  `CREATE TABLE student_audit_log_2026_q4
     PARTITION OF student_audit_log FOR VALUES FROM ('2026-10-01') TO ('2027-01-01')`,
  `CREATE TABLE student_audit_log_2027_q1
     PARTITION OF student_audit_log FOR VALUES FROM ('2027-01-01') TO ('2027-04-01')`,

  `CREATE INDEX idx_audit_student_time ON student_audit_log(student_id, changed_at DESC)`,
  `CREATE INDEX idx_audit_changed_by   ON student_audit_log(changed_by)`,

  // 5. Re-enable trigger
  `CREATE TRIGGER audit_students
     AFTER INSERT OR UPDATE OR DELETE ON students
     FOR EACH ROW EXECUTE FUNCTION log_student_changes()`,

  // 6. Refresh view
  `SELECT refresh_student_risk_summary()`,
];

(async () => {
  for (const [i, sql] of STEPS.entries()) {
    try {
      await db.query(sql);
      console.log(`  [${i + 1}/${STEPS.length}] OK`);
    } catch (e) {
      console.error(`  [${i + 1}/${STEPS.length}] FAILED: ${e.message}`);
      process.exit(1);
    }
  }
  console.log('Done. Audit FK patched correctly.');
  process.exit(0);
})();
