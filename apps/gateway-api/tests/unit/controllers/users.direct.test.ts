/**
 * Direct unit tests for gateway-api users.controller handlers.
 *
 * These tests call handler functions directly with mock FastifyRequest / FastifyReply
 * objects. This bypasses Fastify's AJV schema validation (which runs before the handler),
 * allowing us to exercise Zod errorMap callbacks, safeParse failure paths, and guard
 * branches that are unreachable through the normal HTTP interface because AJV validates
 * the same constraints first.
 */

jest.mock('../../../src/services/usersService', () => ({
  getUserByUid: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  listUsers: jest.fn(),
  getPreApproved: jest.fn(),
  listPreApproved: jest.fn(),
  addPreApproved: jest.fn(),
  deletePreApproved: jest.fn(),
  updatePreApproved: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import type { FastifyReply, FastifyRequest, RouteGenericInterface, RawServerDefault } from 'fastify';
import type { IncomingMessage } from 'http';
import * as usersService from '../../../src/services/usersService.js';
import {
  listUsersHandler,
  getPreApprovedHandler,
  deletePreApprovedHandler,
  updatePreApprovedHandler,
  updateUserHandler,
  addPreApprovedHandler,
} from '../../../src/controllers/users.controller.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Creates a minimal mock FastifyRequest. */
function makeMockRequest(overrides: {
  query?: Record<string, unknown>;
  body?: unknown;
  params?: Record<string, unknown>;
  user?: { uid: string; email?: string; role?: string; enable?: boolean };
  correlationId?: string;
}): FastifyRequest {
  return {
    query: overrides.query ?? {},
    body: overrides.body ?? {},
    params: overrides.params ?? {},
    user: overrides.user ?? { uid: 'user-uid', email: 'user@example.com', role: 'admin', enable: true },
    correlationId: overrides.correlationId ?? 'test-corr-id',
    headers: {},
    raw: {},
    id: 'test-id',
    ip: '127.0.0.1',
    hostname: 'localhost',
    log: { trace: jest.fn(), debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  } as unknown as FastifyRequest;
}

/** Creates a minimal mock FastifyReply with chainable code(). */
function makeMockReply() {
  const reply = {
    _statusCode: 200,
    _payload: undefined as unknown,
    code: jest.fn(),
    send: jest.fn(),
    status: jest.fn(),
  };
  reply.code.mockReturnValue(reply);
  reply.send.mockReturnValue(reply);
  return reply as unknown as FastifyReply & { _statusCode: number; _payload: unknown };
}

// ---------------------------------------------------------------------------
// listUsersHandler — safeParse failure paths
// ---------------------------------------------------------------------------

describe('users.controller (direct) — listUsersHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when maxResults is not a valid integer (triggers safeParse failure)', async () => {
    const request = makeMockRequest({ query: { maxResults: 'not-a-number' } });
    const reply = makeMockReply();

    await listUsersHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalled();
  });

  it('returns 400 when role is invalid (triggers role errorMap callback)', async () => {
    const request = makeMockRequest({ query: { role: 'superuser' } });
    const reply = makeMockReply();

    await listUsersHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toContain("role must be either 'admin' or 'user'");
  });

  it('returns 400 when enable is invalid (triggers enable errorMap callback)', async () => {
    const request = makeMockRequest({ query: { enable: 'maybe' } });
    const reply = makeMockReply();

    await listUsersHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toContain("enable must be 'true' or 'false'");
  });

  it('returns 400 when orderBy is invalid (triggers orderBy errorMap callback)', async () => {
    const request = makeMockRequest({ query: { orderBy: 'name' } });
    const reply = makeMockReply();

    await listUsersHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toContain("orderBy must be one of");
  });

  it('returns 400 when orderDirection is invalid (triggers orderDirection errorMap callback)', async () => {
    const request = makeMockRequest({ query: { orderDirection: 'random' } });
    const reply = makeMockReply();

    await listUsersHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toContain("orderDirection must be either 'asc' or 'desc'");
  });

  it('succeeds and calls listUsers with all filters', async () => {
    (usersService.listUsers as jest.Mock).mockResolvedValue({ users: [], nextPageToken: undefined });
    const request = makeMockRequest({
      query: {
        maxResults: '50',
        pageToken: 'tok',
        email: 'u@e.com',
        role: 'admin',
        enable: 'true',
        orderBy: 'email',
        orderDirection: 'desc',
      },
    });
    const reply = makeMockReply();

    await listUsersHandler(request as never, reply as unknown as FastifyReply);

    expect(usersService.listUsers).toHaveBeenCalled();
    expect(reply.send).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getPreApprovedHandler — safeParse failure, email path, and filter paths
// ---------------------------------------------------------------------------

describe('users.controller (direct) — getPreApprovedHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when role is invalid (triggers role errorMap callback)', async () => {
    const request = makeMockRequest({ query: { role: 'superadmin' } });
    const reply = makeMockReply();

    await getPreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toContain("role must be either 'admin' or 'user'");
  });

  it('returns 400 when orderBy is invalid (triggers orderBy errorMap callback)', async () => {
    const request = makeMockRequest({ query: { orderBy: 'uid' } });
    const reply = makeMockReply();

    await getPreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toContain("orderBy must be either 'email' or 'role'");
  });

  it('returns 400 when orderDirection is invalid (triggers orderDirection errorMap callback)', async () => {
    const request = makeMockRequest({ query: { orderDirection: 'random' } });
    const reply = makeMockReply();

    await getPreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toContain("orderDirection must be either 'asc' or 'desc'");
  });

  it('fetches a specific user when email query param is provided (covers email branch)', async () => {
    const preApprovedUser = { email: 'u@e.com', role: 'admin' };
    (usersService.getPreApproved as jest.Mock).mockResolvedValue(preApprovedUser);
    const request = makeMockRequest({
      query: { email: 'u@e.com' },
      user: { uid: 'admin-uid', role: 'admin', enable: true },
    });
    const reply = makeMockReply();

    await getPreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(usersService.getPreApproved).toHaveBeenCalledWith('u@e.com', 'admin');
    expect(reply.send).toHaveBeenCalled();
  });

  it('lists all when email is not provided, with role/orderBy/orderDirection filters', async () => {
    (usersService.listPreApproved as jest.Mock).mockResolvedValue([]);
    const request = makeMockRequest({
      query: { role: 'admin', orderBy: 'email', orderDirection: 'asc' },
      user: { uid: 'admin-uid', role: 'admin', enable: true },
    });
    const reply = makeMockReply();

    await getPreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(usersService.listPreApproved).toHaveBeenCalledWith('admin', {
      role: 'admin',
      orderBy: 'email',
      orderDirection: 'asc',
    });
    expect(reply.send).toHaveBeenCalled();
  });

  it('lists all without filters when no query params provided', async () => {
    (usersService.listPreApproved as jest.Mock).mockResolvedValue([]);
    const request = makeMockRequest({
      query: {},
      user: { uid: 'admin-uid', role: 'admin', enable: true },
    });
    const reply = makeMockReply();

    await getPreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(usersService.listPreApproved).toHaveBeenCalledWith('admin', undefined);
  });
});

// ---------------------------------------------------------------------------
// deletePreApprovedHandler — email missing guard
// ---------------------------------------------------------------------------

describe('users.controller (direct) — deletePreApprovedHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when email query param is missing', async () => {
    const request = makeMockRequest({ query: {} });
    const reply = makeMockReply();

    await deletePreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toBe('email query parameter is required');
  });

  it('calls deletePreApproved when email is provided', async () => {
    (usersService.deletePreApproved as jest.Mock).mockResolvedValue(undefined);
    const request = makeMockRequest({
      query: { email: 'u@e.com' },
      user: { uid: 'admin-uid', role: 'admin', enable: true },
    });
    const reply = makeMockReply();

    await deletePreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(usersService.deletePreApproved).toHaveBeenCalledWith('u@e.com', 'admin');
    expect(reply.code).toHaveBeenCalledWith(204);
  });
});

// ---------------------------------------------------------------------------
// updatePreApprovedHandler — email missing and body validation guards
// ---------------------------------------------------------------------------

describe('users.controller (direct) — updatePreApprovedHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when email query param is missing', async () => {
    const request = makeMockRequest({ query: {}, body: { role: 'admin' } });
    const reply = makeMockReply();

    await updatePreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toBe('email query parameter is required');
  });

  it('returns 400 when body is empty (triggers refine failure)', async () => {
    const request = makeMockRequest({ query: { email: 'u@e.com' }, body: {} });
    const reply = makeMockReply();

    await updatePreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
  });

  it('returns 400 when role is invalid (triggers role errorMap callback)', async () => {
    const request = makeMockRequest({ query: { email: 'u@e.com' }, body: { role: 'superadmin' } });
    const reply = makeMockReply();

    await updatePreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toContain("role must be either 'admin' or 'user'");
  });

  it('updates successfully when email and valid role provided', async () => {
    const updated = { email: 'u@e.com', role: 'user' };
    (usersService.updatePreApproved as jest.Mock).mockResolvedValue(updated);
    const request = makeMockRequest({
      query: { email: 'u@e.com' },
      body: { role: 'user' },
      user: { uid: 'admin-uid', role: 'admin', enable: true },
    });
    const reply = makeMockReply();

    await updatePreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(usersService.updatePreApproved).toHaveBeenCalledWith('u@e.com', { role: 'user' }, 'admin');
    expect(reply.send).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateUserHandler — Zod errorMap callbacks
// ---------------------------------------------------------------------------

describe('users.controller (direct) — updateUserHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when role is invalid (triggers role errorMap callback)', async () => {
    const request = makeMockRequest({
      params: { uid: 'uid-1' },
      body: { role: 'superadmin' },
    });
    const reply = makeMockReply();

    await updateUserHandler(request as unknown as FastifyRequest<{ Params: { uid: string } }>, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toContain("role must be either 'admin' or 'user'");
  });

  it('returns 400 when body is empty (triggers refine failure)', async () => {
    const request = makeMockRequest({
      params: { uid: 'uid-1' },
      body: {},
    });
    const reply = makeMockReply();

    await updateUserHandler(request as unknown as FastifyRequest<{ Params: { uid: string } }>, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toContain('at least one valid field');
  });
});

// ---------------------------------------------------------------------------
// addPreApprovedHandler — Zod errorMap callbacks
// ---------------------------------------------------------------------------

describe('users.controller (direct) — addPreApprovedHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when role is invalid (triggers role errorMap callback)', async () => {
    const request = makeMockRequest({
      body: { email: 'u@e.com', role: 'superadmin' },
    });
    const reply = makeMockReply();

    await addPreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const payload = (reply.send as jest.Mock).mock.calls[0][0] as { error?: { message?: string } };
    expect(payload.error?.message).toContain("role must be either 'admin' or 'user'");
  });

  it('returns 400 when email is invalid (triggers email validation)', async () => {
    const request = makeMockRequest({
      body: { email: 'not-an-email', role: 'admin' },
    });
    const reply = makeMockReply();

    await addPreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(reply.code).toHaveBeenCalledWith(400);
  });
});

// ---------------------------------------------------------------------------
// Null-coalescing (?? 'user') branches — when request.user.role is undefined
// ---------------------------------------------------------------------------

describe('users.controller (direct) — null-role fallbacks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletePreApprovedHandler falls back to "user" role when role is undefined', async () => {
    (usersService.deletePreApproved as jest.Mock).mockResolvedValue(undefined);
    const request = makeMockRequest({
      query: { email: 'u@e.com' },
      user: { uid: 'uid-1', role: undefined },
    });
    const reply = makeMockReply();

    await deletePreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(usersService.deletePreApproved).toHaveBeenCalledWith('u@e.com', 'user');
    expect(reply.code).toHaveBeenCalledWith(204);
  });

  it('updatePreApprovedHandler falls back to "user" role when role is undefined', async () => {
    const updated = { email: 'u@e.com', role: 'user' };
    (usersService.updatePreApproved as jest.Mock).mockResolvedValue(updated);
    const request = makeMockRequest({
      query: { email: 'u@e.com' },
      body: { role: 'user' },
      user: { uid: 'uid-1', role: undefined },
    });
    const reply = makeMockReply();

    await updatePreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(usersService.updatePreApproved).toHaveBeenCalledWith('u@e.com', { role: 'user' }, 'user');
  });

  it('getPreApprovedHandler (email path) falls back to "user" role when role is undefined', async () => {
    (usersService.getPreApproved as jest.Mock).mockResolvedValue({ email: 'u@e.com', role: 'admin' });
    const request = makeMockRequest({
      query: { email: 'u@e.com' },
      user: { uid: 'uid-1', role: undefined },
    });
    const reply = makeMockReply();

    await getPreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(usersService.getPreApproved).toHaveBeenCalledWith('u@e.com', 'user');
  });

  it('getPreApprovedHandler (list path) falls back to "user" role when role is undefined', async () => {
    (usersService.listPreApproved as jest.Mock).mockResolvedValue([]);
    const request = makeMockRequest({
      query: {},
      user: { uid: 'uid-1', role: undefined },
    });
    const reply = makeMockReply();

    await getPreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(usersService.listPreApproved).toHaveBeenCalledWith('user', undefined);
  });

  it('addPreApprovedHandler falls back to "user" role when role is undefined', async () => {
    const pa = { email: 'u@e.com', role: 'admin' };
    (usersService.addPreApproved as jest.Mock).mockResolvedValue(pa);
    const request = makeMockRequest({
      body: { email: 'u@e.com', role: 'admin' },
      user: { uid: 'uid-1', role: undefined },
    });
    const reply = makeMockReply();

    await addPreApprovedHandler(request as never, reply as unknown as FastifyReply);

    expect(usersService.addPreApproved).toHaveBeenCalledWith('u@e.com', 'admin', 'user');
  });
});
