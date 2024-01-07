import path from 'path'
import { type LoaderContext } from 'webpack'
import { escapeJsString } from './helpers'

export interface WxmlLoaderOptions {
  addTemplate: (source: string) => {
    compPath: string
    deps: string[]
    codeRoot: string
  }
}

export default function (this: LoaderContext<WxmlLoaderOptions>, source: string) {
  const { addTemplate } = this.query as WxmlLoaderOptions
  const { compPath, deps, codeRoot } = addTemplate(source)
  const requires = deps.map((x) => {
    const p = path.join(codeRoot, `${x}.wxml`)
    return `require('${escapeJsString(p)}');`
  })
  return `
    ${requires.join('')}
    module.exports = '${escapeJsString(compPath)}'
  `
}
