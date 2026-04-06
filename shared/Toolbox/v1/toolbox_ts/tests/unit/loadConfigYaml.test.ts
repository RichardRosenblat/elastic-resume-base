/**
 * Unit tests for toolbox_ts loadConfigYaml module.
 */

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfigYaml } from '../../src/loadConfigYaml.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `toolbox-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env['CONFIG_FILE'];
});

function writeConfig(content: string): string {
  const configPath = join(tmpDir, 'config.yaml');
  writeFileSync(configPath, content, 'utf8');
  process.env['CONFIG_FILE'] = configPath;
  return configPath;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('loadConfigYaml', () => {
  it('sets env vars from systems.shared and systems.<service>', () => {
    writeConfig(`
systems:
  shared:
    SHARED_KEY: "shared-value"
  my-service:
    SERVICE_KEY: "service-value"
`);
    delete process.env['SHARED_KEY'];
    delete process.env['SERVICE_KEY'];

    loadConfigYaml('my-service');

    expect(process.env['SHARED_KEY']).toBe('shared-value');
    expect(process.env['SERVICE_KEY']).toBe('service-value');

    delete process.env['SHARED_KEY'];
    delete process.env['SERVICE_KEY'];
  });

  it('does not override existing env vars', () => {
    writeConfig(`
systems:
  shared:
    EXISTING_KEY: "from-yaml"
`);
    process.env['EXISTING_KEY'] = 'pre-existing';

    loadConfigYaml('my-service');

    expect(process.env['EXISTING_KEY']).toBe('pre-existing');

    delete process.env['EXISTING_KEY'];
  });

  it('service keys take precedence over shared keys with the same name', () => {
    writeConfig(`
systems:
  shared:
    SOME_KEY: "shared-value"
  my-service:
    SOME_KEY: "service-override"
`);
    delete process.env['SOME_KEY'];

    loadConfigYaml('my-service');

    expect(process.env['SOME_KEY']).toBe('service-override');

    delete process.env['SOME_KEY'];
  });

  it('returns silently when no config file is found', () => {
    process.env['CONFIG_FILE'] = '/nonexistent/path/config.yaml';

    expect(() => loadConfigYaml('no-such-service')).not.toThrow();
  });

  it('returns silently when YAML is malformed', () => {
    writeConfig('this: is: not: valid: yaml: [');

    expect(() => loadConfigYaml('my-service')).not.toThrow();
  });

  it('returns silently when YAML root is not an object', () => {
    writeConfig('"just a string"');

    expect(() => loadConfigYaml('my-service')).not.toThrow();
  });

  it('returns silently when the systems key is missing', () => {
    writeConfig('other:\n  key: value\n');

    expect(() => loadConfigYaml('my-service')).not.toThrow();
  });

  it('applies the shared section even when the service section is absent', () => {
    writeConfig(`
systems:
  shared:
    ONLY_SHARED_KEY: "only-shared"
`);
    delete process.env['ONLY_SHARED_KEY'];

    loadConfigYaml('other-service');

    expect(process.env['ONLY_SHARED_KEY']).toBe('only-shared');

    delete process.env['ONLY_SHARED_KEY'];
  });

  it('applies the service section even when the shared section is absent', () => {
    writeConfig(`
systems:
  my-service:
    ONLY_SERVICE_KEY: "only-service"
`);
    delete process.env['ONLY_SERVICE_KEY'];

    loadConfigYaml('my-service');

    expect(process.env['ONLY_SERVICE_KEY']).toBe('only-service');

    delete process.env['ONLY_SERVICE_KEY'];
  });

  it('stringifies numeric YAML values', () => {
    writeConfig(`
systems:
  my-service:
    PORT: 9000
    TIMEOUT: 30.5
`);
    delete process.env['PORT'];
    delete process.env['TIMEOUT'];

    loadConfigYaml('my-service');

    expect(process.env['PORT']).toBe('9000');
    expect(process.env['TIMEOUT']).toBe('30.5');

    delete process.env['PORT'];
    delete process.env['TIMEOUT'];
  });

  it('stringifies boolean YAML values', () => {
    writeConfig(`
systems:
  my-service:
    FEATURE_FLAG: true
`);
    delete process.env['FEATURE_FLAG'];

    loadConfigYaml('my-service');

    expect(process.env['FEATURE_FLAG']).toBe('true');

    delete process.env['FEATURE_FLAG'];
  });

  it('skips keys with null YAML values', () => {
    writeConfig(`
systems:
  my-service:
    NULL_KEY: null
`);
    delete process.env['NULL_KEY'];

    loadConfigYaml('my-service');

    expect(process.env['NULL_KEY']).toBeUndefined();
  });
});
