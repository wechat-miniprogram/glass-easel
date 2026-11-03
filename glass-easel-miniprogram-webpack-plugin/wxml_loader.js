const path = require('path')
const { escapeJsString } = require('./helpers')

module.exports = function (src, prevMap, meta) {
  const { addTemplate } = this.query
  const { compPath, deps, scriptDeps, codeRoot } = addTemplate(src, this.currentModule)
  const requires = deps
    .map((x) => {
      const p = path.join(codeRoot, `${x}.wxml`)
      return `require('${escapeJsString(p)}');`
    })
    .concat(
      scriptDeps.map((x) => {
        // script dependencies (wxs) are resolved without the `.wxs` suffix
        const p = x.endsWith('.wxs') ? path.join(codeRoot, x) : path.join(codeRoot, `${x}.wxs`)
        return `require('${escapeJsString(p)}');`
      }),
    )
  return `
    ${requires.join('')}
    module.exports = '${escapeJsString(compPath)}'
  `
}
