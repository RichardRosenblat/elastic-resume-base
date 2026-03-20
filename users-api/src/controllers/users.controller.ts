import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import {
  createUser,
  getUserByUid,
  updateUser,
  deleteUser,
  listUsers,
  getUserRoleByEmail,
  getUserRolesBatch,
} from '../services/usersService.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  uid: z.string().optional(),
  email: z.string().email(),
  displayName: z.string().optional(),
  photoURL: z.string().optional(),
  role: z.string().optional(),
  disabled: z.boolean().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  photoURL: z.string().optional(),
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

type UidParams = { uid: string };
type EmailParams = { email: string };
type ListUsersQuery = { maxResults?: number; pageToken?: string };

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handles POST /api/v1/users — creates a new Firestore user document.
 */
export async function createUserHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'createUserHandler: validating request body');
  const parsed = createUserSchema.safeParse(request.body);
  if (!parsed.success) {
    logger.warn(
      { correlationId: request.correlationId, issues: parsed.error.issues },
      'createUserHandler: validation failed',
    );
    void reply.code(400).send(
      formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error', request.correlationId),
    );
    return;
  }
  logger.info({ correlationId: request.correlationId, email: parsed.data.email }, 'createUserHandler: creating user');
  const user = await createUser(parsed.data);
  logger.debug({ correlationId: request.correlationId, uid: user.uid }, 'createUserHandler: user created successfully');
  void reply.code(201).send(formatSuccess(user, request.correlationId));
}

/**
 * Handles GET /api/v1/users/:uid — retrieves a Firestore user document by UID.
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
 * Handles PATCH /api/v1/users/:uid — updates a Firestore user document by UID.
 */
export async function updateUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { uid } = request.params;
  logger.debug({ correlationId: request.correlationId, uid }, 'updateUserHandler: validating request body');
  const parsed = updateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    logger.warn(
      { correlationId: request.correlationId, uid, issues: parsed.error.issues },
      'updateUserHandler: validation failed',
    );
    void reply.code(400).send(
      formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error', request.correlationId),
    );
    return;
  }
  logger.info({ correlationId: request.correlationId, uid }, 'updateUserHandler: updating user');
  const user = await updateUser(uid, parsed.data);
  logger.debug({ correlationId: request.correlationId, uid }, 'updateUserHandler: user updated successfully');
  void reply.send(formatSuccess(user, request.correlationId));
}

/**
 * Handles DELETE /api/v1/users/:uid — removes a Firestore user document by UID.
 */
export async function deleteUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { uid } = request.params;
  logger.info({ correlationId: request.correlationId, uid }, 'deleteUserHandler: deleting user');
  await deleteUser(uid);
  logger.debug({ correlationId: request.correlationId, uid }, 'deleteUserHandler: user deleted successfully');
  void reply.code(204).send();
}

/**
 * Handles GET /api/v1/users — lists Firestore user documents with optional pagination.
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
    void reply.code(400).send(
      formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error', request.correlationId),
    );
    return;
  }
  logger.debug(
    { correlationId: request.correlationId, maxResults: parsed.data.maxResults, hasPageToken: !!parsed.data.pageToken },
    'listUsersHandler: fetching users page',
  );
  const result = await listUsers(parsed.data.maxResults, parsed.data.pageToken);
  logger.debug(
    { correlationId: request.correlationId, count: result.users.length, hasNextPage: !!result.pageToken },
    'listUsersHandler: users page retrieved',
  );
  void reply.send(formatSuccess(result, request.correlationId));
}

/**
 * Handles GET /api/v1/users/role/:email — BFF access check endpoint.
 *
 * Returns HTTP 200 with `{ role }` on success or HTTP 403 when the user has no access.
 */
export async function getUserRoleHandler(
  request: FastifyRequest<{ Params: EmailParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { email } = request.params;
  logger.debug({ correlationId: request.correlationId, email }, 'getUserRoleHandler: checking user role');
  const role = await getUserRoleByEmail(email);

  if (role === null) {
    logger.info({ correlationId: request.correlationId, email }, 'getUserRoleHandler: user has no application access');
    void reply.code(403).send(
      formatError('FORBIDDEN', 'User does not have access to this application', request.correlationId),
    );
    return;
  }

  logger.debug({ correlationId: request.correlationId, email, role }, 'getUserRoleHandler: role resolved');
  void reply.send(formatSuccess({ role }, request.correlationId));
}

/**
 * Handles POST /api/v1/users/roles/batch — batch role lookup from Firestore.
 */
export async function getBatchRolesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'getBatchRolesHandler: validating request body');
  const parsed = batchRolesSchema.safeParse(request.body);
  if (!parsed.success) {
    logger.warn(
      { correlationId: request.correlationId, issues: parsed.error.issues },
      'getBatchRolesHandler: validation failed',
    );
    void reply.code(400).send(
      formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error', request.correlationId),
    );
    return;
  }
  logger.debug(
    { correlationId: request.correlationId, count: parsed.data.uids.length },
    'getBatchRolesHandler: fetching batch roles',
  );
  const roles = await getUserRolesBatch(parsed.data.uids);
  logger.debug({ correlationId: request.correlationId }, 'getBatchRolesHandler: batch roles retrieved');
  void reply.send(formatSuccess(roles, request.correlationId));
}

