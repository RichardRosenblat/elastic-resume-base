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
  // ts-jest can transpile them alongside the gateway code without ESM/CJS interop issues.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: false }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^js-yaml$': '<rootDir>/node_modules/js-yaml',
    '^firebase-admin(.*)$': '<rootDir>/../shared/Aegis/node_modules/firebase-admin$1',
    '^@elastic-resume-base/bowltie$': '<rootDir>/../shared/Bowltie/src/index.ts',
    '^@elastic-resume-base/aegis$': '<rootDir>/../shared/Aegis/src/index.ts',
    '^@shared/toolbox$': '<rootDir>/../shared/Toolbox/src/index.ts',
  },
};
