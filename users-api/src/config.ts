import { z } from 'zod';
import { loadConfigYaml } from './utils/loadConfigYaml.js';

// Populate process.env from config.yaml (systems.shared + systems.users-api)
// before Zod reads process.env below. Keys already set are never overridden.
loadConfigYaml('users-api');

/** Zod schema for application configuration. */
const configSchema = z.object({
  port: z.number().default(8005),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  projectId: z.string().default('demo-elastic-resume-base'),
  firestoreEmulatorHost: z.string().optional(),
  firebaseAuthEmulatorHost: z.string().optional(),
  googleServiceAccountKey: z.string().optional(),
  adminSheetFileId: z.string().optional(),
  firestoreUsersCollection: z.string().default('users'),
  logLevel: z.string().default('info'),
  gcpProjectId: z.string().default('demo-elastic-resume-base'),
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
    googleServiceAccountKey: process.env['GOOGLE_SERVICE_ACCOUNT_KEY'],
    adminSheetFileId: process.env['ADMIN_SHEET_FILE_ID'],
    firestoreUsersCollection: process.env['FIRESTORE_USERS_COLLECTION'],
    logLevel: process.env['LOG_LEVEL'],
    gcpProjectId: process.env['GCP_PROJECT_ID'],
    allowedOrigins: process.env['ALLOWED_ORIGINS'],
  });
}

/** Validated application configuration singleton. */
export const config = loadConfig();
