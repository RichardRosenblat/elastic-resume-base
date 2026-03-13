import { z } from 'zod';

/** Zod schema for application configuration. */
const configSchema = z.object({
  port: z.number().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  projectId: z.string().default('demo-elastic-resume-base'),
  firestoreEmulatorHost: z.string().optional(),
  firebaseAuthEmulatorHost: z.string().optional(),
  downloaderServiceUrl: z.string().url().default('http://localhost:8001'),
  searchBaseServiceUrl: z.string().url().default('http://localhost:8002'),
  fileGeneratorServiceUrl: z.string().url().default('http://localhost:8003'),
  documentReaderServiceUrl: z.string().url().default('http://localhost:8004'),
  requestTimeoutMs: z.number().default(30000),
  logLevel: z.string().default('info'),
  allowedOrigins: z.string().default('http://localhost:3000'),
});

/** Application configuration type inferred from schema. */
export type Config = z.infer<typeof configSchema>;

/**
 * Loads and validates configuration from environment variables.
 * @returns Validated configuration object.
 */
function loadConfig(): Config {
  return configSchema.parse({
    port: process.env['PORT'] ? parseInt(process.env['PORT'], 10) : undefined,
    nodeEnv: process.env['NODE_ENV'],
    projectId: process.env['FIREBASE_PROJECT_ID'],
    firestoreEmulatorHost: process.env['FIRESTORE_EMULATOR_HOST'],
    firebaseAuthEmulatorHost: process.env['FIREBASE_AUTH_EMULATOR_HOST'],
    downloaderServiceUrl: process.env['DOWNLOADER_SERVICE_URL'],
    searchBaseServiceUrl: process.env['SEARCH_BASE_SERVICE_URL'],
    fileGeneratorServiceUrl: process.env['FILE_GENERATOR_SERVICE_URL'],
    documentReaderServiceUrl: process.env['DOCUMENT_READER_SERVICE_URL'],
    requestTimeoutMs: process.env['REQUEST_TIMEOUT_MS'] ? parseInt(process.env['REQUEST_TIMEOUT_MS'], 10) : undefined,
    logLevel: process.env['LOG_LEVEL'],
    allowedOrigins: process.env['ALLOWED_ORIGINS'],
  });
}

/** Validated application configuration singleton. */
export const config = loadConfig();
