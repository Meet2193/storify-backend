const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { checkHealth } = require('./controllers/health.controller');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();

// Security HTTP headers
app.use(helmet());

// Enable CORS
const corsOptions = {
  origin: config.security.corsOrigin === '*' ? '*' : config.security.corsOrigin.split(','),
  credentials: true,
};
app.use(cors(corsOptions));

// Request logging (skip in test environment)
if (!config.isTest) {
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
}

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root health check route
app.get('/health', checkHealth);

// API v1 routes
app.use('/api/v1', routes);

// 404 handler
app.use(notFoundHandler);

// Central error handler
app.use(errorHandler);

module.exports = app;
