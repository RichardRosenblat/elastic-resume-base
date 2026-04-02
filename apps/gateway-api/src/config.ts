import { z } from 'zod';
import { loadConfigYaml } from '../../../shared/Toolbox/v1/toolbox_ts/src/loadConfigYaml.js';

// Populate process.env from config.yaml (systems.shared + systems.gateway-api)
// before Zod reads process.env below. Keys already set are never overridden.
loadConfigYaml('gateway-api');

/** Zod schema for application configuration. */
const configSchema = z.object({
  port: z.number().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  projectId: z.string().default('demo-elastic-resume-base'),
  firestoreEmulatorHost: z.string().optional(),
  firebaseAuthEmulatorHost: z.string().optional(),
  ingestorServiceUrl: z.string().url().default('http://localhost:8001'),
  searchBaseServiceUrl: z.string().url().default('http://localhost:8002'),
  fileGeneratorServiceUrl: z.string().url().default('http://localhost:8003'),
  documentReaderServiceUrl: z.string().url().default('http://localhost:8004'),
  requestTimeoutMs: z.number().default(30000),
  rateLimitMax: z.number().int().positive().default(1000),
  rateLimitTimeWindow: z.string().default('15 minutes'),
  apiV1RateLimitMax: z.number().int().positive().default(1000),
  apiV1RateLimitTimeWindow: z.string().default('15 minutes'),
  logLevel: z.string().default('info'),
  allowedOrigins: z.string().default('http://localhost:3000'),
  gcpProjectId: z.string().default('demo-elastic-resume-base'),
  userApiServiceUrl: z.string().url().default('http://localhost:8005'),
});

/** Application configuration type inferred from schema. */
export type Config = z.infer<typeof configSchema>;

/** Parses a string to an integer, returning undefined for missing or non-numeric values. */
function safeParseInt(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Loads and validates configuration from environment variables.
 * @returns Validated configuration object.
 */
function loadConfig(): Config {
  return configSchema.parse({
    port: safeParseInt(process.env['PORT']),
    nodeEnv: process.env['NODE_ENV'],
    projectId: process.env['FIREBASE_PROJECT_ID'],
    firestoreEmulatorHost: process.env['FIRESTORE_EMULATOR_HOST'],
    firebaseAuthEmulatorHost: process.env['FIREBASE_AUTH_EMULATOR_HOST'],
    ingestorServiceUrl: process.env['INGESTOR_SERVICE_URL'],
    searchBaseServiceUrl: process.env['SEARCH_BASE_SERVICE_URL'],
    fileGeneratorServiceUrl: process.env['FILE_GENERATOR_SERVICE_URL'],
    documentReaderServiceUrl: process.env['DOCUMENT_READER_SERVICE_URL'],
    requestTimeoutMs: safeParseInt(process.env['REQUEST_TIMEOUT_MS']),
    rateLimitMax: safeParseInt(process.env['RATE_LIMIT_MAX']),
    rateLimitTimeWindow: process.env['RATE_LIMIT_TIME_WINDOW'],
    apiV1RateLimitMax: safeParseInt(process.env['API_V1_RATE_LIMIT_MAX']),
    apiV1RateLimitTimeWindow: process.env['API_V1_RATE_LIMIT_TIME_WINDOW'],
    logLevel: process.env['LOG_LEVEL'],
    allowedOrigins: process.env['ALLOWED_ORIGINS'],
    gcpProjectId: process.env['GCP_PROJECT_ID'],
    userApiServiceUrl: process.env['USER_API_SERVICE_URL'],
  });
}

/** Validated application configuration singleton. */
export const config = loadConfig();
