import { build } from 'esbuild';

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
  outfile: 'dist/server.js',
  sourcemap: true,
});
