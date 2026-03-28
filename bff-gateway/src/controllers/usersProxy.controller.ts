import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';
import { proxyToUsersApi } from '../services/usersProxyService.js';

/**
 * Fastify catch-all handler that transparently proxies any unmatched request
 * under `/api/v1/users/*` to the Users API.
 *
 * Cross-cutting concerns handled here:
 * - **Authentication** — enforced upstream by `authHook` (applied to the full
 *   `/api/v1` scope in `routes/index.ts`).
 * - **Input validation** — body size and query string length limits are checked
 *   inside {@link proxyToUsersApi}.
 * - **Logging** — request and response metadata are logged without sensitive
 *   data (authorization header is never forwarded or logged).
 * - **Error mapping** — 5xx responses become 502, timeouts become 504, and
 *   unreachable upstream becomes 503.
 *
 * Explicit BFF routes registered before this handler always take priority.
 * This handler only fires when no other route matches the incoming request.
 */
export async function usersProxyHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { method, url } = request;
  const { uid, role } = request.user;

  logger.info(
    { method, url, correlationId: request.correlationId, uid, role },
    'usersProxyHandler: transparent proxy forwarding unmatched Users API request',
  );

  const result = await proxyToUsersApi(
    method,
    url,
    request.headers as Record<string, string | string[] | undefined>,
    request.body,
    request.correlationId,
  );

  // Forward safe upstream response headers to the client.
  for (const [key, value] of Object.entries(result.headers)) {
    if (value !== undefined) {
      void reply.header(key, value);
    }
  }

  // 204 No Content must not have a body.
  if (result.statusCode === 204) {
    void reply.code(204).send();
    return;
  }

  void reply.code(result.statusCode).send(result.body);
}
