import { config } from './config.js';
import { logger } from './utils/logger.js';
import { buildApp } from './app.js';
import { initializeAuth } from '@elastic-resume-base/aegis';

// Initialize authentication on startup
initializeAuth({ projectId: process.env['FIREBASE_PROJECT_ID'] || 'demo-elastic-resume-base' });

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.info({ port: config.port, env: config.nodeEnv }, 'BFF Gateway started');
} catch (err) {
  logger.error({ err }, 'Failed to start BFF Gateway');
  process.exit(1);
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  void app.close()
    .then(() => {
      logger.info('Server closed');
      process.exit(0);
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    });
});

export default app;
