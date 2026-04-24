'use strict';

require('dotenv').config();
const db = require('./src/db/index');
const logger = require('./src/utils/logger');

async function patch() {
  try {
    logger.info('▶  Adding google_id column to users table...');
    
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    `);

    logger.info('✅ Successfully added google_id column!');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Failed to patch table:', err.message);
    process.exit(1);
  }
}

patch();
