/**
 * @file vite.config.ts — Vite + Vitest configuration.
 *
 * In addition to standard Vite/Vitest settings, this file includes a
 * lightweight plugin that reads the monorepo-wide `config.yaml` (one
 * directory above `frontend/`) and injects the `systems.frontend` VITE_*
 * variables so the dev server and test runner behave exactly as they would
 * with a fully configured deployment — no separate `.env.local` file needed.
 *
 * How it works
 * ────────────
 * 1. `loadConfigYamlEnv()` reads `../config.yaml`, merges `systems.shared`
 *    with `systems.frontend`, and returns the VITE_*-prefixed entries.
 * 2. Each entry is written to `process.env` (so Vite's normal env pipeline
 *    picks them up for dev/build) AND to `test.env` (so Vitest populates
 *    `import.meta.env` inside each test worker correctly).
 * 3. Keys already in `process.env` (shell variables, Docker `ARG`/`ENV`)
 *    are never overwritten — those always take highest priority.
 *
 * Priority (highest → lowest):
 *   1. Shell / CI / Docker env vars (set before `vite` runs)
 *   2. `config.yaml` `systems.frontend` + `systems.shared`
 *   3. Vite `.env` / `.env.local` files  (optional per-developer overrides)
 *   4. Fallback defaults in `src/config.ts`
 *
 * SEPARATION OF CONCERNS
 * ──────────────────────
 *   • Operational / infrastructure config  → `config.yaml`  (systems.frontend)
 *   • Appearance (colours, fonts, branding) → `src/theme/theme.json`
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import jsyaml from 'js-yaml';

// ---------------------------------------------------------------------------
// config.yaml loader
// ---------------------------------------------------------------------------

/**
 * Reads the monorepo `config.yaml`, merges `systems.shared` with
 * `systems.frontend`, and returns only the `VITE_`-prefixed entries.
 *
 * Mirrors the `loadConfigYaml` logic used by bff-gateway and users-api so
 * that a single `config.yaml` at the repo root is the authoritative source
 * for every service.
 *
 * @returns A flat `{ VITE_FOO: "bar" }` record, or `{}` when config.yaml
 *   cannot be found or parsed.
 */
function loadConfigYamlEnv(): Record<string, string> {
  const candidates = [
    // 1. Explicit override (useful in CI / custom setups)
    process.env['CONFIG_FILE'],
    // 2. Monorepo root — running `npm run dev` from inside `frontend/`
    resolve(import.meta.dirname, '..', 'config.yaml'),
    // 3. Same directory — running `vite` from the repo root
    resolve(import.meta.dirname, 'config.yaml'),
  ].filter((p): p is string => typeof p === 'string');

  const configPath = candidates.find(existsSync);
  if (!configPath) return {};

  try {
    const raw = jsyaml.load(readFileSync(configPath, 'utf8'));
    if (typeof raw !== 'object' || raw === null) return {};

    const systems = (raw as Record<string, unknown>)['systems'];
    if (typeof systems !== 'object' || systems === null) return {};

    const systemsMap = systems as Record<string, Record<string, unknown> | undefined>;
    const merged: Record<string, unknown> = {
      ...(systemsMap['shared'] ?? {}),
      ...(systemsMap['frontend'] ?? {}),
    };

    if (
      merged['VITE_FIREBASE_AUTH_EMULATOR_HOST'] === undefined
      && typeof merged['FIREBASE_AUTH_EMULATOR_HOST'] === 'string'
    ) {
      merged['VITE_FIREBASE_AUTH_EMULATOR_HOST'] = merged['FIREBASE_AUTH_EMULATOR_HOST'];
    }

    return Object.fromEntries(
      Object.entries(merged)
        .filter(([k]) => k.startsWith('VITE_'))
        .map(([k, v]) => [k, String(v)]),
    );
  } catch (err) {
    // Malformed config.yaml — fall through to Vite's normal env loading.
    console.warn(
      '[vite] Failed to load config.yaml:',
      err instanceof Error ? err.message : err,
    );
    return {};
  }
}

// ---------------------------------------------------------------------------
// Populate env from config.yaml
//
// Only set keys absent from process.env so shell / Docker env vars always
// take highest priority (mirrors the backend loadConfigYaml behaviour).
// ---------------------------------------------------------------------------
const yamlEnv = loadConfigYamlEnv();
const envFromYaml: Record<string, string> = {};

for (const [key, value] of Object.entries(yamlEnv)) {
  if (process.env[key] === undefined) {
    // For Vite dev/build: Vite includes process.env VITE_* in import.meta.env
    process.env[key] = value;
    // Collect separately so we can also pass to Vitest's test.env below
    envFromYaml[key] = value;
  }
}

// ---------------------------------------------------------------------------
// Vite / Vitest config
// ---------------------------------------------------------------------------
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        '../shared', // Allows Vite to read custom Aegis library
        '.'          // Keeps allowing current frontend directory
      ]
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    /**
     * Inject VITE_* values from config.yaml into each Vitest worker's
     * `import.meta.env`.  This is the correct Vitest-native mechanism and
     * avoids conflicts with Vitest's own `import.meta.env` transformation.
     */
    env: envFromYaml,
  },
});

