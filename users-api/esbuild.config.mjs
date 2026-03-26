import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // Keep all npm packages as external so node_modules/ is used at runtime.
  // This avoids bundling packages that rely on native add-ons or dynamic
  // require() calls (e.g. firebase-admin, @fastify/swagger-ui).
  packages: 'external',
  outfile: 'dist/server.js',
  sourcemap: true,
});
