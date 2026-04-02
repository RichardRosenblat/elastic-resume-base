/**
 * IAM-based (Google Cloud Identity) HTTP client factory for service-to-service
 * authentication.
 *
 * This file is **server-only** — it uses `google-auth-library` which requires
 * a Node.js environment and Google Cloud credentials.  Never import this file
 * in browser code.
 */
import type { HarborClient, HarborClientOptions } from '../client/index.js';
/**
 * Configuration options for creating an IAM-authenticated HarborClient.
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
     *
     * The Google Auth Library uses this value when requesting an identity token
     * from the metadata server (or service-account credentials).
     */
    audience: string;
}
/**
 * Creates a pre-configured {@link HarborClient} that automatically attaches a
 * Google Cloud OIDC identity token to every outgoing request.
 *
 * Use this factory for **service-to-service** calls where the receiving service
 * requires IAM authentication (e.g. Cloud Run services with ingress set to
 * "internal" or "internal + load balancer").
 *
 * Authentication relies on Application Default Credentials (ADC): on GCP, the
 * Compute Engine / Cloud Run service account is used automatically.  In local
 * development, ADC falls back to `gcloud auth application-default login`.
 *
 * @param options - Configuration including the IAM `audience`.
 * @returns A configured HarborClient with an IAM token request interceptor.
 *
 * @example
 * ```typescript
 * import { createIamHarborClient } from '@elastic-resume-base/harbor/server';
 *
 * const client = createIamHarborClient({
 *   baseURL: config.usersApiServiceUrl,
 *   timeoutMs: config.requestTimeoutMs,
 *   audience: config.usersApiServiceUrl,
 * });
 *
 * const response = await client.get('/api/v1/users');
 * ```
 */
export declare function createIamHarborClient(options: IamHarborClientOptions): HarborClient;
//# sourceMappingURL=iam.d.ts.map