"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readDocument = readDocument;
const httpClient_1 = require("../utils/httpClient");
const config_1 = require("../config");
const errorMapper_1 = require("../utils/errorMapper");
const client = (0, httpClient_1.createHttpClient)(config_1.config.documentReaderServiceUrl);
async function readDocument(payload) {
    try {
        const response = await client.post('/read', payload);
        return response.data;
    }
    catch (err) {
        const mapped = (0, errorMapper_1.mapDownstreamError)(err);
        throw Object.assign(new Error(mapped.message), { statusCode: mapped.statusCode, code: mapped.code });
    }
}
//# sourceMappingURL=documentReaderClient.js.map