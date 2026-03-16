import { ErrorReporting } from '@google-cloud/error-reporting';
import { config } from '../config.js';
import { logger } from './logger.js';

let errorReporting: ErrorReporting | null = null;

/**
 * Returns the singleton ErrorReporting instance (only in production).
 */
export function getErrorReporting(): ErrorReporting | null {
  if (config.nodeEnv !== 'production') return null;
  if (!errorReporting) {
    errorReporting = new ErrorReporting({ projectId: config.gcpProjectId, reportMode: 'production' });
    logger.info({ projectId: config.gcpProjectId }, 'Google Cloud Error Reporting initialized');
  }
  return errorReporting;
}

/**
 * Reports an error to Google Cloud Error Reporting (no-op outside production).
 */
export function reportError(err: Error): void {
  const reporter = getErrorReporting();
  if (reporter) reporter.report(err);
}
