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

// ─── TEMPORARY DB PATCH ──────────────────────────────────────────────────────
app.get('/api/v1/patch-db', async (req, res) => {
  try {
    const db = require('./db/index');
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);`);
    res.json({ success: true, message: 'Production database patched!' });
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
