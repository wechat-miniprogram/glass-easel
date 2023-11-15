import { type GeneralBackendContext } from './backend'
import { type StyleScopeId } from './class_list'
import { type GeneralComponent } from './component'
import { type ComponentSpace } from './component_space'
import { type TemplateEngine } from './template_engine'

export const ENV = {
  DEV: !(typeof process && process.env.NODE_ENV === 'production'),
}

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

/**
 * Options for a component
 */
export type ComponentOptions = {
  /** Is external component or not */
  externalComponent?: boolean
  /** The host node tag name (only valid in external components) */
  hostNodeTagName?: string
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
  /** Enable direct slots or not */
  directSlots?: boolean
  /** Write property values of components to backend with `setAttribute` */
  reflectToAttributes?: boolean
  /** Allow properties and methods to be able to visit directly in component instance */
  writeFieldsToNode?: boolean
  /** Write node ID to backend node */
  writeIdToDOM?: boolean
  /** Use the methods in method caller as the event handlers or not */
  useMethodCallerListeners?: boolean
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
  hostNodeTagName: string
  templateEngine: TemplateEngine | null
  styleScope: StyleScopeId | null
  extraStyleScope: StyleScopeId | null
  multipleSlots: boolean
  dynamicSlots: boolean
  directSlots: boolean
  reflectToAttributes: boolean
  writeFieldsToNode: boolean
  writeIdToDOM: boolean
  useMethodCallerListeners: boolean
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
  backendContext: GeneralBackendContext | null
}

/**
 * The default options
 */
export const globalOptions: NormalizedComponentOptions & EnvironmentOptions = {
  defaultComponentSpace: null,
  externalComponent: false,
  templateEngine: null,
  styleScope: null,
  extraStyleScope: null,
  hostNodeTagName: 'wx-x',
  multipleSlots: false,
  dynamicSlots: false,
  directSlots: false,
  reflectToAttributes: false,
  writeFieldsToNode: true,
  writeIdToDOM: false,
  useMethodCallerListeners: false,
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
    externalComponent:
      p.externalComponent !== undefined ? p.externalComponent : b.externalComponent,
    templateEngine: p.templateEngine !== undefined ? p.templateEngine : b.templateEngine,
    styleScope: p.styleScope !== undefined ? p.styleScope : b.styleScope,
    hostNodeTagName: p.hostNodeTagName !== undefined ? p.hostNodeTagName : b.hostNodeTagName,
    extraStyleScope: p.extraStyleScope !== undefined ? p.extraStyleScope : b.extraStyleScope,
    multipleSlots: p.multipleSlots !== undefined ? p.multipleSlots : b.multipleSlots,
    dynamicSlots: p.dynamicSlots !== undefined ? p.dynamicSlots : b.dynamicSlots,
    directSlots: p.directSlots !== undefined ? p.directSlots : b.directSlots,
    reflectToAttributes:
      p.reflectToAttributes !== undefined ? p.reflectToAttributes : b.reflectToAttributes,
    writeFieldsToNode:
      p.writeFieldsToNode !== undefined ? p.writeFieldsToNode : b.writeFieldsToNode,
    writeIdToDOM: p.writeIdToDOM !== undefined ? p.writeIdToDOM : b.writeIdToDOM,
    useMethodCallerListeners:
      p.useMethodCallerListeners !== undefined
        ? p.useMethodCallerListeners
        : b.useMethodCallerListeners,
    idPrefixGenerator:
      p.idPrefixGenerator !== undefined ? p.idPrefixGenerator : b.idPrefixGenerator,
    pureDataPattern: p.pureDataPattern !== undefined ? p.pureDataPattern : b.pureDataPattern,
    dataDeepCopy: p.dataDeepCopy !== undefined ? p.dataDeepCopy : b.dataDeepCopy,
    propertyPassingDeepCopy:
      p.propertyPassingDeepCopy !== undefined
        ? p.propertyPassingDeepCopy
        : b.propertyPassingDeepCopy,
    listenerChangeLifetimes:
      p.listenerChangeLifetimes !== undefined
        ? p.listenerChangeLifetimes
        : b.listenerChangeLifetimes,
    virtualHost: p.virtualHost !== undefined ? p.virtualHost : b.virtualHost,
    propertyEarlyInit:
      p.propertyEarlyInit !== undefined ? p.propertyEarlyInit : b.propertyEarlyInit,
  }
}
