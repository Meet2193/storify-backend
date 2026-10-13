const app = require('./app');
const config = require('./config');
const { connectDB, disconnectDB } = require('./config/db');
const logger = require('./utils/logger');

let server;

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`UNCAUGHT EXCEPTION! Shutting down... ${err.message}`, { stack: err.stack });
  process.exit(1);
});

// Start the server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    const PORT = config.server.port;
    server = app.listen(PORT, () => {
      logger.info(`=========================================`);
      logger.info(` Storify API Server Running`);
      logger.info(` Port:        ${PORT}`);
      logger.info(` Environment: ${config.env}`);
      logger.info(` Healthcheck: http://localhost:${PORT}/health`);
      logger.info(`=========================================`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`UNHANDLED REJECTION! Shutting down... ${err.message}`, { stack: err.stack });
  if (server) {
    server.close(async () => {
      await disconnectDB();
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Graceful shutdown on process termination signals
const handleGracefulShutdown = (signal) => {
  logger.info(`${signal} received. Initiating graceful shutdown...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDB();
      logger.info('Database connection closed. Process exited gracefully.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
