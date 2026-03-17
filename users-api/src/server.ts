import admin from 'firebase-admin';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import app from './app.js';

/**
 * Initialises the Firebase Admin SDK.
 *
 * When `GOOGLE_SERVICE_ACCOUNT_KEY` is present, credentials are loaded from it.
 * Otherwise the SDK falls back to Application Default Credentials or the Firestore
 * emulator (controlled by the `FIRESTORE_EMULATOR_HOST` env var).
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

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Users API started');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default server;
