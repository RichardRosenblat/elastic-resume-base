import type { FastifyRequest, FastifyReply } from 'fastify';
import admin from 'firebase-admin';
import { formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { ForbiddenError } from '../errors.js';
import { checkUserAccess } from '../services/userApiClient.js';

let firebaseApp: admin.app.App | null = null;

/**
 * Returns the initialized Firebase Admin app, initializing it on first call.
 * @returns Firebase Admin App instance.
 */
export function getFirebaseApp(): admin.app.App {
  if (!firebaseApp) {
    if (admin.apps && admin.apps.length > 0) {
      firebaseApp = admin.apps[0]!;
    } else {
      logger.debug('getFirebaseApp: initializing Firebase Admin SDK');
      firebaseApp = admin.initializeApp({
        projectId: process.env['FIREBASE_PROJECT_ID'] || 'demo-elastic-resume-base',
      });
      logger.info('getFirebaseApp: Firebase Admin SDK initialized');
    }
  }
  return firebaseApp;
}

/** Resets the Firebase app instance (for testing only). */
export function _resetFirebaseApp(): void {
  firebaseApp = null;
}

/**
 * Fastify onRequest hook that verifies a Firebase ID token from the Authorization header.
 * Sets `request.user` on success or replies with 401 on failure.
 * Also validates that the user is a registered application user via the UserAPI,
 * replying with 403 if the user is not permitted.
 */
export async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  logger.trace({ correlationId: request.correlationId }, 'authHook: verifying Authorization header');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({ correlationId: request.correlationId }, 'authHook: missing or malformed Authorization header');
    void reply.code(401).send(formatError('UNAUTHORIZED', 'Missing or invalid Authorization header'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const app = getFirebaseApp();
    logger.trace({ correlationId: request.correlationId }, 'authHook: verifying Firebase ID token');
    const decoded = await admin.auth(app).verifyIdToken(token);

    request.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name as string | undefined,
      picture: decoded.picture,
    };
    logger.debug({ correlationId: request.correlationId, uid: decoded.uid }, 'authHook: token verified successfully');
  } catch (err) {
    logger.warn({ err, correlationId: request.correlationId }, 'Token verification failed');
    void reply.code(401).send(formatError('UNAUTHORIZED', 'Invalid or expired token'));
    return;
  }

  try {
    logger.trace({ correlationId: request.correlationId, uid: request.user.uid }, 'authHook: checking application access via UserAPI');
    const role = await checkUserAccess(request.user.uid);
    logger.debug({ correlationId: request.correlationId, uid: request.user.uid, role }, 'authHook: application access granted');
  } catch (err) {
    if (err instanceof ForbiddenError) {
      logger.info({ correlationId: request.correlationId, uid: request.user.uid }, 'authHook: user denied application access');
      void reply.code(403).send(formatError('FORBIDDEN', err.message));
      return;
    }
    throw err;
  }
}
