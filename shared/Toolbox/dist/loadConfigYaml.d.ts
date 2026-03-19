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
export declare function loadConfigYaml(serviceName: string): void;
//# sourceMappingURL=loadConfigYaml.d.ts.map