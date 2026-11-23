/* eslint-disable no-console */

const fs = require('fs')
const childProcess = require('child_process')

const writeFileAndGitAdd = (p, content) => {
  fs.writeFileSync(p, content)
  if (childProcess.spawnSync('git', ['add', p]).status !== 0) {
    throw new Error(`failed to execute git add on ${p}`)
  }
}

const readLineSync = () => {
  const buffer = Buffer.alloc(1)
  let line = ''
  while (fs.readSync(0, buffer, 0, 1, null) === 1) {
    const ch = buffer.toString('utf8')
    if (ch === '\n') break
    line += ch
  }
  return line.trim().toLowerCase()
}

// check git branch
const branchRes = childProcess.spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
  encoding: 'utf8',
})
if (branchRes.status !== 0) {
  throw new Error('failed to get current git branch')
}
const currentBranch = branchRes.stdout.trim()
if (currentBranch !== 'master') {
  throw new Error(`current git branch is "${currentBranch}" instead of "master"`)
}

// check arguments
const versionArg = process.argv[2]
if (!versionArg) {
  throw new Error('version not given in argv')
}

const currentVersion = JSON.parse(
  fs.readFileSync('glass-easel/package.json', { encoding: 'utf8' }),
).version

const bumpVersion = (base, part) => {
  const segments = base.split('.').map((s) => parseInt(s, 10))
  const index = { major: 0, minor: 1, patch: 2 }[part]
  segments[index] += 1
  for (let i = index + 1; i < segments.length; i += 1) {
    segments[i] = 0
  }
  return segments.join('.')
}

let version = versionArg
if (['major', 'minor', 'patch'].includes(versionArg)) {
  version = bumpVersion(currentVersion, versionArg)
} else if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(versionArg)) {
  throw new Error('version illegal')
}

// confirm publishing
console.info(
  `This script will update all package versions from "${currentVersion}" to "${version}", ` +
    `then commit the changes and tag them as "v${version}". ` +
    `It will also run cargo check, formatting, lint, build and tests before pushing the commit and the tag to origin. ` +
    `The remote CI workflow publishes the packages once the tag is pushed.`,
)
console.info(`Publish version "${version}"? Type "y" or "yes" to confirm.`)
const answer = readLineSync()
if (answer !== 'y' && answer !== 'yes') {
  throw new Error('publishing cancelled')
}

// avoid rust warnings
console.info('Run cargo check')
if (
  childProcess.spawnSync('cargo', ['check'], {
    env: { RUSTFLAGS: '-D warnings', ...process.env },
    stdio: 'inherit',
  }).status !== 0
) {
  throw new Error('failed to check rust modules (are there rust warnings or errors?)')
}

// force rust formatting
console.info('Run cargo fmt --check')
if (
  childProcess.spawnSync('cargo', ['fmt', '--check'], {
    stdio: 'inherit',
  }).status !== 0
) {
  throw new Error('failed to check formatting of rust modules')
}

// avoid eslint warnings
;[
  'glass-easel',
  'glass-easel-miniprogram-adapter',
  'glass-easel-miniprogram-typescript',
  'glass-easel-miniprogram-webpack-plugin',
  'glass-easel-shadow-sync',
].forEach((p) => {
  console.info(`Run eslint on ${p}`)
  if (
    childProcess.spawnSync('npx', ['eslint', '-c', '../.eslintrc.js', '.'], {
      cwd: p,
      stdio: 'inherit',
    }).status !== 0
  ) {
    throw new Error('failed to lint modules (are there eslint warnings or errors?)')
  }
})
console.info('Run eslint on glass-easel-miniprogram-template')
if (
  childProcess.spawnSync('npx', ['eslint', '-c', '.eslintrc.js', '.'], {
    cwd: 'glass-easel-miniprogram-template',
    stdio: 'inherit',
  }).status !== 0
) {
  throw new Error('failed to lint modules (are there eslint warnings or errors?)')
}

// check git status
const gitStatusRes = childProcess.spawnSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
if (gitStatusRes.status !== 0 || gitStatusRes.stdout.length > 0) {
  throw new Error('failed to check git status (are there uncommitted changes?)')
}

