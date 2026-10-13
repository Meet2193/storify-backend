const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Generate a JWT token
 * @param {Object} payload - Data to embed in the token
 * @param {string} [expiresIn] - Optional custom expiry
 * @returns {string} Signed JWT token
 */
const generateToken = (payload, expiresIn = config.jwt.expiresIn) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn,
  });
};

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

module.exports = {
  generateToken,
  verifyToken,
};
