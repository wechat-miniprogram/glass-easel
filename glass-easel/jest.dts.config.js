module.exports = {
  displayName: {
    color: 'blue',
    name: 'types',
  },
  roots: ['tests'],
  runner: 'jest-runner-tsd',
  testMatch: ['**/types/**/?(*.)+(spec|test).[jt]s?(x)'],
}
