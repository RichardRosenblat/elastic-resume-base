/**
 * HarborManager — registry and lifecycle manager for {@link HarborClient} instances.
 *
 * `HarborManager` allows you to register, retrieve, and manage the lifecycle
 * of multiple named {@link HarborClient} objects in a centralised place.  This
 * is especially useful in service bootstrapping code where you need to create
 * several downstream clients once and then inject them into service-specific
 * objects later.
 *
 * @example
 * ```typescript
 * import { HarborManager } from '@elastic-resume-base/harbor/client';
 *
 * const manager = new HarborManager();
 *
 * // Register clients during application startup:
 * manager.registerClient('users', { baseURL: 'http://users-api:8005', timeoutMs: 10_000 });
 * manager.registerClient('search', { baseURL: 'http://search:8002', timeoutMs: 5_000 });
 *
 * // Retrieve clients anywhere in the application:
 * const usersClient = manager.getClient('users');
 * ```
 */
import { HarborClient, type HarborClientOptions } from './harbor-client.js';
export declare class HarborManager {
    private readonly _clients;
    /**
     * Registers a new {@link HarborClient} under the given `key`.
     *
     * If a client with the same key already exists it is **replaced** and the
     * new client is returned.
     *
     * @param key     - A unique identifier for this client (e.g. `'users'`).
     * @param options - Configuration options forwarded to {@link HarborClient}.
     * @returns The newly created {@link HarborClient} instance.
     */
    registerClient(key: string, options: HarborClientOptions): HarborClient;
    /**
     * Returns the {@link HarborClient} registered under `key`, or `undefined`
     * if no client has been registered with that key.
     *
     * @param key - The key used when the client was registered.
     */
    getClient(key: string): HarborClient | undefined;
    /**
     * Returns `true` if a client is registered under `key`.
     *
     * @param key - The key to check.
     */
    hasClient(key: string): boolean;
    /**
     * Removes the client registered under `key`.
     *
     * @param key - The key of the client to remove.
     * @returns `true` if the client existed and was removed, `false` otherwise.
     */
    unregisterClient(key: string): boolean;
    /**
     * Removes all registered clients.
     */
    clear(): void;
    /**
     * Returns all keys for which a client is currently registered.
     */
    get registeredKeys(): string[];
    /**
     * Returns the total number of registered clients.
     */
    get size(): number;
}
//# sourceMappingURL=harbor-manager.d.ts.map