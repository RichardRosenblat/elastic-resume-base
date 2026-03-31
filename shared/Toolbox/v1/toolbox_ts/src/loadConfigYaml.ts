import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

/**
 * Resolves the `load` function from the `js-yaml` package, if available.
 *
 * The require call is deliberately scoped to `process.cwd()` so that the
 * consuming service's own `node_modules/js-yaml` is found regardless of
 * whether this code runs as ESM, CJS, or in a Jest test environment.
 *
 * @returns The `js-yaml` `load` function, or `null` if `js-yaml` is not
 *   installed in the consuming service's dependency tree.
 */
function resolveYamlLoad(): ((content: string) => unknown) | null {
  // Scope require() to process.cwd() so that js-yaml resolves from the
  // consuming service's node_modules in all contexts (ESM, CJS, and tests).
  const require = createRequire(resolve(process.cwd(), '__noop__.js'));
  const candidates = [
    resolve(process.cwd(), 'node_modules', 'js-yaml'),
    'js-yaml',
  ];

  for (const candidate of candidates) {
    try {
      const mod = require(candidate) as { load?: (content: string) => unknown; default?: { load?: (content: string) => unknown } };
      const load = mod.load ?? mod.default?.load;
      if (typeof load === 'function') {
        return load;
      }
    } catch {
      // Try next candidate.
    }
  }

  console.warn('[loadConfigYaml] Could not resolve js-yaml from this service context.');
  return null;
}

/**
 * Loads config.yaml and populates process.env with the merged contents of
 * `systems.shared` and `systems.<serviceName>`.
 *
 * Only sets keys that are not already present in process.env so environment
 * variables from shell / Docker / CI always take precedence.
 *
 * If config.yaml cannot be found or parsed the function returns silently.
 *
 * Search order:
 *   1. Path in CONFIG_FILE environment variable.
 *   2. `config.yaml` in parent directories up to the specified depth level.
 *   3. `config.yaml` in current working directory.
 *   4. `config.yaml` one directory above current working directory.
 *
 * @param serviceName The key under `systems.<serviceName>` in config.yaml.
 * @param depthLevel The number of directories to traverse upwards when searching for config.yaml.
 */
export function loadConfigYaml(serviceName: string, depthLevel: number = 2): void {

  const candidates = [
    process.env['CONFIG_FILE'],
    resolve(process.cwd(), new Array(depthLevel).fill("..").join("/"), 'config.yaml'),
    resolve(process.cwd(), 'config.yaml'),
    resolve(process.cwd(), '..', 'config.yaml'),
  ].filter((p): p is string => typeof p === 'string');

  const configPath = candidates.find(existsSync);
  if (!configPath) return;

  const yamlLoad = resolveYamlLoad();
  if (!yamlLoad) return;

  try {
    const raw = yamlLoad(readFileSync(configPath, 'utf8'));
    if (typeof raw !== 'object' || raw === null) return;

    const systems = (raw as Record<string, unknown>)['systems'];
    if (typeof systems !== 'object' || systems === null) return;

    const systemsMap = systems as Record<string, Record<string, unknown> | undefined>;
    const merged: Record<string, unknown> = {
      ...(systemsMap['shared'] ?? {}),
      ...(systemsMap[serviceName] ?? {}),
    };

    for (const [key, value] of Object.entries(merged)) {
      if (process.env[key] === undefined && value !== null && value !== undefined) {
        process.env[key] = String(value);
      }
    }
  } catch (err) {
    console.warn(
      `[loadConfigYaml] Failed to load "${configPath}":`,
      err instanceof Error ? err.message : err,
    );
  }
}
