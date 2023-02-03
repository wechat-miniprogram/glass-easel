module.exports = {
  preset: 'ts-jest/presets/js-with-babel',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  roots: ['tests'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '!**/types/**'],
  testEnvironment: 'jsdom',
  "collectCoverageFrom": [
    "src/**/*.ts"
  ],
}
