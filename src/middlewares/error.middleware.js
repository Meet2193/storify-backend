const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/apiError');

/**
 * Handle 404 Route Not Found
 */
const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Central Error Handler Middleware
 */
const errorHandler = (err, _req, res, _next) => {
  let error = err;

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Invalid value for field '${err.path}': ${err.value}`;
    error = ApiError.badRequest(message);
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    const message = `Duplicate value '${value}' for field '${field}'. Please use another value.`;
    error = ApiError.conflict(message);
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map((val) => ({
      field: val.path,
      message: val.message,
    }));
    error = ApiError.badRequest('Validation Error', errors);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid authentication token');
  }

  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Authentication token expired');
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  const errors = error.errors && error.errors.length > 0 ? error.errors : null;

  // Log non-operational or 500 errors
  if (statusCode >= 500) {
    logger.error(`[Unhandled Error] ${err.message}`, { stack: err.stack });
  } else {
    logger.warn(`[Operational Error] ${statusCode} - ${message}`);
  }

  const response = {
    success: false,
    statusCode,
    message,
    ...(errors && { errors }),
    ...(!config.isProduction && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
