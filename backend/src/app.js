'use strict';

require('dotenv').config();
const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const morgan        = require('morgan');
const rateLimit     = require('express-rate-limit');

const logger        = require('./utils/logger');
const errorHandler  = require('./middleware/errorHandler');

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth.routes');
const studentRoutes  = require('./routes/student.routes');
const predictRoutes  = require('./routes/predict.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

// ─── Trust proxy (required behind Render / Vercel / Railway reverse proxies) ──
app.set('trust proxy', 1);

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — allow multiple origins (local + deployed frontend) ────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(u => u.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, healthchecks)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Allow any Vercel deployments automatically to avoid CORS headaches
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Global rate limiter ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs : 15 * 60 * 1000,
  max      : 200,
  standardHeaders: true,
  legacyHeaders  : false,
  message  : { success: false, message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── HTTP logging ─────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'AcadAI Backend' });
});

// ─── PRODUCTION DB SETUP (run once after deploy) ─────────────────────────────
app.get('/api/v1/patch-db', async (_req, res) => {
  const db = require('./db/index');
  const steps = [];
  const errors = [];

  async function run(label, sql) {
    try {
      await db.query(sql);
      steps.push(`✓ ${label}`);
    } catch (e) {
      errors.push(`✗ ${label}: ${e.message}`);
    }
  }

  // Extensions
  await run('pgcrypto extension', `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await run('pg_trgm extension', `CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

  // Users – google_id column
  await run('users.google_id column', `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE`);
  await run('users.google_id index', `CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`);

  // Lookup tables
  await run('majors table', `CREATE TABLE IF NOT EXISTS majors (id SMALLSERIAL PRIMARY KEY, name VARCHAR(80) NOT NULL UNIQUE, department VARCHAR(80), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await run('grades table', `CREATE TABLE IF NOT EXISTS grades (id SMALLSERIAL PRIMARY KEY, label VARCHAR(30) NOT NULL UNIQUE)`);
  await run('semesters table', `CREATE TABLE IF NOT EXISTS semesters (id SMALLSERIAL PRIMARY KEY, label VARCHAR(30) NOT NULL UNIQUE)`);

  // Students table
  await run('students table', `
    CREATE TABLE IF NOT EXISTS students (
      id           BIGSERIAL    PRIMARY KEY,
      student_code VARCHAR(20)  NOT NULL UNIQUE,
      name         VARCHAR(120) NOT NULL,
      email        VARCHAR(255) NOT NULL UNIQUE,
      avatar_url   VARCHAR(500),
      grade_id     SMALLINT     NOT NULL REFERENCES grades(id) ON UPDATE CASCADE,
      major_id     SMALLINT     NOT NULL REFERENCES majors(id) ON UPDATE CASCADE,
      semester_id  SMALLINT     NOT NULL REFERENCES semesters(id) ON UPDATE CASCADE,
      attendance   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (attendance BETWEEN 0 AND 100),
      score        NUMERIC(4,2) NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 10),
      is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await run('prediction_logs table', `
    CREATE TABLE IF NOT EXISTS prediction_logs (
      id            BIGSERIAL    PRIMARY KEY,
      student_id    BIGINT       NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      requested_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
      input_data    JSONB        NOT NULL,
      prediction    NUMERIC(5,2) NOT NULL,
      risk_level    VARCHAR(10)  NOT NULL,
      model_version VARCHAR(30)  NOT NULL DEFAULT 'local-v1.0',
      confidence    NUMERIC(4,3),
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await run('prediction_logs.confidence column',
    `ALTER TABLE prediction_logs ADD COLUMN IF NOT EXISTS confidence NUMERIC(4,3)`);


  // updated_at trigger function
  await run('update_updated_at_column function', `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql
  `);
  await run('students updated_at trigger', `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_students_updated_at') THEN
        CREATE TRIGGER set_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END $$
  `);

  // ── Seed default lookup rows (needed to backfill existing rows) ──────────────
  await run('seed default grade N/A',    `INSERT INTO grades    (label) VALUES ('N/A')        ON CONFLICT (label) DO NOTHING`);
  await run('seed default major General',`INSERT INTO majors    (name)  VALUES ('General')    ON CONFLICT (name)  DO NOTHING`);
  await run('seed default semester Fall', `INSERT INTO semesters (label) VALUES ('1st / Fall') ON CONFLICT (label) DO NOTHING`);

  // ── Add FK columns to students if they are missing (handles v1 schema) ───────
  await run('students.grade_id column',
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS grade_id SMALLINT REFERENCES grades(id) ON UPDATE CASCADE`);
  await run('students.major_id column',
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS major_id SMALLINT REFERENCES majors(id) ON UPDATE CASCADE`);
  await run('students.semester_id column',
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS semester_id SMALLINT REFERENCES semesters(id) ON UPDATE CASCADE`);

  // ── Backfill any rows that have NULL FK values ────────────────────────────────
  await run('backfill grade_id for existing rows', `
    UPDATE students
       SET grade_id = (SELECT id FROM grades WHERE label = 'N/A' LIMIT 1)
     WHERE grade_id IS NULL
  `);
  await run('backfill major_id for existing rows', `
    UPDATE students
       SET major_id = (SELECT id FROM majors WHERE name = 'General' LIMIT 1)
     WHERE major_id IS NULL
  `);
  await run('backfill semester_id for existing rows', `
    UPDATE students
       SET semester_id = (SELECT id FROM semesters WHERE label = '1st / Fall' LIMIT 1)
     WHERE semester_id IS NULL
  `);

  // ── student_code column (v1 may not have it) ──────────────────────────────────
  await run('students.student_code column',
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS student_code VARCHAR(20) UNIQUE`);
  await run('backfill student_code', `
    UPDATE students SET student_code = 'STU-' || id::text WHERE student_code IS NULL
  `);

  // Materialized view
  await run('student_risk_summary materialized view', `
    CREATE MATERIALIZED VIEW IF NOT EXISTS student_risk_summary AS
    SELECT
      s.id AS student_id, s.student_code, s.name, s.email,
      s.attendance, s.score, s.is_active, s.avatar_url, s.created_at, s.updated_at,
      g.label   AS grade,
      m.name    AS major,
      sem.label AS semester,
      pl.prediction AS ai_prediction, pl.risk_level, pl.model_version, pl.confidence,
      pl.created_at AS predicted_at, pl.requested_by AS predicted_by
    FROM students s
    LEFT JOIN grades    g   ON g.id   = s.grade_id
    LEFT JOIN majors    m   ON m.id   = s.major_id
    LEFT JOIN semesters sem ON sem.id = s.semester_id
    LEFT JOIN LATERAL (
      SELECT prediction, risk_level, model_version, confidence, created_at, requested_by
      FROM prediction_logs WHERE student_id = s.id ORDER BY created_at DESC LIMIT 1
    ) pl ON TRUE
    WITH DATA
  `);

  await run('student_risk_summary unique index', `CREATE UNIQUE INDEX IF NOT EXISTS idx_srs_student_id ON student_risk_summary(student_id)`);
  await run('student_risk_summary name trgm index', `CREATE INDEX IF NOT EXISTS idx_srs_name_trgm ON student_risk_summary USING GIN(name gin_trgm_ops)`);

  // Refresh function
  await run('refresh_student_risk_summary function', `
    CREATE OR REPLACE FUNCTION refresh_student_risk_summary()
    RETURNS void AS $$
    BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY student_risk_summary; END;
    $$ LANGUAGE plpgsql
  `);

  // Dashboard stats view
  await run('dashboard_stats view', `
    CREATE OR REPLACE VIEW dashboard_stats AS
    SELECT
      COUNT(*)                                                           AS total_students,
      ROUND(AVG(score) * 10, 1)                                         AS average_score,
      COUNT(*) FILTER (WHERE risk_level IN ('medium','high'))           AS at_risk_students,
      COUNT(*) FILTER (WHERE risk_level = 'high')                       AS high_risk_count,
      ROUND(AVG(attendance), 1)                                         AS avg_attendance,
      COUNT(*) FILTER (WHERE risk_level IS NULL)                        AS unscored_students
    FROM student_risk_summary WHERE is_active = TRUE
  `);

  res.json({ success: errors.length === 0, steps, errors });
});

// ─── DEMO SEED DATA (run to populate dashboard) ──────────────────────────────
app.get('/api/v1/seed-data', async (_req, res) => {
  try {
    const logger = require('./utils/logger');
    const db = require('./db/index');
    const bcrypt = require('bcryptjs');

    logger.info('▶  Manual demo seed triggered...');

    // 1. Majors, Grades, Semesters
    const majors = ['Computer Science', 'Mathematics', 'Physics', 'Philosophy', 'Literature'];
    for (const m of majors) {
      await db.query(`INSERT INTO majors (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [m]);
    }
    const grades = ['Grade 10-A', 'Grade 10-B', 'Grade 11-A', 'Grade 11-B', 'Grade 12-A'];
    for (const g of grades) {
      await db.query(`INSERT INTO grades (label) VALUES ($1) ON CONFLICT (label) DO NOTHING`, [g]);
    }
    const semesters = ['1st / Fall', '2nd / Spring'];
    for (const s of semesters) {
      await db.query(`INSERT INTO semesters (label) VALUES ($1) ON CONFLICT (label) DO NOTHING`, [s]);
    }

    // 2. Admin
    const hash = await bcrypt.hash('Admin@1234', 12);
    const adminRes = await db.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      ['Demo Admin', 'admin@acadai.edu', hash, 'admin']
    );
    const adminId = adminRes.rows[0].id;

    // 3. Dummy Students (only if empty)
    const check = await db.query('SELECT id FROM students LIMIT 1');
    if (check.rows.length === 0) {
      const demoStudents = [
        { name: 'Elena Rodriguez', email: 'e.rod@academy.edu', grade: 'Grade 11-A', major: 'Computer Science', attendance: 94, score: 8.2, risk: 'low', prediction: 91 },
        { name: 'Marcus Thorne', email: 'm.thorne@academy.edu', grade: 'Grade 11-B', major: 'Mathematics', attendance: 62, score: 4.5, risk: 'high', prediction: 42 },
        { name: 'Li Wei', email: 'l.wei@academy.edu', grade: 'Grade 11-A', major: 'Physics', attendance: 88, score: 7.8, risk: 'medium', prediction: 76 },
        { name: 'Sarah Jenkins', email: 's.jenkins@academy.edu', grade: 'Grade 10-C', major: 'Computer Science', attendance: 99, score: 9.5, risk: 'low', prediction: 97 }
      ];

      for (const s of demoStudents) {
        const studentRes = await db.query(
          `INSERT INTO students (student_code, name, email, grade_id, major_id, semester_id, attendance, score) 
           VALUES ($1, $2, $3, (SELECT id FROM grades WHERE label=$4), (SELECT id FROM majors WHERE name=$5), (SELECT id FROM semesters LIMIT 1), $6, $7)
           RETURNING id`,
          [`STU-${Math.floor(10000+Math.random()*90000)}`, s.name, s.email, s.grade, s.major, s.attendance, s.score]
        );
        const sid = studentRes.rows[0].id;
        
        await db.query(
          `INSERT INTO prediction_logs (student_id, requested_by, input_data, prediction, risk_level, model_version, confidence)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [sid, adminId, '{}', s.prediction, s.risk, 'demo-v1', 0.85]
        );
      }
    }

    // 4. Refresh view
    await db.query('SELECT refresh_student_risk_summary()');

    res.json({ success: true, message: 'Demo data seeded! Dashboard is now live.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── API routes ───────────────────────────────────────────────────────────────
const API = '/api/v1';
app.use(`${API}/auth`,      authRoutes);
app.use(`${API}/students`,  studentRoutes);
app.use(`${API}/predict`,   predictRoutes);
app.use(`${API}/dashboard`, dashboardRoutes);

// ─── 404 fallback ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
