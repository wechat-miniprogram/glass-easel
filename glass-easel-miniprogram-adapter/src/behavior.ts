import type * as glassEasel from 'glass-easel'
import { type GeneralComponentDefinition, type utils as typeUtils } from './types'
import { type GeneralComponent } from './component'

type Empty = typeUtils.Empty
type DataList = typeUtils.DataList
type PropertyList = typeUtils.PropertyList
type MethodList = typeUtils.MethodList
type ChainingFilterType = typeUtils.ChainingFilterType

export type DefinitionFilter = (
  target: GeneralComponentDefinition,
  childFilters: (((target: GeneralComponentDefinition) => void) | null)[],
) => void

export type GeneralBehavior = Behavior<
  Record<string, any>,
  Record<string, any>,
  Record<string, any>,
  any
>

export class Behavior<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
  TChainingFilter extends ChainingFilterType,
  TComponentExport = never,
  TExtraThisFields extends DataList = Empty,
> {
  /** @internal */
  _$: glassEasel.GeneralBehavior
  /** @internal */
  _$chainingFilter?: typeUtils.ChainingFilterFunc<any, any>
  /** @internal */
  _$boundDefinitionFilter?: (target: GeneralComponentDefinition) => void
  /** @internal */
  _$export?: (source: GeneralComponent | null) => TComponentExport

  /** @internal */
  constructor(
    inner: glassEasel.Behavior<TData, TProperty, TMethod, TChainingFilter, TExtraThisFields>,
    parents: GeneralBehavior[],
    definitionFilter: DefinitionFilter | undefined,
    chainingFilter: typeUtils.ChainingFilterFunc<any, any> | undefined,
    componentExport: ((source: GeneralComponent | null) => TComponentExport) | undefined,
  ) {
    this._$ = inner as glassEasel.GeneralBehavior
    this._$chainingFilter = chainingFilter
    this._$export = componentExport

    // processing definition filter
    if (definitionFilter !== undefined) {
      const definitionFilterArgs = parents.map((p) => p._$boundDefinitionFilter ?? null)
      this._$boundDefinitionFilter = (childDef) => {
        definitionFilter(childDef, definitionFilterArgs)
      }
    }
  }
}

export class ComponentType<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TComponentExport,
> {
  /** @internal */
  _$: glassEasel.ComponentDefinition<TData, TProperty, TMethod>

  /** @internal */
  constructor(inner: glassEasel.ComponentDefinition<TData, TProperty, TMethod>) {
    this._$ = inner
  }
}

export class TraitBehavior<
  TIn extends { [key: string]: any },
  TOut extends { [key: string]: any } = TIn,
> {
  /** @internal */
  _$: glassEasel.TraitBehavior<TIn, TOut>

  /** @internal */
  constructor(inner: glassEasel.TraitBehavior<TIn>)
  constructor(inner: glassEasel.TraitBehavior<TIn, TOut>)
  constructor(inner: glassEasel.TraitBehavior<TIn, TOut>) {
    this._$ = inner
  }
}
