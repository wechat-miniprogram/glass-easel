/* eslint-disable import/no-extraneous-dependencies */
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'
import terser from '@rollup/plugin-terser'

const config = [
  {
    input: './src/view_controller',
    output: [{ file: 'dist/view_controller.js', sourcemap: true, format: 'es' }],
    plugins: [
      nodeResolve({
        extensions: ['.ts', 'js'],
      }),
      typescript({
        sourceMap: true,
      }),
      terser({
        sourceMap: true,
      }),
    ],
  },
  {
    input: './src/view_controller',
    output: [{ file: 'dist/view_controller.d.ts', format: 'es' }],
    plugins: [
      nodeResolve({
        extensions: ['.ts', 'js'],
      }),
      dts(),
    ],
  },
  {
    input: './src/backend',
    output: [{ file: 'dist/backend.js', sourcemap: true, format: 'es' }],
    plugins: [
      nodeResolve({
        extensions: ['.ts', 'js'],
      }),
      typescript({
        sourceMap: true,
      }),
      terser({
        sourceMap: true,
      }),
    ],
  },
  {
    input: './src/backend',
    output: [{ file: 'dist/backend.d.ts', format: 'es' }],
    plugins: [
      nodeResolve({
        extensions: ['.ts', 'js'],
      }),
      dts(),
    ],
  },
]

export default config
