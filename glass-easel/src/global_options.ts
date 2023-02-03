import * as backend from './backend/backend_protocol'
import * as composedBackend from './backend/composed_backend_protocol'
import * as domlikeBackend from './backend/domlike_backend_protocol'
import {
  StyleScopeId,
  StyleScopeManager,
} from './class_list'
import {
  Context as BackendContext,
} from './backend/backend_protocol'
import {
  TemplateEngine,
} from './template_engine'
import {
  ComponentSpace,
} from './component_space'
import {
  GlassEaselTemplateEngine,
} from './tmpl'
import {
  GeneralComponent,
  GeneralBackendContext,
} from '.'
import {
  BM,
} from './backend/mode'

/**
 * The deep copy strategy
 *
 * Higher level indicates more accuracy but probably less performance.
 */
export enum DeepCopyKind {
  /**
   * Avoid deep copy
   *
   * This avoids any copy, and recursive objects can be handled without any failing.
   * However, changing non-copied data will sometimes break the logic.
   */
  None = 'none',
  /**
   * Do a simple deep copy
   *
   * This simply clones each enumerable fields in an object to a new object.
   * It causes stack overflow in recursive objects.
   * Everything in prototypes is ignored.
   */
  Simple = 'simple',
  /**
   * Do a deep copy with recursion detection
   *
   * This clones each enumerable fields in an object to a new object.
   * It can handle recursive objects by recursive detection.
   * Everything in prototypes is ignored.
   */
  SimpleWithRecursion = 'simple-recursion',
}

let defaultComponentSpace: ComponentSpace | null = null

export const getDefaultComponentSpace = (): ComponentSpace => {
  if (defaultComponentSpace) {
    return defaultComponentSpace
  }
  const cs = new ComponentSpace()
  defaultComponentSpace = cs
  return cs
}

let defaultBackendContext: GeneralBackendContext | null = null

export const getDefaultBackendContext = (): GeneralBackendContext => {
  if (defaultBackendContext) return defaultBackendContext
  let c: GeneralBackendContext
  if (BM.DOMLIKE) {
    c = new domlikeBackend.CurrentWindowBackendContext()
  } else if (BM.COMPOSED) {
    c = new composedBackend.EmptyComposedBackendContext()
  } else {
    c = new backend.EmptyBackendContext()
  }
  defaultBackendContext = c
  return c
}

/**
 * Options for a component
 */
export type ComponentOptions = {
  /** Is external component or not */
  externalComponent?: boolean
  /** The template engine */
  templateEngine?: TemplateEngine
  /** The style scope */
  styleScope?: StyleScopeId
  /** An extra style scope assigned to the component */
  extraStyleScope?: StyleScopeId | null
  /** Enable multiple slots or not */
  multipleSlots?: boolean
  /** Enable dynamic slots or not */
  dynamicSlots?: boolean
  /** Write property values of components to backend with `setAttribute` */
  reflectToAttributes?: boolean
  /** Allow properties and methods to be able to visit directly in component instance */
  writeFieldsToNode?: boolean
  /** Write node ID to backend node */
  writeIdToDOM?: boolean
  /** Generate a prefix for ID written to backend node */
  idPrefixGenerator?: ((this: GeneralComponent) => string) | null
  /** Filter some fields out when applying to templates */
  pureDataPattern?: RegExp | null
  /** Decide how to deep copy component data when updates */
  dataDeepCopy?: DeepCopyKind
  /** Decide how to deep copy when a property changes */
  propertyPassingDeepCopy?: DeepCopyKind
  /** Enable listener change events or not */
  listenerChangeLifetimes?: boolean
  /** Component host node is virtual or not */
  virtualHost?: boolean
  /** Init component with property values or not */
  propertyEarlyInit?: boolean
}

export type NormalizedComponentOptions = {
  externalComponent: boolean
  templateEngine: TemplateEngine
  styleScope: StyleScopeId
  extraStyleScope: StyleScopeId | null
  multipleSlots: boolean
  dynamicSlots: boolean
  reflectToAttributes: boolean
  writeFieldsToNode: boolean
  writeIdToDOM: boolean
  idPrefixGenerator: ((this: GeneralComponent) => string) | null
  pureDataPattern: RegExp | null
  dataDeepCopy: DeepCopyKind
  propertyPassingDeepCopy: DeepCopyKind
  listenerChangeLifetimes: boolean
  virtualHost: boolean
  propertyEarlyInit: boolean
}

