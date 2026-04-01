import { config } from './config.js';
import { logger } from './utils/logger.js';
import { buildApp } from './app.js';
import { initializeAuth } from '@elastic-resume-base/aegis/server';

// Initialize authentication on startup
initializeAuth({ projectId: config.projectId });

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.info({ port: config.port, env: config.nodeEnv }, 'Gateway started');
} catch (err) {
  logger.error({ err }, 'Failed to start Gateway');
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
