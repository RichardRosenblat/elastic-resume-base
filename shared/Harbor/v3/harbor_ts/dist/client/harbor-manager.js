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
import { HarborClient } from './harbor-client.js';
// ─── HarborManager ────────────────────────────────────────────────────────────
export class HarborManager {
    _clients = new Map();
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
    registerClient(key, options) {
        const client = new HarborClient(options);
        this._clients.set(key, client);
        return client;
    }
    /**
     * Returns the {@link HarborClient} registered under `key`, or `undefined`
     * if no client has been registered with that key.
     *
     * @param key - The key used when the client was registered.
     */
    getClient(key) {
        return this._clients.get(key);
    }
    /**
     * Returns `true` if a client is registered under `key`.
     *
     * @param key - The key to check.
     */
    hasClient(key) {
        return this._clients.has(key);
    }
    /**
     * Removes the client registered under `key`.
     *
     * @param key - The key of the client to remove.
     * @returns `true` if the client existed and was removed, `false` otherwise.
     */
    unregisterClient(key) {
        return this._clients.delete(key);
    }
    /**
     * Removes all registered clients.
     */
    clear() {
        this._clients.clear();
    }
    /**
     * Returns all keys for which a client is currently registered.
     */
    get registeredKeys() {
        return Array.from(this._clients.keys());
    }
    /**
     * Returns the total number of registered clients.
     */
    get size() {
        return this._clients.size;
    }
}
//# sourceMappingURL=harbor-manager.js.map