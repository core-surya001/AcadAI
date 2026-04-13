'use strict';

const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const UserModel = require('../models/user.model');
const { AppError } = require('../utils/appError');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sendTokenResponse(res, statusCode, user, token) {
  return res.status(statusCode).json({
    success: true,
    data: {
      token,
      user: {
        id   : user.id,
        name : user.name,
        email: user.email,
        role : user.role,
      },
    },
  });
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Creates a new user account (admin-only in production; open for demo).
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await UserModel.findByEmail(email);
    if (existing) throw new AppError('Email already registered', 409);

    const hashedPassword = await bcrypt.hash(password, 12);
    const user  = await UserModel.create({ name, email, hashedPassword, role });
    const token = signToken(user.id);

    sendTokenResponse(res, 201, user, token);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/login
 * Validates credentials and returns a JWT.
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findByEmail(email);
    if (!user) throw new AppError('Invalid email or password', 401);

    if (!user.is_active) throw new AppError('Account is deactivated', 403);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError('Invalid email or password', 401);

    const token = signToken(user.id);
    sendTokenResponse(res, 200, user, token);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /auth/me
 * Returns the currently authenticated user's profile.
 */
exports.getMe = async (req, res, next) => {
  try {
    // req.user is attached by the protect middleware
    res.json({
      success: true,
      data   : {
        id   : req.user.id,
        name : req.user.name,
        email: req.user.email,
        role : req.user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/refresh
 * Issues a fresh token given a valid (non-expired) token.
 */
exports.refresh = async (req, res, next) => {
  try {
    const token = signToken(req.user.id);
    sendTokenResponse(res, 200, req.user, token);
  } catch (err) {
    next(err);
  }
};
