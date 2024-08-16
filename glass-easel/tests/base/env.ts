/* eslint-disable no-new-func */
/* eslint-disable @typescript-eslint/no-implied-eval */

// eslint-disable-next-line import/no-extraneous-dependencies
import { TmplGroup } from 'glass-easel-template-compiler'
import * as glassEasel from '../../src'
import * as ComposedBackend from './composed_backend'
import * as ShadowBackend from './shadow_backend'

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

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query as unknown,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

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

type FilterFuncs = {
  A?: glassEasel.template.ChangePropFilter
  B?: glassEasel.template.EventListenerWrapper
}

export const tmpl = (src: string, options?: TemplateOptions, filterFuncs?: FilterFuncs) => {
  const group = TmplGroup.newDev()
  if (filterFuncs !== undefined) {
    const A = filterFuncs.A || (() => {})
    const B = filterFuncs.B || (() => {})
    group.setFilterFuncs(`{A:${A.toString()},B:${B.toString()}}`)
  }
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
export const shadowBackend = new ShadowBackend.Context()
export const composedBackend = new ComposedBackend.Context()

export const getCustomExternalTemplateEngine = (
  createExternalShadowRoot: (comp: glassEasel.GeneralComponent) => glassEasel.ExternalShadowRoot,
) => {
  class CustomExternalTemplateEngine implements glassEasel.templateEngine.Template {
    static create() {
      return new CustomExternalTemplateEngine()
    }

    // eslint-disable-next-line class-methods-use-this
    createInstance(comp: glassEasel.GeneralComponent): glassEasel.templateEngine.TemplateInstance {
      return new EmptyTemplateInstance(comp, createExternalShadowRoot(comp))
    }
  }

  class EmptyTemplateInstance implements glassEasel.templateEngine.TemplateInstance {
    comp: glassEasel.GeneralComponent
    shadowRoot: glassEasel.ExternalShadowRoot

    constructor(comp: glassEasel.GeneralComponent, shadowRoot: glassEasel.ExternalShadowRoot) {
      this.comp = comp
      this.shadowRoot = shadowRoot
    }

    // eslint-disable-next-line class-methods-use-this
    initValues() {
      // empty
    }

    // eslint-disable-next-line class-methods-use-this
    updateValues() {
      // empty
    }
  }

  return CustomExternalTemplateEngine
}
