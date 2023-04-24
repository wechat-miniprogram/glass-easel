/* eslint-disable @typescript-eslint/no-unsafe-return */

import {
  ComponentParams,
  DataList,
  PropertyList,
  MethodList,
  ComponentInstance,
  PropertyListItem,
  ComponentMethod,
  RelationParams,
  PropertyType,
  TraitRelationParams,
  DataWithPropertyValues,
  PropertyOption,
  PropertyTypeToValueType,
  TaggedMethod,
  UnTaggedMethod,
  ChainingFilterFunc,
  ChainingFilterType,
  SetDataSetter,
  DeepReadonly,
  Empty,
  NewFieldList,
  ObserverDataPathStrings,
  GetFromObserverPathString,
  IsNever,
} from './component_params'
import { FuncArr, triggerWarning } from './func_arr'
import { ComponentOptions, getDefaultComponentSpace } from './global_options'
import { MultiPaths, parseMultiPaths } from './data_path'
import { DataValue, DataGroupObserverTree } from './data_proxy'
import {
  ComponentDefinition,
  GeneralComponentDefinition,
  LifetimeFuncs,
  Lifetimes,
  PageLifetimeFuncs,
} from './component'
import {
  RelationDefinition,
  RelationType,
  RelationListener,
  RelationFailedListener,
} from './relation'
import { normalizeUrl, ComponentSpace, ComponentWaitingList } from './component_space'
import { TraitBehavior } from './trait_behaviors'
import { simpleDeepCopy } from './data_utils'
import { EventListener } from './event'

export const enum NormalizedPropertyType {
  Invalid,
  Any,
  String,
  Number,
  Boolean,
  Object,
  Array,
  Function,
}

export type PropertyDefinition = {
  type: NormalizedPropertyType
  optionalTypes: NormalizedPropertyType[] | null
  value: unknown | undefined
  default: (() => unknown) | undefined
  observer: ((newValue: unknown, oldValue: unknown) => void) | null
  comparison: ((newValue: unknown, oldValue: unknown) => boolean) | null
  reflectIdPrefix: boolean
}

export type ComponentDefinitionWithPlaceholder =
  | {
      final: GeneralComponentDefinition | null
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

const shallowMerge = (dest: { [key: string]: unknown }, src: { [key: string]: unknown }) => {
  const keys = Object.keys(src)
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]!
    if (Object.prototype.hasOwnProperty.call(dest, key)) {
      if (key[0] === '_') {
        triggerWarning(`data field "${key}" from different behaviors is overriding or merging.`)
      }
      if (
        typeof dest[key] === 'object' &&
        typeof src[key] === 'object' &&
        src[key] !== null &&
        !Array.isArray(src[key])
      ) {
        if (Array.isArray(dest[key])) {
          dest[key] = (dest[key] as DataValue[]).slice()
        } else {
          const oldDest = dest[key] as { [key: string]: DataValue }
          const newDest = {} as { [key: string]: DataValue }
          const subKeys = Object.keys(oldDest)
          for (let i = 0; i < subKeys.length; i += 1) {
            const subKey = subKeys[i]!
            newDest[subKey] = oldDest[subKey]
          }
          dest[key] = newDest
        }
        shallowMerge(
          dest[key] as { [key: string]: unknown },
          src[key] as { [key: string]: unknown },
        )
      } else {
        dest[key] = src[key]
      }
    } else {
      dest[key] = src[key]
    }
  }
}

