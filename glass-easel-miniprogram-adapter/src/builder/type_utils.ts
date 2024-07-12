import type * as glassEasel from 'glass-easel'
import type { utils as typeUtils } from '../types'
import type { ComponentType, GeneralBehavior, TraitBehavior } from '../behavior'
import type { GeneralComponent } from '../component'

export type ResolveBehaviorBuilder<
  B,
  TChainingFilter extends ChainingFilterType,
> = typeUtils.IsNever<TChainingFilter> extends false
  ? TChainingFilter extends ChainingFilterType
    ? Omit<B, TChainingFilter['remove']> & TChainingFilter['add']
    : B
  : B

type DataList = typeUtils.DataList
type PropertyList = typeUtils.PropertyList
type ChainingFilterType = typeUtils.ChainingFilterType
type ComponentMethod = typeUtils.ComponentMethod
type TaggedMethod<Fn extends ComponentMethod> = typeUtils.TaggedMethod<Fn>

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
  data: typeUtils.Merge<typeUtils.DataWithPropertyValues<TPrevData, TProperty>>
  setData: (
    this: void,
    newData: Partial<typeUtils.SetDataSetter<TPrevData>>,
    callback?: () => void,
  ) => void
  implement: <TIn extends { [x: string]: any }>(
    this: void,
    traitBehavior: TraitBehavior<TIn, any>,
    impl: TIn,
  ) => void
  relation<TOut extends { [key: string]: any }>(
    this: void,
    def: TraitRelationParams<TOut> & ThisType<TMethodCaller>,
  ): RelationHandler<any, TOut>
  relation(this: void, def: RelationParams & ThisType<TMethodCaller>): RelationHandler<any, never>
  observer<
    P extends typeUtils.ObserverDataPathStrings<
      typeUtils.DataWithPropertyValues<TPrevData, TProperty>
    >,
    V = typeUtils.GetFromObserverPathString<
      typeUtils.DataWithPropertyValues<TPrevData, TProperty>,
      P
    >,
  >(
    this: void,
    paths: P,
    func: (newValue: V) => void,
  ): void
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
    this: void,
    paths: readonly [...P],
    func: (...newValues: V extends any[] ? V : never) => void,
  ): void
  lifetime: <L extends keyof Lifetimes>(this: void, name: L, func: Lifetimes[L]) => void
  pageLifetime: (this: void, name: string, func: (...args: any[]) => void) => void
  method: <Fn extends ComponentMethod>(this: void, func: Fn) => TaggedMethod<Fn>
  listener: <T>(
    this: void,
    func: glassEasel.EventListener<T>,
  ) => TaggedMethod<glassEasel.EventListener<T>>
}
