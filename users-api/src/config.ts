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
  bootstrapAdminUserEmail: z.string().email().optional(),
  googleServiceAccountKey: z.string().optional(),
  firestoreUsersCollection: z.string().default('users'),
  firestorePreApprovedUsersCollection: z.string().default('pre_approved_users'),
  onboardableEmailDomains: z.string().default(''),
  autoUserCreationDomains: z.string().optional(),
  autoAdminCreationDomains: z.string().optional(),
  logLevel: z.string().default('info'),
  gcpProjectId: z.string().default('demo-elastic-resume-base'),
  allowedOrigins: z.string().default('http://localhost:3000'),
  rateLimitMax: z.number().int().positive().default(500),
  rateLimitTimeWindow: z.string().default('15 minutes'),
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
    googleServiceAccountKey: process.env['GOOGLE_SERVICE_ACCOUNT_KEY'],
    firestoreUsersCollection: process.env['FIRESTORE_USERS_COLLECTION'],
    firestorePreApprovedUsersCollection: process.env['FIRESTORE_PRE_APPROVED_USERS_COLLECTION'],
    onboardableEmailDomains: process.env['ONBOARDABLE_EMAIL_DOMAINS'],
    autoUserCreationDomains: process.env['AUTO_USER_CREATION_DOMAINS'],
    autoAdminCreationDomains: process.env['AUTO_ADMIN_CREATION_DOMAINS'],
    logLevel: process.env['LOG_LEVEL'],
    gcpProjectId: process.env['GCP_PROJECT_ID'],
    allowedOrigins: process.env['ALLOWED_ORIGINS'],
    bootstrapAdminUserEmail: process.env['BOOTSTRAP_ADMIN_USER_EMAIL'],
    rateLimitMax: safeParseInt(process.env['RATE_LIMIT_MAX']),
    rateLimitTimeWindow: process.env['RATE_LIMIT_TIME_WINDOW'],
  });
}

/** Validated application configuration singleton. */
export const config = loadConfig();
