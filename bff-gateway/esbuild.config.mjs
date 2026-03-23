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
  alias: {
    '@shared/toolbox': resolve(__dirname, '../shared/Toolbox/src/index.ts'),
    '@elastic-resume-base/aegis': resolve(__dirname, '../shared/Aegis/src/index.ts'),
  },
  outfile: 'dist/server.js',
  sourcemap: true,
});
