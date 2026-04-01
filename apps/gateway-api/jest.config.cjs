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
    '^firebase-admin(.*)$': '<rootDir>/node_modules/firebase-admin$1',
    '^@elastic-resume-base/bowltie$': '<rootDir>/../../shared/Bowltie/v1/bowltie_ts/src/index.ts',
    '^@elastic-resume-base/aegis/server$': '<rootDir>/../../shared/Aegis/v2/aegis_ts/src/server.ts',
    '^@elastic-resume-base/aegis/client$': '<rootDir>/../../shared/Aegis/v2/aegis_ts/src/client.ts',
    '^@elastic-resume-base/aegis$': '<rootDir>/../../shared/Aegis/v2/aegis_ts/src/server.ts',
    '^@elastic-resume-base/harbor/server$': '<rootDir>/../../shared/Harbor/v2/harbor_ts/src/server.ts',
    '^@elastic-resume-base/harbor/client$': '<rootDir>/../../shared/Harbor/v2/harbor_ts/src/client.ts',
    '^@elastic-resume-base/harbor$': '<rootDir>/../../shared/Harbor/v2/harbor_ts/src/server.ts',
    '^axios$': '<rootDir>/node_modules/axios/dist/node/axios.cjs',
    '^@shared/toolbox$': '<rootDir>/../../shared/Toolbox/v1/toolbox_ts/src/index.ts',
  },
};
