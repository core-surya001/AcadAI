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
      const result = await db.query('SELECT NOW()');
      logger.info(`✅  PostgreSQL connected at ${result.rows[0].now}`);
      return;
    } catch (err) {
      logger.warn(`⏳  DB connection attempt ${attempt}/${retries} failed: ${err.message} (code: ${err.code || 'N/A'})`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function startServer() {
  // Log connection info for debugging (mask password)
  if (process.env.DATABASE_URL) {
    const masked = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
    logger.info(`📡  Using DATABASE_URL: ${masked}`);
  } else {
    logger.info(`📡  Using local DB: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  }

  try {
    await connectWithRetry();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀  AcadAI backend running on port ${PORT}`);
      logger.info(`    Environment : ${process.env.NODE_ENV}`);
      
      // Auto-run DB patch on startup (to ensure Render production schema is initialized)
      setTimeout(() => {
        logger.info('🔄  Auto-running DB setup script...');
        import('node-fetch').then(({ default: fetch }) => {
           fetch(`http://127.0.0.1:${PORT}/api/v1/patch-db`)
             .then(r => r.json())
             .then(data => logger.info(`✅  DB setup result: ${JSON.stringify(data)}`))
             .catch(err => logger.error(`❌  DB setup failed: ${err.message}`));
        }).catch(err => {
           // Fallback if node-fetch is not installed (Node 18+ has native fetch)
           if (typeof fetch === 'function') {
             fetch(`http://127.0.0.1:${PORT}/api/v1/patch-db`)
               .then(r => r.json())
               .then(data => logger.info(`✅  DB setup result: ${JSON.stringify(data)}`))
               .catch(err => logger.error(`❌  DB setup failed: ${err.message}`));
           }
        });
      }, 2000);
    });
  } catch (err) {
    logger.error(`❌  Failed to connect to PostgreSQL: ${err.message} (code: ${err.code || 'N/A'})`);
    process.exit(1);
  }
}

startServer();
