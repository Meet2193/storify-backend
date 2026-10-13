const { verifyToken } = require('../utils/token.util');
const ApiError = require('../utils/apiError');
const User = require('../models/user.model');
const { USER_STATUS } = require('../constants');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user object to req.user
 */
const authenticate = async (req, _res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(ApiError.unauthorized('Access denied. No token provided.'));
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(ApiError.unauthorized('Token expired. Please login again.'));
      }
      return next(ApiError.unauthorized('Invalid authentication token.'));
    }

    if (!decoded || !decoded.id) {
      return next(ApiError.unauthorized('Invalid token payload.'));
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return next(ApiError.unauthorized('User belonging to this token no longer exists.'));
    }

    if (user.status === USER_STATUS.SUSPENDED) {
      return next(ApiError.forbidden('Account is suspended. Please contact support.'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;