/**
 * Options for global environment
 */
export type EnvironmentOptions = {
  /** The default component space */
  defaultComponentSpace: ComponentSpace | null
  /** Throw errors when errors caught in event callbacks (useful in testing scripts) */
  throwGlobalError: boolean
  /** Write some extra attributes to DOM backend (for testing) */
  writeExtraInfoToAttr: boolean
  /** The default backend context */
  backendContext: BackendContext | null
}

/**
 * The default options
 */
export const globalOptions: NormalizedComponentOptions & EnvironmentOptions = {
  defaultComponentSpace: null,
  externalComponent: false,
  templateEngine: new GlassEaselTemplateEngine(),
  styleScope: StyleScopeManager.globalScope(),
  extraStyleScope: null,
  multipleSlots: false,
  dynamicSlots: false,
  reflectToAttributes: false,
  writeFieldsToNode: true,
  writeIdToDOM: false,
  idPrefixGenerator: null,
  pureDataPattern: null,
  dataDeepCopy: DeepCopyKind.Simple,
  propertyPassingDeepCopy: DeepCopyKind.Simple,
  listenerChangeLifetimes: false,
  virtualHost: false,
  propertyEarlyInit: false,
  throwGlobalError: false,
  writeExtraInfoToAttr: false,
  backendContext: null,
}

export const normalizeComponentOptions = (
  componentOptions: ComponentOptions | undefined,
  baseComponentOptions?: NormalizedComponentOptions,
): NormalizedComponentOptions => {
  const b = baseComponentOptions === undefined ? globalOptions : baseComponentOptions
  if (componentOptions === undefined && b !== globalOptions) {
    return b
  }
  const p = componentOptions ?? {}
  return {
    externalComponent: p.externalComponent !== undefined
      ? p.externalComponent
      : b.externalComponent,
    templateEngine: p.templateEngine !== undefined
      ? p.templateEngine
      : b.templateEngine,
    styleScope: p.styleScope !== undefined
      ? p.styleScope
      : b.styleScope,
    extraStyleScope: p.extraStyleScope !== undefined
      ? p.extraStyleScope
      : b.extraStyleScope,
    multipleSlots: p.multipleSlots !== undefined
      ? p.multipleSlots
      : b.multipleSlots,
    dynamicSlots: p.dynamicSlots !== undefined
      ? p.dynamicSlots
      : b.dynamicSlots,
    reflectToAttributes: p.reflectToAttributes !== undefined
      ? p.reflectToAttributes
      : b.reflectToAttributes,
    writeFieldsToNode: p.writeFieldsToNode !== undefined
      ? p.writeFieldsToNode
      : b.writeFieldsToNode,
    writeIdToDOM: p.writeIdToDOM !== undefined
      ? p.writeIdToDOM
      : b.writeIdToDOM,
    idPrefixGenerator: p.idPrefixGenerator !== undefined
      ? p.idPrefixGenerator
      : b.idPrefixGenerator,
    pureDataPattern: p.pureDataPattern !== undefined
      ? p.pureDataPattern
      : b.pureDataPattern,
    dataDeepCopy: p.dataDeepCopy !== undefined
      ? p.dataDeepCopy
      : b.dataDeepCopy,
    propertyPassingDeepCopy: p.propertyPassingDeepCopy !== undefined
      ? p.propertyPassingDeepCopy
      : b.propertyPassingDeepCopy,
    listenerChangeLifetimes: p.listenerChangeLifetimes !== undefined
      ? p.listenerChangeLifetimes
      : b.listenerChangeLifetimes,
    virtualHost: p.virtualHost !== undefined
      ? p.virtualHost
      : b.virtualHost,
    propertyEarlyInit: p.propertyEarlyInit !== undefined
      ? p.propertyEarlyInit
      : b.propertyEarlyInit,
  }
}
