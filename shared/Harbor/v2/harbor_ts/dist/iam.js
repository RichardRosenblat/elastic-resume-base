/**
 * IAM-based (Google Cloud Identity) HTTP client factory for service-to-service
 * authentication.
 *
 * This file is **server-only** — it uses `google-auth-library` which requires
 * a Node.js environment and Google Cloud credentials.  Never import this file
 * in browser code.
 */
import { GoogleAuth } from 'google-auth-library';
import { createHarborClient } from './shared.js';
// ─── Factory ──────────────────────────────────────────────────────────────────
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
export function createIamHarborClient(options) {
    const client = createHarborClient(options);
    const auth = new GoogleAuth();
    client.interceptors.request.use(async (axiosConfig) => {
        try {
            const idTokenClient = await auth.getIdTokenClient(options.audience);
            const headers = await idTokenClient.getRequestHeaders();
            const token = headers.get('Authorization');
            if (token) {
                axiosConfig.headers['Authorization'] = token;
            }
        }
        catch {
            // If IAM token acquisition fails, let the request proceed without the
            // token — the downstream service will return 401/403, which surfaces
            // the misconfiguration more clearly than silently swallowing the error.
        }
        return axiosConfig;
    });
    return client;
}
//# sourceMappingURL=iam.js.map