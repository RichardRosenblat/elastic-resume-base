import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
import { createUser, getUserByUid, updateUser, deleteUser, listUsers } from '../services/usersService.js';
import { AuthenticatedRequest } from '../models/index.js';

/**
 * Extracts the authenticated user's UID from the request.
 * @param req - Express request (must have passed `authMiddleware`).
 * @returns UID of the authenticated user.
 */
function getRequesterUid(req: Request): string {
  return (req as AuthenticatedRequest).user.uid;
}

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional(),
  photoURL: z.string().url().optional(),
  disabled: z.boolean().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  displayName: z.string().optional(),
  photoURL: z.string().url().optional(),
  disabled: z.boolean().optional(),
});

const listUsersQuerySchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(1000).default(100),
  pageToken: z.string().optional(),
});

/**
 * Handles POST /api/v1/users — creates a new Firebase Auth user.
 * Requires admin role.
 */
export async function createUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(formatError('VALIDATION_ERROR', 'Validation error'));
      return;
    }
    const requesterUid = getRequesterUid(req);
    const user = await createUser(parsed.data, requesterUid);
    res.status(201).json(formatSuccess(user, (req as AuthenticatedRequest).correlationId));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /api/v1/users/:uid — retrieves a Firebase Auth user by UID.
 * Available to all authenticated users.
 */
export async function getUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getUserByUid(req.params['uid'] as string);
    res.status(200).json(formatSuccess(user, (req as AuthenticatedRequest).correlationId));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles PATCH /api/v1/users/:uid — updates a Firebase Auth user by UID.
 * Admins may update any user with all fields; non-admins may only update their own
 * profile with non-sensitive fields (displayName, photoURL).
 */
export async function updateUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(formatError('VALIDATION_ERROR', 'Validation error'));
      return;
    }
    const requesterUid = getRequesterUid(req);
    const user = await updateUser(req.params['uid'] as string, parsed.data, requesterUid);
    res.status(200).json(formatSuccess(user, (req as AuthenticatedRequest).correlationId));
  } catch (err) {
    next(err);
  }
}

/**
 * Handles DELETE /api/v1/users/:uid — deletes a Firebase Auth user by UID.
 * Requires admin role.
 */
export async function deleteUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requesterUid = getRequesterUid(req);
    await deleteUser(req.params['uid'] as string, requesterUid);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /api/v1/users — lists Firebase Auth users with optional pagination.
 * Available to all authenticated users.
 */
export async function listUsersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json(formatError('VALIDATION_ERROR', 'Validation error'));
      return;
    }
    const result = await listUsers(parsed.data.maxResults, parsed.data.pageToken);
    res.status(200).json(formatSuccess(result, (req as AuthenticatedRequest).correlationId));
  } catch (err) {
    next(err);
  }
}
