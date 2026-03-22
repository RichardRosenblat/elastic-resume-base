import type { FastifyRequest, FastifyReply } from 'fastify';
import admin from 'firebase-admin';
import { formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { authorizeUser } from '../services/userApiClient.js';

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
 *
 * Flow:
 * 1. Validates the Bearer token using Firebase Admin SDK.
 * 2. Extracts uid and email from the decoded token.
 * 3. Calls users-api /authorize to get role and enable status.
 * 4. If enable=false, returns 403 with a pending approval message.
 * 5. Sets request.user with uid, email, role, and enable for downstream handlers.
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

  let uid: string;
  let email: string | undefined;

  try {
    const app = getFirebaseApp();
    logger.trace({ correlationId: request.correlationId }, 'authHook: verifying Firebase ID token');
    const decoded = await admin.auth(app).verifyIdToken(token);

    uid = decoded.uid;
    email = decoded.email;

    request.user = {
      uid,
      email,
      name: decoded.name as string | undefined,
      picture: decoded.picture,
      role: 'user',
      enable: false,
    };
    logger.debug({ correlationId: request.correlationId, uid }, 'authHook: token verified successfully');
  } catch (err) {
    logger.warn({ err, correlationId: request.correlationId }, 'Token verification failed');
    void reply.code(401).send(formatError('UNAUTHORIZED', 'Invalid or expired token'));
    return;
  }

  // Ensure email is present — required for authorization
  if (!email) {
    logger.warn({ correlationId: request.correlationId, uid }, 'authHook: token has no email');
    void reply.code(403).send(formatError('FORBIDDEN', 'User account has no email address; access denied'));
    return;
  }

  // Call users-api to determine authorization status
  try {
    logger.trace({ correlationId: request.correlationId, uid, email }, 'authHook: calling UserAPI authorize');
    const { role, enable } = await authorizeUser(uid, email);

    if (!enable) {
      logger.info({ correlationId: request.correlationId, uid, role }, 'authHook: user account is pending approval');
      void reply.code(403).send(formatError('FORBIDDEN', 'Your account is pending approval. Please contact an administrator.'));
      return;
    }

    request.user.role = role;
    request.user.enable = enable;
    logger.debug({ correlationId: request.correlationId, uid, role, enable }, 'authHook: authorization granted');
  } catch (err) {
    // Use code-based checks instead of `instanceof` to guard against module identity
    // mismatches: error classes bundled inside external modules are separate class objects
    // at runtime, so `instanceof` can return false for a logically equivalent error.
    // Comparing the `.code` string is always safe across module boundaries.
    if ((err as { code?: string }).code === 'FORBIDDEN') {
      logger.info({ correlationId: request.correlationId, uid }, 'authHook: user denied application access');
      void reply.code(403).send(formatError('FORBIDDEN', (err as Error).message));
      return;
    }
    if ((err as { code?: string }).code === 'SERVICE_UNAVAILABLE') {
      logger.error({ correlationId: request.correlationId, uid, err }, 'authHook: UserAPI unavailable');
      void reply.code(503).send(formatError('SERVICE_UNAVAILABLE', 'Authorization service is temporarily unavailable'));
      return;
    }
    throw err;
  }
}

/**
 * Returns a Fastify onRequest hook that enforces admin-only access.
 * Must be used AFTER authHook (which sets request.user.role).
 */
export async function requireAdminHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.user?.role !== 'admin') {
    logger.info(
      { correlationId: request.correlationId, uid: request.user?.uid, role: request.user?.role },
      'requireAdminHook: non-admin access denied',
    );
    void reply.code(403).send(formatError('FORBIDDEN', 'Admin access required'));
  }
}
