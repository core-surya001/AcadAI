'use strict';

const jwt       = require('jsonwebtoken');
const UserModel = require('../models/user.model');
const { AppError } = require('../utils/appError');

/**
 * protect — verifies the Bearer JWT and attaches `req.user`.
 * Attach this middleware to any route that requires authentication.
 */
exports.protect = async (req, _res, next) => {
  try {
    // 1. Extract token from Authorization header
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Not authorised — no token provided', 401);
    }

    // 2. Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Token has expired — please log in again', 401);
      }
      throw new AppError('Invalid token', 401);
    }

    // 3. Confirm the user still exists and is active
    const user = await UserModel.findById(decoded.sub);
    if (!user) {
      throw new AppError('User belonging to this token no longer exists', 401);
    }
    if (!user.is_active) {
      throw new AppError('Account has been deactivated', 403);
    }

    // 4. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * restrictTo — role-based access guard.
 * Usage: router.delete('/:id', protect, restrictTo('admin'), ctrl.delete);
 */
exports.restrictTo = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission for this action', 403));
    }
    next();
  };
};
