'use strict';

/**
 * seed.js — Populate the database with demo data using the v2.0 schema.
 * Usage: node src/db/seed.js
 *
 * Order matters:
 *   1. Lookup tables (majors, grades, semesters)
 *   2. Admin user
 *   3. Students (referencing lookup IDs)
 *   4. Seed prediction_logs for each student
 *   5. Refresh materialized view
 */

require('dotenv').config();
const bcrypt  = require('bcryptjs');
const db      = require('./index');
const logger  = require('../utils/logger');

// ─── Demo Data ────────────────────────────────────────────────────────────────

const MAJORS = [
  { name: 'Computer Science', department: 'Engineering' },
  { name: 'Mathematics',      department: 'Sciences'    },
  { name: 'Physics',          department: 'Sciences'    },
  { name: 'Philosophy',       department: 'Humanities'  },
  { name: 'Literature',       department: 'Humanities'  },
];

const GRADES = [
  { label: 'Grade 10-A' },
  { label: 'Grade 10-B' },
  { label: 'Grade 10-C' },
  { label: 'Grade 11-A' },
  { label: 'Grade 11-B' },
  { label: 'Grade 12-A' },
];

const SEMESTERS = [
  { label: '1st / Fall'   },
  { label: '2nd / Spring' },
  { label: '3rd / Fall'   },
  { label: '4th / Spring' },
  { label: '5th / Fall'   },
  { label: '6th / Spring' },
];

const ADMIN = {
  name    : 'Alex Rivera',
  email   : 'admin@acadai.edu',
  password: 'Admin@1234',
  role    : 'admin',
};

// Students referencing lookup labels (resolved to IDs below)
const STUDENT_TEMPLATES = [
  { code: 'STU-24012', name: 'Elena Rodriguez',   email: 'e.rod@academy.edu',      grade: 'Grade 11-A', major: 'Computer Science', semester: '4th / Spring', attendance: 94,  score: 8.2, prediction: 91,  risk: 'low'    },
  { code: 'STU-24015', name: 'Marcus Thorne',      email: 'm.thorne@academy.edu',   grade: 'Grade 11-B', major: 'Mathematics',      semester: '3rd / Fall',   attendance: 62,  score: 4.5, prediction: 42,  risk: 'high'   },
  { code: 'STU-24018', name: 'Li Wei',             email: 'l.wei@academy.edu',      grade: 'Grade 11-A', major: 'Physics',          semester: '4th / Spring', attendance: 88,  score: 7.8, prediction: 76,  risk: 'medium' },
  { code: 'STU-24021', name: 'Sarah Jenkins',      email: 's.jenkins@academy.edu',  grade: 'Grade 10-C', major: 'Computer Science', semester: '2nd / Spring', attendance: 99,  score: 9.5, prediction: 97,  risk: 'low'    },
  { code: 'STU-24025', name: 'Julianne Sterling',  email: 'j.sterling@academy.edu', grade: 'Grade 11-A', major: 'Computer Science', semester: '4th / Spring', attendance: 92,  score: 8.8, prediction: 88,  risk: 'low'    },
  { code: 'STU-24030', name: 'David Chen',         email: 'd.chen@academy.edu',     grade: 'Grade 10-B', major: 'Philosophy',       semester: '1st / Fall',   attendance: 71,  score: 5.1, prediction: 48,  risk: 'high'   },
  { code: 'STU-24035', name: 'Aisha Patel',        email: 'a.patel@academy.edu',    grade: 'Grade 11-B', major: 'Mathematics',      semester: '3rd / Fall',   attendance: 85,  score: 7.2, prediction: 72,  risk: 'medium' },
  { code: 'STU-24040', name: "Liam O'Brien",       email: 'l.obrien@academy.edu',   grade: 'Grade 10-A', major: 'Physics',          semester: '2nd / Fall',   attendance: 90,  score: 8.0, prediction: 85,  risk: 'low'    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertLookup(table, uniqueCol, rows) {
  const ids = {};
  for (const row of rows) {
    const cols   = Object.keys(row);
    const vals   = cols.map((_, i) => `$${i + 1}`);
    const placed = cols.map(c => `${c} = EXCLUDED.${c}`);
    const result = await db.query(
      `INSERT INTO ${table} (${cols.join(',')})
       VALUES (${vals.join(',')})
       ON CONFLICT (${uniqueCol}) DO UPDATE SET ${placed.join(', ')}
       RETURNING id, ${uniqueCol}`,
      Object.values(row),
    );
    ids[result.rows[0][uniqueCol]] = result.rows[0].id;
  }
  return ids;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    logger.info('▶  Seeding database (v2.0 schema)…');

    // 1. Lookup tables
    const majorIds    = await upsertLookup('majors',    'name',  MAJORS);
    const gradeIds    = await upsertLookup('grades',    'label', GRADES);
    const semesterIds = await upsertLookup('semesters', 'label', SEMESTERS);
    logger.info('  ✓ Lookup tables seeded');

    // 2. Admin user
    const hash = await bcrypt.hash(ADMIN.password, 12);
    const adminRes = await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [ADMIN.name, ADMIN.email, hash, ADMIN.role],
    );
    const adminId = adminRes.rows[0].id;
    logger.info(`  ✓ Admin user: ${ADMIN.email}  /  password: ${ADMIN.password}`);

    // 3. Students
    const studentIds = [];
    for (const s of STUDENT_TEMPLATES) {
      const gradeId    = gradeIds[s.grade];
      const majorId    = majorIds[s.major];
      const semesterId = semesterIds[s.semester] || semesterIds['1st / Fall'];

      const res = await db.query(
        `INSERT INTO students
           (student_code, name, email, grade_id, major_id, semester_id, attendance, score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (student_code) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           attendance = EXCLUDED.attendance,
           score = EXCLUDED.score
         RETURNING id, student_code`,
        [s.code, s.name, s.email, gradeId, majorId, semesterId, s.attendance, s.score],
      );
      studentIds.push({ id: res.rows[0].id, code: res.rows[0].student_code, prediction: s.prediction, risk: s.risk });
    }
    logger.info(`  ✓ ${STUDENT_TEMPLATES.length} students seeded`);

    // 4. Seed one prediction log per student so the materialized view has data
    for (const s of studentIds) {
      await db.query(
        `INSERT INTO prediction_logs
           (student_id, requested_by, input_data, prediction, risk_level, model_version, confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [
          s.id,
          adminId,
          JSON.stringify({ seeded: true }),
          s.prediction,
          s.risk,
          'local-v1.0',
          0.72,
        ],
      );
    }
    logger.info('  ✓ Seed prediction logs inserted');

    // 5. Refresh the materialized view so dashboard stats are live
    await db.query('SELECT refresh_student_risk_summary()');
    logger.info('  ✓ Materialized view refreshed');

    logger.info('✅  Seed complete');
    process.exit(0);
  } catch (err) {
    logger.error('❌  Seed failed:', err.message);
    logger.error(err.stack);
    process.exit(1);
  }
})();
