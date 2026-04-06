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
import { ServiceClient } from '../service-client.js';
export class DocumentReaderServiceClient extends ServiceClient {
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
//# sourceMappingURL=document-reader-service-client.js.map