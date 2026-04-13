'use strict';

require('dotenv').config();
const app     = require('./app');
const logger  = require('./utils/logger');
const db      = require('./db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Verify DB connection on startup
    await db.query('SELECT 1');
    logger.info('✅  PostgreSQL connected');

    app.listen(PORT, () => {
      logger.info(`🚀  AcadAI backend running on http://localhost:${PORT}`);
      logger.info(`    Environment : ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    logger.error('❌  Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  }
}

startServer();
