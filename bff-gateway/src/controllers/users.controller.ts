import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
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

type CreateUserBody = z.infer<typeof createUserSchema>;
type UpdateUserBody = z.infer<typeof updateUserSchema>;
type ListUsersQuery = { maxResults?: number; pageToken?: string };
type UidParams = { uid: string };

/**
 * Handles POST /api/v1/users — creates a new Firebase Auth user.
 * Requires admin role.
 */
export async function createUserHandler(
  request: FastifyRequest<{ Body: CreateUserBody }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = createUserSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400).send(formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error'));
    return;
  }
  const user = await createUser(parsed.data, request.user.uid);
  reply.code(201).send(formatSuccess(user, request.correlationId));
}

/**
 * Handles GET /api/v1/users/:uid — retrieves a Firebase Auth user by UID.
 * Available to all authenticated users.
 */
export async function getUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const user = await getUserByUid(request.params.uid);
  reply.send(formatSuccess(user, request.correlationId));
}

/**
 * Handles PATCH /api/v1/users/:uid — updates a Firebase Auth user by UID.
 * Admins may update any user with all fields; non-admins may only update their own
 * profile with non-sensitive fields (displayName, photoURL).
 */
export async function updateUserHandler(
  request: FastifyRequest<{ Params: UidParams; Body: UpdateUserBody }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = updateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400).send(formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error'));
    return;
  }
  const user = await updateUser(request.params.uid, parsed.data, request.user.uid);
  reply.send(formatSuccess(user, request.correlationId));
}

/**
 * Handles DELETE /api/v1/users/:uid — deletes a Firebase Auth user by UID.
 * Requires admin role.
 */
export async function deleteUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  await deleteUser(request.params.uid, request.user.uid);
  reply.code(204).send();
}

/**
 * Handles GET /api/v1/users — lists Firebase Auth users with optional pagination.
 * Available to all authenticated users.
 */
export async function listUsersHandler(
  request: FastifyRequest<{ Querystring: ListUsersQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = listUsersQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    reply.code(400).send(formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error'));
    return;
  }
  const result = await listUsers(parsed.data.maxResults, parsed.data.pageToken);
  reply.send(formatSuccess(result, request.correlationId));
}
