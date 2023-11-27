/* eslint-disable @typescript-eslint/no-unsafe-return */

import * as glassEasel from 'glass-easel'
import {
  Behavior,
  ComponentType,
  TraitBehavior,
  type DefinitionFilter,
  type GeneralBehavior,
} from './behavior'
import { ComponentProto, type AllData, type Component, type GeneralComponent } from './component'
import { type MiniProgramEnv } from './env'
import {
  StyleIsolation,
  type BehaviorDefinition,
  type ComponentDefinition,
  type ComponentDefinitionOptions,
  type ComponentStaticConfig,
  type PageDefinition,
  type utils as typeUtils,
} from './types'
import { guid } from './utils'

// The page constructor
export interface PageConstructor {
  <TData extends DataList, TNewExtraFields extends { [k: PropertyKey]: any }>(
    definition: PageDefinition<TData, TNewExtraFields> &
      ThisType<Component<TData, Empty, TNewExtraFields, undefined>>,
  ): void
}

// The component constructor
export interface ComponentConstructor {
  (): ComponentBuilder
  <
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
    TComponentExport,
  >(
    definition: ComponentDefinition<TData, TProperty, TMethod, TComponentExport> &
      ThisType<Component<TData, TProperty, TMethod, TComponentExport>>,
  ): void
}

// The behavior constructor
export interface BehaviorConstructor {
  (): BehaviorBuilder
  <
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
    TComponentExport,
  >(
    definition: BehaviorDefinition<TData, TProperty, TMethod, TComponentExport>,
  ): Behavior<TData, TProperty, TMethod, never>
  trait<TIn extends { [key: string]: any }>(): TraitBehavior<TIn, TIn>
  trait<TIn extends { [key: string]: any }, TOut extends { [key: string]: any }>(
    trans: (impl: TIn) => TOut,
  ): TraitBehavior<TIn, TOut>
}

/* The component registration environment */
export interface ComponentEnv {
  Page: PageConstructor
  Component: ComponentConstructor
  Behavior: BehaviorConstructor
}

type Empty = typeUtils.Empty
type DataList = typeUtils.DataList
type PropertyList = typeUtils.PropertyList
type PropertyType = typeUtils.PropertyType
type PropertyTypeToValueType<T extends PropertyType> = typeUtils.PropertyTypeToValueType<T>
type MethodList = typeUtils.MethodList
type ChainingFilterType = typeUtils.ChainingFilterType
type ComponentMethod = typeUtils.ComponentMethod
type TaggedMethod<Fn extends ComponentMethod> = typeUtils.TaggedMethod<Fn>
type ChainingFilterFunc<
  TAddedFields extends { [key: string]: any },
  TRemovedFields extends string = never,
> = typeUtils.ChainingFilterFunc<TAddedFields, TRemovedFields>

export interface RelationHandler<TTarget, TOut> {
  list(): TTarget[]
  listAsTrait: TOut extends never ? undefined : () => TOut[]
}

export type TraitRelationParams<TOut extends { [key: string]: any }> = {
  target: TraitBehavior<any, TOut>
  type: 'ancestor' | 'descendant' | 'parent' | 'child' | 'parent-common-node' | 'child-common-node'
  linked?: (target: GeneralComponent) => void
  linkChanged?: (target: GeneralComponent) => void
  unlinked?: (target: GeneralComponent) => void
  linkFailed?: (target: GeneralComponent) => void
}

export type RelationParams = {
  target?: string | ComponentType<any, any, any, any> | GeneralBehavior | TraitBehavior<any>
  type: 'ancestor' | 'descendant' | 'parent' | 'child' | 'parent-common-node' | 'child-common-node'
  linked?: (target: GeneralComponent) => void
  linkChanged?: (target: GeneralComponent) => void
  unlinked?: (target: GeneralComponent) => void
  linkFailed?: (target: GeneralComponent) => void
}

export type Lifetimes = {
  created: () => void
  attached: () => void
  moved: () => void
  detached: () => void
  ready: () => void
}

export interface BuilderContext<
  TPrevData extends DataList,
  TProperty extends PropertyList,
  TMethodCaller,
> extends ThisType<TMethodCaller> {
  self: TMethodCaller
  data: typeUtils.DeepReadonly<typeUtils.DataWithPropertyValues<TPrevData, TProperty>>
  setData: (newData: Partial<typeUtils.SetDataSetter<TPrevData>>, callback?: () => void) => void
  implement: <TIn extends { [x: string]: any }>(
    traitBehavior: TraitBehavior<TIn, any>,
    impl: TIn,
  ) => void
  relation<TOut extends { [key: string]: any }>(
    def: TraitRelationParams<TOut> & ThisType<TMethodCaller>,
  ): RelationHandler<any, TOut>
  relation(def: RelationParams & ThisType<TMethodCaller>): RelationHandler<any, never>
  observer<
    P extends typeUtils.ObserverDataPathStrings<
      typeUtils.DataWithPropertyValues<TPrevData, TProperty>
    >,
    V = typeUtils.DeepReadonly<
      typeUtils.GetFromObserverPathString<typeUtils.DataWithPropertyValues<TPrevData, TProperty>, P>
    >,
  >(
    paths: P,
    func: (newValue: V) => void,
  ): void
  observer<
    P extends typeUtils.ObserverDataPathStrings<
      typeUtils.DataWithPropertyValues<TPrevData, TProperty>
    >[],
    V = {
      [K in keyof P]: typeUtils.DeepReadonly<
        typeUtils.GetFromObserverPathString<
          typeUtils.DataWithPropertyValues<TPrevData, TProperty>,
          P[K]
        >
      >
    },
  >(
    paths: readonly [...P],
    func: (...newValues: V extends any[] ? V : never) => void,
  ): void
  lifetime: <L extends keyof Lifetimes>(name: L, func: Lifetimes[L]) => void
  pageLifetime: (name: string, func: (...args: any[]) => void) => void
  method: <Fn extends ComponentMethod>(func: Fn) => TaggedMethod<Fn>
}

