/**
 * IAM-authenticated HarborClient for service-to-service authentication.
 *
 * This file is **server-only** — it uses `google-auth-library` which requires
 * a Node.js environment and Google Cloud credentials.  Never import this file
 * in browser code.
 */

import { GoogleAuth } from 'google-auth-library';
import type { InternalAxiosRequestConfig } from 'axios';
import { HarborClient, type HarborClientOptions } from '../client/harbor-client.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Configuration options for creating an {@link IamHarborClient}.
 *
 * Extends {@link HarborClientOptions} with the required `audience` field used
 * to obtain a Google Cloud OIDC identity token.
 */
export interface IamHarborClientOptions extends HarborClientOptions {
  /**
   * The audience for the IAM OIDC identity token.
   *
   * For Cloud Run services this is typically the service's HTTPS URL, e.g.
   * `https://my-service-hash-uc.a.run.app`.
   */
  audience: string;
}

// ─── IamHarborClient ─────────────────────────────────────────────────────────

/**
 * An object-oriented HTTP client that automatically attaches a Google Cloud
 * OIDC identity token to every outgoing request.
 *
 * Use this client for **service-to-service** calls where the receiving service
 * requires IAM authentication (e.g. Cloud Run services with ingress set to
 * "internal" or "internal + load balancer").
 *
 * Inject it wherever an {@link IHarborClient} is expected so the transport can
 * be swapped in tests without modifying the service client code.
 *
 * @example
 * ```typescript
 * import { IamHarborClient } from '@elastic-resume-base/harbor/server';
 *
 * const client = new IamHarborClient({
 *   baseURL: config.usersApiServiceUrl,
 *   timeoutMs: config.requestTimeoutMs,
 *   audience: config.usersApiServiceUrl,
 * });
 *
 * const response = await client.get('/api/v1/users');
 * ```
 */
export class IamHarborClient extends HarborClient {
  private readonly _auth: GoogleAuth;
  private readonly _audience: string;

  constructor(options: IamHarborClientOptions) {
    super(options);
    this._audience = options.audience;
    this._auth = new GoogleAuth();

    this.axiosInstance.interceptors.request.use(
      async (axiosConfig: InternalAxiosRequestConfig) => {
        try {
          const idTokenClient = await this._auth.getIdTokenClient(this._audience);
          const headers = await idTokenClient.getRequestHeaders();
          const authorization = headers.get('authorization');
          if (authorization) {
            axiosConfig.headers['Authorization'] = authorization;
          }
        } catch {
          // If IAM token acquisition fails, let the request proceed without the
          // token — the downstream service will return 401/403, which surfaces
          // the misconfiguration more clearly than silently swallowing the error.
        }
        return axiosConfig;
      },
    );
  }
}
