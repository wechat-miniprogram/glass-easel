/* eslint-disable no-new-func */
/* eslint-disable @typescript-eslint/no-implied-eval */

import { TmplGroup } from 'glass-easel-template-compiler'
import * as glassEasel from '../../src'

glassEasel.globalOptions.throwGlobalError = true
const warningThrow = (msg: string) => {
  throw new Error(msg)
}
glassEasel.addGlobalWarningListener(warningThrow)

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
;(glassEasel.Element.prototype as any).toJSON = function () {
  return `[GlassEaselElement ${glassEasel.dumpSingleElementToString(this)}]`
}
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
;(glassEasel.TextNode.prototype as any).toJSON = function () {
  return `[GlassEaselTextNode ${glassEasel.dumpSingleElementToString(this)}]`
}

export const execWithWarn = <T>(expectCount: number, func: () => T): T => {
  let count = 0
  const warningListener = () => {
    count += 1
    return false
  }
  glassEasel.removeGlobalWarningListener(warningThrow)
  glassEasel.addGlobalWarningListener(warningListener)
  const ret = func()
  glassEasel.removeGlobalWarningListener(warningListener)
  glassEasel.addGlobalWarningListener(warningThrow)
  expect(count).toBe(expectCount)
  return ret
}

type TemplateOptions = {
  updateMode?: string
  disallowNativeNode?: boolean
}

export const tmpl = (src: string, options?: TemplateOptions) => {
  const group = new TmplGroup()
  group.addTmpl('', src)
  const genObjectSrc = `return ${group.getTmplGenObjectGroups()}`
  group.free()
  // console.info(genObjectSrc)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const genObjectGroupList = (new Function(genObjectSrc))() as { [key: string]: any }
  return {
    groupList: genObjectGroupList,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    content: genObjectGroupList[''],
    ...options,
  }
}

export const multiTmpl = (src: { [path: string]: string }, options?: TemplateOptions) => {
  const group = new TmplGroup()
  Object.keys(src).forEach((path) => {
    if (path.endsWith('.wxs')) {
      group.addScript(path.slice(0, -4), src[path]!)
    } else {
      group.addTmpl(path, src[path]!)
    }
  })
  const genObjectSrc = `return ${group.getTmplGenObjectGroups()}`
  group.free()
  // console.info(genObjectSrc)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const genObjectGroupList = (new Function(genObjectSrc))() as { [key: string]: any }
  return {
    groupList: genObjectGroupList,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    content: genObjectGroupList[''],
    ...options,
  }
}

export const domBackend = new glassEasel.domlikeBackend.CurrentWindowBackendContext()
export const shadowBackend = new glassEasel.backend.EmptyBackendContext()
export const composedBackend = new glassEasel.composedBackend.EmptyComposedBackendContext()
