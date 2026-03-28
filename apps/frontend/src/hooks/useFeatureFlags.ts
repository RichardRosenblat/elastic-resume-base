/**
 * @file useFeatureFlags — returns the current feature-flag state.
 *
 * Feature flags are read from `VITE_FEATURE_*` environment variables at
 * build time. The hook wraps the `config.features` object so that components
 * have a single, stable import rather than importing `config` directly.
 *
 * @example
 * const { resumeSearch } = useFeatureFlags();
 * if (!resumeSearch) return <ComingSoon />;
 */
import { config } from '../config';
import type { FeatureFlags } from '../types';

/**
 * Returns the feature-flag state derived from the Vite environment variables
 * (`VITE_FEATURE_*`). Use this hook to conditionally enable or disable UI
 * sections that depend on backend services that may not yet be deployed.
 *
 * @returns A {@link FeatureFlags} object where each key is `true` when the
 *   corresponding backend feature is available.
 */
export function useFeatureFlags(): FeatureFlags {
  return config.features;
}
