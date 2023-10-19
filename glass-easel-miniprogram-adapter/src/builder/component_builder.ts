/* eslint-disable @typescript-eslint/no-unsafe-return */

import * as glassEasel from 'glass-easel'
import { BaseBehaviorBuilder } from './base_behavior_builder'
import { ComponentType } from '../behavior'
import { ComponentProto } from '../component'
import type {
  ComponentDefinitionOptions,
  ComponentDefinition,
  PageDefinition,
  utils as typeUtils,
} from '../types'
import type { Behavior, GeneralBehavior } from '../behavior'
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
  TComponentExport = undefined,
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
  private _$export?: (source: GeneralComponent | null) => TComponentExport
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
        proto = ret._$proto = new ComponentProto(methods) as any
      }
      const caller = proto!.derive()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      caller._$ = originalCaller as any
      caller._$export = ret._$export
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
  >(
    behavior: Behavior<UData, UProperty, UMethod, UChainingFilter>,
  ): ResolveBehaviorBuilder<
    ComponentBuilder<
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
  export<TNewComponentExport>(
    f: (
      this: Component<TData, TProperty, TMethod, TComponentExport>,
      source: GeneralComponent | null,
    ) => TNewComponentExport,
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
    TNewComponentExport = undefined,
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
