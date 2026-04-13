'use strict';

const { Pool } = require('pg');
const logger   = require('../utils/logger');

// ─── Support both individual vars AND a single DATABASE_URL ───────────────────
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: true,   // Neon requires SSL — 'true' enables SNI routing
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host    : process.env.DB_HOST     || 'localhost',
      port    : parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'acadai',
      user    : process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max     : 20,
      idleTimeoutMillis   : 30000,
      connectionTimeoutMillis: 2000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err.message);
});

/**
 * Helper to run parameterised queries.
 */
const query = (text, params) => pool.query(text, params);

/**
 * Grab a dedicated client for multi-statement transactions.
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
