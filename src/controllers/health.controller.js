const mongoose = require('mongoose');
const config = require('../config');
const ApiResponse = require('../utils/apiResponse');

const dbStatusMap = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Health check endpoint
 * GET /health or GET /api/v1/health
 */
const checkHealth = (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const isDbConnected = dbState === 1;

  const healthData = {
    service: 'storify-backend',
    status: isDbConnected ? 'healthy' : 'degraded',
    uptime: `${process.uptime().toFixed(2)}s`,
    timestamp: new Date().toISOString(),
    environment: config.env,
    database: {
      status: dbStatusMap[dbState] || 'unknown',
      connected: isDbConnected,
    },
  };

  const statusCode = isDbConnected ? 200 : 503;
  return ApiResponse.success(res, healthData, 'Health status check', statusCode);
};

module.exports = {
  checkHealth,
};
