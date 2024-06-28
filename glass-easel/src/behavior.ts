/* eslint-disable @typescript-eslint/no-unsafe-return */

import {
  ComponentDefinition,
  type GeneralComponentDefinition,
  type LifetimeFuncs,
  type Lifetimes,
  type PageLifetimeFuncs,
} from './component'
import {
  type ChainingFilterFunc,
  type ChainingFilterType,
  type ComponentInstance,
  type ComponentMethod,
  type ComponentParams,
  type DataList,
  type DataWithPropertyValues,
  type Empty,
  type GetFromObserverPathString,
  type IsNever,
  type Merge,
  type MethodList,
  type NewFieldList,
  type ObserverDataPathStrings,
  type PropertyList,
  type PropertyListItem,
  type PropertyOption,
  type PropertyType,
  type PropertyTypeToValueType,
  type RelationParams,
  type SetDataSetter,
  type TaggedMethod,
  type TraitRelationParams,
  type UnTaggedMethod,
} from './component_params'
import {
  getDefaultComponentSpace,
  type ComponentSpace,
  type ComponentWaitingList,
} from './component_space'
import { parseMultiPaths, type MultiPaths } from './data_path'
import {
  DataGroupObserverTree,
  NormalizedPropertyType,
  normalizePropertyType,
  normalizePropertyTypeShortHand,
  shallowMerge,
  type DataValue,
  type PropertyDefinition,
} from './data_proxy'
import { simpleDeepCopy } from './data_utils'
import { type EventListener } from './event'
import { FuncArr, safeCallback } from './func_arr'
import { type ComponentOptions } from './global_options'
import { normalizeRelation, type RelationDefinition, type RelationHandler } from './relation'
import { type TraitBehavior } from './trait_behaviors'
import { dispatchError, triggerWarning } from './warning'

export type ComponentDefinitionWithPlaceholder =
  | {
      final: GeneralComponentDefinition | null
      source: GeneralBehavior
      placeholder: string | null
      waiting: ComponentWaitingList | null
    }
  | NativeNodeDefinition

export type NativeNodeDefinition = string

type ResolveBehaviorBuilder<
  B,
  TChainingFilter extends ChainingFilterType,
> = IsNever<TChainingFilter> extends false
  ? TChainingFilter extends ChainingFilterType
    ? Omit<B, TChainingFilter['remove']> & TChainingFilter['add']
    : B
  : B

export interface BuilderContext<
  TPrevData extends DataList,
  TProperty extends PropertyList,
  TMethodCaller,
> extends ThisType<TMethodCaller> {
  self: TMethodCaller
  data: Merge<DataWithPropertyValues<TPrevData, TProperty>>
  setData: (newData: Partial<SetDataSetter<TPrevData>>) => void
  implement: <TIn extends { [x: string]: any }>(
    traitBehavior: TraitBehavior<TIn, any>,
    impl: TIn,
  ) => void
  relation<TOut extends { [key: string]: any }>(
    def: TraitRelationParams<TOut>,
  ): RelationHandler<any, TOut>
  relation(def: RelationParams): RelationHandler<any, never>
  observer<
    P extends ObserverDataPathStrings<DataWithPropertyValues<TPrevData, TProperty>>,
    V = Merge<GetFromObserverPathString<DataWithPropertyValues<TPrevData, TProperty>, P>>,
  >(
    paths: P,
    func: (newValue: V) => void,
  ): void
  observer<
    P extends ObserverDataPathStrings<DataWithPropertyValues<TPrevData, TProperty>>[],
    V = {
      [K in keyof P]: Merge<
        GetFromObserverPathString<DataWithPropertyValues<TPrevData, TProperty>, P[K]>
      >
    },
  >(
    paths: readonly [...P],
    func: (...newValues: V extends any[] ? V : never) => void,
  ): void
  lifetime: <L extends keyof Lifetimes>(name: L, func: Lifetimes[L]) => void
  pageLifetime: (name: string, func: (...args: any[]) => void) => void
  method: <Fn extends ComponentMethod>(func: Fn) => TaggedMethod<Fn>
  listener: <T>(func: EventListener<T>) => TaggedMethod<EventListener<T>>
}

export type GeneralBehaviorBuilder = BehaviorBuilder<
  Record<string, any>,
  Record<string, any>,
  Record<string, any>,
  Record<string, any>,
  never,
  never,
  Record<string, any>
>

export class BehaviorBuilder<
  TPrevData extends DataList = Empty,
  TData extends DataList = Empty,
  TProperty extends PropertyList = Empty,
  TMethod extends MethodList = Empty,
  TChainingFilter extends ChainingFilterType = never,
  TPendingChainingFilter extends ChainingFilterType = never,
  TExtraThisFields extends DataList = Empty,