/**
 * A component space with mini-program code manager
 */
export class CodeSpace {
  /** @internal */
  _$env: MiniProgramEnv
  private _$isMainSpace: boolean
  private space: glassEasel.ComponentSpace
  private styleScopeManager: glassEasel.StyleScopeManager
  private staticConfigMap: { [path: string]: ComponentStaticConfig }
  private styleSheetMap: { [path: string]: { url: string; styleScopeName: string | undefined } }
  private compiledTemplateMap: { [path: string]: glassEasel.template.ComponentTemplate }
  private waitingAliasMap: { [is: string]: string[] }
  /** @internal */
  _$sharedStyleScope: glassEasel.StyleScopeId
  /** @internal */
  _$styleIsolationMap: { [path: string]: StyleIsolation }
  /** @internal */
  _$overallBehavior: glassEasel.GeneralBehavior | null = null

  /** @internal */
  constructor(
    env: MiniProgramEnv,
    isMainSpace: boolean,
    publicComponents: { [alias: string]: string },
    globalCodeSpace?: CodeSpace,
  ) {
    this._$env = env
    this._$isMainSpace = isMainSpace
    this.space = new glassEasel.ComponentSpace(
      '',
      globalCodeSpace?.space,
      globalCodeSpace?.space.styleScopeManager,
    )
    this.styleScopeManager = this.space.styleScopeManager
    this.staticConfigMap = Object.create(null) as { [path: string]: ComponentStaticConfig }
    this.styleSheetMap = Object.create(null) as {
      [path: string]: { url: string; styleScopeName: string }
    }
    this.compiledTemplateMap = Object.create(null) as {
      [path: string]: glassEasel.template.ComponentTemplate
    }
    this.waitingAliasMap = Object.create(null) as { [path: string]: string[] }
    Object.keys(publicComponents).forEach((alias) => {
      const is = publicComponents[alias]!
      if (this.waitingAliasMap[is]) this.waitingAliasMap[is]!.push(alias)
      else this.waitingAliasMap[is] = [alias]
    })
    this._$sharedStyleScope = this.styleScopeManager.register('')
    this._$styleIsolationMap = Object.create(null) as { [path: string]: StyleIsolation }
  }

  isMainSpace(): boolean {
    return this._$isMainSpace
  }

  /**
   * Get the underlying component space
   */
  getComponentSpace(): glassEasel.ComponentSpace {
    return this.space
  }

  /**
   * Add a behavior for all components
   *
   * Must be called before any component registration so that the component will use this behavior.
   * Set to `null` to disable this behavior.
   */
  setOverallBehavior(behavior: glassEasel.GeneralBehavior) {
    this._$overallBehavior = behavior
  }

  /**
   * Import another component space as a plugin (must be in the same environment)
   *
   * Components from the imported `codeSpace` can be used with URLs.
   * If `domainAlias` is provided, the URL format is `plugin://DOMAIN_ALIAS/COMPONENT_SPACE_EXPORT_ALIAS` .
   * If `privateImport` is enabled, another URL format is `plugin-private://DOMAIN/COMPONENT_IS` .
   */
  importCodeSpace(id: string, domainAlias?: string, privateImport = false) {
    const cs = this._$env.getCodeSpace(id)
    if (!cs) {
      throw new Error(`There is no space "${id}" in the environment`)
    }
    if (domainAlias) this.space.importSpace(`plugin://${domainAlias}`, cs.space, false)
    if (privateImport) this.space.importSpace(`plugin-private://${id}`, cs.space, true)
  }

  /**
   * Add a style sheet URL with style scope name
   *
   * The URL should be recognized by the target backend.
   * The `path` should not contain the `.wxss` suffix.
   */
  addStyleSheet(path: string, styleSheetUrl: string, styleScopeName?: string) {
    this.styleSheetMap[path] = { url: styleSheetUrl, styleScopeName }
  }

  /**
   * Get a style sheet URL
   *
   * The URL should be recognized by the target backend.
   * The `path` should not contain the `.wxss` suffix.
   */
  getStyleSheet(path: string): string | undefined {
    return this.styleSheetMap[path]?.url
  }

  getStyleScopeName(path: string): string | undefined {
    return this.styleSheetMap[path]?.styleScopeName
  }

  /**
   * Add a compiled template
   *
   * The content is the execution result of the generated string of the template compiler.
   * The `path` should not contain the `.wxml` suffix.
   */
  addCompiledTemplate(path: string, content: glassEasel.template.ComponentTemplate) {
    this.compiledTemplateMap[path] = content
  }

