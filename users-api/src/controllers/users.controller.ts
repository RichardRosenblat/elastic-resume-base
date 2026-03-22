import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import {
  authorizeUser,
  getUserByUid,
  updateUser,
  deleteUser,
  listUsers,
} from '../services/usersService.js';
import {
  getPreApprovedUser,
  listPreApprovedUsers,
  addToPreApproved,
  deleteFromPreApproved,
  updatePreApproved,
} from '../services/preApprovedUsersService.js';


// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const authorizeSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
});

const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    role: z.string().optional(),
    enable: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).some((k) => data[k as keyof typeof data] !== undefined), {
    message: 'Request body must contain at least one valid field to update (email, role, or enable)',
  });

const listUsersQuerySchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(1000).default(100),
  pageToken: z.string().optional(),
  role: z.string().optional(),
  enable: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const addPreApprovedSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'user'], {
    errorMap: () => ({ message: "role must be either 'admin' or 'user'" }),
  }),
});

const updatePreApprovedSchema = z.object({
  role: z.enum(['admin', 'user'], {
    errorMap: () => ({ message: "role must be either 'admin' or 'user'" }),
  }).optional(),
});

const listPreApprovedQuerySchema = z.object({
  email: z.string().optional(),
  role: z.string().optional(),
});

type UidParams = { uid: string };
type ListUsersQuery = { maxResults?: number; pageToken?: string; role?: string; enable?: string };
type ListPreApprovedQuery = { email?: string; role?: string };

// ---------------------------------------------------------------------------
// Authorize Handler (Unauthenticated)
// ---------------------------------------------------------------------------

/**
 * Handles POST /api/v1/users/authorize — BFF login flow endpoint.
 * Returns the user's role and enable status based on the authorization logic.
 */
export async function authorizeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'authorizeHandler: validating request body');
  const parsed = authorizeSchema.safeParse(request.body);
  if (!parsed.success) {
    logger.warn(
      { correlationId: request.correlationId, issues: parsed.error.issues },
      'authorizeHandler: validation failed',
    );
    void reply.code(400).send(
      formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error', request.correlationId),
    );
    return;
  }

  const { uid, email } = parsed.data;
  logger.debug({ correlationId: request.correlationId, uid, email }, 'authorizeHandler: authorizing user');

  try {
    const result = await authorizeUser({ uid, email });
    logger.debug({ correlationId: request.correlationId, uid, ...result }, 'authorizeHandler: authorization result');
    void reply.send(formatSuccess(result, request.correlationId));
  } catch (err) {
    // Use code-based check instead of `instanceof ForbiddenError` to guard against module
    // identity mismatches: error classes bundled inside external modules (e.g. Synapse) are
    // separate class objects at runtime, so `instanceof` can return false for a logically
    // equivalent error.  Comparing the `.code` string is always safe across module boundaries.
    if ((err as { code?: string }).code === 'FORBIDDEN') {
      logger.info({ correlationId: request.correlationId, uid, email }, 'authorizeHandler: user denied access');
      void reply.code(403).send(
        formatError('FORBIDDEN', (err as Error).message, request.correlationId),
      );
      return;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// User CRUD Handlers
// ---------------------------------------------------------------------------

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
 * Handles GET /api/v1/users — lists user documents with optional pagination and filtering.
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

  const { maxResults, pageToken, role, enable } = parsed.data;
  const filters: { role?: string; enable?: boolean } = {};
  if (role !== undefined) filters.role = role;
  if (enable !== undefined) filters.enable = enable;
  const finalFilters = Object.keys(filters).length > 0 ? filters : undefined;

  logger.debug(
    { correlationId: request.correlationId, maxResults, hasPageToken: !!pageToken, filters },
    'listUsersHandler: fetching users page',
  );
  const result = await listUsers(maxResults, pageToken, finalFilters);
  logger.debug(
    { correlationId: request.correlationId, count: result.users.length, hasNextPage: !!result.pageToken },
    'listUsersHandler: users page retrieved',
  );
  void reply.send(formatSuccess(result, request.correlationId));
}

// ---------------------------------------------------------------------------
// Pre-Approve Handlers
// ---------------------------------------------------------------------------

/**
 * Handles GET /api/v1/users/pre-approve — lists all pre-approved users or gets one by email.
 * If `email` query param is provided, retrieves the specific pre-approved user.
 * If `role` query param is provided (without email), filters the list by role.
 */
export async function getPreApprovedHandler(
  request: FastifyRequest<{ Querystring: ListPreApprovedQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = listPreApprovedQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    void reply.code(400).send(
      formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error', request.correlationId),
    );
    return;
  }

  const { email, role } = parsed.data;

  if (email) {
    logger.debug({ correlationId: request.correlationId, email }, 'getPreApprovedHandler: fetching single pre-approved user');
    const user = await getPreApprovedUser(email);
    logger.debug({ correlationId: request.correlationId, email }, 'getPreApprovedHandler: pre-approved user retrieved');
    void reply.send(formatSuccess(user, request.correlationId));
  } else {
    const filters = role !== undefined ? { role } : undefined;
    logger.debug({ correlationId: request.correlationId, filters }, 'getPreApprovedHandler: listing pre-approved users');
    const users = await listPreApprovedUsers(filters);
    logger.debug({ correlationId: request.correlationId, count: users.length }, 'getPreApprovedHandler: pre-approved users listed');
    void reply.send(formatSuccess(users, request.correlationId));
  }
}

/**
 * Handles POST /api/v1/users/pre-approve — adds a user to the pre-approved list.
 */
export async function addPreApprovedHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'addPreApprovedHandler: validating request body');
  const parsed = addPreApprovedSchema.safeParse(request.body);
  if (!parsed.success) {
    logger.warn(
      { correlationId: request.correlationId, issues: parsed.error.issues },
      'addPreApprovedHandler: validation failed',
    );
    void reply.code(400).send(
      formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error', request.correlationId),
    );
    return;
  }
  logger.info({ correlationId: request.correlationId, email: parsed.data.email }, 'addPreApprovedHandler: adding pre-approved user');
  const user = await addToPreApproved(parsed.data);
  logger.debug({ correlationId: request.correlationId, email: parsed.data.email }, 'addPreApprovedHandler: pre-approved user added');
  void reply.code(201).send(formatSuccess(user, request.correlationId));
}

