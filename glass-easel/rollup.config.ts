/* eslint-disable import/no-extraneous-dependencies */
import nodeResolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import { ModuleFormat, RollupOptions } from 'rollup'
import dts from 'rollup-plugin-dts'

const jobs: string[] = []
let minimize = true
let sourcemap = true
let dev = false
const args = (process.env as { GLASS_EASEL_ARGS?: string }).GLASS_EASEL_ARGS || ''
args.split(' ').forEach((arg) => {
  if (!arg) return
  if (arg[0] === '-') {
    if (arg === '--no-minimize') minimize = false
    else if (arg === '--dev') {
      dev = true
      minimize = false
      sourcemap = false
    }
  } else {
    jobs.push(arg)
  }
})

const dtsCompilation: RollupOptions = {
  input: './src/index.ts',
  output: { file: `dist/glass_easel.d.ts`, format: 'es', name: 'glassEasel' },
  plugins: [
    nodeResolve({
      extensions: ['.ts', 'js'],
    }),
    dts(),
  ],
}

const genConfig = (
  type: 'dynamic' | 'shadow' | 'composed' | 'domlike',
  ext: string,
  format: ModuleFormat,
): RollupOptions => ({
  input: './src/index.ts',
  output: {
    file: `dist/glass_easel.${ext ? `${ext}.` : ''}js`,
    sourcemap,
    format,
    name: 'glassEasel',
  },
  plugins: [
    replace({
      values: {
        'ENV.DEV': JSON.stringify(dev),
        'BM.DYNAMIC': JSON.stringify(type === 'dynamic'),
        'BM.SHADOW': JSON.stringify(type === 'shadow'),
        'BM.COMPOSED': JSON.stringify(type === 'composed'),
        'BM.DOMLIKE': JSON.stringify(type === 'domlike'),
      },
      preventAssignment: true,
    }),
    nodeResolve({
      extensions: ['.ts', 'js'],
    }),
    typescript({
      sourceMap: sourcemap,
    }),
    minimize
      ? terser({
          sourceMap: sourcemap,
        })
      : null,
  ],
})

const config: RollupOptions[] = [dtsCompilation]

if (jobs.length) {
  jobs.forEach((name) => {
    const map = {
      all: () => genConfig('dynamic', 'all', 'cjs'),
      'all-es': () => genConfig('dynamic', 'all.es', 'es'),
      'all-global': () => genConfig('dynamic', 'all.global', 'iife'),
      shadow: () => genConfig('shadow', 'shadow', 'cjs'),
      'shadow-es': () => genConfig('shadow', 'shadow.es', 'es'),
      'shadow-global': () => genConfig('shadow', 'shadow.global', 'iife'),
      composed: () => genConfig('composed', 'composed', 'cjs'),
      'composed-es': () => genConfig('composed', 'composed.es', 'es'),
      'composed-global': () => genConfig('composed', 'composed.global', 'iife'),
      domlike: () => genConfig('domlike', 'domlike', 'cjs'),
      'domlike-es': () => genConfig('domlike', 'domlike.es', 'es'),
      'domlike-global': () => genConfig('domlike', 'domlike.global', 'iife'),
    } as Record<string, () => RollupOptions>
    if (!map[name]) throw new Error(`Unknown job: ${name}`)
    config.push(map[name]!())
  })
} else {
  config.push(genConfig('dynamic', 'all', 'cjs'), genConfig('dynamic', 'all.es', 'es'))
}

export default config
