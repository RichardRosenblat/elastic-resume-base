/**
 * @file serviceRegistry.ts — In-memory downstream service health registry.
 *
 * Tracks each downstream service's liveness and temperature (warm/cold) based
 * on passive observation of proxied traffic and demand-driven active probes.
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
 *
 * Active probing is pull-based: `ensureFreshHealth` is triggered on demand (e.g. when
 * the health endpoint is queried) and throttled by `DOWNSTREAM_HEALTH_REFRESH_INTERVAL_MS`
 * so that only cold services with a stale probe timestamp are re-probed.
 */
import axios from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/** Raw record stored per service in the in-memory registry. */
export interface ServiceRecord {
  live: boolean;
  lastSeenAlive: string | null;
  lastChecked: string;
  /** ISO timestamp of the last active probe attempt. Defaults to epoch so the first
   *  call to `ensureFreshHealth` always triggers a probe for cold services. */
  lastActiveProbeAttempt: string;
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
 *
 * Passive observation: `lastActiveProbeAttempt` is intentionally preserved so
 * that the active prober's throttle is unaffected by regular traffic.
 */
export function observeSuccess(serviceKey: string): void {
  const now = new Date().toISOString();
  const existing = _registry.get(serviceKey);
  _registry.set(serviceKey, {
    live: true,
    lastSeenAlive: now,
    lastChecked: now,
    lastActiveProbeAttempt: existing?.lastActiveProbeAttempt ?? now,
  });
}

/**
 * Marks a service as unreachable and updates `lastChecked` without touching
 * `lastSeenAlive`. Called on connection-level failures (ECONNREFUSED, ETIMEDOUT,
 * or any error without an HTTP response).
 *
 * Passive observation: `lastActiveProbeAttempt` is intentionally preserved so
 * that the active prober's throttle is unaffected by regular traffic.
 */
export function observeFailure(serviceKey: string): void {
  const now = new Date().toISOString();
  const existing = _registry.get(serviceKey);
  _registry.set(serviceKey, {
    live: false,
    lastSeenAlive: existing?.lastSeenAlive ?? null,
    lastChecked: now,
    lastActiveProbeAttempt: existing?.lastActiveProbeAttempt ?? now,
  });
  logger.debug({ serviceKey }, 'serviceRegistry: connection-level failure observed');
}

// ---------------------------------------------------------------------------
// Public API — registry management
// ---------------------------------------------------------------------------

/**
 * Ensures a registry entry exists for the given service key and URL.
 * Creates a "never seen" default entry if the key is not yet tracked.
 * `lastActiveProbeAttempt` is initialized to the epoch so that the first call
 * to `ensureFreshHealth` will always consider the entry stale.
 * Idempotent — safe to call multiple times.
 */
export function ensureEntry(serviceKey: string, url: string): void {
  _serviceUrls.set(serviceKey, url);
  if (!_registry.has(serviceKey)) {
    _registry.set(serviceKey, {
      live: false,
      lastSeenAlive: null,
      lastChecked: new Date().toISOString(),
      lastActiveProbeAttempt: new Date(0).toISOString(),
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
 *
 * Stamps `lastActiveProbeAttempt` when the probe is initiated so that
 * `ensureFreshHealth` throttles correctly after this call.
 */
export async function probeService(serviceKey: string): Promise<void> {
  const url = _serviceUrls.get(serviceKey);
  if (!url) return;

  const existing = _activeProbes.get(serviceKey);
  if (existing) return existing;

  const probe = (async () => {
    // Stamp the attempt time before the HTTP call so that concurrent
    // ensureFreshHealth callers see a fresh timestamp and skip re-probing.
    const record = _registry.get(serviceKey);
    if (record) {
      _registry.set(serviceKey, {
        ...record,
        lastActiveProbeAttempt: new Date().toISOString(),
      });
    }
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
 * Demand-driven (pull-based) health refresh for a single service.
 *
 * A probe is triggered only when **both** of the following are true:
 *  1. The service is `cold` — not seen alive within `DOWNSTREAM_WARM_TTL_MS`.
 *  2. The last active probe attempt is older than `DOWNSTREAM_HEALTH_REFRESH_INTERVAL_MS`.
 *
 * Concurrency is handled by the `_activeProbes` mutex inside `probeService`:
 * if multiple requests trigger `ensureFreshHealth` simultaneously, at most one
 * outgoing HTTP call is made per service.
 *
 * Passive observation (updating health during normal routing) is never blocked
 * by this function and does not affect its throttle timestamp.
 */
export async function ensureFreshHealth(serviceKey: string): Promise<void> {
  const record = _registry.get(serviceKey);
  if (!record) return;

  // Warm services do not need an active probe.
  if (computeTemperature(record) !== 'cold') return;

  // Throttle: skip if an active probe was attempted recently enough.
  const now = Date.now();
  const lastAttempt = new Date(record.lastActiveProbeAttempt).getTime();
  if (now - lastAttempt < config.downstreamHealthRefreshIntervalMs) return;

  await probeService(serviceKey);
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

/** @internal Sets a specific registry entry. For use in tests only.
 *  `lastActiveProbeAttempt` defaults to epoch so `ensureFreshHealth` treats the
 *  entry as stale, matching the behaviour of a freshly-registered service. */
export function _setRegistryEntryForTest(
  key: string,
  record: Omit<ServiceRecord, 'lastActiveProbeAttempt'> & { lastActiveProbeAttempt?: string },
  url?: string,
): void {
  _registry.set(key, {
    ...record,
    lastActiveProbeAttempt: record.lastActiveProbeAttempt ?? new Date(0).toISOString(),
  });
  if (url) _serviceUrls.set(key, url);
}
