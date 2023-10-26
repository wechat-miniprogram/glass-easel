const path = require('node:path')
const fs = require('node:fs')
const { fileURLToPath } = require('node:url')
const bg = require('./pkg/glass_easel_template_compiler_bg.cjs.js')

const bytes = fs.readFileSync(
  path.resolve(__dirname, './pkg/glass_easel_template_compiler_bg.wasm'),
)

const wasmModule = new WebAssembly.Module(bytes)
const wasmInstance = new WebAssembly.Instance(wasmModule, {
  './glass_easel_template_compiler_bg.js': bg,
})

bg.__wbg_set_wasm(wasmInstance.exports)

module.exports = bg