/**
 * Handles DELETE /api/v1/users/pre-approve?email=... — removes a user from the pre-approved list.
 */
export async function deletePreApprovedHandler(
  request: FastifyRequest<{ Querystring: ListPreApprovedQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { email } = request.query;
  if (!email) {
    void reply.code(400).send(
      formatError('VALIDATION_ERROR', 'email query parameter is required', request.correlationId),
    );
    return;
  }
  logger.info({ correlationId: request.correlationId, email }, 'deletePreApprovedHandler: deleting pre-approved user');
  await deleteFromPreApproved(email);
  logger.debug({ correlationId: request.correlationId, email }, 'deletePreApprovedHandler: pre-approved user deleted');
  void reply.code(204).send();
}

/**
 * Handles PATCH /api/v1/users/pre-approve?email=... — updates a pre-approved user.
 */
export async function updatePreApprovedHandler(
  request: FastifyRequest<{ Querystring: ListPreApprovedQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { email } = request.query;
  if (!email) {
    void reply.code(400).send(
      formatError('VALIDATION_ERROR', 'email query parameter is required', request.correlationId),
    );
    return;
  }
  logger.debug({ correlationId: request.correlationId, email }, 'updatePreApprovedHandler: validating request body');
  const parsed = updatePreApprovedSchema.safeParse(request.body);
  if (!parsed.success) {
    logger.warn(
      { correlationId: request.correlationId, issues: parsed.error.issues },
      'updatePreApprovedHandler: validation failed',
    );
    void reply.code(400).send(
      formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error', request.correlationId),
    );
    return;
  }
  logger.info({ correlationId: request.correlationId, email }, 'updatePreApprovedHandler: updating pre-approved user');
  const user = await updatePreApproved(email, parsed.data);
  logger.debug({ correlationId: request.correlationId, email }, 'updatePreApprovedHandler: pre-approved user updated');
  void reply.send(formatSuccess(user, request.correlationId));
}
