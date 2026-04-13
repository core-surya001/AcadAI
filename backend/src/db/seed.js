'use strict';

/**
 * seed.js — Populate the database with demo data matching the frontend mock.
 * Usage: node src/db/seed.js
 */

require('dotenv').config();
const bcrypt  = require('bcryptjs');
const db      = require('./index');
const logger  = require('../utils/logger');

const STUDENTS = [
  { id: 'STU-24012', name: 'Elena Rodriguez',   email: 'e.rod@academy.edu',       grade: 'Grade 11-A', major: 'Computer Science', semester: '4th / Spring', attendance: 94,  score: 8.2, risk_level: 'low',    ai_prediction: 91 },
  { id: 'STU-24015', name: 'Marcus Thorne',      email: 'm.thorne@academy.edu',    grade: 'Grade 11-B', major: 'Mathematics',      semester: '3rd / Fall',   attendance: 62,  score: 4.5, risk_level: 'high',   ai_prediction: 42 },
  { id: 'STU-24018', name: 'Li Wei',             email: 'l.wei@academy.edu',       grade: 'Grade 11-A', major: 'Physics',          semester: '4th / Spring', attendance: 88,  score: 7.8, risk_level: 'medium', ai_prediction: 76 },
  { id: 'STU-24021', name: 'Sarah Jenkins',      email: 's.jenkins@academy.edu',   grade: 'Grade 10-C', major: 'Computer Science', semester: '2nd / Spring', attendance: 99,  score: 9.5, risk_level: 'low',    ai_prediction: 97 },
  { id: 'STU-24025', name: 'Julianne Sterling',  email: 'j.sterling@academy.edu',  grade: 'Grade 11-A', major: 'Computer Science', semester: '4th / Spring', attendance: 92,  score: 8.8, risk_level: 'low',    ai_prediction: 88 },
  { id: 'STU-24030', name: 'David Chen',         email: 'd.chen@academy.edu',      grade: 'Grade 10-B', major: 'Philosophy',       semester: '1st / Fall',   attendance: 71,  score: 5.1, risk_level: 'high',   ai_prediction: 48 },
  { id: 'STU-24035', name: 'Aisha Patel',        email: 'a.patel@academy.edu',     grade: 'Grade 11-B', major: 'Mathematics',      semester: '3rd / Spring', attendance: 85,  score: 7.2, risk_level: 'medium', ai_prediction: 72 },
  { id: 'STU-24040', name: "Liam O'Brien",       email: 'l.obrien@academy.edu',    grade: 'Grade 10-A', major: 'Physics',          semester: '2nd / Fall',   attendance: 90,  score: 8.0, risk_level: 'low',    ai_prediction: 85 },
];

const ADMIN = {
  name    : 'Alex Rivera',
  email   : 'admin@acadai.edu',
  password: 'Admin@1234',
  role    : 'admin',
};

(async () => {
  try {
    logger.info('Seeding database…');

    // Seed admin user
    const hash = await bcrypt.hash(ADMIN.password, 12);
    await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (email) DO NOTHING`,
      [ADMIN.name, ADMIN.email, hash, ADMIN.role]
    );
    logger.info(`✅  Admin user: ${ADMIN.email}  /  password: ${ADMIN.password}`);

    // Seed students
    for (const s of STUDENTS) {
      await db.query(
        `INSERT INTO students
           (id, name, email, grade, major, semester, attendance, score, risk_level, ai_prediction)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.name, s.email, s.grade, s.major, s.semester,
         s.attendance, s.score, s.risk_level, s.ai_prediction]
      );
    }
    logger.info(`✅  ${STUDENTS.length} students seeded`);

    process.exit(0);
  } catch (err) {
    logger.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
