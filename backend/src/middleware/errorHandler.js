'use strict';

const logger = require('../utils/logger');

/**
 * Global Express error handler.
 * Catches all errors forwarded via next(err) and returns a consistent JSON shape.
 */
function errorHandler(err, _req, res, _next) {
  // Defaults
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal server error';
  let errors     = err.errors     || undefined;

  // ─── Known error types ──────────────────────────────────────────────────────

  // PostgreSQL unique constraint violation
  if (err.code === '23505') {
    statusCode = 409;
    message    = 'Duplicate entry — a record with that value already exists';
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    statusCode = 400;
    message    = 'Related record not found';
  }

  // JSON parse error
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message    = 'Invalid JSON in request body';
  }

  // Express payload too large
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message    = 'Request payload is too large';
  }

  // ─── Logging ────────────────────────────────────────────────────────────────
  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${message}`, {
      stack: err.stack,
      url  : _req?.originalUrl,
    });
  } else {
    logger.warn(`[${statusCode}] ${message}`);
  }

  // ─── Response ───────────────────────────────────────────────────────────────
  const body = {
    success: false,
    message,
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
  }

  if (errors) body.errors = errors;

  res.status(statusCode).json(body);
}

module.exports = errorHandler;