> {
  /** @internal */
  _$ownerSpace: ComponentSpace
  /** @internal */
  _$is: string | undefined
  /** @internal */
  _$behaviors: (string | GeneralBehavior)[] = []
  /** @internal */
  _$chainingFilter?: (chain: GeneralBehaviorBuilder) => any
  /** @internal */
  _$options?: ComponentOptions
  /** @internal */
  _$traitBehaviors: { traitBehavior: TraitBehavior<any, any>; impl: any }[] = []
  /** @internal */
  _$template?: { [key: string]: unknown }
  /** @internal */
  _$using?: { [alias: string]: string | GeneralComponentDefinition }
  /** @internal */
  _$placeholders?: { [alias: string]: string }
  /** @internal */
  _$generics?: { [alias: string]: { default?: string | GeneralComponentDefinition } | true }
  /** @internal */
  _$externalClasses?: string[]
  /** @internal */
  _$staticData: { [field: string]: any } | undefined = undefined
  /** @internal */
  _$data: (() => { [field: string]: any })[] = []
  /** @internal */
  _$properties?: { name: string; def: PropertyListItem<PropertyType, unknown> }[]
  /** @internal */
  _$methods: { name: string; func: ComponentMethod }[] = []
  /** @internal */
  _$observers?: {
    dataPaths: MultiPaths
    func: ComponentMethod | string
    once: boolean
  }[]
  /** @internal */
  _$lifetimes: { name: string; func: ComponentMethod; once: boolean }[] = []
  /** @internal */
  _$pageLifetimes?: { name: string; func: ComponentMethod; once: boolean }[] = []
  /** @internal */
  _$listeners?: {
    [name: string]: ComponentMethod | string
  }
  /** @internal */
  _$relations?: { name: string; rel: RelationParams }[]
  /** @internal */
  _$init: ((this: any, ctx: any) => any)[] = []
  /** @internal */
  _$methodCallerInit?: (this: ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>) => any

  /** @internal */
  constructor(is: string | undefined, ownerSpace: ComponentSpace) {
    this._$is = is
    this._$ownerSpace = ownerSpace
  }

  /**
   * Set a front-most init function
   *
   * It should return the method caller (the `this` value for various callbacks)
   * that will be used in future.
   */
  methodCallerInit(
    func: (this: ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>) => any,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    this._$methodCallerInit = func
    return this as any
  }

  /**
   * Add a behavior
   *
   * If the behavior contains a chaining filter, the chaining filter is called.
   */
  behavior<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
    UChainingFilter extends ChainingFilterType,
    UExtraThisFields extends DataList,
  >(
    behavior: Behavior<UData, UProperty, UMethod, UChainingFilter, UExtraThisFields>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData & UData,
      TProperty & UProperty,
      TMethod & UMethod,
      UChainingFilter,
      TPendingChainingFilter,
      TExtraThisFields & UExtraThisFields
    >,
    UChainingFilter
  > {
    this._$behaviors.push(behavior as GeneralBehavior)
    if (behavior._$chainingFilter) {
      return behavior._$chainingFilter(this as any) as any
    }
    return this as any
  }

  /**
   * Set the chaining filter
   *
   * The chaining filter is the definition filter for chaining API.
   * It SHOULD return another chainable object for further chaining.
   */
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
      TExtraThisFields
    >,
    TChainingFilter
  > {
    this._$chainingFilter = func
    return this as any
  }

  /**
   * Set component options
   *
   * The options will be merged with previous settings.
   */
  options(options: ComponentOptions): ResolveBehaviorBuilder<this, TChainingFilter> {
    const oldOptions = this._$options
    if (oldOptions) {
      this._$options = { ...oldOptions, ...options }
    } else {
      this._$options = options
    }
    return this as any
  }

  /**
   * Implement a trait behavior
   */
  implement<TIn extends { [key: string]: any }>(
    traitBehavior: TraitBehavior<TIn, any>,
    impl: TIn,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    this._$traitBehaviors.push({ traitBehavior, impl })
    return this as any
  }

  /**
   * Set the compiled template object
   */
  template(template: { [key: string]: unknown }): ResolveBehaviorBuilder<this, TChainingFilter> {
    this._$template = template
    return this as any
  }

  /**
   * Add other components to the component using list
   */
  usingComponents<T extends Record<string, string | ComponentDefinition<any, any, any>>>(
    list: T,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    if (this._$using) this._$using = { ...this._$using, ...list }
    else this._$using = list
    return this as any
  }

  /**
   * Add some placeholders
   *
   * The alias SHOULD be in the using list, otherwise it will be ignored.
   */
  placeholders(list: Record<string, string>): ResolveBehaviorBuilder<this, TChainingFilter> {
    if (this._$placeholders) this._$placeholders = { ...this._$placeholders, ...list }
    else this._$placeholders = list
    return this as any
  }

  /**
   * Add other generics
   *
   * The alias SHOULD NOT be in the using list, otherwise it will be ignored.
   */
  generics(
    list: Record<string, { default?: string | GeneralComponentDefinition } | true>,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    if (this._$generics) this._$generics = { ...this._$generics, ...list }
    else this._$generics = list
    return this as any
  }

  /**
   * Add external classes
   */
  externalClasses(list: string[]): ResolveBehaviorBuilder<this, TChainingFilter> {
    if (this._$externalClasses) this._$externalClasses = this._$externalClasses.concat(list)
    else this._$externalClasses = list
    return this as any
  }

  /**
   * Add some template data fields
   *
   * It does not support raw data, but a `gen` function which returns the new data fields.
   * The `gen` function executes once during component creation.
   */
  data<T extends DataList>(
    gen: () => NewFieldList<DataWithPropertyValues<TData, TProperty>, T>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      T,
      TData & T,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TExtraThisFields
    >,
    TChainingFilter
  > {
    this._$data.push(() => safeCallback('Data Generator', gen, null, [], this._$is) ?? {})
    return this as any
  }

  /**
   * Set the static template data fields
   *
   * The data will be cloned once during component creation.
   * If called multiple times, the static data will be overwritten but not merged!
   * Usually, the `data()` method is preferred.
   */
  staticData<T extends DataList>(
    data: NewFieldList<DataWithPropertyValues<TData, TProperty>, T>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      T,
      TData & T,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TExtraThisFields
    >,
    TChainingFilter
  > {
    this._$staticData = data
    return this as any
  }

  /**
   * Add a single property
   *
   * The property name should be different from other properties.
   */
  property<N extends string, T extends PropertyType, V extends PropertyTypeToValueType<T>>(
    name: N,
    def: N extends keyof (TData & TProperty) ? never : PropertyListItem<T, V>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData,
      TProperty & Record<N, unknown extends V ? T : PropertyOption<T, V>>,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TExtraThisFields
    >,
    TChainingFilter
  > {
    if (!this._$properties) this._$properties = []
    this._$properties.push({ name, def: def as PropertyListItem<PropertyType, unknown> })
    return this as any
  }

  /**
   * Add a single public method
   *
   * The public method can be used as an event handler, and can be visited in component instance.
   */
  methods<T extends MethodList>(
    funcs: T & ThisType<ComponentInstance<TData, TProperty, TMethod & T, TExtraThisFields>>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod & T,
      TChainingFilter,
      TPendingChainingFilter,
      TExtraThisFields
    >,
    TChainingFilter
  > {
    const keys = Object.keys(funcs)
    for (let i = 0; i < keys.length; i += 1) {
      const name = keys[i]!
      const func = funcs[name]!
      this._$methods.push({ name, func })
    }
    return this as any
  }

  /**
   * Add a data observer
   */
  observer<
    P extends ObserverDataPathStrings<DataWithPropertyValues<TPrevData, TProperty>>,
    V = Merge<GetFromObserverPathString<DataWithPropertyValues<TPrevData, TProperty>, P>>,
  >(
    paths: P,
    func: (
      this: ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>,
      newValue: V,
    ) => void,
    once?: boolean,
  ): ResolveBehaviorBuilder<this, TChainingFilter>
  observer<
    P extends ObserverDataPathStrings<DataWithPropertyValues<TPrevData, TProperty>>[],
    V = {
      [K in keyof P]: Merge<
        GetFromObserverPathString<DataWithPropertyValues<TPrevData, TProperty>, P[K]>
      >
    },
  >(
    paths: readonly [...P],
    func: (
      this: ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>,
      ...newValues: V extends any[] ? V : never
    ) => void,
    once?: boolean,
  ): ResolveBehaviorBuilder<this, TChainingFilter>
  observer(
    paths: string | readonly string[],
    func: (
      this: ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>,
      ...args: any[]
    ) => any,
    once = false,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    if (!this._$observers) this._$observers = []
    try {
      this._$observers.push({ dataPaths: parseMultiPaths(paths as string | string[]), func, once })
    } catch (e) {
      // parse multi paths my throw errors
      dispatchError(e, `observer`, this._$is)
    }
    return this as any
  }

  /**
   * Add a lifetime callback
   */
  lifetime<L extends keyof Lifetimes>(
    name: L,
    func: (
      this: ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>,
      ...args: Parameters<Lifetimes[L]>
    ) => ReturnType<Lifetimes[L]>,
    once = false,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    this._$lifetimes.push({ name, func, once })
    return this as any
  }

  /**
   * Add a page-lifetime callback
   */
  pageLifetime(
    name: string,
    func: (
      this: ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>,
      ...args: any[]
    ) => any,
    once = false,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    if (!this._$pageLifetimes) this._$pageLifetimes = []
    this._$pageLifetimes.push({ name, func, once })
    return this as any
  }

  /**
   * Add a relation
   */
  relation(
    name: string,
    rel: RelationParams & ThisType<ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>>,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    if (!this._$relations) this._$relations = []
    this._$relations.push({ name, rel })
    return this as any
  }

  /**
   * Execute a function while component instance creation
   *
   * A `BuilderContext` is provided to tweak the component creation progress.
   * The return value is used as the "export" value of the behavior,
   * which can be imported by other behaviors.
   */
  init<TExport extends Record<string, TaggedMethod<(...args: any[]) => any>> | void>(
    func: (
      this: ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>,
      builderContext: BuilderContext<
        TPrevData,
        TProperty,
        ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>
      >,
    ) => TExport,
    // eslint-disable-next-line function-paren-newline
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod &
        (TExport extends void
          ? Empty
          : {
              [K in keyof TExport]: UnTaggedMethod<TExport[K]>
            }),
      TChainingFilter,
      TPendingChainingFilter,
      TExtraThisFields
    >,
    TChainingFilter
  > {
    this._$init.push(func)
    return this as any
  }

  /**
   * Apply a classic-style definition
   */
  definition<
    TNewData extends DataList = Empty,
    TNewProperty extends PropertyList = Empty,
    TNewMethod extends MethodList = Empty,
  >(
    def: ComponentParams<TNewData, TNewProperty, TNewMethod> &
      ThisType<
        ComponentInstance<
          TData & TNewData,
          TProperty & TNewProperty,
          TMethod & TNewMethod,
          TExtraThisFields
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
      TExtraThisFields
    >,
    TChainingFilter
  > {
    if (def.behaviors) this._$behaviors.push(...def.behaviors)
    if (def.options) this.options(def.options)
    if (def.template) this.template(def.template)
    if (def.using) this.usingComponents(def.using)
    if (def.placeholders) this.placeholders(def.placeholders)
    if (def.generics) this.generics(def.generics)
    if (def.externalClasses) this.externalClasses(def.externalClasses)
    const rawData = def.data
    if (rawData !== undefined) {
      if (typeof rawData === 'function') {
        this._$data.push(() => safeCallback('Data Generator', rawData, null, [], this._$is) ?? {})
      } else {
        this._$staticData = rawData
      }
    }
    const rawProperties = def.properties
    if (rawProperties !== undefined) {
      if (!this._$properties) this._$properties = []
      const keys = Object.keys(rawProperties)
      for (let i = 0; i < keys.length; i += 1) {
        const name = keys[i]!
        const def = rawProperties[name]! as PropertyList
        this._$properties.push({ name, def })
      }
    }
    const rawMethods = def.methods
    if (rawMethods !== undefined) {
      const keys = Object.keys(rawMethods)
      for (let i = 0; i < keys.length; i += 1) {
        const name = keys[i]!
        const func = rawMethods[name]!
        this._$methods.push({ name, func })
      }
    }
    const rawObservers = def.observers
    if (rawObservers !== undefined) {
      if (!this._$observers) this._$observers = []
      if (Array.isArray(rawObservers)) {
        for (let i = 0; i < rawObservers.length; i += 1) {
          const { fields, observer } = rawObservers[i]!
          try {
            this._$observers.push({
              dataPaths: parseMultiPaths(fields ?? '**'),
              func: observer,
              once: false,
            })
          } catch (e) {
            // parse multi paths may throw errors
            dispatchError(e, `definition`, this._$is)
          }
        }
      } else {
        const keys = Object.keys(rawObservers)
        for (let i = 0; i < keys.length; i += 1) {
          const fields = keys[i]!
          const observer = rawObservers[fields]!
          try {
            this._$observers.push({
              dataPaths: parseMultiPaths(fields),
              func: observer,
              once: false,
            })
          } catch (e) {
            // parse multi paths may throw errors
            dispatchError(e, `definition`, this._$is)
          }
        }
      }
    }
    const rawLifetimes = def.lifetimes
    if (rawLifetimes?.created === undefined && typeof def.created === 'function') {
      this._$lifetimes.push({ name: 'created', func: def.created, once: true })
    }
    if (rawLifetimes?.attached === undefined && typeof def.attached === 'function') {
      this._$lifetimes.push({ name: 'attached', func: def.attached, once: true })
    }
    if (rawLifetimes?.moved === undefined && typeof def.moved === 'function') {
      this._$lifetimes.push({ name: 'moved', func: def.moved, once: true })
    }
    if (rawLifetimes?.detached === undefined && typeof def.detached === 'function') {
      this._$lifetimes.push({ name: 'detached', func: def.detached, once: true })
    }
    if (rawLifetimes?.ready === undefined && typeof def.ready === 'function') {
      this._$lifetimes.push({ name: 'ready', func: def.ready, once: true })
    }
    if (rawLifetimes) {
      const keys = Object.keys(rawLifetimes)
      for (let i = 0; i < keys.length; i += 1) {
        const name = keys[i]!
        const func = rawLifetimes[name]!
        this._$lifetimes.push({ name, func, once: true })
      }
    }
    const rawPageLifetimes = def.pageLifetimes
    if (rawPageLifetimes) {
      if (!this._$pageLifetimes) this._$pageLifetimes = []
      const keys = Object.keys(rawPageLifetimes)
      for (let i = 0; i < keys.length; i += 1) {
        const name = keys[i]!
        const func = rawPageLifetimes[name]!
        this._$pageLifetimes.push({ name, func, once: true })
      }
    }
    this._$listeners = def.listeners
    const rawRelations = def.relations
    if (rawRelations) {
      if (!this._$relations) this._$relations = []
      const keys = Object.keys(rawRelations)
      for (let i = 0; i < keys.length; i += 1) {
        const name = keys[i]!
        const rel = rawRelations[name]!
        this._$relations.push({ name, rel })
      }
    }
    return this as any
  }

  /**
   * Finish build, generate a behavior, and register it in the component space
   */
  registerBehavior(): Behavior<
    TData,
    TProperty,
    TMethod,
    TPendingChainingFilter,
    TExtraThisFields
  > {
    const is = this._$is
    const behavior = new Behavior(this)
    if (is !== undefined) {
      this._$ownerSpace._$registerBehavior(is, behavior as unknown as GeneralBehavior)
    }
    return behavior as any
  }

  extraThisFieldsType<T extends DataList>(): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TExtraThisFields & T
    >,
    TChainingFilter
  > {
    return this as any
  }

  /**
   * Finish build, generate a component definition, and register it in the component space
   */
  registerComponent(): ComponentDefinition<TData, TProperty, TMethod> {
    const is = this._$is
    const behavior = new Behavior(this)
    const compDef = new ComponentDefinition(behavior)
    if (is !== undefined) {
      this._$ownerSpace._$registerComponent(is, compDef as unknown as GeneralComponentDefinition)
    }
    return compDef
  }
}

/**
 * Common mixin-like behavior
 *
 * Each component definition contains a single *root* behavior.
 * A behavior can mixin other behaviors.
 */
export class Behavior<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
  TChainingFilter extends ChainingFilterType,
  TExtraThisFields extends DataList = Empty,
> {
  /** @internal */
  private _$unprepared: boolean
  is: string
  ownerSpace: ComponentSpace
  /** @internal */
  private _$builder: BehaviorBuilder<
    any,
    TData,
    TProperty,
    TMethod,
    any,
    TChainingFilter,
    TExtraThisFields
  >
  /** @internal */
  private _$flatAncestors: Set<GeneralBehavior>
  /** @internal */
  _$chainingFilter?: (chain: GeneralBehaviorBuilder) => TChainingFilter
  /** @internal */
  _$options?: ComponentOptions
  /** @internal */
  _$traitBehaviors?: { traitBehavior: TraitBehavior<any, any>; impl: any }[]
  /** @internal */
  _$template?: { [key: string]: unknown }
  /** @internal */
  _$using: { [alias: string]: ComponentDefinitionWithPlaceholder }
  /** @internal */
  _$generics?: string[]
  /** @internal */
  _$genericDefaults?: { [alias: string]: null | GeneralComponentDefinition | NativeNodeDefinition }
  /** @internal */
  _$externalClasses?: string[]
  /** @internal */
  _$staticData?: DataList
  /** @internal */
  _$data: (() => { [field: string]: any })[]
  /** @internal */
  _$propertyMap: { [name: string]: PropertyDefinition }
  /** @internal */
  _$methodMap: { [name: string]: ComponentMethod }
  /** @internal */
  _$observers: { dataPaths: MultiPaths; observer: ComponentMethod; once: boolean }[]
  /** @internal */
  _$lifetimes: { name: string; func: ComponentMethod; once: boolean }[]
  /** @internal */
  _$pageLifetimes?: { name: string; func: ComponentMethod; once: boolean }[]
  /** @internal */
  _$listeners?: { id: string; ev: string; listener: ComponentMethod }[]
  /** @internal */
  _$relationMap?: { [name: string]: RelationDefinition }
  /** @internal */
  _$init: ((this: any, ctx: any) => any)[]
  /** @internal */
  _$methodCallerInit?: (
    this: ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>,
  ) => ComponentInstance<TData, TProperty, TMethod, TExtraThisFields>

  /**
   * Create a behavior with classic-style definition
   */
  static create<TData extends DataList, TProperty extends PropertyList, TMethod extends MethodList>(
    def: ComponentParams<TData, TProperty, TMethod> &
      ThisType<ComponentInstance<TData, TProperty, TMethod>>,
    ownerSpace?: ComponentSpace,
  ) {
    return new BehaviorBuilder(def.is, ownerSpace || getDefaultComponentSpace())
      .definition(def)
      .registerBehavior()
  }

  /** @internal */
  constructor(
    builder: BehaviorBuilder<
      any,
      TData,
      TProperty,
      TMethod,
      any,
      TChainingFilter,
      TExtraThisFields
    >,
  ) {
    this._$unprepared = true
    this.is = builder._$is || ''
    this.ownerSpace = builder._$ownerSpace
    this._$builder = builder
    this._$flatAncestors = new Set()
    this._$chainingFilter = builder._$chainingFilter
    this._$options = builder._$options
    this._$traitBehaviors = undefined
    this._$template = builder._$template
    this._$using = Object.create(null) as { [alias: string]: ComponentDefinitionWithPlaceholder }
    this._$generics = undefined
    this._$genericDefaults = undefined
    this._$externalClasses = builder._$externalClasses
    this._$staticData = undefined
    this._$data = []
    this._$propertyMap = Object.create(null) as { [name: string]: PropertyDefinition }
    this._$methodMap = Object.create(null) as { [name: string]: ComponentMethod }
    this._$observers = []
    this._$lifetimes = []
    this._$pageLifetimes = undefined
    this._$listeners = undefined
    this._$relationMap = undefined
    this._$init = []
    this._$methodCallerInit = builder._$methodCallerInit
  }

  general(): GeneralBehavior {
    return this as unknown as GeneralBehavior
  }

  /**
   * List all component dependencies (recursively)
   *
   * This method will prepare the underlying behavior.
   */
  getComponentDependencies(genericTargets?: {
    [name: string]: GeneralComponentDefinition | NativeNodeDefinition
  }): Set<GeneralComponentDefinition> {
    const ret: Set<GeneralComponentDefinition> = new Set()
    const rec = function (this: void, beh: GeneralBehavior) {
      if (beh._$unprepared) beh.prepare()
      const keys = Object.keys(beh._$using)
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i]!
        const v = beh._$using[k]!
        if (typeof v === 'string') continue
        const dep = v.final
        if (dep && !ret.has(dep)) {
          ret.add(dep)
          rec(dep.behavior as GeneralBehavior)
        }
      }
    }
    rec(this.general())
    if (genericTargets) {
      const list = Object.values(genericTargets)
      for (let i = 0; i < list.length; i += 1) {
        const dep = list[i]!
        if (typeof dep === 'string') continue
        if (!ret.has(dep)) {
          ret.add(dep)
          rec(dep.behavior as GeneralBehavior)
        }
      }
    }
    return ret
  }

  /** Same as `prepare` method in the prototype (for backward compatibility) */
  static prepare<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
    TChainingFilter extends ChainingFilterType = never,
  >(behavior: Behavior<TData, TProperty, TMethod, TChainingFilter>) {
    behavior.prepare()
  }

  /**
   * Execute the prepare phase (an optimization phase) of this behavior
   *
   * Every behavior needs this phase for better future performance.
   * However, this phase requires a little time for execution,
   * and requires its all dependent behaviors created.
   * If a dependent behavior is not prepared, then its prepare phase is also executed.
   */
  prepare() {
    if (!this._$unprepared) return
    this._$unprepared = false
    const is = this.is
    const space = this.ownerSpace
    const builder = this._$builder

    // mixin dependent behaviors
    const flatAncestors = this._$flatAncestors
    if (Array.isArray(builder._$behaviors)) {
      for (let i = 0; i < builder._$behaviors.length; i += 1) {
        const parentName = builder._$behaviors[i]!
        let parent: GeneralBehavior | null = null
        if (parentName instanceof Behavior) {
          parent = parentName
        } else {
          const parentNameStr = String(parentName)
          if (space) {
            parent = space.getBehaviorByUrl(parentNameStr, is)
          }
          if (!parent) {
            dispatchError(new Error(`behavior "${parentNameStr}" is not found.`), `[prepare]`, is)
          }
        }
        if (!parent) continue
        if (parent._$unprepared) Behavior.prepare(parent)

        // merge trait behaviors
        const traitBehaviors = parent._$traitBehaviors
        if (traitBehaviors !== undefined) {
          if (!this._$traitBehaviors) this._$traitBehaviors = []
          this._$traitBehaviors.push(...traitBehaviors)
        }

        // merge static data
        const staticData = parent._$staticData
        if (staticData) {
          if (!this._$staticData) this._$staticData = {}
          shallowMerge(this._$staticData, staticData)
        }

        // merge methods
        Object.assign(this._$methodMap, parent._$methodMap)

        // merge properties
        Object.assign(this._$propertyMap, parent._$propertyMap)

        // merge dynamic data
        this._$data.push(...parent._$data)

        // merge observers
        const observers = parent._$observers
        for (let i = 0; i < observers.length; i += 1) {
          const item = observers[i]!
          if (item.once) {
            if (this._$observers.indexOf(item as any) >= 0) continue
          }
          this._$observers.push(item as any)
        }

        // merge lifetimes
        const lifetimes = parent._$lifetimes
        for (let i = 0; i < lifetimes.length; i += 1) {
          const item = lifetimes[i]!
          if (item.once) {
            if (this._$lifetimes.indexOf(item as any) >= 0) continue
          }
          this._$lifetimes.push(item as any)
        }

        // merge page lifetimes
        const pageLifetimes = parent._$pageLifetimes
        if (pageLifetimes !== undefined) {
          if (this._$pageLifetimes) {
            for (let i = 0; i < pageLifetimes.length; i += 1) {
              const item = pageLifetimes[i]!
              if (item.once) {
                if (this._$pageLifetimes.indexOf(item as any) >= 0) continue
              }
              this._$pageLifetimes.push(item as any)
            }
          } else {
            this._$pageLifetimes = pageLifetimes.slice() as any[]
          }
        }

        // merge legacy listeners
        const listeners = parent._$listeners as any[] | undefined
        if (listeners !== undefined) {
          if (!this._$listeners) this._$listeners = []
          this._$listeners.push(...listeners)
        }

        // merge relations
        const relations = parent._$relationMap
        if (relations !== undefined) {
          if (!this._$relationMap) {
            this._$relationMap = Object.create(null) as { [name: string]: RelationDefinition }
          }
          Object.assign(this._$relationMap, relations)
        }

        // merge init
        this._$init.push(...parent._$init)

        // construct flat ancestors
        parent._$flatAncestors.forEach((p) => {
          flatAncestors.add(p)
        })
      }
    }

    // init trait behaviors
    const traitBehaviors = builder._$traitBehaviors
    if (traitBehaviors !== undefined) {
      if (!this._$traitBehaviors) this._$traitBehaviors = []
      this._$traitBehaviors.push(...traitBehaviors)
    }

    // init using
    if (typeof builder._$using === 'object' && builder._$using !== null) {
      const hasPlaceholders =
        typeof builder._$placeholders === 'object' && builder._$placeholders !== null
      const keys = Object.keys(builder._$using)
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i]!
        const v = builder._$using[k]!
        let placeholder = null
        if (hasPlaceholders) {
          placeholder = (builder._$placeholders as { [name: string]: string })[k] ?? null
        }
        if (v instanceof ComponentDefinition) {
          this._$using[k] = {
            final: v,
            source: this as GeneralBehavior,
            placeholder,
            waiting: null,
          }
        } else if (space) {
          const path = String(v)
          const final = space.getComponentByUrlWithoutDefault(path, is)
          if (final) {
            this._$using[k] = {
              final,
              source: this as GeneralBehavior,
              placeholder: null,
              waiting: null,
            }
          } else if (placeholder !== null) {
            const p: ComponentDefinitionWithPlaceholder = {
              final: null,
              source: this as GeneralBehavior,
              placeholder,
              waiting: null,
            }
            const wl = space._$componentWaitingList(path, is)
            if (wl) {
              wl.add((c) => {
                p.final = c
                p.placeholder = null
                p.waiting = null
              })
              p.waiting = wl
            }
            this._$using[k] = p
          } else {
            const final = space.getGlobalUsingComponent(path)
            if (typeof final === 'string') {
              this._$using[k] = final
            } else {
              this._$using[k] = {
                final,
                source: this as GeneralBehavior,
                placeholder: null,
                waiting: null,
              }
            }
          }
        } else {
          dispatchError(new Error(`cannot find component "${String(v)}"`), `[prepare]`, is)
        }
      }
    }

    // init generics
    if (typeof builder._$generics === 'object' && builder._$generics !== null) {
      const generics = (this._$generics = [] as string[])
      const genericDefaults = Object.create(null) as {
        [alias: string]: null | GeneralComponentDefinition | NativeNodeDefinition
      }
      this._$genericDefaults = genericDefaults
      const genericKeys = Object.keys(builder._$generics)
      for (let i = 0; i < genericKeys.length; i += 1) {
        const k = genericKeys[i]!
        const genericDef = builder._$generics[k]
        let defaultComp: GeneralComponentDefinition | NativeNodeDefinition | null = null
        const d = genericDef === true ? undefined : genericDef?.default
        if (d !== undefined) {
          if (d instanceof ComponentDefinition) {
            defaultComp = d
          } else if (space) {
            const tagName = String(d)
            defaultComp =
              space.getComponentByUrlWithoutDefault(tagName, is) ||
              space.getGlobalUsingComponent(tagName)
          } else {
            dispatchError(
              new Error(`cannot define generic "${k}" without a default implementor.`),
              `[prepare]`,
              is,
            )
          }
        }
        generics.push(k)
        genericDefaults[k] = defaultComp
      }
    }

    // init static data
    const staticData = builder._$staticData
    if (staticData) {
      if (!this._$staticData) {
        this._$staticData = staticData
      } else {
        shallowMerge(this._$staticData, staticData)
      }
    }

    // init methods (methods should be initialized before others with function refs)
    const methods = builder._$methods
    for (let i = 0; i < methods.length; i += 1) {
      const { name, func } = methods[i]!
      this._$methodMap[name] = func
    }

    // init properties
    const properties = builder._$properties
    if (properties !== undefined) {
      const initValueFuncs: { name: string; func: () => any }[] = []
      for (let i = 0; i < properties.length; i += 1) {
        const { name, def } = properties[i]!
        const shortHandDef = normalizePropertyTypeShortHand(def)
        let d: PropertyDefinition
        if (shortHandDef !== null) {
          d = shortHandDef
        } else {
          const propDef = def as PropertyOption<any, unknown>
          let type = normalizePropertyType(propDef.type)
          let optionalTypes: NormalizedPropertyType[] | null = null
          if (Array.isArray(propDef.optionalTypes)) {
            optionalTypes = propDef.optionalTypes.map(normalizePropertyType)
            if (optionalTypes.length > 0) {
              if (type === NormalizedPropertyType.Invalid || type === NormalizedPropertyType.Any) {
                type = optionalTypes[0]!
              }
            }
          }
          if (type === NormalizedPropertyType.Invalid) {
            dispatchError(new Error(`the type of property "${name}" is illegal`), `[prepare]`, is)
          }
          let value: DataValue = propDef.value
          if (propDef.value === undefined) {
            if (type === NormalizedPropertyType.String) value = ''
            else if (type === NormalizedPropertyType.Number) value = 0
            else if (type === NormalizedPropertyType.Boolean) value = false
            else if (type === NormalizedPropertyType.Array) value = []
            else value = null
          } else if (propDef.default !== undefined) {
            triggerWarning(
              `the initial value of property "${name}" is not used when its default is provided.`,
              is,
            )
          }
          let observer: ((newValue: any, oldValue: any) => void) | null
          if (typeof propDef.observer === 'function') {
            observer = propDef.observer
          } else if (typeof propDef.observer === 'string') {
            observer = this._$methodMap[propDef.observer] || null
            if (!observer) {
              dispatchError(
                new Error(
                  `Cannot find method "${propDef.observer}" for observer of property "${name}".`,
                ),
                `[prepare]`,
                is,
              )
            }
          } else {
            observer = null
            if (propDef.observer !== undefined) {
              dispatchError(
                new Error(
                  `The observer of property "${name}" is not a function, got "${typeof propDef.observer}".`,
                ),
                `[prepare]`,
                is,
              )
            }
          }
          let comparer: ((newValue: unknown, oldValue: unknown) => boolean) | null
          if (typeof propDef.comparer === 'function') {
            comparer = propDef.comparer
          } else {
            comparer = null
            if (propDef.comparer !== undefined) {
              dispatchError(
                new Error(`the comparer of property "${name}" is not a function.`),
                `[prepare]`,
                is,
              )
            }
          }
          const reflectIdPrefix = !!propDef.reflectIdPrefix
          d = {
            type,
            optionalTypes,
            value,
            default: propDef.default,
            observer,
            comparer,
            reflectIdPrefix,
          }
        }
        this._$propertyMap[name] = d
        initValueFuncs.push({
          name,
          func:
            typeof d.default === 'function'
              ? () => {
                  const value = safeCallback(`Property "${name}" Default`, d.default!, null, [], is)
                  return value !== undefined ? value : simpleDeepCopy(d.value)
                }
              : () => simpleDeepCopy(d.value),
        })
      }
      this._$data.push(() => {
        const ret: DataList = {}
        for (let i = 0; i < initValueFuncs.length; i += 1) {
          const { name, func } = initValueFuncs[i]!
          ret[name] = func()
        }
        return ret
      })
    }

    // init dynamic data
    this._$data.push(...builder._$data)

    // observers
    const observers = builder._$observers
    if (observers !== undefined) {
      for (let i = 0; i < observers.length; i += 1) {
        const { dataPaths, func, once } = observers[i]!
        const observer = typeof func === 'function' ? func : this._$methodMap[func]
        if (typeof observer === 'function') {
          this._$observers.push({ dataPaths, observer, once })
        } else {
          dispatchError(
            new Error(`the "${String(observer)}" observer is not a function.`),
            `[prepare]`,
            is,
          )
        }
      }
    }

    // lifetimes
    const lifetimes = builder._$lifetimes
    this._$lifetimes.push(...lifetimes)

    // page lifetimes
    const pageLifetimes = builder._$pageLifetimes
    if (pageLifetimes) {
      if (!this._$pageLifetimes) this._$pageLifetimes = []
      this._$pageLifetimes.push(...pageLifetimes)
    }

    // listeners
    const listeners = builder._$listeners
    if (listeners !== undefined) {
      const keys = Object.keys(listeners)
      if (keys.length > 0) {
        this._$listeners = []
        for (let i = 0; i < keys.length; i += 1) {
          const k = keys[i]!
          const v = listeners[k]!
          const listener = typeof v === 'function' ? v : this._$methodMap[v]
          if (listener) {
            const dot = k.indexOf('.')
            let id: string
            let ev: string
            if (dot >= 0) {
              id = k.slice(0, dot)
              ev = k.slice(dot + 1)
            } else {
              id = ''
              ev = k
            }
            this._$listeners.push({ id, ev, listener })
          } else {
            dispatchError(
              new Error(`the "${k}" listener is not a function or a method name`),
              `[prepare]`,
              is,
            )
          }
        }
      }
    }

    // relations
    const relations = builder._$relations
    if (relations !== undefined) {
      if (!this._$relationMap) {
        this._$relationMap = Object.create(null) as { [name: string]: RelationDefinition }
      }
      for (let i = 0; i < relations.length; i += 1) {
        const { name: key, rel: relation } = relations[i]!
        if (relation === undefined || relation === null) continue
        const rel = normalizeRelation(space, is, key, relation)
        if (rel) this._$relationMap[key] = rel
      }
    }

    // init funcs
    this._$init.push(...builder._$init)

    flatAncestors.add(this as unknown as GeneralBehavior)
  }

  /**
   * Get the template content
   *
   * This method is usually used by the template engine.
   */
  getTemplate() {
    return this._$template
  }

  _$updateTemplate(template: { [key: string]: unknown }) {
    this._$template = template
  }

  /** Check whether the `other` behavior is a dependent behavior of this behavior */
  hasBehavior(other: string | GeneralBehavior): boolean {
    if (this._$unprepared) this.prepare()
    if (other instanceof Behavior) {
      return this._$flatAncestors.has(other)
    }
    if (this.ownerSpace) {
      const b = this.ownerSpace.getBehaviorByUrl(other, this.is)
      if (!b) {
        return false
      }
      return this._$flatAncestors.has(b)
    }
    return false
  }

  /**
   * Get the methods
   *
   * Only valid after `prepare` .
   */
  getMethods(): TMethod {
    return this._$methodMap as any as TMethod
  }

  /** @internal */
  _$generateObserverTree(): DataGroupObserverTree {
    const ot = new DataGroupObserverTree(this._$propertyMap)
    const observers = this._$observers
    for (let i = 0; i < observers.length; i += 1) {
      const { dataPaths, observer } = observers[i]!
      ot.addObserver(observer, dataPaths)
    }
    return ot
  }

  /** @internal */
  _$getAllLifetimeFuncs(): LifetimeFuncs {
    const ret = Object.create(null) as LifetimeFuncs
    const lifetimes = this._$lifetimes
    for (let i = 0; i < lifetimes.length; i += 1) {
      const { name, func } = lifetimes[i]!
      if (ret[name]) {
        ret[name]!.add(func)
      } else {
        const fa = (ret[name] = new FuncArr('lifetime'))
        fa.add(func)
      }
    }
    return ret
  }

  /** @internal */
  _$getAllPageLifetimeFuncs(): PageLifetimeFuncs {
    const ret = Object.create(null) as PageLifetimeFuncs
    const pageLifetimes = this._$pageLifetimes
    if (!pageLifetimes) return ret
    for (let i = 0; i < pageLifetimes.length; i += 1) {
      const { name, func } = pageLifetimes[i]!
      if (ret[name]) {
        ret[name]!.add(func)
      } else {
        const fa = (ret[name] = new FuncArr('pageLifetime'))
        fa.add(func)
      }
    }
    return ret
  }
}

export type GeneralBehavior = Behavior<
  Record<string, any>,
  Record<string, any>,
  Record<string, any>,
  any,
  any
>
