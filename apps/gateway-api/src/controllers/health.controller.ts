import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { ensureEntry, ensureFreshHealth, getRegistry } from '../services/serviceRegistry.js';

/** Service key → URL mapping for all registered downstream services. */
const DOWNSTREAM_SERVICES: Record<string, string> = {
  usersApi: config.userApiServiceUrl,
  ingestor: config.ingestorServiceUrl,
  searchBase: config.searchBaseServiceUrl,
  fileGenerator: config.fileGeneratorServiceUrl,
  documentReader: config.documentReaderServiceUrl,
  dlqNotifier: config.dlqNotifierServiceUrl,
};

/** Responds with liveness status. */
export function getLive(_request: FastifyRequest, reply: FastifyReply): void {
  logger.trace('getLive: liveness probe received');
  void reply.send({ status: 'ok' });
}

/** Responds with readiness status. */
export function getReady(_request: FastifyRequest, reply: FastifyReply): void {
  logger.trace('getReady: readiness probe received');
  void reply.send({ status: 'ok' });
}

/**
 * Registers all downstream services in the in-memory registry. Idempotent.
 * Must be called before `initializeRegistry` so that the startup probe has
 * entries to iterate over.
 */
export function registerDownstreamServices(): void {
  for (const [key, url] of Object.entries(DOWNSTREAM_SERVICES)) {
    ensureEntry(key, url);
  }
}

/**
 * Returns the registry snapshot for all downstream services. Always returns
 * HTTP 200; individual service availability is reflected in the response body.
 *
 * Before returning, `ensureFreshHealth` is called for every service so that
 * cold services with a stale probe timestamp receive an outgoing health check.
 * This is awaited, so the response always reflects the *updated* health status.
 * Probe locking in the registry prevents duplicate outbound calls when multiple
 * requests arrive simultaneously (thundering herd protection).
 */
export async function getDownstream(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Ensure all services have registry entries (idempotent)
  for (const [key, url] of Object.entries(DOWNSTREAM_SERVICES)) {
    ensureEntry(key, url);
  }

  // Trigger a fresh health check for each service (pull-based probing).
  // ensureFreshHealth is a no-op for warm services and recently-probed cold ones.
  await Promise.allSettled(Object.keys(DOWNSTREAM_SERVICES).map(k => ensureFreshHealth(k)));

  void reply.send({ downstream: getRegistry() });
}