const normalizePropertyTypeShortHand = (propDef: unknown): PropertyDefinition | null => {
  if (propDef === String) {
    return {
      type: NormalizedPropertyType.String,
      optionalTypes: null,
      value: '',
      default: undefined,
      observer: null,
      comparison: null,
      reflectIdPrefix: false,
    }
  }
  if (propDef === Number) {
    return {
      type: NormalizedPropertyType.Number,
      optionalTypes: null,
      value: 0,
      default: undefined,
      observer: null,
      comparison: null,
      reflectIdPrefix: false,
    }
  }
  if (propDef === Boolean) {
    return {
      type: NormalizedPropertyType.Boolean,
      optionalTypes: null,
      value: false,
      default: undefined,
      observer: null,
      comparison: null,
      reflectIdPrefix: false,
    }
  }
  if (propDef === Object) {
    return {
      type: NormalizedPropertyType.Object,
      optionalTypes: null,
      value: null,
      default: undefined,
      observer: null,
      comparison: null,
      reflectIdPrefix: false,
    }
  }
  if (propDef === Array) {
    return {
      type: NormalizedPropertyType.Array,
      optionalTypes: null,
      value: [],
      default: undefined,
      observer: null,
      comparison: null,
      reflectIdPrefix: false,
    }
  }
  if (propDef === Function) {
    return {
      type: NormalizedPropertyType.Function,
      optionalTypes: null,
      value() {
        /* empty */
      },
      default: undefined,
      observer: null,
      comparison: null,
      reflectIdPrefix: false,
    }
  }
  if (propDef === null || propDef === undefined) {
    return {
      type: NormalizedPropertyType.Any,
      optionalTypes: null,
      value: null,
      default: undefined,
      observer: null,
      comparison: null,
      reflectIdPrefix: false,
    }
  }
  return null
}

const normalizePropertyType = (t: unknown): NormalizedPropertyType => {
  if (t === String) {
    return NormalizedPropertyType.String
  }
  if (t === Number) {
    return NormalizedPropertyType.Number
  }
  if (t === Boolean) {
    return NormalizedPropertyType.Boolean
  }
  if (t === Object) {
    return NormalizedPropertyType.Object
  }
  if (t === Array) {
    return NormalizedPropertyType.Array
  }
  if (t === Function) {
    return NormalizedPropertyType.Function
  }
  if (t === null || t === undefined) {
    return NormalizedPropertyType.Any
  }
  return NormalizedPropertyType.Invalid
}

export const convertValueToType = (
  value: unknown,
  propName: string,
  prop: PropertyDefinition,
): unknown => {
  const type = prop.type
  const defaultFn = prop.default
  // try match optional types
  const optionalTypes = prop.optionalTypes
  if (optionalTypes) {
    for (let i = 0; i < optionalTypes.length; i += 1) {
      if (matchTypeWithValue(optionalTypes[i]!, value)) {
        return value
      }
    }
  }
  // for string
  if (type === NormalizedPropertyType.String) {
    if (value === null || value === undefined) {
      triggerWarning(
        `property "${propName}" received type-incompatible value: expected <String> but get null value. Used default value instead.`,
      )
      return defaultFn === undefined ? '' : defaultFn()
    }
    if (typeof value === 'object') {
      triggerWarning(
        `property "${propName}" received type-incompatible value: expected <String> but got object-typed value. Force converted.`,
      )
    }
    return String(value)
  }
  // for number
  if (type === NormalizedPropertyType.Number) {
    // eslint-disable-next-line no-restricted-globals
    if (isFinite(value as number)) return Number(value)
    if (typeof value === 'number') {
      triggerWarning(
        `property "${propName}" received type-incompatible value: expected <Number> but got NaN or Infinity. Used default value instead.`,
      )
    } else {
      triggerWarning(
        `property "${propName}" received type-incompatible value: expected <Number> but got non-number value. Used default value instead.`,
      )
    }
    return defaultFn === undefined ? 0 : defaultFn()
  }
  // for boolean
  if (type === NormalizedPropertyType.Boolean) {
    return !!value
  }
  // for array
  if (type === NormalizedPropertyType.Array) {
    if (Array.isArray(value)) return value as unknown
    triggerWarning(
      `property "${propName}" received type-incompatible value: expected <Array> but got non-array value. Used default value instead.`,
    )
    return defaultFn === undefined ? [] : defaultFn()
  }
  // for object
  if (type === NormalizedPropertyType.Object) {
    if (typeof value === 'object') return value
    triggerWarning(
      `property "${propName}" received type-incompatible value: expected <Object> but got non-object value. Used default value instead.`,
    )
    return defaultFn === undefined ? null : defaultFn()
  }
  // for function
  if (type === NormalizedPropertyType.Function) {
    if (typeof value === 'function') return value
    triggerWarning(
      `property "${propName}" received type-incompatible value: expected <Function> but got non-function value. Used default value instead.`,
    )
    // eslint-disable-next-line func-names
    return defaultFn === undefined
      ? function () {
          /* empty */
        }
      : defaultFn()
  }
  // for any-typed, just return the value and avoid undefined
  if (value === undefined) return defaultFn === undefined ? null : defaultFn()
  return value
}

