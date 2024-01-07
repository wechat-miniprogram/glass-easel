/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type LoaderContext } from 'webpack'
import { type RawSourceMap, SourceMapGenerator, SourceMapConsumer } from 'source-map'
import { StyleSheetTransformer } from 'glass-easel-stylesheet-compiler'

export interface AdditionalData {
  [index: string]: any
  webpackAST: object
}

export interface WxssLoaderOptions {
  classPrefix: string
}

export default function (
  this: LoaderContext<WxssLoaderOptions>,
  source: string,
  prevMap: RawSourceMap,
  meta: AdditionalData,
) {
  const context = this
  const callback = context.async()
  const { classPrefix } = context.query as WxssLoaderOptions
  const sst = new StyleSheetTransformer(context.resourcePath, source, classPrefix, 750)
  const ss = sst.getContent()
  let map
  if (context.sourceMap) {
    const ssSourceMap = JSON.parse(sst.toSourceMap())
    if (prevMap) {
      const destConsumer = new SourceMapConsumer(ssSourceMap)
      const srcConsumer = new SourceMapConsumer(prevMap)
      Promise.all([destConsumer, srcConsumer])
        .then(([destConsumer, srcConsumer]) => {
          const gen = SourceMapGenerator.fromSourceMap(destConsumer)
          gen.applySourceMap(srcConsumer, context.resourcePath)
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
