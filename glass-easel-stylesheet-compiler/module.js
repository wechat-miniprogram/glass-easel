import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as bg from './pkg/glass_easel_stylesheet_compiler_bg.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const bytes = fs.readFileSync(
  path.resolve(__dirname, './pkg/glass_easel_stylesheet_compiler_bg.wasm'),
)

const wasmModule = new WebAssembly.Module(bytes)
const wasmInstance = new WebAssembly.Instance(wasmModule, {
  './glass_easel_stylesheet_compiler_bg.js': bg,
})

bg.__wbg_set_wasm(wasmInstance.exports)

export * from './pkg/glass_easel_stylesheet_compiler_bg.js'
