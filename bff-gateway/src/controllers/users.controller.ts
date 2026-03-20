import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
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

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  role: z.string().optional(),
  enable: z.boolean().optional(),
});

const updatePreApprovedSchema = z.object({
  role: z.string().min(1).optional(),
});

const addPreApprovedSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
});

const listUsersQuerySchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(1000).default(100),
  pageToken: z.string().optional(),
});

type UidParams = { uid: string };
type EmailQuery = { email?: string };
type ListUsersQuery = { maxResults?: number; pageToken?: string };

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
    void reply.code(400).send(formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error'));
    return;
  }
  logger.debug({ correlationId: request.correlationId }, 'listUsersHandler: fetching users');
  const result = await listUsers(parsed.data.maxResults, parsed.data.pageToken);
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
 * Admins can update any user with any field.
 * Non-admins can only update their own email.
 */
export async function updateUserHandler(
  request: FastifyRequest<{ Params: UidParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { uid } = request.params;
  logger.debug({ correlationId: request.correlationId, uid }, 'updateUserHandler: validating request body');
  const parsed = updateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error'));
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
  await deleteUser(uid, request.user.role);
  void reply.code(204).send();
}

/**
 * Handles GET /api/v1/users/pre-approve — lists or gets pre-approved users (admin only).
 */
export async function getPreApprovedHandler(
  request: FastifyRequest<{ Querystring: EmailQuery }>,
  reply: FastifyReply,
): Promise<void> {
  const { email } = request.query;
  if (email) {
    logger.debug({ correlationId: request.correlationId, email }, 'getPreApprovedHandler: fetching specific user');
    const user = await getPreApproved(email);
    void reply.send(formatSuccess(user, request.correlationId));
  } else {
    logger.debug({ correlationId: request.correlationId }, 'getPreApprovedHandler: listing all');
    const users = await listPreApproved();
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
    void reply.code(400).send(formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error'));
    return;
  }
  logger.info({ correlationId: request.correlationId, email: parsed.data.email }, 'addPreApprovedHandler: adding pre-approved user');
  const user = await addPreApproved(parsed.data.email, parsed.data.role, request.user.role);
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
  await deletePreApproved(email, request.user.role);
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
    void reply.code(400).send(formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error'));
    return;
  }
  logger.info({ correlationId: request.correlationId, email }, 'updatePreApprovedHandler: updating pre-approved user');
  const user = await updatePreApproved(email, parsed.data, request.user.role);
  void reply.send(formatSuccess(user, request.correlationId));
}
