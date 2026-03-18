import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createUser,
  getUserByUid,
  updateUser,
  deleteUser,
  listUsers,
  getUserRole,
  getUserRolesBatch,
} from '../services/usersService.js';
import type { CorrelatedRequest } from '../models/index.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  uid: z.string().optional(),
  email: z.string().email(),
  displayName: z.string().optional(),
  photoURL: z.string().url().optional(),
  role: z.string().optional(),
  disabled: z.boolean().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  photoURL: z.string().url().optional(),
  role: z.string().optional(),
  disabled: z.boolean().optional(),
});

const listUsersQuerySchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(1000).default(100),
  pageToken: z.string().optional(),
});

const batchRolesSchema = z.object({
  uids: z.array(z.string()).min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the correlation ID from the request object.
 */
function correlationId(req: Request): string | undefined {
  return (req as CorrelatedRequest).correlationId;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handles POST /api/v1/users — creates a new Firestore user document.
 */
export async function createUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation error' } });
      return;
    }
    const user = await createUser(parsed.data);
    res.status(201).json({ success: true, data: user, correlationId: correlationId(req) });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /api/v1/users/:uid — retrieves a Firestore user document by UID.
 */
export async function getUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getUserByUid(req.params['uid'] as string);
    res.status(200).json({ success: true, data: user, correlationId: correlationId(req) });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles PATCH /api/v1/users/:uid — updates a Firestore user document by UID.
 */
export async function updateUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation error' } });
      return;
    }
    const user = await updateUser(req.params['uid'] as string, parsed.data);
    res.status(200).json({ success: true, data: user, correlationId: correlationId(req) });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles DELETE /api/v1/users/:uid — removes a Firestore user document by UID.
 */
export async function deleteUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteUser(req.params['uid'] as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /api/v1/users — lists Firestore user documents with optional pagination.
 */
export async function listUsersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = listUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation error' } });
      return;
    }
    const result = await listUsers(parsed.data.maxResults, parsed.data.pageToken);
    res.status(200).json({ success: true, data: result, correlationId: correlationId(req) });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /api/v1/users/:uid/role — BFF access check endpoint.
 *
 * Implements the BFF Authorization Logic:
 * - If `ADMIN_SHEET_FILE_ID` is set, uses Bugle to check Google Drive permissions.
 * - Otherwise uses Synapse/Firestore to look up the user's role.
 *
 * Returns HTTP 200 with `{ role }` on success or HTTP 403 when the user has no access.
 */
export async function getUserRoleHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.params['uid'] as string;
    const role = await getUserRole(uid);

    if (role === null) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'User does not have access to this application' },
        correlationId: correlationId(req),
      });
      return;
    }

    res.status(200).json({ success: true, data: { role }, correlationId: correlationId(req) });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles POST /api/v1/users/roles/batch — batch role lookup from Firestore.
 *
 * Accepts `{ uids: string[] }` and returns a `Record<string, string>` mapping
 * each UID to its stored role.  UIDs not present in Firestore default to `"user"`.
 */
export async function getBatchRolesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = batchRolesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation error' } });
      return;
    }
    const roles = await getUserRolesBatch(parsed.data.uids);
    res.status(200).json({ success: true, data: roles, correlationId: correlationId(req) });
  } catch (err) {
    next(err);
  }
}
