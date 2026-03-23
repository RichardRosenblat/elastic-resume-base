import { describe, it, expect } from 'vitest';
import { config } from './config';

describe('config', () => {
  it('has default bffUrl', () => {
    expect(config.bffUrl).toBeDefined();
  });

  it('has firebase config', () => {
    expect(config.firebase).toBeDefined();
    expect(config.firebase.projectId).toBeDefined();
  });

  it('has features config', () => {
    expect(config.features).toBeDefined();
    expect(typeof config.features.resumeIngest).toBe('boolean');
    expect(typeof config.features.userManagement).toBe('boolean');
  });
});
