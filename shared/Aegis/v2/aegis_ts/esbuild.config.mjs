import { build } from 'esbuild';

// Server-side bundle (firebase-admin, Node.js)
await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
});

// Client-side bundle (firebase browser SDK)
await build({
  entryPoints: ['src/client.ts'],
  outfile: 'dist/client.js',
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
});
