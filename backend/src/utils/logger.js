'use strict';

const winston = require('winston');

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const devFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts}  ${level}: ${stack || message}`;
});

const logger = winston.createLogger({
  level  : process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format : combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  ),
  transports: [
    // ─── Console ──────────────────────────────────────────────────────────────
    new winston.transports.Console({
      format: combine(colorize(), devFormat),
    }),

    // ─── File: combined ───────────────────────────────────────────────────────
    new winston.transports.File({
      filename : 'logs/combined.log',
      maxsize  : 5 * 1024 * 1024,  // 5 MB
      maxFiles : 5,
      format   : combine(winston.format.json()),
    }),

    // ─── File: errors only ────────────────────────────────────────────────────
    new winston.transports.File({
      filename : 'logs/error.log',
      level    : 'error',
      maxsize  : 5 * 1024 * 1024,
      maxFiles : 3,
      format   : combine(winston.format.json()),
    }),
  ],
});

module.exports = logger;
