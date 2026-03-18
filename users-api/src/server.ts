import admin from 'firebase-admin';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import { buildApp } from './app.js';

/**
 * Initialises the Firebase Admin SDK.
 */
function initFirebase(): void {
  if (admin.apps.length > 0) {
    return;
  }

  const appOptions: admin.AppOptions = {
    projectId: config.projectId,
  };

  if (config.googleServiceAccountKey) {
    try {
      const raw = config.googleServiceAccountKey.trim();
      const decoded = raw.startsWith('{')
        ? raw
        : Buffer.from(raw, 'base64').toString('utf-8');
      const credentials = JSON.parse(decoded) as admin.ServiceAccount;
      appOptions.credential = admin.credential.cert(credentials);
    } catch {
      logger.warn('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY; using default credentials');
    }
  }

  admin.initializeApp(appOptions);
}

initFirebase();

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
  app.close().then(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
