import { build } from 'esbuild';
import { resolve } from 'node:path';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  packages: 'external',          // don't bundle firebase-admin, zod, etc.
  sourcemap: true,
  // Lets esbuild find Toolbox source files outside this package's directory
  nodePaths: [resolve('..'), resolve('node_modules')],
});
