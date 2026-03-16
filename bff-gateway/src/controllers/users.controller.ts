import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createUser, getUserByUid, updateUser, deleteUser, listUsers } from '../services/usersService.js';

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
 * Creates a new user in Firebase Auth.
 */
export async function createUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation error', details: parsed.error.errors });
      return;
    }
    const user = await createUser(parsed.data);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves a user from Firebase Auth by UID.
 */
export async function getUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getUserByUid(req.params['uid'] as string);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

/**
 * Updates a user in Firebase Auth by UID.
 */
export async function updateUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation error', details: parsed.error.errors });
      return;
    }
    const user = await updateUser(req.params['uid'] as string, parsed.data);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

/**
 * Deletes a user from Firebase Auth by UID.
 */
export async function deleteUserHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteUser(req.params['uid'] as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * Lists users from Firebase Auth with optional pagination.
 */
export async function listUsersHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation error', details: parsed.error.errors });
      return;
    }
    const result = await listUsers(parsed.data.maxResults, parsed.data.pageToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