// change npm version
;[
  'glass-easel/package.json',
  'glass-easel-miniprogram-adapter/package.json',
  'glass-easel-miniprogram-typescript/package.json',
  'glass-easel-miniprogram-webpack-plugin/package.json',
  'glass-easel-miniprogram-template/package.json',
  'glass-easel-shadow-sync/package.json',
  'glass-easel-template-compiler/package.json',
  'glass-easel-stylesheet-compiler/package.json',
].forEach((p) => {
  let content = fs.readFileSync(p, { encoding: 'utf8' })
  let oldVersion
  content = content.replace(/"version": "(.+)"/, (_, v) => {
    oldVersion = v
    return `"version": "${version}"`
  })
  if (!oldVersion) {
    throw new Error(`version segment not found in ${p}`)
  }
  console.info(`Update ${p} version from "${oldVersion}" to "${version}"`)
  writeFileAndGitAdd(p, content)
})

// change cargo version
;['glass-easel-template-compiler/Cargo.toml', 'glass-easel-stylesheet-compiler/Cargo.toml'].forEach(
  (p) => {
    let content = fs.readFileSync(p, { encoding: 'utf8' })
    let oldVersion
    content = content.replace(/\nversion = "(.+)"/, (_, v) => {
      oldVersion = v
      return `\nversion = "${version}"`
    })
    if (!oldVersion) {
      throw new Error(`version segment not found in ${p}`)
    }
    console.info(`Update ${p} version from "${oldVersion}" to "${version}"`)
    writeFileAndGitAdd(p, content)
  },
)

// pnpm install
console.info('Run pnpm install')
if (childProcess.spawnSync('pnpm', ['install'], { stdio: 'inherit' }).status !== 0) {
  throw new Error('failed to pnpm install')
}

// generate cbindgen files for template compiler
console.info('Run cbindgen')
const cbindgenRes = childProcess.spawnSync('cbindgen', [], { cwd: 'glass-easel-template-compiler' })
if (cbindgenRes.status !== 0) {
  throw new Error('failed to execute cbindgen for the template compiler')
}
writeFileAndGitAdd(
  'glass-easel-template-compiler/glass_easel_template_compiler.h',
  cbindgenRes.stdout,
)

// run build
console.info('Run build')
if (
  childProcess.spawnSync('npm', ['run', 'build'], {
    env: { GLASS_EASEL_ARGS: '', ...process.env },
    stdio: 'inherit',
  }).status !== 0
) {
  throw new Error('failed to execute build')
}

// cargo test
console.info('Run cargo test')
if (childProcess.spawnSync('cargo', ['test'], { stdio: 'inherit' }).status !== 0) {
  throw new Error('failed to cargo test')
}

// npm test
console.info('Run pnpm test')
if (childProcess.spawnSync('pnpm', ['test', '-r'], { stdio: 'inherit' }).status !== 0) {
  throw new Error('failed to pnpm test')
}

// add lock files
;['Cargo.lock', 'pnpm-lock.yaml'].forEach((p) => {
  if (childProcess.spawnSync('git', ['add', p]).status !== 0) {
    throw new Error(`failed to execute git add on ${p}`)
  }
})

// git commit
if (
  childProcess.spawnSync('git', ['commit', '--message', `version: ${version}`], {
    stdio: 'inherit',
  }).status !== 0
) {
  throw new Error('failed to execute git commit')
}

// add a git tag and push
console.info('Push to git origin')
if (childProcess.spawnSync('git', ['tag', `v${version}`]).status !== 0) {
  throw new Error('failed to execute git tag')
}
if (childProcess.spawnSync('git', ['push'], { stdio: 'inherit' }).status !== 0) {
  throw new Error('failed to execute git push')
}
if (childProcess.spawnSync('git', ['push', '--tags'], { stdio: 'inherit' }).status !== 0) {
  throw new Error('failed to execute git push --tags')
}

console.info('Version updated! Wait the remote actions to build and publish.')
