'use strict';
require('dotenv').config();
const db = require('./src/db');

const SQL = `
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
`;

db.query(SQL)
  .then(() => { console.log('Audit trigger patched OK'); process.exit(0); })
  .catch(e => { console.error('FAILED:', e.message); process.exit(1); });
