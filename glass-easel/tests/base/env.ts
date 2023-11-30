/* eslint-disable no-new-func */
/* eslint-disable @typescript-eslint/no-implied-eval */

import { TmplGroup } from 'glass-easel-template-compiler'
import * as glassEasel from '../../src'
import * as ComposedBackend from './composed_backend'

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

export const execWithError = <R>(func: () => R, ...errors: string[]): R | void => {
  let count = 0
  const errorListener = (err: unknown) => {
    if (count >= errors.length) return true // will throw
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe(errors[count])
    count += 1
    return false
  }
  glassEasel.addGlobalErrorListener(errorListener)
  try {
    return func()
  } catch (e) {
    errorListener(e)
    return undefined
  } finally {
    glassEasel.removeGlobalErrorListener(errorListener)
    expect(count).toBe(errors.length)
  }
}

type TemplateOptions = {
  updateMode?: string
  fallbackListenerOnNativeNode?: boolean
}

export const tmpl = (src: string, options?: TemplateOptions) => {
  const group = new TmplGroup()
  group.addTmpl('', src)
  const genObjectSrc = `return ${group.getTmplGenObjectGroups()}`
  group.free()
  // console.info(genObjectSrc)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const genObjectGroupList = new Function(genObjectSrc)() as { [key: string]: any }
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
  const genObjectGroupList = new Function(genObjectSrc)() as { [key: string]: any }
  return {
    groupList: genObjectGroupList,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    content: genObjectGroupList[''],
    ...options,
  }
}

export const domBackend = new glassEasel.CurrentWindowBackendContext()
export const shadowBackend = new glassEasel.EmptyBackendContext()
export const composedBackend = new ComposedBackend.Context()
