/* eslint-disable */

const { SourceMapGenerator, SourceMapConsumer } = require('source-map')
const { StyleSheetTransformer } = require('glass-easel-stylesheet-compiler')

module.exports = function (src, prevMap, meta) {
  const callback = this.async()
  const { classPrefix, compPath, setLowPriorityStyles } = this.query
  const sst = new StyleSheetTransformer(this.resourcePath, src, classPrefix, 750, compPath)
  setLowPriorityStyles(sst.getLowPriorityContent(), sst.getLowPrioritySourceMap())
  const ss = sst.getContent()
  let map
  if (this.sourceMap) {
    const ssSourceMap = JSON.parse(sst.getSourceMap())
    sst.free()
    if (prevMap) {
      const destConsumer = new SourceMapConsumer(ssSourceMap)
      const srcConsumer = new SourceMapConsumer(prevMap)
      Promise.all([destConsumer, srcConsumer])
        .then(([destConsumer, srcConsumer]) => {
          const gen = SourceMapGenerator.fromSourceMap(destConsumer)
          gen.applySourceMap(srcConsumer, this.resourcePath)
          destConsumer.destroy()
          srcConsumer.destroy()
          map = gen.toJSON()
          callback(null, ss, map, meta)
          return undefined
        })
        .catch((err) => {
          callback(err)
        })
    } else {
      map = ssSourceMap
      callback(null, ss, map, meta)
    }
  }
}
