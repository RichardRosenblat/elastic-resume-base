import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadConfigYaml } from '../shared/Toolbox/src/loadConfigYaml.ts';

/**
 * Frontend runtime config is loaded from monorepo config.yaml via Toolbox,
 * mirroring the backend services' environment-loading strategy.
 */
loadConfigYaml('frontend');

/**
 * The frontend consumes VITE_* variables, but project ID is now centralized as
 * FIREBASE_PROJECT_ID under systems.shared. Derive the VITE alias when needed.
 */
if (
  process.env['VITE_FIREBASE_PROJECT_ID'] === undefined
  && typeof process.env['FIREBASE_PROJECT_ID'] === 'string'
) {
  process.env['VITE_FIREBASE_PROJECT_ID'] = process.env['FIREBASE_PROJECT_ID'];
}

if (
  process.env['VITE_FIREBASE_AUTH_EMULATOR_HOST'] === undefined
  && typeof process.env['FIREBASE_AUTH_EMULATOR_HOST'] === 'string'
) {
  process.env['VITE_FIREBASE_AUTH_EMULATOR_HOST'] = process.env['FIREBASE_AUTH_EMULATOR_HOST'];
}

if (
  process.env['VITE_FIREBASE_AUTH_DOMAIN'] === undefined
  && typeof process.env['FIREBASE_AUTH_DOMAIN'] === 'string'
  && process.env['FIREBASE_AUTH_DOMAIN'] !== ''
) {
  process.env['VITE_FIREBASE_AUTH_DOMAIN'] = process.env['FIREBASE_AUTH_DOMAIN'];
}

function collectViteEnv(): Record<string, string> {
  const entries = Object.entries(process.env)
    .filter(([key, value]) => key.startsWith('VITE_') && typeof value === 'string')
    .map(([key, value]) => [key, value as string]);

  return Object.fromEntries(entries);
}

const viteEnv = collectViteEnv();

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        '../shared',
        '.',
      ],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    env: viteEnv,
  },
});
