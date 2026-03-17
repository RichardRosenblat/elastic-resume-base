import { Request, Response } from 'express';
import { formatSuccess } from '@elastic-resume-base/bowltie';
import { AuthenticatedRequest } from '../models/index.js';

/** Returns the authenticated user's profile. */
export function getProfile(req: Request, res: Response): void {
  const authReq = req as AuthenticatedRequest;
  const { uid, email, name, picture } = authReq.user;
  res.status(200).json(formatSuccess({ uid, email, name, picture }, authReq.correlationId));
}
