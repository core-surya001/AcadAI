'use strict';

const { Pool } = require('pg');
const logger   = require('../utils/logger');

// ─── Support both individual vars AND a single DATABASE_URL ───────────────────
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString : process.env.DATABASE_URL,
      ssl              : { rejectUnauthorized: false }, // Required for Neon / Render / Railway
      max              : 20,          // was 5 — headroom for concurrent requests at 10K DAU
      min              : 2,           // keep 2 warm connections to avoid cold-start on every request
      idleTimeoutMillis: 10_000,      // close idle faster on serverless (was 30s)
      connectionTimeoutMillis: 5_000, // fail fast; let retry logic handle it (was 10s)
      allowExitOnIdle  : true,        // critical for Neon serverless connection model
    }
  : {
      host    : process.env.DB_HOST     || 'localhost',
      port    : parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME     || 'acadai',
      user    : process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max     : 20,
      min     : 2,
      idleTimeoutMillis   : 30_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle     : true,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err.message);
});

pool.on('connect', () => {
  logger.debug('New DB connection established');
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
