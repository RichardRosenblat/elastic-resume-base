import type { FastifyRequest, FastifyReply } from 'fastify';
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

type UidParams = { uid: string };
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
  const parsed = createUserSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Validation error' },
    });
    return;
  }
  const user = await createUser(parsed.data);
  reply.code(201).send({ success: true, data: user, correlationId: request.correlationId });
}

/**
 * Handles GET /api/v1/users/:uid — retrieves a Firestore user document by UID.
 */
export async function getUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const user = await getUserByUid(request.params.uid);
  reply.send({ success: true, data: user, correlationId: request.correlationId });
}

/**
 * Handles PATCH /api/v1/users/:uid — updates a Firestore user document by UID.
 */
export async function updateUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = updateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Validation error' },
    });
    return;
  }
  const user = await updateUser(request.params.uid, parsed.data);
  reply.send({ success: true, data: user, correlationId: request.correlationId });
}

/**
 * Handles DELETE /api/v1/users/:uid — removes a Firestore user document by UID.
 */
export async function deleteUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  await deleteUser(request.params.uid);
  reply.code(204).send();
}

/**
 * Handles GET /api/v1/users — lists Firestore user documents with optional pagination.
 */
export async function listUsersHandler(
  request: FastifyRequest<{ Querystring: ListUsersQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = listUsersQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    reply.code(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Validation error' },
    });
    return;
  }
  const result = await listUsers(parsed.data.maxResults, parsed.data.pageToken);
  reply.send({ success: true, data: result, correlationId: request.correlationId });
}

/**
 * Handles GET /api/v1/users/:uid/role — BFF access check endpoint.
 *
 * Returns HTTP 200 with `{ role }` on success or HTTP 403 when the user has no access.
 */
export async function getUserRoleHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const role = await getUserRole(request.params.uid);

  if (role === null) {
    reply.code(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'User does not have access to this application' },
      correlationId: request.correlationId,
    });
    return;
  }

  reply.send({ success: true, data: { role }, correlationId: request.correlationId });
}

/**
 * Handles POST /api/v1/users/roles/batch — batch role lookup from Firestore.
 */
export async function getBatchRolesHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = batchRolesSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Validation error' },
    });
    return;
  }
  const roles = await getUserRolesBatch(parsed.data.uids);
  reply.send({ success: true, data: roles, correlationId: request.correlationId });
}
