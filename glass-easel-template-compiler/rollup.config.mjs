import { base64 } from 'rollup-plugin-base64'

const config = [
  {
    input: './module.js',
    output: [{ file: 'pkg/module.js', sourcemap: false, format: 'es' }],
    plugins: [
      base64({ include: ['**/*.wasm'] })
    ]
  },
  {
    input: './module.js',
    output: [{ file: 'pkg/main.js', sourcemap: false, format: 'cjs' }],
    plugins: [
      base64({ include: ['**/*.wasm'] })
    ]
  },
]

export default config
