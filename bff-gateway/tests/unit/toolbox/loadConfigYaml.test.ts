/**
 * Unit tests for loadConfigYaml.
 * Tests that config.yaml values are merged into process.env correctly.
 */

import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfigYaml } from '../../../../shared/Toolbox/src/loadConfigYaml.js';

const TEMP_CONFIG = resolve(process.cwd(), '__test_config__.yaml');

afterEach(() => {
  // Clean up temp file and env vars
  try {
    unlinkSync(TEMP_CONFIG);
  } catch {
    // File may not exist
  }
  delete process.env['TEST_KEY_SHARED'];
  delete process.env['TEST_KEY_SERVICE'];
  delete process.env['TEST_KEY_OVERRIDE'];
  delete process.env['CONFIG_FILE'];
});

describe('loadConfigYaml', () => {
  it('sets env vars from systems.shared and systems.<service>', () => {
    writeFileSync(
      TEMP_CONFIG,
      `
systems:
  shared:
    TEST_KEY_SHARED: "shared-value"
  my-service:
    TEST_KEY_SERVICE: "service-value"
`,
    );

    process.env['CONFIG_FILE'] = TEMP_CONFIG;
    loadConfigYaml('my-service');

    expect(process.env['TEST_KEY_SHARED']).toBe('shared-value');
    expect(process.env['TEST_KEY_SERVICE']).toBe('service-value');
  });

  it('does not overwrite already-set env vars', () => {
    writeFileSync(
      TEMP_CONFIG,
      `
systems:
  shared:
    TEST_KEY_OVERRIDE: "from-yaml"
`,
    );

    process.env['CONFIG_FILE'] = TEMP_CONFIG;
    process.env['TEST_KEY_OVERRIDE'] = 'pre-existing';
    loadConfigYaml('my-service');

    expect(process.env['TEST_KEY_OVERRIDE']).toBe('pre-existing');
  });

  it('returns silently when no config file is found', () => {
    delete process.env['CONFIG_FILE'];
    // No config.yaml in a temp location — just ensure no throw
    expect(() => loadConfigYaml('nonexistent-service')).not.toThrow();
  });

  it('returns silently when the config file is malformed YAML', () => {
    writeFileSync(TEMP_CONFIG, 'this: is: not: valid: yaml: [');
    process.env['CONFIG_FILE'] = TEMP_CONFIG;
    // Should warn and not throw
    expect(() => loadConfigYaml('my-service')).not.toThrow();
  });

  it('service keys override shared keys', () => {
    writeFileSync(
      TEMP_CONFIG,
      `
systems:
  shared:
    TEST_KEY_SHARED: "shared-value"
  my-service:
    TEST_KEY_SHARED: "service-override"
`,
    );

    process.env['CONFIG_FILE'] = TEMP_CONFIG;
    loadConfigYaml('my-service');

    expect(process.env['TEST_KEY_SHARED']).toBe('service-override');
  });
});
