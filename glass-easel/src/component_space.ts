import {
  ComponentParams,
  DataList,
  PropertyList,
  MethodList,
  ComponentInstance,
  Empty,
} from './component_params'
import { Behavior, BehaviorBuilder, GeneralBehavior, NativeNodeDefinition } from './behavior'
import {
  ComponentDefinition,
  GeneralComponentDefinition,
  Component,
  GeneralComponent,
} from './component'
import {
  ComponentOptions,
  normalizeComponentOptions,
  NormalizedComponentOptions,
} from './global_options'
import { StyleScopeManager } from './class_list'
import { GeneralBackendContext } from '.'
import { TraitBehavior } from './trait_behaviors'

const normalizePath = (path: string, basePath: string): string => {
  let slices: string[]
  if (path[0] !== '/') {
    slices = basePath.split('/').slice(0, -1).concat(path.split('/'))
  } else {
    slices = path.split('/')
  }
  const finalSlices = [] as string[]
  for (let i = 0; i < slices.length; i += 1) {
    const slice = slices[i]!
    if (slice === '' || slice === '.') continue
    if (slice === '..') {
      finalSlices.pop()
      continue
    }
    finalSlices.push(slice)
  }
  return finalSlices.join('/')
}

export const normalizeUrl = (
  path: string,
  relPath: string,
): { domain: string | null; absPath: string } => {
  const protoSep = path.indexOf('://')
  if (protoSep > 0) {
    const domainSep = path.indexOf('/', protoSep + 3)
    if (domainSep > 0) {
      const domain = path.slice(0, domainSep)
      const absPath = normalizePath(path.slice(domainSep + 1), '')
      return {
        domain,
        absPath,
      }
    }
    // HACK for invalid URL like `a://the-comp` , provide some compatibility
    const domain = path.slice(0, protoSep + 3)
    const absPath = normalizePath(path.slice(protoSep + 3), '')
    return {
      domain,
      absPath,
    }
  }
  return {
    domain: null,
    absPath: normalizePath(path, relPath),
  }
}

export class ComponentWaitingList {
  /** @internal */
  private _$callbacks: ((c: GeneralComponentDefinition) => void)[] = []
  /** @internal */
  private _$ownerSpace: ComponentSpace
  /** @internal */
  private _$isPub: boolean
  /** @internal */
  private _$alias: string

  constructor(ownerSpace: ComponentSpace, isPub: boolean, alias: string) {
    this._$ownerSpace = ownerSpace
    this._$isPub = isPub
    this._$alias = alias
  }

  add(callback: (c: GeneralComponentDefinition) => void) {
    this._$callbacks.push(callback)
  }

  hintUsed() {
    this._$ownerSpace._$componentWaitingListener?.(this._$isPub, this._$alias)
  }

  remove(callback: (c: GeneralComponentDefinition) => void) {
    const index = this._$callbacks.indexOf(callback)
    // must gurrantee order here (cannot swap-remove)
    this._$callbacks.splice(index, 1)
  }

  call(c: GeneralComponentDefinition) {
    const cbs = this._$callbacks
    this._$callbacks = []
    for (let i = 0; i < cbs.length; i += 1) {
      const f = cbs[i]!
      f(c)
    }
  }
}

/** A group of components for cross-component using */
export class ComponentSpace {
  /** @internal */
  private _$behaviorList = Object.create(null) as { [path: string]: GeneralBehavior }
  /** @internal */
  private _$pubBehaviorList = Object.create(null) as { [path: string]: GeneralBehavior }
  /** @internal */
  private _$list = Object.create(null) as { [path: string]: GeneralComponentDefinition }
  /** @internal */
  private _$pubList = Object.create(null) as { [path: string]: GeneralComponentDefinition }
  /** @internal */
  private _$using = Object.create(null) as {
    [path: string]: GeneralComponentDefinition | NativeNodeDefinition
  }
  /** @internal */
  private _$importedSpaces = Object.create(null) as {
    [path: string]: {
      space: ComponentSpace
      privateUse: boolean
    }
  }
  /** @internal */
  private _$defaultComponent: string
  /** @internal */
  private _$componentOptions: NormalizedComponentOptions
  styleScopeManager: StyleScopeManager
  /** @internal */
  private _$listWaiting = Object.create(null) as {
    [path: string]: ComponentWaitingList
  }
  /** @internal */
  private _$pubListWaiting = Object.create(null) as {
    [path: string]: ComponentWaitingList
  }
  /** @internal */
  _$componentWaitingListener: ((isPub: boolean, alias: string) => void) | null = null

