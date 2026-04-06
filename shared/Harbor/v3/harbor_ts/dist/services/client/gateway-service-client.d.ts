/**
 * GatewayServiceClient — client-side service client for the Gateway API.
 *
 * Use this class in **frontend / browser** code to communicate with the
 * Gateway API.  Pass a {@link HarborClient} (or {@link IHarborClient}) at
 * construction time so the transport can be swapped or mocked in tests.
 *
 * @example
 * ```typescript
 * import { HarborClient, GatewayServiceClient } from '@elastic-resume-base/harbor/client';
 *
 * const harbor = new HarborClient({ baseURL: 'https://gateway.example.com', timeoutMs: 30_000 });
 * const gateway = new GatewayServiceClient(harbor);
 *
 * const response = await gateway.get('/api/v1/resumes');
 * ```
 */
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ServiceClient } from '../service-client.js';
import type { IHarborClient } from '../../client/harbor-client.js';
export declare class GatewayServiceClient extends ServiceClient {
    constructor(client: IHarborClient);
    get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
}
//# sourceMappingURL=gateway-service-client.d.ts.map