  /**
   * Get a compiled template
   *
   * The content is the execution result of the generated string of the template compiler.
   * The `path` should not contain the `.wxml` suffix.
   */
  getCompiledTemplate(path: string): glassEasel.template.ComponentTemplate | undefined {
    return this.compiledTemplateMap[path]
  }

  /**
   * Add a static JSON config
   *
   * The `path` should not contain the `.json` suffix.
   */
  addComponentStaticConfig(path: string, content: ComponentStaticConfig) {
    this.staticConfigMap[path] = content
  }

  /**
   * Get a static JSON config
   *
   * The `path` should not contain the `.json` suffix.
   */
  getComponentStaticConfig(path: string): ComponentStaticConfig | undefined {
    return this.staticConfigMap[path]
  }

  /** @internal */
  prepareComponentOptions(
    is: string,
    options?: ComponentDefinitionOptions,
  ): [glassEasel.ComponentOptions, StyleIsolation] {
    // accept some fields from static JSON config
    const staticConfig = this.staticConfigMap[is]
    const pureDataPatternString = staticConfig?.pureDataPattern
    const pureDataPattern = pureDataPatternString
      ? new RegExp(pureDataPatternString)
      : options?.pureDataPattern

    // calculate style scope
    const addGlobalClass = staticConfig?.addGlobalClass
    let styleIsolation = staticConfig?.styleIsolation
    if (styleIsolation === undefined) {
      if (staticConfig?.component) {
        styleIsolation = addGlobalClass ? StyleIsolation.ApplyShared : StyleIsolation.Isolated
      } else {
        styleIsolation = StyleIsolation.Shared
      }
    }
    let styleScope: glassEasel.StyleScopeId | undefined
    let extraStyleScope: glassEasel.StyleScopeId | undefined
    if (
      styleIsolation === StyleIsolation.ApplyShared ||
      styleIsolation === StyleIsolation.PageApplyShared
    ) {
      styleScope = this.styleScopeManager.register(this.getStyleScopeName(is) || `__${guid()}`)
      extraStyleScope = this._$sharedStyleScope
    } else if (
      (styleIsolation === StyleIsolation.Shared || styleIsolation === StyleIsolation.PageShared) &&
      this._$isMainSpace
    ) {
      styleScope = this._$sharedStyleScope
    } else {
      styleScope = this.styleScopeManager.register(this.getStyleScopeName(is) || `__${guid()}`)
    }

    // construct component options
    const ret: glassEasel.ComponentOptions = {
      idPrefixGenerator: guid,
      multipleSlots: options?.multipleSlots,
      pureDataPattern,
      virtualHost: options?.virtualHost,
      styleScope,
      extraStyleScope,
      dataDeepCopy: options?.dataDeepCopy,
      propertyPassingDeepCopy: options?.propertyPassingDeepCopy,
      propertyEarlyInit: options?.propertyEarlyInit,
      externalComponent: options?.externalComponent,
    }
    return [ret, styleIsolation]
  }

  /**
   * Create a component definition environment
   *
   * During the sync execution of `cb` , `Component` and `Behavior` global vars will be available.
   * `globalObject` should be the JavaScript global object, a.k.a. `window` in DOM.
   * Some global variables, a.k.a `Component` `Behavior` `Page` ,
   * will be written into `globalObject` .
   * `path` should be the component path (without ".js" extension).
   */
  globalComponentEnv<T>(globalObject: any, path: string, cb: () => T): T {
    return this.componentEnv(path, ({ Page, Component, Behavior }) => {
      /* eslint-disable @typescript-eslint/no-unsafe-member-access */
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      const oldPage = globalObject.Page
      const oldComponent = globalObject.Component
      const oldBehavior = globalObject.Behavior
      globalObject.Page = Page
      globalObject.Component = Component
      globalObject.Behavior = Behavior
      const ret = cb()
      globalObject.Page = oldPage
      globalObject.Component = oldComponent
      globalObject.Behavior = oldBehavior
      /* eslint-enable @typescript-eslint/no-unsafe-member-access */
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
      return ret
    })
  }

  /**
   * Create a component definition environment
   *
   * Like `globalComponentEnv` , but the global variables are given as callback arguments.
   */
  componentEnv<T>(path: string, cb: (env: ComponentEnv) => T): T {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    // The page constructor
    function pageConstructor<
      TData extends DataList,
      TNewExtraFields extends { [k: PropertyKey]: any },
    >(
      definition: PageDefinition<TData, TNewExtraFields> &
        ThisType<Component<TData, Empty, TNewExtraFields, undefined>>,
    ) {
      return self.component(path).pageDefinition(definition).register()
    }

    // The component constructor
    function componentConstructor(): ComponentBuilder
    function componentConstructor<
      TData extends DataList,
      TProperty extends PropertyList,
      TMethod extends MethodList,
      TComponentExport,
    >(definition: ComponentDefinition<TData, TProperty, TMethod, TComponentExport>): void
    function componentConstructor<
      TData extends DataList,
      TProperty extends PropertyList,
      TMethod extends MethodList,
      TComponentExport,
    >(definition?: ComponentDefinition<TData, TProperty, TMethod, TComponentExport>) {
      if (definition !== undefined) {
        return self.component(path).definition(definition).register()
      }
      return self.component(path)
    }

    // The behavior constructor
    function behaviorConstructor(): BehaviorBuilder
    function behaviorConstructor<
      TData extends DataList,
      TProperty extends PropertyList,
      TMethod extends MethodList,
      TComponentExport,
    >(
      definition: BehaviorDefinition<TData, TProperty, TMethod, TComponentExport>,
    ): Behavior<TData, TProperty, TMethod, never>
    function behaviorConstructor<
      TData extends DataList,
      TProperty extends PropertyList,
      TMethod extends MethodList,
      TComponentExport,
    >(definition?: BehaviorDefinition<TData, TProperty, TMethod, TComponentExport>) {
      if (definition !== undefined) {
        return self.behavior().definition(definition).register()
      }
      return self.behavior()
    }
    behaviorConstructor.trait = self.traitBehavior.bind(self)

    // prepare global vars and execute
    return cb({
      Page: pageConstructor,
      Component: componentConstructor,
      Behavior: behaviorConstructor,
    })
  }

