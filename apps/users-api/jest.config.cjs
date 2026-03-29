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
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: false }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^js-yaml$': '<rootDir>/node_modules/js-yaml',
    '^@elastic-resume-base/bugle$': '<rootDir>/../../shared/Bugle/v1/bugle_ts/src/index.ts',
    '^@elastic-resume-base/bowltie$': '<rootDir>/../../shared/Bowltie/v1/bowltie_ts/src/index.ts',
    '^@elastic-resume-base/synapse$': '<rootDir>/../../shared/Synapse/v1/synapse_ts/src/index.ts',
    '^@shared/toolbox$': '<rootDir>/../../shared/Toolbox/v1/toolbox_ts/src/index.ts',
  },
};
