import type { IPubSubPublisher } from './interfaces/pub-sub-publisher.js';
/**
 * Initialises the Hermes Pub/Sub layer with an explicit GCP project ID.
 *
 * This is the primary initialisation path when the project ID is known at
 * startup (e.g. loaded from a config file).
 *
 * Calling this function more than once has no effect — the first call wins
 * (idempotent).
 *
 * @param projectId - Google Cloud project ID that owns the Pub/Sub topics.
 *
 * @example
 * ```typescript
 * import { initializePubSub } from '@elastic-resume-base/hermes';
 *
 * initializePubSub(process.env.GCP_PROJECT_ID ?? 'my-gcp-project');
 * ```
 */
export declare function initializePubSub(projectId: string): void;
/**
 * Initialises the Hermes Pub/Sub layer from environment variables.
 *
 * Reads the following variable:
 *
 * | Variable         | Required | Description                 |
 * |------------------|----------|-----------------------------|
 * | `GCP_PROJECT_ID` | ✅       | Google Cloud project ID     |
 *
 * Calling this function more than once has no effect (idempotent).
 *
 * @throws {ZodError} If `GCP_PROJECT_ID` is not set or is empty.
 *
 * @example
 * ```typescript
 * import { initializePubSubFromEnv } from '@elastic-resume-base/hermes';
 *
 * // Call once at application startup — after environment has been loaded.
 * initializePubSubFromEnv();
 * ```
 */
export declare function initializePubSubFromEnv(): void;
/**
 * Returns the initialised Pub/Sub publisher singleton.
 *
 * @returns The active {@link IPubSubPublisher} instance.
 * @throws {Error} If neither {@link initializePubSub} nor
 *   {@link initializePubSubFromEnv} has been called.
 *
 * @example
 * ```typescript
 * import { getPublisher } from '@elastic-resume-base/hermes';
 *
 * const publisher = getPublisher();
 * await publisher.publish('resume-ingested', { resumeId: 'abc-123' });
 * ```
 */
export declare function getPublisher(): IPubSubPublisher;
/**
 * Resets the internal Pub/Sub publisher singleton.
 *
 * **For testing only.** Call this in `afterEach` / `beforeEach` blocks to
 * ensure test isolation when testing code that calls `initializePubSub`.
 *
 * @internal
 */
export declare function _resetPubSubForTesting(): void;
//# sourceMappingURL=pubsub.d.ts.map