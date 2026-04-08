/**
 * @module @elastic-resume-base/harbor/client (v3)
 *
 * HarborClient **browser-safe** entry point.
 *
 * This module exposes the object-oriented {@link HarborClient} class, the
 * {@link HarborManager} registry, and related types. It contains no
 * server-side logic (no IAM authentication, no service-account credentials).
 * Use this module in frontend code or any environment where Node.js-only
 * packages (e.g. `google-auth-library`) are unavailable.
 *
 * ## Quick Start — basic client
 *
 * ```typescript
 * import { HarborClient } from '@elastic-resume-base/harbor/client';
 *
 * const client = new HarborClient({ baseURL: 'https://api.example.com', timeoutMs: 30_000 });
 *
 * try {
 *   const response = await client.get('/data');
 * } catch (err) {
 *   if (isHarborError(err)) {
 *     // Handle HTTP / network errors
 *   }
 * }
 * ```
 *
 * ## Quick Start — manager (multiple clients)
 *
 * ```typescript
 * import { HarborManager } from '@elastic-resume-base/harbor/client';
 *
 * const manager = new HarborManager();
 * const usersClient = manager.registerClient('users', { baseURL: 'http://users-api:8005' });
 * const searchClient = manager.registerClient('search', { baseURL: 'http://search:8002' });
 *
 * // Retrieve later by key:
 * const client = manager.getClient('users');
 * ```
 */
export type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError as HarborError } from 'axios';
export type { IHarborClient, HarborClientOptions } from './harbor-client.js';
export { HarborClient, isHarborError } from './harbor-client.js';
export { HarborManager } from './harbor-manager.js';
export { GatewayServiceClient } from '../services/client/gateway-service-client.js';
export type { ServiceClient } from '../services/service-client.js';
//# sourceMappingURL=index.d.ts.map