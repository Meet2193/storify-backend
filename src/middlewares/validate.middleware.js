const { validationResult } = require('express-validator');
const ApiError = require('../utils/apiError');

/**
 * Middleware to evaluate express-validator rules
 */
const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));
    return next(new ApiError(400, 'Validation Error', formattedErrors));
  }
  next();
};

module.exports = validate;
