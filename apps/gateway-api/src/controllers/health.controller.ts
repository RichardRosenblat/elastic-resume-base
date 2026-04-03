import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import { ensureEntry, getRegistry, probeService } from '../services/serviceRegistry.js';

/** Service key → URL mapping for all registered downstream services. */
const DOWNSTREAM_SERVICES: Record<string, string> = {
  usersApi: config.userApiServiceUrl,
  downloader: config.ingestorServiceUrl,
  searchBase: config.searchBaseServiceUrl,
  fileGenerator: config.fileGeneratorServiceUrl,
  documentReader: config.documentReaderServiceUrl,
};

/** Responds with liveness status. */
export function getLive(_request: FastifyRequest, reply: FastifyReply): void {
  void reply.send({ status: 'ok' });
}

/** Responds with readiness status. */
export function getReady(_request: FastifyRequest, reply: FastifyReply): void {
  void reply.send({ status: 'ok' });
}

/**
 * Returns the registry snapshot for all downstream services. Always returns
 * HTTP 200; individual service availability is reflected in the response body.
 *
 * For services that have never been contacted (`lastSeenAlive === null`), a
 * one-time probe is triggered and awaited before the snapshot is returned.
 * Probe locking in the registry prevents duplicate outbound calls when multiple
 * requests arrive simultaneously (thundering herd protection).
 */
export async function getDownstream(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Ensure all services have registry entries (idempotent)
  for (const [key, url] of Object.entries(DOWNSTREAM_SERVICES)) {
    ensureEntry(key, url);
  }

  // For services never yet contacted, trigger a one-time probe and wait for it
  const snapshot = getRegistry();
  const neverSeen = Object.keys(DOWNSTREAM_SERVICES).filter(k => !snapshot[k]?.lastSeenAlive);

  if (neverSeen.length > 0) {
    await Promise.allSettled(neverSeen.map(k => probeService(k)));
  }

  void reply.send({ downstream: getRegistry() });
}