export const matchTypeWithValue = (type: NormalizedPropertyType, value: any) => {
  if (type === NormalizedPropertyType.String) {
    if (typeof value !== 'string') return false
  } else if (type === NormalizedPropertyType.Number) {
    if (!Number.isFinite(value)) return false
  } else if (type === NormalizedPropertyType.Boolean) {
    if (typeof value !== 'boolean') return false
  } else if (type === NormalizedPropertyType.Object) {
    if (typeof value !== 'object' || Array.isArray(value)) return false
  } else if (type === NormalizedPropertyType.Array) {
    if (typeof value !== 'object' || !Array.isArray(value)) return false
  } else if (type === NormalizedPropertyType.Function) {
    if (typeof value !== 'function') return false
  } else if (value === undefined) {
    return false
  }
  return true
}

export const normalizeRelation = <TOut extends { [key: string]: any }>(
  is: string,
  key: string,
  relation: RelationParams | TraitRelationParams<TOut>,
): RelationDefinition | null => {
  const checkRelationFunc = (f: unknown): RelationListener | null => {
    if (typeof f === 'function') {
      return f as RelationListener
    }
    if (f !== undefined) {
      triggerWarning(
        `the "${key}" relation listener is not a function (when preparing behavior "${is}").`,
      )
    }
    return null
  }
  let type: RelationType
  if (relation.type === 'parent') {
    type = RelationType.ParentComponent
  } else if (relation.type === 'child') {
    type = RelationType.ChildComponent
  } else if (relation.type === 'parent-common-node') {
    type = RelationType.ParentNonVirtualNode
  } else if (relation.type === 'child-common-node') {
    type = RelationType.ChildNonVirtualNode
  } else if (relation.type === 'ancestor') {
    type = RelationType.Ancestor
  } else if (relation.type === 'descendant') {
    type = RelationType.Descendant
  } else {
    const type = relation.type as string
    triggerWarning(
      `the "${key}" relation has an invalid relation type "${type}" (when preparing behavior "${is}").`,
    )
    return null
  }
  let target:
    | string
    | GeneralBehavior
    | TraitBehavior<{ [key: string]: unknown }, { [key: string]: unknown }>
  let domain: string | null = null
  if (relation.target instanceof ComponentDefinition) {
    target = relation.target.behavior as GeneralBehavior
  } else if (relation.target instanceof Behavior || relation.target instanceof TraitBehavior) {
    target = relation.target
  } else {
    const { domain: d, absPath } = normalizeUrl(relation.target || key, is)
    target = absPath
    domain = d
  }
  if (!target) {
    triggerWarning(
      `the target of relation "${key}" is not a valid behavior or component (when preparing behavior "${is}").`,
    )
    return null
  }
  return {
    target,
    domain,
    type,
    linked: checkRelationFunc(relation.linked),
    linkChanged: checkRelationFunc(relation.linkChanged),
    unlinked: checkRelationFunc(relation.unlinked),
    linkFailed: checkRelationFunc(relation.linkFailed) as RelationFailedListener,
  }
}

export interface RelationHandler<TTarget, TOut> {
  list(): TTarget[]
  listAsTrait: TOut extends never ? undefined : () => TOut[]
}

export interface RelationInit {
  (def: RelationParams): RelationHandler<any, never>
  <TOut extends { [key: string]: any }>(def: TraitRelationParams<TOut>): RelationHandler<
    unknown,
    TOut
  >
}

export interface BuilderContext<
  TPrevData extends DataList,
  TProperty extends PropertyList,
  TMethodCaller,
