import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types';

let firebaseApp: admin.app.App | null = null;

export function getFirebaseApp(): admin.app.App {
  if (!firebaseApp) {
    if (admin.apps.length > 0) {
      firebaseApp = admin.apps[0]!;
    } else {
      firebaseApp = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'demo-elastic-resume-base',
      });
    }
  }
  return firebaseApp;
}

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
    logger.warn('Token verification failed', { correlationId: (req as AuthenticatedRequest).correlationId });
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
}
