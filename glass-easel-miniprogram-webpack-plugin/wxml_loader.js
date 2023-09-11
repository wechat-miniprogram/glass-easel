const { escapeJsString } = require('./helpers')

module.exports = function (src, prevMap, meta) {
  const { compPath } = this.query
  return `
    // build time ${new Date().getTime()}
    module.exports = '${escapeJsString(compPath)}'
  `
}
