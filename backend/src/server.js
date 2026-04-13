'use strict';

require('dotenv').config();
const app     = require('./app');
const logger  = require('./utils/logger');
const db      = require('./db');

const PORT = process.env.PORT || 5000;

/**
 * Retry DB connection — Neon serverless Postgres has a cold-start delay.
 */
async function connectWithRetry(retries = 5, delay = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await db.query('SELECT 1');
      logger.info('✅  PostgreSQL connected');
      return;
    } catch (err) {
      logger.warn(`⏳  DB connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function startServer() {
  try {
    await connectWithRetry();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀  AcadAI backend running on port ${PORT}`);
      logger.info(`    Environment : ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    logger.error('❌  Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  }
}

startServer();
