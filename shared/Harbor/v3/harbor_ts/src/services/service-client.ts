/**
 * ServiceClient — abstract base class for service-specific HTTP clients.
 *
 * Extend this class to create typed service clients that accept a
 * {@link IHarborClient} via constructor injection.  This makes the service
 * client independently testable: pass a mock {@link IHarborClient} in tests
 * and the real {@link HarborClient} (or {@link IamHarborClient}) in production.
 *
 * @example
 * ```typescript
 * import { ServiceClient, HarborClient } from '@elastic-resume-base/harbor/client';
 *
 * class UsersServiceClient extends ServiceClient {
 *   async listUsers(): Promise<User[]> {
 *     const response = await this.client.get<User[]>('/api/v1/users');
 *     return response.data;
 *   }
 * }
 *
 * // In production:
 * const harbor = new HarborClient({ baseURL: config.usersApiUrl });
 * const usersClient = new UsersServiceClient(harbor);
 *
 * // In tests:
 * const mockHarbor: IHarborClient = { get: jest.fn().mockResolvedValue({ data: [] }) } as unknown as IHarborClient;
 * const usersClient = new UsersServiceClient(mockHarbor);
 * ```
 */

import type { IHarborClient } from '../client/harbor-client.js';

export abstract class ServiceClient {
  /** The underlying Harbor HTTP client, available to subclasses. */
  protected readonly client: IHarborClient;

  constructor(client: IHarborClient) {
    this.client = client;
  }
}
