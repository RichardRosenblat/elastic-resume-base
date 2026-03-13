"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const zod_1 = require("zod");
const configSchema = zod_1.z.object({
    port: zod_1.z.number().default(3000),
    nodeEnv: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    projectId: zod_1.z.string().default('demo-elastic-resume-base'),
    firestoreEmulatorHost: zod_1.z.string().optional(),
    firebaseAuthEmulatorHost: zod_1.z.string().optional(),
    downloaderServiceUrl: zod_1.z.string().url().default('http://localhost:8001'),
    searchBaseServiceUrl: zod_1.z.string().url().default('http://localhost:8002'),
    fileGeneratorServiceUrl: zod_1.z.string().url().default('http://localhost:8003'),
    documentReaderServiceUrl: zod_1.z.string().url().default('http://localhost:8004'),
    requestTimeoutMs: zod_1.z.number().default(30000),
});
function loadConfig() {
    return configSchema.parse({
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
        nodeEnv: process.env.NODE_ENV,
        projectId: process.env.FIREBASE_PROJECT_ID,
        firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
        firebaseAuthEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST,
        downloaderServiceUrl: process.env.DOWNLOADER_SERVICE_URL,
        searchBaseServiceUrl: process.env.SEARCH_BASE_SERVICE_URL,
        fileGeneratorServiceUrl: process.env.FILE_GENERATOR_SERVICE_URL,
        documentReaderServiceUrl: process.env.DOCUMENT_READER_SERVICE_URL,
        requestTimeoutMs: process.env.REQUEST_TIMEOUT_MS ? parseInt(process.env.REQUEST_TIMEOUT_MS, 10) : undefined,
    });
}
exports.config = loadConfig();
//# sourceMappingURL=index.js.map