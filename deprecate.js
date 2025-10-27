/* eslint-disable no-console */

const childProcess = require('child_process')

// check arguments
const version = process.argv[2]
if (!version) {
  throw new Error('version not given in argv')
}
if (!/[0-9]+\.[0-9]+\.[0-9]+/.test(version)) {
  throw new Error('version illegal')
}
const message = process.argv[3]
if (!message) {
  throw new Error('message not given in argv')
}

// npm deprecate
;[
  'glass-easel-template-compiler',
  'glass-easel-stylesheet-compiler',
  'glass-easel',
  'glass-easel-miniprogram-adapter',
  'glass-easel-miniprogram-webpack-plugin',
  'glass-easel-miniprogram-typescript',
  'glass-easel-miniprogram-template',
  'glass-easel-shadow-sync',
].forEach((p) => {
  console.info(`Deprecate ${p}@${version} on npmjs`)
  if (
    childProcess.spawnSync(
      'npm',
      ['deprecate', `${p}@${version}`, message, '--registry', 'https://registry.npmjs.org'],
      { stdio: 'inherit' },
    ).status !== 0
  ) {
    throw new Error('failed to deprecate')
  }
})

// cargo yank
;['glass-easel-template-compiler', 'glass-easel-stylesheet-compiler'].forEach((p) => {
  console.info(`Deprecate ${p}@${version} on crates.io`)
  if (
    childProcess.spawnSync('cargo', ['yank', '--version', `${version}`, `${p}`], {
      stdio: 'inherit',
    }).status !== 0
  ) {
    throw new Error('failed to deprecate')
  }
})