  /**
   * Create a new component space
   *
   * The `defaultComponent` is the default component path.
   * It should be defined soon after creation.
   * A `baseSpace` can be provided as a "base" component space -
   * every component alias (and behavior alias) in the space will be imported when creation.
   * However, if any new component is added to the base space after the creation,
   * it will not be added to the created space.
   */
  constructor(
    defaultComponent?: string,
    baseSpace?: ComponentSpace,
    styleScopeManager?: StyleScopeManager,
  ) {
    if (baseSpace) {
      Object.assign(this._$list, baseSpace._$pubList)
      Object.assign(this._$behaviorList, baseSpace._$pubBehaviorList)
    }
    this._$defaultComponent = defaultComponent ?? ''
    this._$componentOptions = normalizeComponentOptions({}, baseSpace?._$componentOptions)
    this.styleScopeManager = styleScopeManager || new StyleScopeManager()
  }

  /**
   * Update the default component options for this space
   *
   * The new options will be merged with existing options.
   */
  updateComponentOptions(componentOptions: ComponentOptions) {
    this._$componentOptions = normalizeComponentOptions(componentOptions, this._$componentOptions)
  }

  getComponentOptions(): NormalizedComponentOptions {
    return this._$componentOptions
  }

  /**
   * Set (or update) a global using component item
   *
   * This will allow all the components in this component space using this component automatically,
   * without declaring it with `using` or `usingComponents` again.
   * The target can also be a tag name of a native node.
   */
  setGlobalUsingComponent(key: string, target: GeneralComponentDefinition | string) {
    this._$using[key] = target
  }

  /**
   * Import another component space
   *
   * The components in the imported space can be used by components in this space.
   * The `protoDomain` should be URL-like, i.e. `space://another-space` .
   * When using, the components in the imported space should be specified with `protoDomain` .
   * For example, if `protoDomain` is `space://another-space` and one imported component has alias `my-comp` ,
   * then it should be specified with `space://another-space/my-comp` .
   * If `privateUse` set to false, only component alias in the imported space can be used;
   * the original name of components is imported otherwise.
   */
  importSpace(protoDomain: string, space: ComponentSpace, privateUse: boolean) {
    this._$importedSpaces[protoDomain] = {
      space,
      privateUse,
    }
  }

  /**
   * Get a component by the `path`
   *
   * The component `is` is actually treated as the "path" of the component.
   * In other words, the component `is` field can be a string like `path/to/the/component` .
   * Other components can be used by the component with "relative path" spacified.
   * In this method, if the `path` is given as a relative path (not started with `/` ),
   * it will be converted according to the `basePath` .
   * If the `path` is given as a URL-like format,
   * the component will be searched in imported comopnent spaces ( `importSpace()` for details).
   */
  getComponentByUrl(path: string, basePath: string): GeneralComponentDefinition {
    const { domain, absPath } = normalizeUrl(path, basePath)
    const comp = this.getComponent(absPath, true, domain)
    if (!comp) {
      throw new Error(
        `There is no component "${absPath}" in the space and no default component can be used`,
      )
    }
    return comp
  }

  /**
   * Get a component by the `path`
   *
   * Similar to `getComponentByUrl()` ,
   * but returns `null` instead of the default component if no compnent was found.
   */
  getComponentByUrlWithoutDefault(
    path: string,
    relPath: string,
  ): GeneralComponentDefinition | null {
    const { domain, absPath } = normalizeUrl(path, relPath)
    const comp = this.getComponent(absPath, false, domain)
    return comp || null
  }

  private getComponent(
    absPath: string,
    withDefault = true,
    domain: string | null = null,
  ): GeneralComponentDefinition | undefined {
    let list: { [is: string]: GeneralComponentDefinition } | undefined
    if (domain) {
      const target = this._$importedSpaces[domain]
      if (target) {
        const { space, privateUse } = target
        if (privateUse) {
          list = space._$list
        } else {
          list = space._$pubList
        }
      }
    } else {
      list = this._$list
    }
    if (list) {
      const def = list[absPath]
      if (def) return def
    }
    if (withDefault) {
      return this._$list[this._$defaultComponent]
    }
    return undefined
  }

