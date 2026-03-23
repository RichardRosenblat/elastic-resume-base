import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { ZodIssue } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import type { UpdateUserRequest } from '../models/index.js';
import {
  getUserByUid,
  listUsers,
  updateUser,
  deleteUser,
  listPreApproved,
  getPreApproved,
  addPreApproved,
  deletePreApproved,
  updatePreApproved,
} from '../services/usersService.js';

/**
 * Formats Zod validation issues into a single descriptive error message.
 * Includes the field path for each issue where available.
 */
function formatZodErrors(issues: ZodIssue[]): string {
  return issues
    .map((issue) => issue.path.length !== 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message)
    .join('; ');
}

const updateUserSchema = z
  .object({
    email: z.string({ invalid_type_error: 'email must be a string' }).email({ message: 'email must be a valid email address' }).optional(),
    role: z.enum(['admin', 'user'], {
      errorMap: () => ({ message: "role must be either 'admin' or 'user'" }),
    }).optional(),
    enable: z.boolean({ invalid_type_error: 'enable must be a boolean' }).optional(),
  })
  .refine((data) => Object.keys(data).some((k) => data[k as keyof typeof data] !== undefined), {
    message: 'Request body must contain at least one valid field to update (email, role, or enable)',
  });

const updatePreApprovedSchema = z
  .object({
    role: z.enum(['admin', 'user'], {
      errorMap: () => ({ message: "role must be either 'admin' or 'user'" }),
    }).optional(),
  })
  .refine((data) => Object.keys(data).some((k) => data[k as keyof typeof data] !== undefined), {
    message: 'Request body must contain at least one valid field to update (role)',
  });

const addPreApprovedSchema = z.object({
  email: z.string({ invalid_type_error: 'email must be a string' }).email({ message: 'email must be a valid email address' }),
  role: z.enum(['admin', 'user'], {
    errorMap: () => ({ message: "role must be either 'admin' or 'user'" }),
  }),
});

const listUsersQuerySchema = z.object({
  maxResults: z.coerce.number().int({ message: 'maxResults must be an integer' }).min(1, { message: 'maxResults must be at least 1' }).max(1000, { message: 'maxResults must be at most 1000' }).default(100),
  pageToken: z.string().optional(),
  email: z.string({ invalid_type_error: 'email must be a string' }).email({ message: 'email must be a valid email address' }).optional(),
  role: z.enum(['admin', 'user'], {
    errorMap: () => ({ message: "role must be either 'admin' or 'user'" }),
  }).optional(),
  enable: z.enum(['true', 'false'], {
    errorMap: () => ({ message: "enable must be 'true' or 'false'" }),
  }).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
  orderBy: z.enum(['uid', 'email', 'role', 'enable'], {
    errorMap: () => ({ message: "orderBy must be one of 'uid', 'email', 'role', or 'enable'" }),
  }).optional(),
  orderDirection: z.enum(['asc', 'desc'], {
    errorMap: () => ({ message: "orderDirection must be either 'asc' or 'desc'" }),
  }).optional(),
});

const getPreApprovedQuerySchema = z.object({
  email: z.string().optional(),
  role: z.enum(['admin', 'user'], {
    errorMap: () => ({ message: "role must be either 'admin' or 'user'" }),
  }).optional(),
  orderBy: z.enum(['email', 'role'], {
    errorMap: () => ({ message: "orderBy must be either 'email' or 'role'" }),
  }).optional(),
  orderDirection: z.enum(['asc', 'desc'], {
    errorMap: () => ({ message: "orderDirection must be either 'asc' or 'desc'" }),
  }).optional(),
});

type UidParams = { uid: string };
type EmailQuery = { email?: string };
type ListUsersQuery = {
  maxResults?: number;
  pageToken?: string;
  email?: string;
  role?: string;
  enable?: string;
  orderBy?: string;
  orderDirection?: string;
};

/**
 * Handles GET /api/v1/users/me — returns the authenticated user's profile from users store.
 */
export async function getMeHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { uid } = request.user;
  logger.debug({ uid }, 'getMeHandler: fetching authenticated user profile');
  const user = await getUserByUid(uid);
  void reply.send(formatSuccess(user, request.correlationId));
}

/**
 * Handles PATCH /api/v1/users/me — updates the authenticated user's own profile.
 */
export async function updateMeHandler(
  request: FastifyRequest<{ Body: UpdateUserRequest }>,
  reply: FastifyReply,
): Promise<void> {
  const { uid, role } = request.user;
  logger.debug({ uid }, 'updateMeHandler: validating request body');
  const parsed = updateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', formatZodErrors(parsed.error.issues)));
    return;
  }
  logger.debug({ uid }, 'updateMeHandler: updating authenticated user profile');
  const updated = await updateUser(uid, parsed.data, uid, role ?? 'user');
  void reply.send(formatSuccess(updated, request.correlationId));
}

/**
 * Handles GET /api/v1/users — lists users via UserAPI.
 */
