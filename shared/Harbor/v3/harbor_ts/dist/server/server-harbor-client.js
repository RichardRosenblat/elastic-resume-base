/**
 * ServerHarborClient — environment-aware HTTP client for server-side use.
 *
 * Selects the underlying transport based on `NODE_ENV` so that callers never
 * need to branch on the environment themselves:
 *
 * - **development** (default when `NODE_ENV` is absent or not `"production"`):
 *   Behaves like a plain {@link HarborClient} — no authentication overhead.
 * - **production** (`NODE_ENV === "production"`): Attaches a Google Cloud OIDC
 *   identity token to every outgoing request (IAM authentication).
 *
 * This file is **server-only** — never import it in browser/frontend code.
 */
import { HarborClient } from '../client/harbor-client.js';
import { IamHarborClient } from './iam-harbor-client.js';
// ─── ServerHarborClient ───────────────────────────────────────────────────────
/**
 * An environment-aware HTTP client that automatically selects the right
 * transport based on `NODE_ENV`.
 *
 * Callers use the returned client identically in both environments:
 *
 * ```typescript
 * import { ServerHarborClient } from '@elastic-resume-base/harbor/server';
 *
 * const client = new ServerHarborClient({ baseURL: config.usersApiServiceUrl });
 * const response = await client.get('/api/v1/users');
 * ```
 *
 * **Server-only** — requires Node.js. Never use in browser code.
 */
export class ServerHarborClient extends HarborClient {
    constructor(options) {
        super(options);
        if (process.env['NODE_ENV'] === 'production') {
            // In production, register the IAM token interceptor directly on our
            // own axios instance so all subsequent calls carry an OIDC token.
            const iamClient = new IamHarborClient({
                ...options,
                audience: options.audience ?? options.baseURL,
            });
            // Replace our axios instance with the IAM-interceptor-equipped one.
            Object.defineProperty(this, 'axiosInstance', {
                value: iamClient.axiosInstance,
                writable: false,
                configurable: true,
            });
        }
    }
}
//# sourceMappingURL=server-harbor-client.js.map