  /**
   * Build a component outside of a definition environment
   *
   * The method do not need a definition environment, so the global object pollution is avoided.
   * `path` should be the component path (without ".js" extension).
   */
  component(path: string): ComponentBuilder {
    return ComponentBuilder.create(this, path, this.waitingAliasMap[path])
  }

  /**
   * Build a behavior outside of a definition environment
   *
   * The method do not need a definition environment, so the global object pollution is avoided.
   * `path` should be the component path (without ".js" extension).
   */
  behavior(): BehaviorBuilder {
    return BehaviorBuilder.create(this)
  }

  /**
   * Define a trait behavior
   */
  traitBehavior<TIn extends { [key: string]: any }>(): TraitBehavior<TIn, TIn>
  traitBehavior<TIn extends { [key: string]: any }, TOut extends { [key: string]: any }>(
    trans: (impl: TIn) => TOut,
  ): TraitBehavior<TIn, TOut>
  traitBehavior<TIn extends { [key: string]: any }, TOut extends { [key: string]: any }>(
    trans?: (impl: TIn) => TOut,
  ): TraitBehavior<TIn, TOut> {
    if (trans === undefined) {
      return new TraitBehavior(this.space.defineTraitBehavior<TIn>())
    }
    return new TraitBehavior(this.space.defineTraitBehavior<TIn, TOut>(trans))
  }
}

type ResolveBehaviorBuilder<
  B,
  TChainingFilter extends ChainingFilterType,
> = typeUtils.IsNever<TChainingFilter> extends false
  ? TChainingFilter extends ChainingFilterType
    ? Omit<B, TChainingFilter['remove']> & TChainingFilter['add']
    : B
  : B

export class BaseBehaviorBuilder<
  TPrevData extends DataList = Empty,
  TData extends DataList = Empty,
  TProperty extends PropertyList = Empty,
  TMethod extends MethodList = Empty,
  TChainingFilter extends ChainingFilterType = never,
  TPendingChainingFilter extends ChainingFilterType = never,
  TComponentExport = never,
