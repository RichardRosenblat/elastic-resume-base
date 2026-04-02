import type { FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { config } from '../config.js';

/** Responds with liveness status. */
export function getLive(_request: FastifyRequest, reply: FastifyReply): void {
  void reply.send({ status: 'ok' });
}

/** Responds with readiness status. */
export function getReady(_request: FastifyRequest, reply: FastifyReply): void {
  void reply.send({ status: 'ok' });
}

/** Checks all downstream services and reports their status. Always returns HTTP 200. */
export async function getDownstream(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const services: Record<string, string> = {
    usersApi: config.userApiServiceUrl,
    downloader: config.ingestorServiceUrl,
    searchBase: config.searchBaseServiceUrl,
    fileGenerator: config.fileGeneratorServiceUrl,
    documentReader: config.documentReaderServiceUrl,
  };

  const results = await Promise.allSettled(
    Object.entries(services).map(([, url]) =>
      axios.get(`${url}/health/live`, { timeout: 5000 }),
    ),
  );

  const downstream = Object.fromEntries(
    Object.entries(services).map(([name], i) => [
      name,
      { status: results[i]?.status === 'fulfilled' ? 'ok' : 'degraded' },
    ]),
  );

  void reply.send({ downstream });
}
