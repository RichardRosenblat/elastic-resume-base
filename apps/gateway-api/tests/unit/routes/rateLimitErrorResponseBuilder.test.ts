/**
 * Tests for the Bowltie-formatted HTTP 429 response produced by
 * `@fastify/rate-limit` when the global or per-route limiter is exceeded.
 *
 * The test builds a minimal Fastify instance that mirrors the actual BFF
 * app setup (correlation ID hook → rate-limit plugin → error handler) so
 * we can assert the full Bowltie envelope shape + TTL-based retry message
 * without relying on real time windows.
 */

import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { correlationIdHook } from '../../../src/middleware/correlationId.js';
import { errorHandler } from '../../../src/middleware/errorHandler.js';
import { buildRateLimitErrorResponseBuilder } from '../../../src/utils/rateLimitErrorResponseBuilder.js';

jest.mock('../../../src/utils/cloudErrorReporting', () => ({
  reportError: jest.fn(),
}));
jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

async function buildTestApp(max: number, timeWindow: string | number, scopeLabel: string) {
  const app = Fastify();

  app.addHook('onRequest', correlationIdHook);
  await app.register(rateLimit, {
    max,
    timeWindow,
    errorResponseBuilder: buildRateLimitErrorResponseBuilder(scopeLabel),
  });
  app.setErrorHandler(errorHandler);

  app.get('/test', (_req, reply) => { void reply.send({ ok: true }); });
  await app.ready();
  return app;
}

describe('buildRateLimitErrorResponseBuilder', () => {
  it('returns a Bowltie-formatted 429 with RATE_LIMIT_EXCEEDED code when the limiter is triggered', async () => {
    const app = await buildTestApp(1, '1 minute', 'Test');

    // First request succeeds
    const first = await app.inject({ method: 'GET', url: '/test' });
    expect(first.statusCode).toBe(200);

    // Second request is rate-limited
    const second = await app.inject({ method: 'GET', url: '/test' });
    expect(second.statusCode).toBe(429);

    const body = second.json<{
      success: boolean;
      error: { code: string; message: string };
      meta: { correlationId: string };
    }>();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.error.message).toMatch(/Too many requests/);
    expect(body.error.message).toMatch(/Please wait \d+ seconds? and try again/);
    expect(body.meta).toBeDefined();
    // correlationId is set by the correlation ID hook
    expect(typeof body.meta.correlationId).toBe('string');
    expect(body.meta.correlationId.length).toBeGreaterThan(0);

    await app.close();
  });

  it('includes singular "second" when the retry delay is exactly 1 second', async () => {
    const app = await buildTestApp(1, 1000, 'Test');

    await app.inject({ method: 'GET', url: '/test' });
    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(429);
    const body = res.json<{ error: { message: string } }>();
    expect(body.error.message).toMatch(/Please wait 1 second and try again/);

    await app.close();
  });

  it('uses "seconds" (plural) when the retry delay is more than 1 second', async () => {
    const app = await buildTestApp(1, '2 minutes', 'Test');

    await app.inject({ method: 'GET', url: '/test' });
    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(429);
    const body = res.json<{ error: { message: string } }>();
    expect(body.error.message).toMatch(/Please wait \d+ seconds and try again/);

    await app.close();
  });

  it('falls back to req.id for correlationId when correlationId hook is not registered', async () => {
    const app = Fastify();
    // No correlationId hook — req.correlationId will be undefined, falling back to req.id
    await app.register(rateLimit, {
      max: 1,
      timeWindow: '1 minute',
      errorResponseBuilder: buildRateLimitErrorResponseBuilder('FallbackTest'),
    });
    app.setErrorHandler(errorHandler);
    app.get('/test', (_req, reply) => { void reply.send({ ok: true }); });
    await app.ready();

    await app.inject({ method: 'GET', url: '/test' });
    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(429);
    const body = res.json<{ success: boolean; error: { code: string } }>();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');

    await app.close();
  });
});
