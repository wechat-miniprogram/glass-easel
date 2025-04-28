/* eslint-disable @typescript-eslint/no-unsafe-return */

import { BaseBehaviorBuilder } from './base_behavior_builder'
import { Behavior } from '../behavior'
import type { BehaviorDefinition, utils as typeUtils } from '../types'
import type { DefinitionFilter } from '../behavior'
import type { AllData, Component, GeneralComponent } from '../component'
import type { CodeSpace } from '../space'
import type { ResolveBehaviorBuilder, BuilderContext } from './type_utils'

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
type ChainingFilterFunc<
  TAddedFields extends { [key: string]: any },
  TRemovedFields extends string = never,
> = typeUtils.ChainingFilterFunc<TAddedFields, TRemovedFields>

export type DefaultBehaviorBuilder = BehaviorBuilder<
  /* TPrevData */ Empty,
  /* TData */ Empty,
  /* TProperty */ Empty,
  /* TMethod */ Empty,
  /* TChainingFilter */ never,
  /* TPendingChainingFilter */ never,
  /* TComponentExport */ never,
  /* TExtraThisFields */ Empty
>

export class BehaviorBuilder<
  TPrevData extends DataList,
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
  TChainingFilter extends ChainingFilterType,
  TPendingChainingFilter extends ChainingFilterType,
  TComponentExport,
  TExtraThisFields extends DataList,
> extends BaseBehaviorBuilder<
  TPrevData,
  TData,
  TProperty,
  TMethod,
  TChainingFilter,
  TPendingChainingFilter,
  TComponentExport,
  TExtraThisFields
> {
  private _$definitionFilter: DefinitionFilter | undefined
  private _$chainingFilter?: ChainingFilterFunc<any, any>

  /** @internal */
  static create(codeSpace: CodeSpace): DefaultBehaviorBuilder {
    const ret = new BehaviorBuilder()
    ret._$codeSpace = codeSpace
    ret._$ = codeSpace.getComponentSpace().defineWithMethodCaller()
    return ret as DefaultBehaviorBuilder
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
      TComponentExport,
      TExtraThisFields
    >,
    TChainingFilter
  > {
    this._$chainingFilter = func
    return this as any
  }

  /** Use another behavior */
  behavior<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
    UChainingFilter extends ChainingFilterType,
    UComponentExport,
    UExtraThisFields extends DataList,
  >(
    behavior: Behavior<
      UData,
      UProperty,
      UMethod,
      UChainingFilter,
      UComponentExport,
      UExtraThisFields
    >,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData & UData,
      TProperty & UProperty,
      TMethod & UMethod,
      UChainingFilter,
      TPendingChainingFilter,
      TComponentExport,
      TExtraThisFields & UExtraThisFields
    >,
    UChainingFilter
  > {
    this._$parents.push(behavior)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this._$ = this._$.behavior(behavior._$)
    if (behavior._$chainingFilter) {
      return behavior._$chainingFilter(this as any)
    }
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
      TNewComponentExport,
      TExtraThisFields
    >,
    TChainingFilter
  > {
    return super.export(f) as any
  }

  /**
   * Add some template data fields
   *
   * It does not support raw data, but a `gen` function which returns the new data fields.
   * The `gen` function executes once during component instance creation.
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
      TComponentExport,
      TExtraThisFields
    >,
    TChainingFilter
  > {
    return super.data(gen) as any
  }

  /**
   * Add some template data fields
   *
   * The data should be JSON-compatible, and will be cloned during component creation.
   */
  override staticData<T extends DataList>(
    data: typeUtils.NewFieldList<AllData<TData, TProperty>, T>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
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
    return super.staticData(data) as any
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
      TComponentExport,
      TExtraThisFields
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
    funcs: T & ThisType<Component<TData, TProperty, TMethod & T, any, TExtraThisFields>>,
  ): ResolveBehaviorBuilder<
    BehaviorBuilder<
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
    return super.methods(funcs) as any
  }

  /**
   * Execute a function while component instance creation
   *
   * A `BuilderContext` is provided to tweak the component creation progress.
   * The return value is used as the "export" value of the behavior.
   */
  override init<TExport extends Record<string, TaggedMethod<(...args: any[]) => any>> | void>(
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
      TComponentExport,
      TExtraThisFields
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
          TNewComponentExport,
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
      TNewComponentExport,
      TExtraThisFields
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
  register(): Behavior<
    TData,
    TProperty,
    TMethod,
    TPendingChainingFilter,
    TComponentExport,
    TExtraThisFields
  > {
    return new Behavior(
      this._$.registerBehavior(),
      this._$parents,
      this._$definitionFilter,
      this._$chainingFilter,
      this._$export,
    )
  }

  /**
   * Add extra this fields type
   */
  extraThisFieldsType<T extends DataList>(): ResolveBehaviorBuilder<
    BehaviorBuilder<
      TPrevData,
      TData,
      TProperty,
      TMethod,
      TChainingFilter,
      TPendingChainingFilter,
      TComponentExport,
      TExtraThisFields & T
    >,
    TChainingFilter
  > {
    return this as any
  }
}
