import { initializePersistence, terminatePersistence } from '@elastic-resume-base/synapse';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { buildApp } from './app.js';

// Initialise the persistence layer (Firebase Admin SDK) before any store is used.
initializePersistence({
  projectId: config.projectId,
  serviceAccountKey: config.googleServiceAccountKey,
});

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.info({ port: config.port, env: config.nodeEnv }, 'Users API started');
} catch (err) {
  logger.error({ err }, 'Failed to start Users API');
  process.exit(1);
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  void app.close()
    .then(() => terminatePersistence())
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