> {
  protected _$codeSpace!: CodeSpace
  protected _$!: glassEasel.BehaviorBuilder<
    TPrevData,
    TData,
    TProperty,
    TMethod,
    TChainingFilter,
    TPendingChainingFilter
  >
  protected _$parents: GeneralBehavior[] = []
  protected _$export?: (source: GeneralComponent | null) => TComponentExport

  /** Implement a trait behavior */
  implement<TIn extends { [key: string]: any }>(
    traitBehavior: TraitBehavior<TIn, any>,
    impl: TIn,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    this._$.implement(traitBehavior._$, impl)
    return this as any
  }

  /** Add external classes */
  externalClasses(list: string[]): this {
    this._$.externalClasses(list)
    return this
  }

  /** Set the export value when the component is being selected */
  export<TNewComponentExport>(
    f: (this: GeneralComponent, source: GeneralComponent | null) => TNewComponentExport,
  ): ResolveBehaviorBuilder<
    BaseBehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TNewComponentExport
    >,
    TChainingFilter
  > {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this._$export = f as any
    return this as any
  }

  data<T extends DataList>(
    gen: () => typeUtils.NewFieldList<AllData<TData, TProperty>, T>,
  ): ResolveBehaviorBuilder<
    BaseBehaviorBuilder<
      T,
      TData & T,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    this._$.data(gen)
    return this as any
  }

  property<N extends string, T extends PropertyType, V extends PropertyTypeToValueType<T>>(
    name: N,
    def: N extends keyof (TData & TProperty) ? never : typeUtils.PropertyListItem<T, V>,
  ): ResolveBehaviorBuilder<
    BaseBehaviorBuilder<
      TPrevData,
      TData,
      TProperty & Record<N, unknown extends V ? T : typeUtils.PropertyOption<T, V>>,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    this._$.property(name, def)
    return this as any
  }

  /**
   * Add some public methods
   *
   * The public method can be used as an event handler, and can be visited in component instance.
   */
  methods<T extends MethodList>(
    funcs: T & ThisType<Component<TData, TProperty, TMethod & T, any>>,
  ): ResolveBehaviorBuilder<
    BaseBehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod & T,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    this._$.methods(funcs)
    return this as any
  }

  /**
   * Add a data observer
   */
  observer<
    P extends typeUtils.ObserverDataPathStrings<
      typeUtils.DataWithPropertyValues<TPrevData, TProperty>
    >,
    V = typeUtils.DeepReadonly<
      typeUtils.GetFromObserverPathString<typeUtils.DataWithPropertyValues<TPrevData, TProperty>, P>
    >,
  >(
    paths: P,
    func: (this: Component<TData, TProperty, TMethod, any>, newValue: V) => void,
    once?: boolean,
  ): ResolveBehaviorBuilder<this, TChainingFilter>
  observer<
    P extends typeUtils.ObserverDataPathStrings<
      typeUtils.DataWithPropertyValues<TPrevData, TProperty>
    >[],
    V = {
      [K in keyof P]: typeUtils.DeepReadonly<
        typeUtils.GetFromObserverPathString<
          typeUtils.DataWithPropertyValues<TPrevData, TProperty>,
          P[K]
        >
      >
    },
  >(
    paths: readonly [...P],
    func: (
      this: Component<TData, TProperty, TMethod, any>,
      ...newValues: V extends any[] ? V : never
    ) => void,
    once?: boolean,
  ): ResolveBehaviorBuilder<this, TChainingFilter>
  observer(
    paths: string | readonly string[],
    func: (this: Component<TData, TProperty, TMethod, any>, ...args: any[]) => any,
    once = false,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    this._$.observer(paths as any, func as any, once)
    return this as any
  }

  /**
   * Add a lifetime callback
   */
  lifetime<L extends keyof Lifetimes>(
    name: L,
    func: (
      this: Component<TData, TProperty, TMethod, any>,
      ...args: Parameters<Lifetimes[L]>
    ) => ReturnType<Lifetimes[L]>,
    once = false,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    this._$.lifetime(name, func as any, once)
    return this as any
  }

  /**
   * Add a page-lifetime callback
   */
  pageLifetime(
    name: string,
    func: (this: Component<TData, TProperty, TMethod, any>, ...args: any[]) => any,
    once = false,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    this._$.pageLifetime(name, func as any, once)
    return this as any
  }

  /**
   * Add a relation
   */
  relation(
    name: string,
    rel: RelationParams & ThisType<Component<TData, TProperty, TMethod, TComponentExport>>,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    const target =
      rel.target instanceof Behavior || rel.target instanceof ComponentType
        ? rel.target._$
        : rel.target
    this._$.relation(name, {
      target,
      type: rel.type,
      linked: rel.linked,
      linkChanged: rel.linkChanged,
      unlinked: rel.unlinked,
      linkFailed: rel.linkFailed,
    } as any)
    return this as any
  }

  init<TExport extends Record<string, TaggedMethod<(...args: any[]) => any>> | void>(
    func: (
      this: Component<TData, TProperty, TMethod, TComponentExport>,
      builderContext: BuilderContext<
        TPrevData,
        TProperty,
        Component<TData, TProperty, TMethod, TComponentExport>
      >,
    ) => TExport,
    // eslint-disable-next-line function-paren-newline
  ): ResolveBehaviorBuilder<
    BaseBehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    this._$.init(function ({
      data,
      setData,
      implement,
      relation,
      observer,
      lifetime,
      pageLifetime,
      method,
    }) {
      const relationInit = ((rel: RelationParams | TraitRelationParams<any>) => {
        if (rel.target instanceof TraitBehavior) {
          return relation({
            target: rel.target._$,
            type: rel.type,
            linked: rel.linked,
            linkChanged: rel.linkChanged,
            unlinked: rel.unlinked,
            linkFailed: rel.linkFailed,
          } as any)
        }
        const target =
          rel.target instanceof Behavior || rel.target instanceof ComponentType
            ? rel.target._$
            : rel.target
        return relation({
          target,
          type: rel.type,
          linked: rel.linked,
          linkChanged: rel.linkChanged,
          unlinked: rel.unlinked,
          linkFailed: rel.linkFailed,
        } as any)
      }) as BuilderContext<TPrevData, TProperty, TMethod>['relation']

      const implementInit = ((traitBehavior: TraitBehavior<any>, impl: Record<string, any>) => {
        implement(traitBehavior._$, impl)
      }) as BuilderContext<TPrevData, TProperty, TMethod>['implement']

      const methodCaller = this as unknown as Component<TData, TProperty, TMethod, TComponentExport>

      func.call(methodCaller, {
        self: methodCaller,
        data,
        setData: (newData, callback) => {
          setData(newData)
          if (callback) {
            glassEasel.triggerRender(methodCaller._$, () => {
              callback()
            })
          }
        },
        implement: implementInit,
        relation: relationInit,
        observer,
        lifetime,
        pageLifetime,
        method,
      })
    })
    return this as any
  }

  definition<
    TNewData extends DataList = Empty,
    TNewProperty extends PropertyList = Empty,
    TNewMethod extends MethodList = Empty,
    TNewComponentExport = never,
  >(
    def: BehaviorDefinition<TNewData, TNewProperty, TNewMethod, TNewComponentExport> &
      ThisType<
        Component<
          TData & TNewData,
          TProperty & TNewProperty,
          TMethod & TNewMethod,
          TNewComponentExport
        >
      >,
  ): ResolveBehaviorBuilder<
    BaseBehaviorBuilder<
      TPrevData,
      TData & TNewData,
      TProperty & TNewProperty,
      TMethod & TNewMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TNewComponentExport
    >,
    TChainingFilter
  > {
    def.behaviors?.forEach((beh) => beh._$bindedDefinitionFilter?.(def))
    const inner = this._$
    const {
      behaviors,
      properties: rawProperties,
      data: rawData,
      observers: rawObservers,
      methods,
      created,
      attached,
      ready,
      moved,
      detached,
      lifetimes: rawLifetimes,
      pageLifetimes: rawPageLifetimes,
      relations: rawRelations,
      externalClasses,
      export: exports,
    } = def
    behaviors?.forEach((beh) => {
      this._$parents.push(beh as GeneralBehavior)
      inner.behavior(beh._$)
    })
    if (rawData !== undefined) {
      if (typeof rawData === 'function') {
        inner.data(rawData as any)
      } else {
        inner.staticData(rawData as any)
      }
    }
    if (rawProperties !== undefined) {
      const keys = Object.keys(rawProperties)
      for (let i = 0; i < keys.length; i += 1) {
        const name = keys[i]!
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        inner.property(name, rawProperties[name] as any)
      }
    }
    if (rawObservers !== undefined) {
      if (Array.isArray(rawObservers)) {
        for (let i = 0; i < rawObservers.length; i += 1) {
          const { fields, observer } = rawObservers[i]!
          inner.observer(fields || ('**' as any), observer)
        }
      } else {
        const keys = Object.keys(rawObservers)
        for (let i = 0; i < keys.length; i += 1) {
          const fields = keys[i]!
          const observer = rawObservers[fields]!
          inner.observer(fields as any, observer)
        }
      }
    }
    if (methods) inner.methods(methods)
    if (created && rawLifetimes?.created === undefined) inner.lifetime('created', created, true)
    if (attached && rawLifetimes?.attached === undefined) inner.lifetime('attached', attached, true)
    if (ready && rawLifetimes?.ready === undefined) inner.lifetime('ready', ready, true)
    if (moved && rawLifetimes?.moved === undefined) inner.lifetime('moved', moved, true)
    if (detached && rawLifetimes?.detached === undefined) inner.lifetime('detached', detached, true)
    if (rawLifetimes) {
      const keys = Object.keys(rawLifetimes)
      for (let i = 0; i < keys.length; i += 1) {
        const name = keys[i]!
        const func = rawLifetimes[name]!
        inner.lifetime(name as any, func, true)
      }
    }
    if (rawPageLifetimes) {
      const keys = Object.keys(rawPageLifetimes)
      for (let i = 0; i < keys.length; i += 1) {
        const name = keys[i]!
        const func = rawPageLifetimes[name]!
        inner.pageLifetime(name, func, true)
      }
    }
    if (rawRelations) {
      const keys = Object.keys(rawRelations)
      for (let i = 0; i < keys.length; i += 1) {
        const name = keys[i]!
        const rel = rawRelations[name]!
        inner.relation(name, rel)
      }
    }
    if (externalClasses) inner.externalClasses(externalClasses)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    if (exports) this._$export = exports as any
    return this as any
  }
}