  getDefaultComponent(): GeneralComponentDefinition | null {
    return this._$list[this._$defaultComponent] || null
  }

  isDefaultComponent(def: GeneralComponentDefinition) {
    return this._$list[this._$defaultComponent] === def
  }

  getGlobalUsingComponent(key: string): GeneralComponentDefinition | NativeNodeDefinition | null {
    return this._$using[key] || null
  }

  /**
   * Get a behavior by the `path`
   *
   * Similar to `getComponentByUrlWithoutDefault()` but for behaviors.
   */
  getBehaviorByUrl(path: string, relPath: string): GeneralBehavior | null {
    const { domain, absPath } = normalizeUrl(path, relPath)
    return this._$getBehavior(absPath, domain) || null
  }

  /** @internal */
  _$getBehavior(absPath: string, domain: string | null = null): GeneralBehavior | undefined {
    let list: { [is: string]: GeneralBehavior } | undefined
    if (domain) {
      const target = this._$importedSpaces[domain]
      if (target) {
        const { space, privateUse } = target
        if (privateUse) {
          list = space._$behaviorList
        } else {
          list = space._$pubBehaviorList
        }
      }
    } else {
      list = this._$behaviorList
    }
    if (list) {
      const def = list[absPath]
      if (def) return def
    }
    return undefined
  }

  /** Register a component in this space */
  defineComponent<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(
    def: ComponentParams<TData, TProperty, TMethod> &
      ThisType<ComponentInstance<TData, TProperty, TMethod>>,
  ): ComponentDefinition<TData, TProperty, TMethod> {
    const is = def.is
    const ret = new BehaviorBuilder(is, this).definition(def).registerComponent()
    return ret
  }

  /** Register a behavior in this space */
  defineBehavior<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(
    def: ComponentParams<TData, TProperty, TMethod> &
      ThisType<ComponentInstance<TData, TProperty, TMethod>>,
  ): Behavior<TData, TProperty, TMethod, never> {
    const is = def.is
    const ret = new BehaviorBuilder(is, this).definition(def).registerBehavior()
    return ret
  }

  /** Register a component or a behavior with chaining API */
  define(is?: string): BehaviorBuilder {
    return new BehaviorBuilder(is, this)
  }

  /**
   * Register a component or a behavior with chaining API (with method caller type specified)
   *
   * This API is generally designed for adapters which require special method callers.
   */
  defineWithMethodCaller(is?: string): BehaviorBuilder<Empty, Empty, Empty, Empty, never, never> {
    return new BehaviorBuilder(is, this)
  }

  /** @internal */
  _$registerComponent(is: string, comp: GeneralComponentDefinition) {
    this._$list[is] = comp
    this._$behaviorList[is] = comp.behavior as unknown as GeneralBehavior
    const arr = this._$listWaiting[is]
    if (arr) {
      delete this._$listWaiting[is]
      arr.call(comp)
    }
  }

  /** @internal */
  _$registerBehavior(is: string, beh: GeneralBehavior) {
    this._$behaviorList[is] = beh
  }

  /**
   * Assign a public alias to a component
   *
   * The alias can be used in other component spaces which imported this component space.
   * One component may have multiple aliases.
   */
  exportComponent(alias: string, is: string) {
    const comp = this._$list[is]
    if (!comp) {
      throw new Error(`There is no component "${is}" for aliasing`)
    }
    this._$pubList[alias] = comp
    const arr = this._$pubListWaiting[alias]
    if (arr) {
      delete this._$pubListWaiting[alias]
      arr.call(comp)
    }
  }

  /**
   * Assign a public alias to a behavior
   *
   * The alias can be used in other component spaces which imported this component space.
   * One behavior may have multiple aliases.
   */
  exportBehavior(alias: string, is: string) {
    const beh = this._$behaviorList[is]
    if (!beh) {
      throw new Error(`There is no behavior "${is}" for aliasing`)
    }
    this._$pubBehaviorList[alias] = beh
  }

