import { config } from '../config';
import type { FeatureFlags } from '../types';

export function useFeatureFlags(): FeatureFlags {
  return config.features;
}
