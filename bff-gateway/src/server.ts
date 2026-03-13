import { config } from './config';
import { logger } from './utils/logger';
import app from './app';
import { getFirebaseApp } from './middleware/auth';

// Initialize Firebase on startup
getFirebaseApp();

const server = app.listen(config.port, () => {
  logger.info('BFF Gateway started', { port: config.port, env: config.nodeEnv });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default server;