> extends ThisType<TMethodCaller> {
  self: TMethodCaller
  data: DeepReadonly<DataWithPropertyValues<TPrevData, TProperty>>
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
    V = DeepReadonly<GetFromObserverPathString<DataWithPropertyValues<TPrevData, TProperty>, P>>,
  >(
    paths: P,
    func: (newValue: V) => void,
  ): void
  observer<
    P extends ObserverDataPathStrings<DataWithPropertyValues<TPrevData, TProperty>>[],
    V = {
      [K in keyof P]: DeepReadonly<
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
  never
>

export class BehaviorBuilder<
  TPrevData extends DataList = Empty,
  TData extends DataList = Empty,
  TProperty extends PropertyList = Empty,
  TMethod extends MethodList = Empty,
  TChainingFilter extends ChainingFilterType = never,
  TPendingChainingFilter extends ChainingFilterType = never,
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
  _$methodCallerInit?: (this: ComponentInstance<TData, TProperty, TMethod>) => any

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
    func: (this: ComponentInstance<TData, TProperty, TMethod>) => any,
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
  >(
    behavior: Behavior<UData, UProperty, UMethod, UChainingFilter>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData & UData,
      TProperty & UProperty,
      TMethod & UMethod,
      UChainingFilter,
      TPendingChainingFilter
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
      }
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
    BehaviorBuilder<T, TData & T, TProperty, TMethod, TChainingFilter, TPendingChainingFilter>,
    TChainingFilter
  > {
    this._$data.push(gen)
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
    BehaviorBuilder<T, TData & T, TProperty, TMethod, TChainingFilter, TPendingChainingFilter>,
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
      TPendingChainingFilter
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
    funcs: T & ThisType<ComponentInstance<TData, TProperty, TMethod & T>>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod & T,
      TChainingFilter,
      TPendingChainingFilter
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
    V = DeepReadonly<GetFromObserverPathString<DataWithPropertyValues<TPrevData, TProperty>, P>>,
  >(
    paths: P,
    func: (this: ComponentInstance<TData, TProperty, TMethod>, newValue: V) => void,
    once?: boolean,
  ): ResolveBehaviorBuilder<this, TChainingFilter>
  observer<
    P extends ObserverDataPathStrings<DataWithPropertyValues<TPrevData, TProperty>>[],
    V = {
      [K in keyof P]: DeepReadonly<
        GetFromObserverPathString<DataWithPropertyValues<TPrevData, TProperty>, P[K]>
      >
    },
  >(
    paths: readonly [...P],
    func: (
      this: ComponentInstance<TData, TProperty, TMethod>,
      ...newValues: V extends any[] ? V : never
    ) => void,
    once?: boolean,
  ): ResolveBehaviorBuilder<this, TChainingFilter>
  observer(
    paths: string | readonly string[],
    func: (this: ComponentInstance<TData, TProperty, TMethod>, ...args: any[]) => any,
    once = false,
  ): ResolveBehaviorBuilder<this, TChainingFilter> {
    if (!this._$observers) this._$observers = []
    this._$observers.push({ dataPaths: parseMultiPaths(paths as string | string[]), func, once })
    return this as any
  }

  /**
   * Add a lifetime callback
   */
  lifetime<L extends keyof Lifetimes>(
    name: L,
    func: (
      this: ComponentInstance<TData, TProperty, TMethod>,
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
    func: (this: ComponentInstance<TData, TProperty, TMethod>, ...args: any[]) => any,
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
    rel: RelationParams & ThisType<ComponentInstance<TData, TProperty, TMethod>>,
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
      this: ComponentInstance<TData, TProperty, TMethod>,
      builderContext: BuilderContext<
        TPrevData,
        TProperty,
        ComponentInstance<TData, TProperty, TMethod>
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
      TPendingChainingFilter
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
      ThisType<ComponentInstance<TData & TNewData, TProperty & TNewProperty, TMethod & TNewMethod>>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData & TNewData,
      TProperty & TNewProperty,
      TMethod & TNewMethod,
      TChainingFilter,
      TPendingChainingFilter
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
        this._$data.push(rawData as () => DataList)
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
          this._$observers.push({
            dataPaths: parseMultiPaths(fields ?? '**'),
            func: observer,
            once: false,
          })
        }
      } else {
        const keys = Object.keys(rawObservers)
        for (let i = 0; i < keys.length; i += 1) {
          const fields = keys[i]!
          const observer = rawObservers[fields]!
          this._$observers.push({ dataPaths: parseMultiPaths(fields), func: observer, once: false })
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
  registerBehavior(): Behavior<TData, TProperty, TMethod, TPendingChainingFilter> {
    const is = this._$is
    const behavior = new Behavior(this)
    if (is !== undefined) {
      this._$ownerSpace._$registerBehavior(is, behavior as unknown as GeneralBehavior)
    }
    return behavior as any
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
> {
  /** @internal */
  private _$unprepared: boolean
  is: string
  ownerSpace: ComponentSpace
  /** @internal */
  private _$builder: BehaviorBuilder<any, TData, TProperty, TMethod, any, TChainingFilter>
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
    this: ComponentInstance<TData, TProperty, TMethod>,
  ) => ComponentInstance<TData, TProperty, TMethod>

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
  constructor(builder: BehaviorBuilder<any, TData, TProperty, TMethod, any, TChainingFilter>) {
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
            triggerWarning(
              `behavior "${parentNameStr}" is not found (when preparing behavior "${is}").`,
            )
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
            placeholder,
            waiting: null,
          }
        } else if (space) {
          const path = String(v)
          const final = space.getComponentByUrlWithoutDefault(path, is)
          if (final) {
            this._$using[k] = {
              final,
              placeholder: null,
              waiting: null,
            }
          } else if (placeholder !== null) {
            const p: ComponentDefinitionWithPlaceholder = {
              final: null,
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
                placeholder: null,
                waiting: null,
              }
            }
          }
        } else {
          triggerWarning(`cannot find component "${String(v)}" (when preparing behavior "${is}").`)
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
            triggerWarning(
              `cannot define generic "${k}" without a default implementor (when preparing behavior "${is}").`,
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
            triggerWarning(
              `the type of property "${name}" is illegal (when preparing behavior "${is}").`,
            )
          }
          let value: DataValue = propDef.value
          if (propDef.value === undefined) {
            if (type === NormalizedPropertyType.String) value = ''
            else if (type === NormalizedPropertyType.Number) value = 0
            else if (type === NormalizedPropertyType.Boolean) value = false
            else if (type === NormalizedPropertyType.Array) value = []
            else value = null
          }
          let observer: ((newValue: any, oldValue: any) => void) | null
          if (typeof propDef.observer === 'function') {
            observer = propDef.observer
          } else if (propDef.observer) {
            observer = this._$methodMap[propDef.observer] || null
          } else {
            observer = null
            if (propDef.observer !== undefined) {
              triggerWarning(
                `the observer of property "${name}" is not a function (when preparing behavior "${is}").`,
              )
            }
          }
          let comparison: ((newValue: unknown, oldValue: unknown) => boolean) | null
          if (typeof propDef.comparison === 'function') {
            comparison = propDef.comparison
          } else {
            comparison = null
            if (propDef.comparison !== undefined) {
              triggerWarning(
                `the comparison of property "${name}" is not a function (when preparing behavior "${is}").`,
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
            comparison,
            reflectIdPrefix,
          }
        }
        this._$propertyMap[name] = d
        initValueFuncs.push({
          name,
          func: d.default === undefined ? () => simpleDeepCopy(d.value) : d.default,
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
          triggerWarning(
            `the "${String(
              observer,
            )}" observer is not a function (when preparing behavior "${is}").`,
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
            triggerWarning(
              `the "${k}" listener is not a function or a method name (when preparing behavior "${is}").`,
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
        const rel = normalizeRelation(is, key, relation)
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
    return this._$methodMap as TMethod
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
        const fa = (ret[name] = new FuncArr())
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
        const fa = (ret[name] = new FuncArr())
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
  any
>
