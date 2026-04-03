/**
 * @file serviceRegistry.ts — In-memory downstream service health registry.
 *
 * Tracks each downstream service's liveness and temperature (warm/cold) based
 * on passive observation of proxied traffic and periodic background probes.
 *
 * Temperature semantics:
 *   - `warm` — seen alive within the configured TTL (platform can reply instantly)
 *   - `cold` — not seen within the TTL (cold start may be required)
 *
 * Update semantics (L4 health only):
 *   - Any successful HTTP response (including 4xx/5xx): `live=true`, timestamps updated.
 *   - Connection-level errors (ECONNREFUSED, ETIMEDOUT, no response): `live=false`,
 *     `lastChecked` updated but `lastSeenAlive` preserved.
 *   - HTTP errors (4xx/5xx) do NOT mark a service as down.
 */
import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/** Raw record stored per service in the in-memory registry. */
export interface ServiceRecord {
  live: boolean;
  lastSeenAlive: string | null;
  lastChecked: string;
}

/** Registry entry with computed temperature field. */
export interface ServiceRegistryEntry {
  live: boolean;
  temperature: 'warm' | 'cold';
  lastSeenAlive: string | null;
  lastChecked: string;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const _registry = new Map<string, ServiceRecord>();
const _activeProbes = new Map<string, Promise<void>>();
const _serviceUrls = new Map<string, string>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeTemperature(record: ServiceRecord): 'warm' | 'cold' {
  if (!record.lastSeenAlive) return 'cold';
  return Date.now() - new Date(record.lastSeenAlive).getTime() < config.downstreamWarmTtlMs
    ? 'warm'
    : 'cold';
}

// ---------------------------------------------------------------------------
// Public API — observation (called by httpClient interceptors)
// ---------------------------------------------------------------------------

/**
 * Marks a service as live and records the current timestamp for both
 * `lastSeenAlive` and `lastChecked`. Called on any successful HTTP response
 * (including 4xx/5xx — L4 health only).
 */
export function observeSuccess(serviceKey: string): void {
  const now = new Date().toISOString();
  _registry.set(serviceKey, { live: true, lastSeenAlive: now, lastChecked: now });
}

/**
 * Marks a service as unreachable and updates `lastChecked` without touching
 * `lastSeenAlive`. Called on connection-level failures (ECONNREFUSED, ETIMEDOUT,
 * or any error without an HTTP response).
 */
export function observeFailure(serviceKey: string): void {
  const now = new Date().toISOString();
  const existing = _registry.get(serviceKey);
  _registry.set(serviceKey, {
    live: false,
    lastSeenAlive: existing?.lastSeenAlive ?? null,
    lastChecked: now,
  });
  logger.debug({ serviceKey }, 'serviceRegistry: connection-level failure observed');
}

// ---------------------------------------------------------------------------
// Public API — registry management
// ---------------------------------------------------------------------------

/**
 * Ensures a registry entry exists for the given service key and URL.
 * Creates a "never seen" default entry if the key is not yet tracked.
 * Idempotent — safe to call multiple times.
 */
export function ensureEntry(serviceKey: string, url: string): void {
  _serviceUrls.set(serviceKey, url);
  if (!_registry.has(serviceKey)) {
    _registry.set(serviceKey, {
      live: false,
      lastSeenAlive: null,
      lastChecked: new Date().toISOString(),
    });
  }
}

/**
 * Returns a snapshot of the registry with the computed `temperature` field
 * appended to each entry.
 */
export function getRegistry(): Record<string, ServiceRegistryEntry> {
  const result: Record<string, ServiceRegistryEntry> = {};
  for (const [key, record] of _registry) {
    result[key] = { ...record, temperature: computeTemperature(record) };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API — probing
// ---------------------------------------------------------------------------

/**
 * Probes a single service via GET /health/live and updates the registry.
 * Implements probe locking: if a probe is already in flight for the given key,
 * returns the existing promise (thundering herd protection).
 */
export async function probeService(serviceKey: string): Promise<void> {
  const url = _serviceUrls.get(serviceKey);
  if (!url) return;

  const existing = _activeProbes.get(serviceKey);
  if (existing) return existing;

  const probe = (async () => {
    try {
      await axios.get(`${url}/health/live`, { timeout: 5000 });
      observeSuccess(serviceKey);
      logger.debug({ serviceKey }, 'serviceRegistry: probe succeeded');
    } catch {
      observeFailure(serviceKey);
      logger.debug({ serviceKey }, 'serviceRegistry: probe failed');
    }
  })().finally(() => _activeProbes.delete(serviceKey));

  _activeProbes.set(serviceKey, probe);
  return probe;
}

/**
 * Probes all registered services concurrently. Called once at gateway startup
 * to populate the registry before traffic arrives.
 */
export async function initializeRegistry(): Promise<void> {
  logger.info('serviceRegistry: starting initial probe of all downstream services');
  await Promise.allSettled([..._serviceUrls.keys()].map(k => probeService(k)));
  logger.info('serviceRegistry: initial probe complete');
}

/**
 * Starts the periodic background refresh loop. Probes only services that have
 * not been seen alive within the warm TTL, avoiding unnecessary cold starts.
 *
 * The returned timer is `.unref()`-ed so it does not prevent process exit.
 * Store the handle and call `clearInterval(handle)` to stop the loop on shutdown.
 */
export function startBackgroundRefresh(): ReturnType<typeof setInterval> {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of _registry) {
      const lastSeenMs = record.lastSeenAlive ? new Date(record.lastSeenAlive).getTime() : 0;
      const isCold =
        !record.lastSeenAlive || now - lastSeenMs >= config.downstreamWarmTtlMs;
      if (isCold) {
        void probeService(key);
      }
    }
  }, config.downstreamHealthRefreshIntervalMs);

  // Do not keep the Node.js process alive solely due to this interval
  interval.unref();
  return interval;
}

// ---------------------------------------------------------------------------
// Test-only helpers
// ---------------------------------------------------------------------------

/** @internal Resets all registry state. For use in tests only. */
export function _resetRegistryForTest(): void {
  _registry.clear();
  _activeProbes.clear();
  _serviceUrls.clear();
}

/** @internal Sets a specific registry entry. For use in tests only. */
export function _setRegistryEntryForTest(
  key: string,
  record: ServiceRecord,
  url?: string,
): void {
  _registry.set(key, record);
  if (url) _serviceUrls.set(key, url);
}
