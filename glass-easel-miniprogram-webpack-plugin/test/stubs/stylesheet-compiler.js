/* A lightweight stand-in for the WASM StyleSheetTransformer, so that the loaders can be
 * unit-tested without the Rust toolchain. */

class StyleSheetTransformer {
  constructor(resourcePath, src) {
    this.resourcePath = resourcePath
    this.src = src
    this.lowPriority = ''
    this.warnings = []
    this.freed = false
    StyleSheetTransformer.instances.push(this)
  }

  getContent() {
    return `/* transformed: ${this.src} */`
  }

  getSourceMap() {
    return JSON.stringify({
      version: 3,
      sources: [this.resourcePath],
      names: [],
      mappings: '',
    })
  }

  getLowPriorityContent() {
    return this.lowPriority
  }

  getLowPrioritySourceMap() {
    return this.lowPriority ? this.getSourceMap() : null
  }

  extractWarnings() {
    return this.warnings
  }

  free() {
    this.freed = true
  }
}

StyleSheetTransformer.instances = []

StyleSheetTransformer.reset = () => {
  StyleSheetTransformer.instances = []
}

module.exports = { StyleSheetTransformer }
