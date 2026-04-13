'use strict';

const { validationResult } = require('express-validator');

/**
 * validate — express-validator middleware that collects validation errors
 * and returns a structured 422 response if any rules failed.
 *
 * Place it AFTER your validation rules array:
 *   router.post('/', [body('name').notEmpty()], validate, controller);
 */
function validate(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({
      field  : e.path  || e.param,
      message: e.msg,
      value  : e.value,
    }));

    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors : formatted,
    });
  }

  next();
}

module.exports = validate;
