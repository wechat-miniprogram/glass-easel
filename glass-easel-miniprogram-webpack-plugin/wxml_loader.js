const path = require('path')
const { escapeJsString } = require('./helpers')

module.exports = function (src, prevMap, meta) {
  const { addTemplate } = this.query
  const { compPath, deps, codeRoot } = addTemplate(src, this.currentModule)
  const requires = deps.map((x) => {
    const p = path.join(codeRoot, `${x}.wxml`)
    return `require('${escapeJsString(p)}');`
  })
  return `
    ${requires.join('')}
    module.exports = '${escapeJsString(compPath)}'
  `
}
