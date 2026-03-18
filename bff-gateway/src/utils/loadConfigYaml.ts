import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

/**
 * Loads config.yaml and populates process.env with the merged contents of
 * `systems.shared` and `systems.<serviceName>`.
 *
 * Only sets keys that are **not** already present in process.env, so
 * environment variables supplied by the shell, Docker, or a test harness
 * always take precedence.
 *
 * If config.yaml cannot be found or parsed the function returns silently,
 * allowing the service to fall back to whatever process.env already contains
 * (Zod defaults, test fixtures, CI secrets, etc.).
 *
 * Search order:
 *   1. Path in the CONFIG_FILE environment variable (explicit override).
 *   2. `config.yaml` in the current working directory — matches when running
 *      from the monorepo root or inside a Docker container whose WORKDIR is
 *      the repo root (e.g. `/app/config.yaml` via a volume mount).
 *   3. `config.yaml` one directory above the current working directory —
 *      matches when running `npm run dev` from inside the service directory.
 *
 * @param serviceName - The key under `systems.<serviceName>` in config.yaml.
 */
export function loadConfigYaml(serviceName: string): void {
  const candidates = [
    process.env['CONFIG_FILE'],
    resolve(process.cwd(), 'config.yaml'),
    resolve(process.cwd(), '..', 'config.yaml'),
  ].filter((p): p is string => typeof p === 'string');

  const configPath = candidates.find(existsSync);
  if (!configPath) return;

  try {
    const raw = yaml.load(readFileSync(configPath, 'utf8'));
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
    // Malformed config.yaml — fall through to existing process.env values.
    // Use console.warn directly: the service logger depends on config being
    // loaded, so we cannot use it here without creating a circular dependency.
    console.warn(`[loadConfigYaml] Failed to load "${configPath}":`, err instanceof Error ? err.message : err);
  }
}