export async function listUsersHandler(
  request: FastifyRequest<{ Querystring: ListUsersQuery }>,
  reply: FastifyReply,
): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'listUsersHandler: validating query params');
  const parsed = listUsersQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', formatZodErrors(parsed.error.issues)));
    return;
  }
  const { maxResults, pageToken, email: emailFilter, role, enable, orderBy, orderDirection } = parsed.data;
  const filters: {
    email?: string;
    role?: string;
    enable?: boolean;
    orderBy?: 'uid' | 'email' | 'role' | 'enable';
    orderDirection?: 'asc' | 'desc';
  } = {};
  if (emailFilter !== undefined) filters.email = emailFilter;
  if (role !== undefined) filters.role = role;
  if (enable !== undefined) filters.enable = enable;
  if (orderBy !== undefined) filters.orderBy = orderBy;
  if (orderDirection !== undefined) filters.orderDirection = orderDirection;
  const finalFilters = Object.keys(filters).length > 0 ? filters : undefined;
  logger.debug({ correlationId: request.correlationId }, 'listUsersHandler: fetching users');
  const result = await listUsers(maxResults, pageToken, finalFilters);
  void reply.send(formatSuccess(result, request.correlationId));
}

/**
 * Handles GET /api/v1/users/:uid — retrieves a user by UID.
 */
export async function getUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { uid } = request.params;
  logger.debug({ correlationId: request.correlationId, uid }, 'getUserHandler: fetching user');
  const user = await getUserByUid(uid);
  void reply.send(formatSuccess(user, request.correlationId));
}

/**
 * Handles PATCH /api/v1/users/:uid — updates a user.
 * Admins may update any user with any field.
 * Non-admins may only update their own email.
 */
export async function updateUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { uid } = request.params;
  logger.debug({ correlationId: request.correlationId, uid }, 'updateUserHandler: validating request body');
  const parsed = updateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', formatZodErrors(parsed.error.issues)));
    return;
  }
  logger.info({ correlationId: request.correlationId, uid, requesterUid: request.user.uid }, 'updateUserHandler: updating user');
  const user = await updateUser(uid, parsed.data, request.user.uid, request.user.role);
  void reply.send(formatSuccess(user, request.correlationId));
}

/**
 * Handles DELETE /api/v1/users/:uid — deletes a user (admin only).
 */
export async function deleteUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { uid } = request.params;
  logger.info({ correlationId: request.correlationId, uid, requesterUid: request.user.uid }, 'deleteUserHandler: deleting user');
  await deleteUser(uid, request.user.role ?? 'user');
  void reply.code(204).send();
}

/**
 * Handles GET /api/v1/users/pre-approve — lists or gets pre-approved users (admin only).
 */
export async function getPreApprovedHandler(
  request: FastifyRequest<{ Querystring: { email?: string; role?: string; orderBy?: string; orderDirection?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const parsed = getPreApprovedQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', formatZodErrors(parsed.error.issues)));
    return;
  }
  const { role: requesterRole } = request.user;
  const { email, role: filterRole, orderBy, orderDirection } = parsed.data;
  if (email) {
    logger.debug({ correlationId: request.correlationId, email }, 'getPreApprovedHandler: fetching specific user');
    const user = await getPreApproved(email, requesterRole ?? 'user');
    void reply.send(formatSuccess(user, request.correlationId));
  } else {
    logger.debug({ correlationId: request.correlationId }, 'getPreApprovedHandler: listing all');
    const filters: { role?: 'admin' | 'user'; orderBy?: 'email' | 'role'; orderDirection?: 'asc' | 'desc' } = {};
    if (filterRole !== undefined) filters.role = filterRole;
    if (orderBy !== undefined) filters.orderBy = orderBy;
    if (orderDirection !== undefined) filters.orderDirection = orderDirection;
    const finalFilters = Object.keys(filters).length > 0 ? filters : undefined;
    const users = await listPreApproved(requesterRole ?? 'user', finalFilters);
    void reply.send(formatSuccess(users, request.correlationId));
  }
}

/**
 * Handles POST /api/v1/users/pre-approve — adds a pre-approved user (admin only).
 */
export async function addPreApprovedHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'addPreApprovedHandler: validating request body');
  const parsed = addPreApprovedSchema.safeParse(request.body);
  if (!parsed.success) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', formatZodErrors(parsed.error.issues)));
    return;
  }
  logger.info({ correlationId: request.correlationId, email: parsed.data.email }, 'addPreApprovedHandler: adding pre-approved user');
  const user = await addPreApproved(parsed.data.email, parsed.data.role, request.user.role ?? 'user');
  void reply.code(201).send(formatSuccess(user, request.correlationId));
}

/**
 * Handles DELETE /api/v1/users/pre-approve?email= — deletes a pre-approved user (admin only).
 */
export async function deletePreApprovedHandler(
  request: FastifyRequest<{ Querystring: EmailQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { email } = request.query;
  if (!email) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', 'email query parameter is required'));
    return;
  }
  logger.info({ correlationId: request.correlationId, email }, 'deletePreApprovedHandler: deleting pre-approved user');
  await deletePreApproved(email, request.user.role ?? 'user');
  void reply.code(204).send();
}

/**
 * Handles PATCH /api/v1/users/pre-approve?email= — updates a pre-approved user (admin only).
 */
export async function updatePreApprovedHandler(
  request: FastifyRequest<{ Querystring: EmailQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { email } = request.query;
  if (!email) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', 'email query parameter is required'));
    return;
  }
  const parsed = updatePreApprovedSchema.safeParse(request.body);
  if (!parsed.success) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', formatZodErrors(parsed.error.issues)));
    return;
  }
  logger.info({ correlationId: request.correlationId, email }, 'updatePreApprovedHandler: updating pre-approved user');
  const user = await updatePreApproved(email, parsed.data, request.user.role ?? 'user');
  void reply.send(formatSuccess(user, request.correlationId));
}
