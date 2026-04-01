import { build } from 'esbuild';

// Server-side bundle (firebase-admin, Node.js)
await build({
  entryPoints: ['src/server/index.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
});

// Client-side bundle (firebase browser SDK)
await build({
  entryPoints: ['src/client/index.ts'],
  outfile: 'dist/client/index.js',
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
});
