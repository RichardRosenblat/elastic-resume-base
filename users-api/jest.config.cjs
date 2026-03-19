module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  // useESM: false (default) is intentional: jest.mock() hoisting is incompatible with ESM mode.
  // moduleNameMapper strips .js extensions so NodeNext imports resolve correctly in tests.
  // Local workspace packages (ESM) are mapped directly to their TypeScript sources so that
  // ts-jest can transpile them alongside the service code without ESM/CJS interop issues.
  // Toolbox's dependencies are mapped to this service's node_modules because Toolbox has no
  // node_modules of its own — its source files are imported directly.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: false }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@elastic-resume-base/synapse$': '<rootDir>/../shared/Synapse/src/index.ts',
    '^@elastic-resume-base/bugle$': '<rootDir>/../shared/Bugle/src/index.ts',
    '^@elastic-resume-base/bowltie$': '<rootDir>/../shared/Bowltie/src/index.ts',
    '^pino$': '<rootDir>/node_modules/pino',
    '^js-yaml$': '<rootDir>/node_modules/js-yaml',
    '^@google-cloud/pino-logging-gcp-config$': '<rootDir>/node_modules/@google-cloud/pino-logging-gcp-config',
  },
};
