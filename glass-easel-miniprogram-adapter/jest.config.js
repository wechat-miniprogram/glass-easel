module.exports = {
  preset: 'ts-jest/presets/js-with-babel',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  roots: ['tests'],
  testEnvironment: 'jsdom',
  collectCoverageFrom: ['src/**/*.ts'],
}
