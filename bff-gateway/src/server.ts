import { config } from './config.js';
import { logger } from './utils/logger.js';
import app from './app.js';
import { getFirebaseApp } from './middleware/auth.js';

// Initialize Firebase on startup
getFirebaseApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'BFF Gateway started');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default server;
