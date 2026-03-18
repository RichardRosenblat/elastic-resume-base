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
      firebaseApp = admin.initializeApp({
        projectId: process.env['FIREBASE_PROJECT_ID'] || 'demo-elastic-resume-base',
      });
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

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send(formatError('UNAUTHORIZED', 'Missing or invalid Authorization header'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const app = getFirebaseApp();
    const decoded = await admin.auth(app).verifyIdToken(token);

    request.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    };
  } catch (err) {
    logger.warn({ err, correlationId: request.correlationId }, 'Token verification failed');
    reply.code(401).send(formatError('UNAUTHORIZED', 'Invalid or expired token'));
    return;
  }

  try {
    await checkUserAccess(request.user.uid);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      reply.code(403).send(formatError('FORBIDDEN', err.message));
      return;
    }
    throw err;
  }
}
