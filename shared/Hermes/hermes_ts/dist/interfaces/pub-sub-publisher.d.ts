/**
 * Publisher interface for the Hermes Pub/Sub abstraction.
 */
/**
 * Abstraction over any Pub/Sub publishing transport.
 *
 * Services should depend on this interface rather than on any concrete
 * implementation. Switching providers (e.g. from Google Cloud Pub/Sub to
 * a local emulator or an in-process stub) then requires only a Hermes
 * configuration change — no consuming service code needs to be refactored.
 *
 * @example
 * ```typescript
 * import type { IPubSubPublisher } from '@elastic-resume-base/hermes';
 *
 * class OrderService {
 *   constructor(private readonly _publisher: IPubSubPublisher) {}
 *
 *   async placeOrder(order: Record<string, unknown>): Promise<void> {
 *     await this._publisher.publish('orders', order);
 *   }
 * }
 * ```
 */
export interface IPubSubPublisher {
    /**
     * Publishes *data* to the given Pub/Sub *topic*.
     *
     * @param topic - Short topic name (e.g. `'resume-ingested'`). The concrete
     *   implementation resolves this to a fully-qualified topic path such as
     *   `projects/{project}/topics/{topic}`.
     * @param data - A JSON-serialisable object that will be encoded to bytes
     *   and published as the message payload.
     * @returns A promise that resolves when the message has been accepted by the
     *   transport (i.e. the Pub/Sub message ID has been received).
     * @throws If the Pub/Sub transport rejects the message or is unreachable.
     *
     * @example
     * ```typescript
     * await publisher.publish('resume-ingested', { resumeId: 'abc-123', status: 'ok' });
     * ```
     */
    publish(topic: string, data: Record<string, unknown>): Promise<void>;
}
//# sourceMappingURL=pub-sub-publisher.d.ts.map