import * as bg from './pkg/glass_easel_stylesheet_compiler_bg.js'
import wasmB64 from './pkg/glass_easel_stylesheet_compiler_bg.wasm'

const wasmBuffer = Uint8Array.from(atob(wasmB64), (c) => c.charCodeAt(0)); // Convert base64 to Uint8Array.

const wasmModule = new WebAssembly.Module(wasmBuffer)
const wasmInstance = new WebAssembly.Instance(wasmModule, {
  './glass_easel_stylesheet_compiler_bg.js': bg,
})

bg.__wbg_set_wasm(wasmInstance.exports)

export * from './pkg/glass_easel_stylesheet_compiler_bg.js'
