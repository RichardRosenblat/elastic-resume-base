/**
 * Google Cloud Pub/Sub implementation of {@link IPubSubPublisher}.
 *
 * Publishes JSON-encoded messages to Google Cloud Pub/Sub topics. All
 * connection details are derived from the project ID supplied at construction
 * time; Application Default Credentials (ADC) are used for authentication,
 * exactly as with every other GCP client library.
 *
 * The `@google-cloud/pubsub` package is an **optional** peer dependency of
 * Hermes. Install it alongside Hermes in services that need Pub/Sub:
 *
 * ```sh
 * npm install @google-cloud/pubsub
 * ```
 *
 * @example
 * ```typescript
 * import { PubSubPublisher } from '@elastic-resume-base/hermes';
 *
 * const publisher = new PubSubPublisher('my-gcp-project');
 * await publisher.publish('resume-ingested', { resumeId: 'abc-123', status: 'ok' });
 * ```
 */
export class PubSubPublisher {
    _projectId;
    _client;
    /**
     * @param projectId - GCP project ID that owns the Pub/Sub topics.
     */
    constructor(projectId) {
        this._projectId = projectId;
    }
    /**
     * Lazily initialises the `@google-cloud/pubsub` client.
     *
     * The client is created on first use so that the module can be imported
     * without requiring `@google-cloud/pubsub` at load time.
     *
     * @returns The shared {@link PubSub} client instance.
     */
    async getClient() {
        if (!this._client) {
            const { PubSub } = await import('@google-cloud/pubsub');
            this._client = new PubSub({ projectId: this._projectId });
        }
        return this._client;
    }
    /**
     * Publishes *data* as a JSON-encoded Pub/Sub message to *topic*.
     *
     * The topic path is resolved to `projects/{projectId}/topics/{topic}`
     * using the project ID supplied at construction time.
     *
     * @param topic - Short topic name (e.g. `'resume-ingested'`).
     * @param data - JSON-serialisable payload object.
     * @returns Promise that resolves when the message has been acknowledged.
     * @throws If the Pub/Sub call fails at the transport or API level.
     *
     * @example
     * ```typescript
     * await publisher.publish('resume-ingested', { resumeId: 'abc-123' });
     * ```
     */
    async publish(topic, data) {
        const client = await this.getClient();
        const pubsubTopic = client.topic(topic);
        const payload = Buffer.from(JSON.stringify(data), 'utf-8');
        await pubsubTopic.publishMessage({ data: payload });
    }
}
//# sourceMappingURL=pub-sub-publisher.js.map