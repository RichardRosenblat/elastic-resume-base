import type { FastifyRequest, FastifyReply } from 'fastify';
import admin from 'firebase-admin';
import { formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { ForbiddenError, NotFoundError, UnavailableError } from '../errors.js';
import {
  getUserById,
  createUserInUsersApi,
  getAllowlistEntry,
  deleteAllowlistEntry,
} from '../services/userApiClient.js';
import { config } from '../config.js';

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
 * Runs the onboarding flow for a user that does not yet exist in the Users collection.
 *
 * Resolution order:
 * 1. Pre-approved allowlist (by email) → create user with allowlist role, enabled=true → ALLOW
 * 2. Domain rule (ALLOWED_DOMAIN env) → create user with role=user, enabled=false → DENY
 * 3. Otherwise → DENY
 *
 * @param uid - Firebase uid of the authenticated user.
 * @param email - Email address of the authenticated user (normalised to lowercase).
 * @param correlationId - Request correlation ID for logging.
 * @returns The user's role if access is granted, or null if access is denied.
 */
async function runOnboardingFlow(
  uid: string,
  email: string,
  correlationId: string,
): Promise<string | null> {
  // Step A: Check allowlist
  try {
    const entry = await getAllowlistEntry(email);
    const role = entry.role ?? 'user';
    logger.info(
      { correlationId, uid, email, role },
      'authHook: onboarding – found in allowlist, creating user (enabled)',
    );

    // Create user with enabled=true. Idempotent – safe if concurrent request already created it.
    const created = await createUserInUsersApi({ uid, email, role, enabled: true });

    // Remove the allowlist entry (best-effort; ignore errors so the user isn't blocked)
    try {
      await deleteAllowlistEntry(email);
    } catch (delErr) {
      logger.warn(
        { correlationId, uid, email, err: delErr },
        'authHook: onboarding – failed to delete allowlist entry (non-fatal)',
      );
    }

    return created.role;
  } catch (err) {
    if (!(err instanceof NotFoundError)) {
      // If the Users API is unreachable, fail closed
      throw err;
    }
    // Not in allowlist – continue to domain check
    logger.debug({ correlationId, uid, email }, 'authHook: onboarding – not in allowlist');
  }

  // Step B: Check domain rule
  const allowedDomain = config.allowedDomain?.trim();
  if (allowedDomain && email.endsWith(`@${allowedDomain}`)) {
    logger.info(
      { correlationId, uid, email, domain: allowedDomain },
      'authHook: onboarding – domain match, creating disabled user',
    );
    // Create user with enabled=false – must be explicitly enabled by an admin
    await createUserInUsersApi({ uid, email, role: 'user', enabled: false });
    return null; // DENY until enabled
  }

  // Step C: Deny
  logger.info({ correlationId, uid, email }, 'authHook: onboarding – no access path found');
  return null;
}

/**
 * Fastify onRequest hook implementing the new authentication and onboarding flow:
 *
 * 1. Verify Firebase ID token → extract uid, email, email_verified.
 * 2. Enforce email verification in production.
 * 3. Look up user in Users collection by uid.
 *    a. Exists + enabled=true  → ALLOW (set role on request.user)
 *    b. Exists + enabled=false → DENY 403
 *    c. Not exists             → run onboarding flow
 * 4. Onboarding flow (fail-closed):
 *    A. Check allowlist (by email) → create enabled user, delete allowlist entry → ALLOW
 *    B. Check domain (ALLOWED_DOMAIN) → create disabled user → DENY
 *    C. Otherwise → DENY
 *
 * If the Users API is unreachable at any point, the request is DENIED (fail-closed).
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

  // ── Step 1: Verify Firebase token ──────────────────────────────────────────
  let uid: string;
  let email: string;
  let emailVerified: boolean;

  try {
    const app = getFirebaseApp();
    logger.trace({ correlationId: request.correlationId }, 'authHook: verifying Firebase ID token');
    const decoded = await admin.auth(app).verifyIdToken(token);

    uid = decoded.uid;
    email = (decoded.email ?? '').toLowerCase();
    emailVerified = decoded.email_verified ?? false;

    request.user = {
      uid,
      email: decoded.email,
      name: decoded.name as string | undefined,
      picture: decoded.picture,
      role: 'user',
    };
    logger.debug({ correlationId: request.correlationId, uid }, 'authHook: token verified');
  } catch (err) {
    logger.warn({ err, correlationId: request.correlationId }, 'Token verification failed');
    void reply.code(401).send(formatError('UNAUTHORIZED', 'Invalid or expired token'));
    return;
  }

  // ── Step 2: Enforce email verification in production ──────────────────────
  if (config.nodeEnv === 'production' && !emailVerified) {
    logger.warn({ correlationId: request.correlationId, uid }, 'authHook: email not verified');
    void reply.code(403).send(formatError('FORBIDDEN', 'Email address must be verified before accessing this application'));
    return;
  }

  if (!email) {
    logger.warn({ correlationId: request.correlationId, uid }, 'authHook: user has no email');
    void reply.code(403).send(formatError('FORBIDDEN', 'User account has no email address'));
    return;
  }

  // ── Step 3: Check user in Users collection by uid ─────────────────────────
  try {
    try {
      const userRecord = await getUserById(uid);

      if (!userRecord.enabled) {
        logger.info({ correlationId: request.correlationId, uid }, 'authHook: user account is disabled');
        void reply.code(403).send(formatError('FORBIDDEN', 'User account is disabled'));
        return;
      }

      request.user.role = userRecord.role;
      logger.debug({ correlationId: request.correlationId, uid, role: userRecord.role }, 'authHook: access granted');
      return;
    } catch (err) {
      if (!(err instanceof NotFoundError)) {
        throw err; // re-throw non-404 errors (e.g. UnavailableError → fail closed)
      }
    }

    // ── Step 4: User not found → onboarding flow ──────────────────────────
    logger.info({ correlationId: request.correlationId, uid, email }, 'authHook: user not found, running onboarding flow');
    const role = await runOnboardingFlow(uid, email, request.correlationId);

    if (role === null) {
      logger.info({ correlationId: request.correlationId, uid, email }, 'authHook: onboarding denied access');
      void reply.code(403).send(formatError('FORBIDDEN', 'User does not have access to this application'));
      return;
    }

    request.user.role = role;
    logger.debug({ correlationId: request.correlationId, uid, role }, 'authHook: onboarding access granted');
  } catch (err) {
    if (err instanceof ForbiddenError) {
      logger.info({ correlationId: request.correlationId, uid }, 'authHook: access denied');
      void reply.code(403).send(formatError('FORBIDDEN', err.message));
      return;
    }
    if (err instanceof UnavailableError) {
      // Fail closed: if Users API is unreachable, deny access
      logger.error({ err, correlationId: request.correlationId, uid }, 'authHook: Users API unavailable – denying access (fail-closed)');
      void reply.code(503).send(formatError('SERVICE_UNAVAILABLE', 'Authentication service temporarily unavailable'));
      return;
    }
    throw err;
  }
}

