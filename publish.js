/* eslint-disable no-console */

const fs = require('fs')
const childProcess = require('child_process')

const writeFileAndGitAdd = (p, content) => {
  fs.writeFileSync(p, content)
  if (childProcess.spawnSync('git', ['add', p]).status !== 0) {
    throw new Error(`failed to execute git add on ${p}`)
  }
}

// check arguments
const version = process.argv[2]
if (!version) {
  throw new Error('version not given in argv')
}
if (!/[0-9]+\.[0-9]+\.[0-9]+/.test(version)) {
  throw new Error('version illegal')
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
  const refVersions = []
  content = content.replace(/"version": "(.+)"/, (_, v) => {
    oldVersion = v
    return `"version": "${version}"`
  })
  if (!oldVersion) {
    throw new Error(`version segment not found in ${p}`)
  }
  console.info(`Update ${p} version from "${oldVersion}" to "${version}"`)
  refVersions.forEach(({ mod, v }) => {
    console.info(`  + dependency ${mod} version from "${v}" to "${version}"`)
  })
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
  throw new Error('failed to execute npm build')
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

// cargo publish
;['glass-easel-template-compiler', 'glass-easel-stylesheet-compiler'].forEach((p) => {
  console.info(`Publish ${p} to crates.io`)
  if (childProcess.spawnSync('cargo', ['publish', '-p', p], { stdio: 'inherit' }).status !== 0) {
    throw new Error('failed to publish Cargo crates')
  }
})

// publish js modules
;[
  'glass-easel',
  'glass-easel-miniprogram-adapter',
  'glass-easel-miniprogram-typescript',
  'glass-easel-miniprogram-webpack-plugin',
  'glass-easel-miniprogram-template',
  'glass-easel-shadow-sync',
  'glass-easel-template-compiler',
  'glass-easel-stylesheet-compiler',
].forEach((p) => {
  console.info(`Publish ${p} to npmjs`)
  if (
    childProcess.spawnSync('pnpm', ['publish', '--registry', 'https://registry.npmjs.org'], {
      cwd: p,
      stdio: 'inherit',
    }).status !== 0
  ) {
    throw new Error('failed to publish NPM modules')
  }
})

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

console.info('All done!')
