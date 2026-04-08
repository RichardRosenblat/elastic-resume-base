# ADR-016: Pull-Based Downstream Health Probing for Cloud Run

**Date:** 2026-04-08
**Status:** Accepted

---

## Context

The gateway API maintains an in-memory registry that tracks the liveness and temperature
(`warm` / `cold`) of every downstream service. "Temperature" reflects whether the downstream
Cloud Run service is likely to be awake: a service is `warm` if it was seen alive within
`DOWNSTREAM_WARM_TTL_MS` (default 5 minutes), and `cold` otherwise.

Originally the gateway refreshed this registry via a **background `setInterval` loop** that
periodically probed cold services at a fixed `DOWNSTREAM_HEALTH_REFRESH_INTERVAL_MS` interval
(default 1 hour):

```ts
// previous implementation — removed by this ADR
export function startBackgroundRefresh(): ReturnType<typeof setInterval> {
  const interval = setInterval(() => { /* probe cold services */ }, config.downstreamHealthRefreshIntervalMs);
  interval.unref();
  return interval;
}
```

This approach has a fundamental incompatibility with **Google Cloud Run**:

> Cloud Run throttles vCPU to near-zero between request handling. When no request is being
> processed, Node.js timers (`setInterval`, `setTimeout`) are frozen and may not fire for hours
> or indefinitely, even if the configured interval has elapsed.

As a result, the background prober silently stops working between bursts of traffic, leaving the
registry stale for arbitrarily long periods. Cold-start predictions based on this stale data
become unreliable.

Additional constraints:

- Health status is only _needed_ when a client explicitly queries `GET /health/downstream`.
  Probing continuously between those queries wastes outbound quota and wakes downstream services
  unnecessarily.
- Concurrently arriving `GET /health/downstream` requests must not fan-out into redundant
  simultaneous probes for the same downstream service (thundering herd problem).
- **Passive observation** — where the registry is updated on every proxied HTTP call (success or
  connection failure) — must remain fast and must not be blocked or interfered with by the active
  probing mechanism.

---

## Decision

Replace the `setInterval` background loop with a **demand-driven, pull-based probing model**
triggered at the moment health status is queried.

### Key design choices

1. **`lastActiveProbeAttempt` field on `ServiceRecord`**

   Each in-memory registry entry gains a `lastActiveProbeAttempt: string` (ISO timestamp).
   This field is initialised to the Unix epoch (`new Date(0)`) when a service is first registered,
   so the very first health query always triggers a probe for cold services. The field is updated
   only by the active prober, never by passive observation, so the throttle is independent of
   regular traffic volume.

2. **`ensureFreshHealth(serviceKey)` function**

   A new exported function encapsulates the demand-driven probe decision:

   ```ts
   export async function ensureFreshHealth(serviceKey: string): Promise<void> {
     const record = _registry.get(serviceKey);
     if (!record) return;
     // 1. Skip warm services — they are alive and do not need probing.
     if (computeTemperature(record) !== 'cold') return;
     // 2. Throttle — skip if a probe was attempted recently enough.
     const lastAttempt = new Date(record.lastActiveProbeAttempt).getTime();
     if (Date.now() - lastAttempt < config.downstreamHealthRefreshIntervalMs) return;
     // 3. Probe (mutex inside probeService prevents concurrent duplicate calls).
     await probeService(serviceKey);
   }
   ```

3. **In-memory mutex (thundering herd protection)**

   The existing `_activeProbes: Map<string, Promise<void>>` map acts as a per-service lock
   inside `probeService`. If `ensureFreshHealth` is called concurrently for the same service
   key, only the first call creates a real outgoing HTTP request; all subsequent callers
   join the same promise. `lastActiveProbeAttempt` is stamped **before** the HTTP call begins,
   so callers that arrive while a probe is already in flight skip re-scheduling one.

4. **`GET /health/downstream` awaits all probes**

   The health endpoint calls `ensureFreshHealth` for every registered service and awaits
   `Promise.allSettled(...)` before returning the registry snapshot. This ensures the response
   always reflects the _current_ health status rather than potentially stale data.

5. **Passive observation unchanged**

   `observeSuccess` and `observeFailure` (called by HTTP client interceptors on every proxied
   request) continue to update `live`, `lastSeenAlive`, and `lastChecked` as before.
   They deliberately do **not** update `lastActiveProbeAttempt`, keeping the active prober's
   throttle independent.

6. **Startup probe retained**

   `initializeRegistry()` (called once at gateway startup) still probes all downstream services
   immediately so the registry is populated before the first request arrives.

---

## Alternatives Considered

| Option | Reason Not Chosen |
|--------|------------------|
| **`setInterval` background loop (status quo)** | CPU throttling in Cloud Run freezes timers between requests; probes stop firing silently; registry becomes stale for arbitrarily long periods |
| **Recursive `setTimeout` with `.unref()`** | Same root problem: any timer mechanism is frozen when the Cloud Run instance is CPU-throttled; `.unref()` does not help |
| **External Cloud Scheduler / Cloud Tasks job** | Would require a separate GCP resource (Scheduler job + HTTP endpoint), adding operational overhead and cost for what is essentially an in-process concern |
| **Always probe on every `GET /health/downstream` request (no throttle)** | Would create a burst of outbound probes on every health poll, waking cold downstream services unnecessarily and adding latency to each health check call |
| **Redis / external store for probe state** | Overengineered for a single-process gateway; introduces a runtime dependency with its own availability concerns; in-memory state is sufficient for the current deployment model |

---

## Consequences

- **Easier:** Health checks are always triggered by actual demand and are never silently skipped due to Cloud Run CPU throttling; the gateway has no background timers that could behave unexpectedly in a serverless environment; probe frequency is naturally self-regulating (proportional to how often `GET /health/downstream` is queried).
- **Harder:** Health status is only refreshed when the health endpoint is polled; if no client queries `/health/downstream` for a period longer than `DOWNSTREAM_WARM_TTL_MS`, the registry may show stale `cold` state until the next poll (this is acceptable because the gateway's routing logic tolerates cold services and the startup probe seeds initial state).
- **Follow-on decisions required:** If multiple gateway instances are deployed (horizontal scaling), each instance maintains its own independent in-memory registry. Should cross-instance health aggregation become necessary, an external shared store would be required (superseding this ADR).
