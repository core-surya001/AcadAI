'use strict';

/**
 * AppError — operational error class with an HTTP status code.
 * Throw this in controllers/models; the global error handler will pick it up.
 *
 * Usage:
 *   throw new AppError('Student not found', 404);
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode   = statusCode;
    this.isOperational = true;          // distinguishes from programming bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { AppError };
