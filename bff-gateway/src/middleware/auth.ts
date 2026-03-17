import { NextFunction, Request, Response } from 'express';
import admin from "firebase-admin";
import { AuthenticatedRequest } from '../models/index.js';
import { logger } from '../utils/logger.js';

let firebaseApp: admin.app.App | null = null;

/**
 * Returns the initialized Firebase Admin app, initializing it on first call.
 * @returns Firebase Admin App instance.
 */
export function getFirebaseApp(): admin.app.App {
  if (!firebaseApp) {
    if ( admin.apps && admin.apps.length > 0) {
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
 * Express middleware that verifies a Firebase ID token from the Authorization header.
 * Sets `req.user` on success or returns 401 on failure.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const app = getFirebaseApp();
    const decoded = await admin.auth(app).verifyIdToken(token);

    (req as AuthenticatedRequest).user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    };

    next();
  } catch (err) {
    logger.warn({ err, correlationId: (req as AuthenticatedRequest).correlationId }, 'Token verification failed');
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
}
