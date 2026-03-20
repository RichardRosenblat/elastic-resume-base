import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { createUser, getUserByUid, updateUser, deleteUser, listUsers } from '../services/usersService.js';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional(),
  photoURL: z.string().optional(),
  disabled: z.boolean().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  displayName: z.string().optional(),
  photoURL: z.string().optional(),
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
  logger.debug({ correlationId: request.correlationId, requesterUid: request.user.uid }, 'createUserHandler: validating request body');
  const parsed = createUserSchema.safeParse(request.body);
  if (!parsed.success) {
    logger.warn(
      { correlationId: request.correlationId, issues: parsed.error.issues },
      'createUserHandler: validation failed',
    );
    void reply.code(400).send(formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error'));
    return;
  }
  logger.info({ correlationId: request.correlationId, email: parsed.data.email, requesterEmail: request.user.email }, 'createUserHandler: creating user');
  const user = await createUser(parsed.data, request.user.email ?? '');
  logger.debug({ correlationId: request.correlationId, uid: user.uid }, 'createUserHandler: user created successfully');
  void reply.code(201).send(formatSuccess(user, request.correlationId));
}

/**
 * Handles GET /api/v1/users/:uid — retrieves a Firebase Auth user by UID.
 * Available to all authenticated users.
 */
export async function getUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { uid } = request.params;
  logger.debug({ correlationId: request.correlationId, uid }, 'getUserHandler: fetching user');
  const user = await getUserByUid(uid);
  logger.debug({ correlationId: request.correlationId, uid }, 'getUserHandler: user retrieved successfully');
  void reply.send(formatSuccess(user, request.correlationId));
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
  const { uid } = request.params;
  logger.debug({ correlationId: request.correlationId, uid, requesterUid: request.user.uid }, 'updateUserHandler: validating request body');
  const parsed = updateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    logger.warn(
      { correlationId: request.correlationId, uid, issues: parsed.error.issues },
      'updateUserHandler: validation failed',
    );
    void reply.code(400).send(formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error'));
    return;
  }
  logger.info({ correlationId: request.correlationId, uid, requesterEmail: request.user.email }, 'updateUserHandler: updating user');
  const user = await updateUser(uid, parsed.data, request.user.email ?? '');
  logger.debug({ correlationId: request.correlationId, uid }, 'updateUserHandler: user updated successfully');
  void reply.send(formatSuccess(user, request.correlationId));
}

/**
 * Handles DELETE /api/v1/users/:uid — deletes a Firebase Auth user by UID.
 * Requires admin role.
 */
export async function deleteUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { uid } = request.params;
  logger.info({ correlationId: request.correlationId, uid, requesterEmail: request.user.email }, 'deleteUserHandler: deleting user');
  await deleteUser(uid, request.user.email ?? '');
  logger.debug({ correlationId: request.correlationId, uid }, 'deleteUserHandler: user deleted successfully');
  void reply.code(204).send();
}

/**
 * Handles GET /api/v1/users — lists Firebase Auth users with optional pagination.
 * Available to all authenticated users.
 */
export async function listUsersHandler(
  request: FastifyRequest<{ Querystring: ListUsersQuery }>,
  reply: FastifyReply,
): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'listUsersHandler: validating query params');
  const parsed = listUsersQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    logger.warn(
      { correlationId: request.correlationId, issues: parsed.error.issues },
      'listUsersHandler: validation failed',
    );
    void reply.code(400).send(formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error'));
    return;
  }
  logger.debug(
    { correlationId: request.correlationId, maxResults: parsed.data.maxResults, hasPageToken: !!parsed.data.pageToken },
    'listUsersHandler: fetching users',
  );
  const result = await listUsers(parsed.data.maxResults, parsed.data.pageToken);
  logger.debug(
    { correlationId: request.correlationId, count: result.users.length, hasNextPage: !!result.pageToken },
    'listUsersHandler: users retrieved successfully',
  );
  void reply.send(formatSuccess(result, request.correlationId));
}
