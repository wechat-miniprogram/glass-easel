/* eslint-disable @typescript-eslint/no-unsafe-return */

import * as glassEasel from 'glass-easel'
import { Behavior, ComponentType, TraitBehavior } from '../behavior'
import type { BehaviorDefinition, utils as typeUtils } from '../types'
import type { GeneralBehavior } from '../behavior'
import type { AllData, Component, GeneralComponent } from '../component'
import type { CodeSpace } from '../space'
import type {
  ResolveBehaviorBuilder,
  Lifetimes,
  RelationParams,
  TraitRelationParams,
  BuilderContext,
} from './type_utils'

type Empty = typeUtils.Empty
type DataList = typeUtils.DataList
type PropertyList = typeUtils.PropertyList
type PropertyType = typeUtils.PropertyType
type PropertyTypeToValueType<T extends PropertyType> = typeUtils.PropertyTypeToValueType<T>
type MethodList = typeUtils.MethodList
type ChainingFilterType = typeUtils.ChainingFilterType
type ComponentMethod = typeUtils.ComponentMethod
type TaggedMethod<Fn extends ComponentMethod> = typeUtils.TaggedMethod<Fn>
type UnTaggedMethod<M extends TaggedMethod<any>> = typeUtils.UnTaggedMethod<M>

export class BaseBehaviorBuilder<
  TPrevData extends DataList = Empty,
  TData extends DataList = Empty,
  TProperty extends PropertyList = Empty,
  TMethod extends MethodList = Empty,
  TChainingFilter extends ChainingFilterType = never,
  TPendingChainingFilter extends ChainingFilterType = never,
  TComponentExport = never,
  TExtraThisFields extends DataList = Empty,
> {
  protected _$codeSpace!: CodeSpace
  protected _$!: glassEasel.BehaviorBuilder<
    TPrevData,
    TData,
    TProperty,
    TMethod,
    TChainingFilter,
    TPendingChainingFilter,
    TExtraThisFields
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
      TNewComponentExport,
      TExtraThisFields
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
      TComponentExport,
      TExtraThisFields
    >,
    TChainingFilter
  > {
    this._$.data(gen)
    return this as any
  }

  staticData<T extends DataList>(
    data: typeUtils.NewFieldList<AllData<TData, TProperty>, T>,
  ): ResolveBehaviorBuilder<
    BaseBehaviorBuilder<
      T,
      TData & T,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport,
      TExtraThisFields
    >,
    TChainingFilter
  > {
    this._$.staticData(data)
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
      TComponentExport,
      TExtraThisFields
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
    funcs: T & ThisType<Component<TData, TProperty, TMethod & T, any, TExtraThisFields>>,
  ): ResolveBehaviorBuilder<
    BaseBehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod & T,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport,
      TExtraThisFields
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
    V = typeUtils.GetFromObserverPathString<
      typeUtils.DataWithPropertyValues<TPrevData, TProperty>,
      P
    >,
  >(
    paths: P,
    func: (this: Component<TData, TProperty, TMethod, any, TExtraThisFields>, newValue: V) => void,
    once?: boolean,
  ): ResolveBehaviorBuilder<this, TChainingFilter>
  observer<
    P extends typeUtils.ObserverDataPathStrings<
      typeUtils.DataWithPropertyValues<TPrevData, TProperty>
    >[],
    V = {
      [K in keyof P]: typeUtils.GetFromObserverPathString<
        typeUtils.DataWithPropertyValues<TPrevData, TProperty>,
        P[K]
      >
    },
  >(
    paths: readonly [...P],
    func: (
      this: Component<TData, TProperty, TMethod, any, TExtraThisFields>,
      ...newValues: V extends any[] ? V : never
    ) => void,
    once?: boolean,
  ): ResolveBehaviorBuilder<this, TChainingFilter>
  observer(
    paths: string | readonly string[],
    func: (
      this: Component<TData, TProperty, TMethod, any, TExtraThisFields>,
      ...args: any[]
    ) => any,
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
      this: Component<TData, TProperty, TMethod, any, TExtraThisFields>,
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
    func: (
      this: Component<TData, TProperty, TMethod, any, TExtraThisFields>,
      ...args: any[]
    ) => any,
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
    rel: RelationParams &
      ThisType<Component<TData, TProperty, TMethod, TComponentExport, TExtraThisFields>>,
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
      this: Component<TData, TProperty, TMethod, TComponentExport, TExtraThisFields>,
      builderContext: BuilderContext<
        TPrevData,
        TProperty,
        Component<TData, TProperty, TMethod, TComponentExport, TExtraThisFields>
      >,
    ) => TExport,
    // eslint-disable-next-line function-paren-newline
  ): ResolveBehaviorBuilder<
    BaseBehaviorBuilder<
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
      TComponentExport,
      TExtraThisFields
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
      listener,
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

      const methodCaller = this as unknown as Component<
        TData,
        TProperty,
        TMethod,
        TComponentExport,
        TExtraThisFields
      >

      const exported = func.call(methodCaller, {
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
        listener,
      })

      if (exported) {
        const exportedKeys = Object.keys(exported)
        for (let j = 0; j < exportedKeys.length; j += 1) {
          const exportedKey = exportedKeys[j]!
          const exportItem: unknown = exported[exportedKey]
          if (glassEasel.Component.isTaggedMethod(exportItem)) {
            ;(methodCaller as { [key: string]: unknown })[exportedKey] = exportItem
          }
        }
      }
      return exported
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
          TNewComponentExport,
          TExtraThisFields
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
      TNewComponentExport,
      TExtraThisFields
    >,
    TChainingFilter
  > {
    def.behaviors?.forEach((beh) => beh._$boundDefinitionFilter?.(def))
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
      this._$parents.push(beh)
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
