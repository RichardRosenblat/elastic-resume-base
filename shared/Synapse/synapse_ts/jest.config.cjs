module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: false }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Resolve Toolbox source files for Jest (which bypasses esbuild)
    '^../../../Toolbox/toolbox_ts/src/(.*)$': '<rootDir>/../../Toolbox/toolbox_ts/src/$1',
  },
};