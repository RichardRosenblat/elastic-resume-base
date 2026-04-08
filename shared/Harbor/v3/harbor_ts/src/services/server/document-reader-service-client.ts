/**
 * DocumentReaderServiceClient — server-side service client for the Document Reader API.
 *
 * Use this class in **Node.js services** (e.g. the Gateway API) to communicate
 * with the Document Reader API.  Pass an {@link IHarborClient} at construction
 * time — typically a {@link ServerHarborClient} in production or a mock in
 * tests.
 *
 * @example
 * ```typescript
 * import { ServerHarborClient, DocumentReaderServiceClient } from '@elastic-resume-base/harbor/server';
 *
 * const harbor = new ServerHarborClient({ baseURL: config.documentReaderUrl });
 * const docReader = new DocumentReaderServiceClient(harbor);
 *
 * const response = await docReader.post('/read', payload);
 * ```
 */

import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ServiceClient } from '../service-client.js';
import type { IHarborClient } from '../../client/harbor-client.js';

export class DocumentReaderServiceClient extends ServiceClient {
  constructor(client: IHarborClient) {
    super(client);
  }

  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.request<T>(config);
  }
}
