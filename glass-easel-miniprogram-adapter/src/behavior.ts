import * as glassEasel from 'glass-easel'
import {
  GeneralComponentDefinition,
  utils as typeUtils,
} from './types'

type DataList = typeUtils.DataList
type PropertyList = typeUtils.PropertyList
type MethodList = typeUtils.MethodList
type ChainingFilterType = typeUtils.ChainingFilterType

export type DefinitionFilter =
(
  target: GeneralComponentDefinition,
  childFilters: (
    ((target: GeneralComponentDefinition) => void)
    | null
  )[],
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
> {
  /** @internal */
  _$: glassEasel.GeneralBehavior
  /** @internal */
  _$bindedDefinitionFilter?: ((target: GeneralComponentDefinition) => void)

  /** @internal */
  constructor(
    inner: glassEasel.Behavior<
      TData,
      TProperty,
      TMethod,
      TChainingFilter
    >,
    parents: GeneralBehavior[],
    definitionFilter: DefinitionFilter | undefined,
  ) {
    this._$ = inner as glassEasel.GeneralBehavior

    // processing definition filter
    if (definitionFilter !== undefined) {
      const definitionFilterArgs = parents.map((p) => p._$bindedDefinitionFilter ?? null)
      this._$bindedDefinitionFilter = (childDef) => {
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
  _$: glassEasel.ComponentDefinition<
    TData,
    TProperty,
    TMethod
  >

  /** @internal */
  constructor(
    inner: glassEasel.ComponentDefinition<
      TData,
      TProperty,
      TMethod
    >,
  ) {
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
