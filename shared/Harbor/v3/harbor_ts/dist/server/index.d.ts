/**
 * @module @elastic-resume-base/harbor/server (v3)
 *
 * HarborClient **server-side** entry point for Node.js services.
 *
 * This module exposes the object-oriented {@link HarborClient},
 * {@link IamHarborClient}, and {@link ServerHarborClient} classes, the
 * {@link HarborManager} registry, and server-side service clients.
 *
 * **Do not import this module in browser/frontend code.** Use
 * `@elastic-resume-base/harbor/client` instead.
 *
 * ## Quick Start — basic client
 *
 * ```typescript
 * import { HarborClient } from '@elastic-resume-base/harbor/server';
 *
 * const client = new HarborClient({ baseURL: config.documentReaderServiceUrl });
 * const result = await client.post('/read', payload);
 * ```
 *
 * ## Quick Start — IAM-authenticated client
 *
 * ```typescript
 * import { IamHarborClient } from '@elastic-resume-base/harbor/server';
 *
 * const client = new IamHarborClient({
 *   baseURL: config.usersApiServiceUrl,
 *   audience: config.usersApiServiceUrl,
 * });
 *
 * const response = await client.get('/api/v1/users');
 * ```
 *
 * ## Quick Start — environment-aware client (recommended)
 *
 * ```typescript
 * import { ServerHarborClient } from '@elastic-resume-base/harbor/server';
 *
 * // Uses plain HarborClient in development, IamHarborClient in production.
 * const client = new ServerHarborClient({ baseURL: config.usersApiServiceUrl });
 * const response = await client.get('/api/v1/users');
 * ```
 *
 * ## Quick Start — service client with injection
 *
 * ```typescript
 * import { ServerHarborClient, UsersServiceClient } from '@elastic-resume-base/harbor/server';
 *
 * const harbor = new ServerHarborClient({ baseURL: config.usersApiServiceUrl });
 * const users = new UsersServiceClient(harbor);
 *
 * const response = await users.get('/api/v1/users');
 * ```
 *
 * ## Quick Start — HarborManager (multiple clients)
 *
 * ```typescript
 * import { HarborManager } from '@elastic-resume-base/harbor/server';
 *
 * const manager = new HarborManager();
 * manager.registerClient('users', { baseURL: config.usersApiServiceUrl });
 * manager.registerClient('search', { baseURL: config.searchServiceUrl });
 * ```
 */
export type { AxiosInstance, AxiosRequestConfig, AxiosResponse, } from 'axios';
export type { AxiosError as HarborError } from 'axios';
export type { IHarborClient, HarborClientOptions } from '../client/harbor-client.js';
export { HarborClient, isHarborError } from '../client/harbor-client.js';
export { HarborManager } from '../client/harbor-manager.js';
export type { IamHarborClientOptions } from './iam-harbor-client.js';
export { IamHarborClient } from './iam-harbor-client.js';
export type { ServerHarborClientOptions } from './server-harbor-client.js';
export { ServerHarborClient } from './server-harbor-client.js';
export type { ServiceClient } from '../services/service-client.js';
export { UsersServiceClient } from '../services/server/users-service-client.js';
export { DocumentReaderServiceClient } from '../services/server/document-reader-service-client.js';
//# sourceMappingURL=index.d.ts.map