export class BehaviorBuilder<
  TPrevData extends DataList = Empty,
  TData extends DataList = Empty,
  TProperty extends PropertyList = Empty,
  TMethod extends MethodList = Empty,
  TChainingFilter extends ChainingFilterType = never,
  TPendingChainingFilter extends ChainingFilterType = never,
  TComponentExport = never,
> extends BaseBehaviorBuilder<
  TPrevData,
  TData,
  TProperty,
  TMethod,
  TChainingFilter,
  TPendingChainingFilter,
  TComponentExport
> {
  private _$definitionFilter: DefinitionFilter | undefined

  /** @internal */
  static create(codeSpace: CodeSpace): BehaviorBuilder {
    const ret = new BehaviorBuilder()
    ret._$codeSpace = codeSpace
    ret._$ = codeSpace.getComponentSpace().defineWithMethodCaller()
    return ret
  }

  /** Define a chaining filter */
  chainingFilter<
    TAddedFields extends { [key: string]: any },
    TRemovedFields extends string = never,
  >(
    func: ChainingFilterFunc<TAddedFields, TRemovedFields>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod,
      TChainingFilter,
      {
        add: TAddedFields
        remove: TRemovedFields
      },
      TComponentExport
    >,
    TChainingFilter
  > {
    this._$.chainingFilter(func as any)
    return this as any
  }

  /** Use another behavior */
  behavior<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
    UChainingFilter extends ChainingFilterType,
  >(
    behavior: Behavior<UData, UProperty, UMethod, UChainingFilter>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData & UData,
      TProperty & UProperty,
      TMethod & UMethod,
      UChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    UChainingFilter
  > {
    this._$parents.push(behavior as GeneralBehavior)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this._$ = this._$.behavior(behavior._$)
    return this as any
  }

  /** Set the export value when the component is being selected */
  override export<TNewComponentExport>(
    f: (this: GeneralComponent, source: GeneralComponent | null) => TNewComponentExport,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TNewComponentExport
    >,
    TChainingFilter
  > {
    return super.export(f) as any
  }

  /**
   * Add some template data fields
   *
   * It does not support raw data, but a `gen` function which returns the new data fields.
   * The `gen` function executes once during component creation.
   */
  override data<T extends DataList>(
    gen: () => typeUtils.NewFieldList<AllData<TData, TProperty>, T>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      T,
      TData & T,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    return super.data(gen) as any
  }

  /**
   * Add a single property
   *
   * The property name should be different from other properties.
   */
  override property<N extends string, T extends PropertyType, V extends PropertyTypeToValueType<T>>(
    name: N,
    def: N extends keyof (TData & TProperty) ? never : typeUtils.PropertyListItem<T, V>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData,
      TProperty & Record<N, unknown extends V ? T : typeUtils.PropertyOption<T, V>>,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    return super.property(name, def) as any
  }

  /**
   * Add some public methods
   *
   * The public method can be used as an event handler, and can be visited in component instance.
   */
  override methods<T extends MethodList>(
    funcs: T & ThisType<Component<TData, TProperty, TMethod & T, any>>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod & T,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    return super.methods(funcs) as any
  }

  /**
   * Execute a function while component instance creation
   *
   * A `BuilderContext` is provided to tweak the component creation progress.
   * The return value is used as the "export" value of the behavior,
   * which can be imported by other behaviors.
   */
  override init<TExport extends Record<string, TaggedMethod<(...args: any[]) => any>> | void>(
    func: (
      this: Component<TData, TProperty, TMethod, TComponentExport>,
      builderContext: BuilderContext<
        TPrevData,
        TProperty,
        Component<TData, TProperty, TMethod, TComponentExport>
      >,
    ) => TExport,
    // eslint-disable-next-line function-paren-newline
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    return super.init(func) as any
  }

  /** Apply a classic definition object */
  override definition<
    TNewData extends DataList = Empty,
    TNewProperty extends PropertyList = Empty,
    TNewMethod extends MethodList = Empty,
    TNewComponentExport = never,
  >(
    def: BehaviorDefinition<TNewData, TNewProperty, TNewMethod, TNewComponentExport> &
      ThisType<
        Component<
          TData & TNewData,
          TProperty & TNewProperty,
          TMethod & TNewMethod,
          TNewComponentExport
        >
      >,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData & TNewData,
      TProperty & TNewProperty,
      TMethod & TNewMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TNewComponentExport
    >,
    TChainingFilter
  > {
    super.definition(def)
    if (def.definitionFilter) this._$definitionFilter = def.definitionFilter
    return this as any
  }

  /**
   * Finish the behavior definition process
   */
  register(): Behavior<TData, TProperty, TMethod, TPendingChainingFilter, TComponentExport> {
    return new Behavior(
      this._$.registerBehavior(),
      this._$parents,
      this._$definitionFilter,
      this._$export,
    )
  }
}

/**
 * A direct way to create a component
 */
export class ComponentBuilder<
  TPrevData extends DataList = Empty,
  TData extends DataList = Empty,
  TProperty extends PropertyList = Empty,
  TMethod extends MethodList = Empty,
  TChainingFilter extends ChainingFilterType = never,
  TPendingChainingFilter extends ChainingFilterType = never,
  TComponentExport = never,
> extends BaseBehaviorBuilder<
  TPrevData,
  TData,
  TProperty,
  TMethod,
  TChainingFilter,
  TPendingChainingFilter,
  TComponentExport
> {
  private _$is!: string
  private _$alias?: string[]
  private _$options?: ComponentDefinitionOptions
  private _$proto?: ComponentProto<TData, TProperty, TMethod, TComponentExport>

  /** @internal */
  static create(codeSpace: CodeSpace, is: string, alias?: string[]) {
    const ret = new ComponentBuilder()
    const overallBehavior = codeSpace._$overallBehavior
    ret._$codeSpace = codeSpace
    ret._$ = codeSpace.getComponentSpace().defineWithMethodCaller(is || '')
    ret._$is = is || ''
    ret._$alias = alias
    ret._$.methodCallerInit(function () {
      const originalCaller = this as unknown as glassEasel.GeneralComponent
      let proto = ret._$proto
      if (proto === undefined) {
        const methods = originalCaller.getComponentDefinition().behavior.getMethods()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        proto = ret._$proto = new ComponentProto(methods, ret._$export) as any
      }
      const caller = proto!.derive()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      caller._$ = originalCaller as any
      return caller
    })
    if (overallBehavior) ret._$.behavior(overallBehavior)
    return ret
  }

  /**
   * Set the component options
   *
   * If called multiple times, only the latest call is valid.
   */
  options(options: ComponentDefinitionOptions): ResolveBehaviorBuilder<this, TChainingFilter> {
    this._$options = options
    return this as any
  }

  /** Use another behavior */
  behavior<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
    UChainingFilter extends ChainingFilterType,
    UComponentExport,
  >(
    behavior: Behavior<UData, UProperty, UMethod, UChainingFilter, UComponentExport>,
  ): ResolveBehaviorBuilder<
    ComponentBuilder<
      TPrevData,
      TData & UData,
      TProperty & UProperty,
      TMethod & UMethod,
      UChainingFilter,
      TPendingChainingFilter,
      UComponentExport
    >,
    UChainingFilter
  > {
    this._$parents.push(behavior as GeneralBehavior)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this._$ = this._$.behavior(behavior._$)
    if (behavior._$export) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this._$export = behavior._$export as any
    }
    return this as any
  }

  /** Set the export value when the component is being selected */
  override export<TNewComponentExport>(
    f: (this: GeneralComponent, source: GeneralComponent | null) => TNewComponentExport,
  ): ResolveBehaviorBuilder<
    ComponentBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TNewComponentExport
    >,
    TChainingFilter
  > {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this._$export = f as any
    return this as any
  }

  /**
   * Add some template data fields
   *
   * It does not support raw data, but a `gen` function which returns the new data fields.
   * The `gen` function executes once during component creation.
   */
  override data<T extends DataList>(
    gen: () => typeUtils.NewFieldList<AllData<TData, TProperty>, T>,
  ): ResolveBehaviorBuilder<
    ComponentBuilder<
      T,
      TData & T,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    return super.data(gen) as any
  }

  /**
   * Add a single property
   *
   * The property name should be different from other properties.
   */
  override property<N extends string, T extends PropertyType, V extends PropertyTypeToValueType<T>>(
    name: N,
    def: N extends keyof (TData & TProperty) ? never : typeUtils.PropertyListItem<T, V>,
  ): ResolveBehaviorBuilder<
    ComponentBuilder<
      TPrevData,
      TData,
      TProperty & Record<N, unknown extends V ? T : typeUtils.PropertyOption<T, V>>,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    return super.property(name, def) as any
  }

  /**
   * Add some public methods
   *
   * The public method can be used as an event handler, and can be visited in component instance.
   */
  override methods<T extends MethodList>(
    funcs: T & ThisType<Component<TData, TProperty, TMethod & T, any>>,
  ): ResolveBehaviorBuilder<
    ComponentBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod & T,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    return super.methods(funcs) as any
  }

  /**
   * Execute a function while component instance creation
   *
   * A `BuilderContext` is provided to tweak the component creation progress.
   * The return value is used as the "export" value of the behavior,
   * which can be imported by other behaviors.
   */
  override init<TExport extends Record<string, TaggedMethod<(...args: any[]) => any>> | void>(
    func: (
      this: Component<TData, TProperty, TMethod, TComponentExport>,
      builderContext: BuilderContext<
        TPrevData,
        TProperty,
        Component<TData, TProperty, TMethod, TComponentExport>
      >,
    ) => TExport,
    // eslint-disable-next-line function-paren-newline
  ): ResolveBehaviorBuilder<
    ComponentBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    return super.init(func) as any
  }

  /** Apply a classic definition object */
  override definition<
    TNewData extends DataList = Empty,
    TNewProperty extends PropertyList = Empty,
    TNewMethod extends MethodList = Empty,
    TNewComponentExport = never,
  >(
    def: ComponentDefinition<TNewData, TNewProperty, TNewMethod, TNewComponentExport> &
      ThisType<
        Component<
          TData & TNewData,
          TProperty & TNewProperty,
          TMethod & TNewMethod,
          TNewComponentExport
        >
      >,
  ): ResolveBehaviorBuilder<
    ComponentBuilder<
      TPrevData,
      TData & TNewData,
      TProperty & TNewProperty,
      TMethod & TNewMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TNewComponentExport
    >,
    TChainingFilter
  > {
    super.definition(def)
    if (def.options) this.options(def.options)
    return this as any
  }

  pageDefinition<TNewData extends DataList, TNewExtraFields extends { [k: PropertyKey]: any }>(
    def: PageDefinition<TNewData, TNewExtraFields> &
      ThisType<Component<TData & TNewData, TProperty, TMethod & TNewExtraFields, undefined>>,
  ): ResolveBehaviorBuilder<
    ComponentBuilder<
      TPrevData,
      TData & TNewData,
      TProperty,
      TMethod & TNewExtraFields,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport
    >,
    TChainingFilter
  > {
    const freeData = Object.create(null) as { [k: string]: any }
    const compDef = {
      methods: {},
    } as { [k: string]: any }
    const keys = Object.keys(def)
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i]!
      if (k === 'data' || k === 'options' || k === 'behaviors') {
        compDef[k] = def[k]
      } else if (typeof def[k] === 'function') {
        ;(compDef.methods as { [k: string]: unknown })[k] = def[k] as unknown
      } else {
        ;(freeData as { [k: string]: unknown })[k] = def[k]
      }
    }
    this.definition(compDef)
    this._$.init(function () {
      Object.assign(this, glassEasel.dataUtils.simpleDeepCopy(freeData))
    })
    return this as any
  }

  /**
   * Finish the component definition process
   */
  register(): ComponentType<TData, TProperty, TMethod, TComponentExport> {
    const is = this._$is
    const codeSpace = this._$codeSpace

    // processing common fields
    const [options, styleIsolation] = codeSpace.prepareComponentOptions(is, this._$options)
    this._$.options(options)
    const staticConfig = codeSpace.getComponentStaticConfig(is)
    const using = staticConfig?.usingComponents
    const generics = staticConfig?.componentGenerics
    const placeholder = staticConfig?.componentPlaceholder
    if (using) this._$.usingComponents(using)
    if (generics) this._$.generics(generics)
    if (placeholder) this._$.placeholders(placeholder)
    const template = codeSpace.getCompiledTemplate(is)
    if (template) this._$.template(template)

    // do registration
    codeSpace._$styleIsolationMap[is] = styleIsolation
    const compDef = this._$.registerComponent()
    this._$alias?.forEach((alias) => {
      this._$codeSpace.getComponentSpace().exportComponent(alias, this._$is)
    })
    return new ComponentType(compDef)
  }
}
