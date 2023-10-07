module.exports = {
  preset: 'ts-jest/presets/js-with-babel',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  moduleNameMapper: {
    '^glass-easel$': '<rootDir>/../glass-easel/src',
  },
  roots: ['tests'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '!**/types/**'],
  testEnvironment: 'jsdom',
  collectCoverageFrom: ['src/**/*.ts'],
}
