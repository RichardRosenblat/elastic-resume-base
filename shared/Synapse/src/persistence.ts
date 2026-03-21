import admin from 'firebase-admin';

/**
 * Options for initialising the persistence layer.
 *
 * These are intentionally Firebase-agnostic names so that consuming services
 * never need to import or reference `firebase-admin` directly.
 */
export interface PersistenceOptions {
  /** Firestore / Firebase project identifier. */
  projectId: string;
  /**
   * Service-account credentials as a raw JSON string **or** a Base64-encoded
   * JSON string.  When omitted, Application Default Credentials (ADC) are used.
   */
  serviceAccountKey?: string;
}

/**
 * Initialises the Firebase Admin SDK — the persistence backend used by Synapse.
 *
 * This function is **idempotent**: subsequent calls after the first successful
 * initialisation are no-ops.  Call it once at application startup before any
 * Synapse store is used.
 *
 * Consuming services should never import `firebase-admin` directly; delegate
 * all persistence-layer concerns (including initialisation) to Synapse.
 *
 * @param options - Persistence initialisation options.
 *
 * @example
 * ```typescript
 * import { initializePersistence } from '@elastic-resume-base/synapse';
 *
 * initializePersistence({
 *   projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-project',
 *   serviceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
 * });
 * ```
 */
export function initializePersistence(options: PersistenceOptions): void {
  if (admin.apps.length > 0) {
    return;
  }

  const appOptions: admin.AppOptions = {
    projectId: options.projectId,
  };

  if (options.serviceAccountKey) {
    try {
      const raw = options.serviceAccountKey.trim();
      const decoded = raw.startsWith('{')
        ? raw
        : Buffer.from(raw, 'base64').toString('utf-8');
      const credentials = JSON.parse(decoded) as admin.ServiceAccount;
      appOptions.credential = admin.credential.cert(credentials);
    } catch {
      // Parsing failed — fall back to Application Default Credentials.
    }
  }

  admin.initializeApp(appOptions);
}
