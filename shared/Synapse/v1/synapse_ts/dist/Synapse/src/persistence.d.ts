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
export declare function initializePersistence(options: PersistenceOptions): void;
/**
 * Terminates the Firebase Admin SDK — should be called during graceful shutdown
 * to release Firestore connections and prevent zombie connections or memory leaks.
 *
 * This function is **idempotent**: if no app is initialized, it is a no-op.
 *
 * @example
 * ```typescript
 * import { terminatePersistence } from '@elastic-resume-base/synapse';
 *
 * process.on('SIGTERM', async () => {
 *   await terminatePersistence();
 *   process.exit(0);
 * });
 * ```
 */
export declare function terminatePersistence(): Promise<void>;
//# sourceMappingURL=persistence.d.ts.map