  /** @internal */
  _$componentWaitingList(path: string, relPath: string): ComponentWaitingList | null {
    const { domain, absPath } = normalizeUrl(path, relPath)
    let waiting: {
      [path: string]: ComponentWaitingList
    } | null
    let space: ComponentSpace
    let isPub: boolean
    if (domain) {
      const target = this._$importedSpaces[domain]
      if (target) {
        space = target.space
        isPub = !target.privateUse
        if (!isPub) {
          if (space._$list[absPath]) {
            return null
          }
          waiting = space._$listWaiting
        } else {
          if (space._$pubList[absPath]) {
            return null
          }
          waiting = space._$pubListWaiting
        }
      } else {
        return null
      }
    } else {
      space = this
      isPub = false
      if (this._$list[absPath]) {
        return null
      }
      waiting = this._$listWaiting
    }
    let wl = waiting[absPath]
    if (wl) return wl
    wl = waiting[absPath] = new ComponentWaitingList(space, isPub, absPath)
    return wl
  }

  /**
   * Set a listener which will be called when a placeholded component is used.
   *
   * This can be used as a hint for a component that should be registered later.
   * If `isPub` is false, the `alias` is the path of the component, a.k.a. `is` .
   * Otherwise, it is the exported `alias` instead.
   */
  setComponentWaitingListener(listener: ((isPub: boolean, alias: string) => void) | null) {
    this._$componentWaitingListener = listener
  }

  /**
   * Create a component by URL
   *
   * This `url` can contain params (started with "?" character).
   * The params will try to be set to component properties (if matches the property name).
   */
  createComponentByUrl(
    tagName: string,
    url: string,
    genericTargets: { [name: string]: string } | null,
    backendContext: GeneralBackendContext | null,
  ): GeneralComponent {
    let domainPath = url
    let paramStr: string | null = null

    // parse URL
    const hashSepIndex = domainPath.indexOf('#')
    if (hashSepIndex >= 0) {
      domainPath = domainPath.slice(0, hashSepIndex)
    }
    const paramSepIndex = domainPath.indexOf('?')
    if (paramSepIndex >= 0) {
      paramStr = domainPath.slice(paramSepIndex + 1)
      domainPath = domainPath.slice(0, paramSepIndex)
    }

    // find target components
    const compDef = this.getComponentByUrl(domainPath, '')
    let genericImpls: { [key: string]: GeneralComponentDefinition } | null = null
    if (genericTargets) {
      genericImpls = Object.create(null) as { [key: string]: GeneralComponentDefinition }
      Object.keys(genericTargets).forEach((key) => {
        const url = genericTargets[key]!
        const compDef = this.getComponentByUrl(url, '')
        genericImpls![key] = compDef
      })
    }

    // create the component
    const comp = Component.createWithGenericsAndContext(
      tagName,
      compDef,
      genericImpls,
      backendContext,
      (comp) => {
        // set params if provided
        if (paramStr) {
          let needApplyUpdates = false
          paramStr.split('&').forEach((kv) => {
            const kvSepIndex = kv.indexOf('=')
            if (kvSepIndex >= 0) {
              const key = decodeURIComponent(kv.slice(0, kvSepIndex))
              const value = decodeURIComponent(kv.slice(kvSepIndex + 1))
              if (comp._$dataGroup.replaceProperty(key, value)) {
                needApplyUpdates = true
              }
            }
          })
          if (needApplyUpdates) comp.applyDataUpdates()
        }
      },
    ) as GeneralComponent

    return comp
  }

  /**
   * Define a trait behavior
   *
   * A trait behavior
   * Optionally, the trait behavior can add a conversion function.
   * This function can convert the implementation to another interface.
   */
  defineTraitBehavior<TIn extends { [key: string]: any }>(): TraitBehavior<TIn, TIn>
  defineTraitBehavior<TIn extends { [key: string]: any }, TOut extends { [key: string]: any }>(
    trans: (impl: TIn) => TOut,
  ): TraitBehavior<TIn, TOut>
  defineTraitBehavior<TIn extends { [key: string]: any }, TOut extends { [key: string]: any }>(
    trans?: (impl: TIn) => TOut,
  ): TraitBehavior<TIn, TOut> {
    return new TraitBehavior<TIn, TOut>(this, trans)
  }
}
