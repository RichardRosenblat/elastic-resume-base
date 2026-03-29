import { z } from 'zod';
import { PubSubPublisher } from './services/pub-sub-publisher.js';
/** Singleton Pub/Sub publisher instance. */
let _publisher;
/** Zod schema for loading the GCP project ID from `process.env`. */
const pubSubEnvSchema = z.object({
    GCP_PROJECT_ID: z.string().min(1, 'GCP_PROJECT_ID is required'),
});
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
export function initializePubSub(projectId) {
    if (_publisher)
        return;
    _publisher = new PubSubPublisher(projectId);
}
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
export function initializePubSubFromEnv() {
    if (_publisher)
        return;
    const env = pubSubEnvSchema.parse(process.env);
    _publisher = new PubSubPublisher(env.GCP_PROJECT_ID);
}
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
export function getPublisher() {
    if (!_publisher) {
        throw new Error('Hermes Pub/Sub has not been initialised. ' +
            'Call initializePubSub() or initializePubSubFromEnv() before using getPublisher().');
    }
    return _publisher;
}
/**
 * Resets the internal Pub/Sub publisher singleton.
 *
 * **For testing only.** Call this in `afterEach` / `beforeEach` blocks to
 * ensure test isolation when testing code that calls `initializePubSub`.
 *
 * @internal
 */
export function _resetPubSubForTesting() {
    _publisher = undefined;
}
//# sourceMappingURL=pubsub.js.map