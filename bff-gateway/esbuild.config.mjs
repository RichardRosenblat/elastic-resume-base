import { build } from 'esbuild';
import { resolve } from 'node:path';

await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  // Keep all npm packages as external so node_modules/ is used at runtime.
  // This avoids bundling packages that rely on native add-ons or dynamic
  // require() calls (e.g. firebase-admin, @fastify/swagger-ui).
  packages: 'external',
  // Allow esbuild to find packages from this service's node_modules when
  // resolving imports that originate inside shared/Toolbox/src/ (which has no
  // node_modules of its own).
  nodePaths: [resolve('node_modules')],
  outfile: 'dist/server.js',
  sourcemap: true,
});
