/* eslint-disable import/no-extraneous-dependencies */
import nodeResolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import type { RollupOptions } from 'rollup'
import dts from 'rollup-plugin-dts'

const jobs: string[] = []
let minimize = true
let sourcemap = true
const args = (process.env as { GLASS_EASEL_ARGS?: string }).GLASS_EASEL_ARGS || ''
args.split(' ').forEach((arg) => {
  if (!arg) return
  if (arg[0] === '-') {
    if (arg === '--no-minimize') minimize = false
    else if (arg === '--dev') {
      minimize = false
      sourcemap = false
    }
  } else {
    jobs.push(arg)
  }
})

const config: RollupOptions[] = [
  {
    input: './src/index.ts',
    external: ['glass-easel'],
    output: {
      file: 'dist/glass_easel_miniprogram_adapter.js',
      sourcemap,
      format: 'cjs',
    },
    plugins: [
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
  },
  {
    input: './src/index.ts',
    external: ['glass-easel'],
    output: {
      file: 'dist/glass_easel_miniprogram_adapter.es.js',
      sourcemap,
      format: 'es',
    },
    plugins: [
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
  },
  {
    input: './src/index.ts',
    external: ['glass-easel'],
    output: { file: `dist/glass_easel_miniprogram_adapter.d.ts`, format: 'es' },
    plugins: [
      nodeResolve({
        extensions: ['.ts', 'js'],
      }),
      dts(),
    ],
  },
]

export default config
