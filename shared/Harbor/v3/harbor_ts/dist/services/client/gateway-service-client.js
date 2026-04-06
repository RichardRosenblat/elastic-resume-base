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
import { ServiceClient } from '../service-client.js';
export class GatewayServiceClient extends ServiceClient {
    constructor(client) {
        super(client);
    }
    get(url, config) {
        return this.client.get(url, config);
    }
    post(url, data, config) {
        return this.client.post(url, data, config);
    }
    put(url, data, config) {
        return this.client.put(url, data, config);
    }
    patch(url, data, config) {
        return this.client.patch(url, data, config);
    }
    delete(url, config) {
        return this.client.delete(url, config);
    }
    request(config) {
        return this.client.request(config);
    }
}
//# sourceMappingURL=gateway-service-client.js.map