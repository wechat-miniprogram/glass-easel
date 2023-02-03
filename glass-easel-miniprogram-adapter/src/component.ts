import * as glassEasel from 'glass-easel'
import {
  utils as typeUtils,
} from './types'
import { ComponentType, GeneralBehavior, TraitBehavior } from './behavior'
import { SelectorQuery } from './selector_query'

type DataList = typeUtils.DataList
type PropertyList = typeUtils.PropertyList
type MethodList = typeUtils.MethodList
export type AllData<
  TData extends DataList,
  TProperty extends PropertyList,
> = typeUtils.DataWithPropertyValues<TData, TProperty>

type ExportType<
  UData extends DataList,
  UProperty extends PropertyList,
  UMethod extends MethodList,
  UComponentExport,
> = (
  UComponentExport extends undefined
    ? Component<UData, UProperty, UMethod, UComponentExport>
    : UComponentExport
)

const filterComponentExportWithType = <
  UData extends DataList,
  UProperty extends PropertyList,
  UMethod extends MethodList,
  UComponentExport,
>(
    source: ComponentCaller<any, any, any, any>,
    elem: glassEasel.Element,
    componentType: ComponentType<UData, UProperty, UMethod, UComponentExport>,
  ): ExportType<UData, UProperty, UMethod, UComponentExport> | undefined => {
  const comp = elem.asInstanceOf(componentType._$)
  if (comp === null) return undefined
  const selectedSpace = comp.getRootBehavior().ownerSpace
  const uncheckedCaller = comp.getMethodCaller()
  const caller = uncheckedCaller instanceof ComponentCaller ? uncheckedCaller : null
  const sourceSpace = source._$.getRootBehavior().ownerSpace
  const defaultResult = selectedSpace !== sourceSpace ? null : caller
  const ret = caller?._$export?.(selectedSpace !== sourceSpace ? null : source) as unknown
  if (ret === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return defaultResult as any
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return ret as any
}

const filterComponentExport = (
  source: ComponentCaller<any, any, any, any>,
  elem: glassEasel.Element,
): any => {
  if (elem instanceof glassEasel.Component) {
    const selectedSpace = elem.getRootBehavior().ownerSpace
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const uncheckedCaller = elem.getMethodCaller()
    const caller = uncheckedCaller instanceof ComponentCaller ? uncheckedCaller : null
    const sourceSpace = source._$.getRootBehavior().ownerSpace
    const defaultResult = selectedSpace !== sourceSpace ? null : caller
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ret = caller?._$export?.(selectedSpace !== sourceSpace ? null : source)
    if (ret === undefined) {
      return defaultResult as any
    }
    return ret
  }
  return undefined
}

export type GeneralComponent = Component<any, any, any, any>

export type Component<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
  TComponentExport,
> = ComponentCaller<TData, TProperty, TMethod, TComponentExport>
  & { [k in keyof TMethod]: TMethod[k] }

export class ComponentCaller<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
  TComponentExport,
> {
  /** @internal */
  _$!: glassEasel.Component<
    TData,
    TProperty,
    TMethod
  >
  /** @internal */
  _$export?: (source: GeneralComponent | null) => TComponentExport

  /** The component path in the code space */
  get is(): string {
    return this._$.is
  }
  set is(value: string) {
    Object.defineProperty(this, 'is', {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }

  /** The `id` field in the template */
  get id(): string {
    return this._$.id
  }
  set id(value: string) {
    Object.defineProperty(this, 'id', {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }

  /** The `data-*` field in the template */
  get dataset(): { [key: string]: any } | null {
    return this._$.dataset
  }
  set dataset(value: { [key: string]: any } | null) {
    Object.defineProperty(this, 'dataset', {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }

  /** The component data and property values */
  get data(): AllData<TData, TProperty> {
    return this._$.data
  }
  set data(value: AllData<TData, TProperty>) {
    Object.defineProperty(this, 'data', {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }

  /** The component data and property values (same as `data` ) */
  get properties(): AllData<TData, TProperty> {
    return this._$.data
  }
  set properties(value: AllData<TData, TProperty>) {
    Object.defineProperty(this, 'properties', {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    })
  }

  /**
   * Group several data update calls
   *
   * This method is designed for hinting the backend that some updates should be handled together.
   * However, this is done automatically now,
   * so this method is just for backward compatibilities.
   */
  // eslint-disable-next-line class-methods-use-this
  groupSetData(callback: () => void) {
    callback()
  }

  /**
   * Do a classic data update
   *
   * The `callback` is called after the update applies in the backend.
   * In most cases, you SHOULD NOT wait the backend update (that might be very slow),
   * and most calls, including read calls such as `selectComponent` , simply works immediately.
   * However, when called inside observers,
   * the data update will not be applied to templates immediately
   * (it is recommanded to use `updateData` instead in observers).
   */
  setData(
    newData: Partial<typeUtils.SetDataSetter<typeUtils.DataWithPropertyValues<TData, TProperty>>>,
    callback?: () => void,
  ): void
  setData(data: Record<string, any>, callback?: () => void) {
    this._$.setData(data as any)
    if (callback) {
      glassEasel.triggerRender(this._$, () => {
        callback()
      })
    }
  }

  /**
   * Schedule a classic data updates
   *
   * The data update will not be applied until next `setData` or `applyDataUpdates` call.
   * When called inside observers, the data update will be applied when observer ends.
   * All data observers will not be triggered immediately before applied.
   * Reads of the data will get the unchanged value before applied.
   */
  updateData(
    newData: Partial<typeUtils.SetDataSetter<typeUtils.DataWithPropertyValues<TData, TProperty>>>,
  ): void
  updateData(newData: Record<string, any>): void {
    this._$.updateData(newData as any)
  }

  /**
   * Schedule a data update on a single specified path
   *
   * The data update will not be applied until next `setData` or `applyDataUpdates` call.
   * All data observers will not be triggered immediately before applied.
   * Reads of the data will get the unchanged value before applied.
   */
  replaceDataOnPath<
    T extends (string | number)[],
  >(
    path: readonly [...T],
    data: typeUtils.GetFromDataPath<typeUtils.DataWithPropertyValues<TData, TProperty>, T>,
  ): void;
  replaceDataOnPath(path: any, data: any) {
    this._$.replaceDataOnPath(path, data)
  }

  /**
   * Schedule an array update
   *
   * The behavior is like `Array.prototype.slice` .
   * Break the array before the `index`-th item, delete `del` items, and insert some items here.
   * If `index` is undefined, negative, or larger than the length of the array,
   * no items will be deleted and new items will be appended to the end of the array.
   * The data update will not be applied until next `setData` or `applyDataUpdates` call.
   * All data observers will not be triggered immediately before applied.
   * Reads of the data will get the unchanged value before applied.
   */
  spliceArrayDataOnPath<
    T extends (string | number)[],
  >(
    path: readonly [...T],
    index: typeUtils.GetFromDataPath<
      typeUtils.DataWithPropertyValues<TData, TProperty>,
      T
    > extends any[] ? number | undefined : never,
    del: typeUtils.GetFromDataPath<
      typeUtils.DataWithPropertyValues<TData, TProperty>,
      T
    > extends any[] ? number | undefined : never,
    inserts: typeUtils.GetFromDataPath<
      typeUtils.DataWithPropertyValues<TData, TProperty>,
      T
    > extends (infer I)[] ? I[] : never
  ): void;
  spliceArrayDataOnPath(
    path: (string | number)[],
    index: number | undefined,
    del: number | undefined,
    inserts: unknown[],
  ) {
    this._$.spliceArrayDataOnPath(path, index as any, del as any, inserts as any)
  }

  /**
   * Apply all scheduled updates immediately
   *
   * Inside observers, it is generally not .
   */
  applyDataUpdates() {
    this._$.applyDataUpdates()
  }

  /**
   * Pending all data updates in the callback, and apply updates after callback returns
   *
   * This function helps grouping several `replaceDataOnPath` or `spliceArrayDataOnPath` calls,
   * and then apply them at the end of the callback.
   * `setData` and `applyDataUpdates` calls inside the callback still apply updates immediately.
   */
  groupUpdates<T>(callback: () => T): T {
    return this._$.groupUpdates(callback)
  }

  /**
   * Check whether the `other` behavior is a dependent behavior or a implemented trait behavior
   */
  hasBehavior(behavior: GeneralBehavior | TraitBehavior<any, any>) {
    return this._$.hasBehavior(behavior._$)
  }

  /**
   * Get the trait behavior implementation of the component
   *
   * Returns `undefined` if the specified trait behavior is not implemented.
   */
  traitBehavior<TOut extends { [key: string]: any }>(
    traitBehavior: TraitBehavior<any, TOut>,
  ): TOut | undefined {
    return this._$.traitBehavior(traitBehavior._$)
  }

  /** Trigger an event */
  triggerEvent(
    name: string,
    detail: any,
    options: {
      bubbles?: boolean,
      composed?: boolean,
      capturePhase?: boolean,
    },
  ) {
    return this._$.triggerEvent(name, detail, options)
  }

  /** Create a selector query for searching element inside the component */
  createSelectorQuery(): SelectorQuery {
    return new SelectorQuery(this)
  }

  // TODO support animate / applyAnimation / clearAnimation
  // TODO support createIntersectionObserver
  // TODO support createMediaQueryObserver
  // TODO support setUpdatePerformanceListener

  /**
   * Query an element inside the component
   *
   * If `componentType` is provided, this method will check the selected component type.
   * If the component type does not match, `null` is returned.
   */
  selectComponent(selector: string): any
  selectComponent<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
    UComponentExport,
  >(
    selector: string,
    componentType: ComponentType<UData, UProperty, UMethod, UComponentExport>,
  ): ExportType<UData, UProperty, UMethod, UComponentExport> | null
  selectComponent<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
    UComponentExport,
  >(
    selector: string,
    componentType?: ComponentType<UData, UProperty, UMethod, UComponentExport>,
  ): ExportType<UData, UProperty, UMethod, UComponentExport> | null {
    const target = this._$.getShadowRoot()!.querySelector(selector)
    if (target === null) return null
    return componentType
      ? filterComponentExportWithType(this, target, componentType) ?? null
      : filterComponentExport(this, target) ?? null
  }

  /**
   * Query all elements inside the component
   *
   * If `componentType` is provided, this method will check the selected component type.
   * If a component type does not match, it is not returned.
   */
  selectAllComponents(selector: string): GeneralComponent[]
  selectAllComponents<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
    UComponentExport,
  >(
    selector: string,
    componentType: ComponentType<UData, UProperty, UMethod, UComponentExport>,
  ): ExportType<UData, UProperty, UMethod, UComponentExport>[]
  selectAllComponents<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
    UComponentExport,
  >(
    selector: string,
    componentType?: ComponentType<UData, UProperty, UMethod, UComponentExport>,
  ): ExportType<UData, UProperty, UMethod, UComponentExport>[] {
    const targets = this._$.getShadowRoot()!.querySelectorAll(selector)
    const ret = [] as ExportType<UData, UProperty, UMethod, UComponentExport>[]
    targets.forEach((target) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const r = componentType
        ? filterComponentExportWithType(this, target, componentType)
        : filterComponentExport(this, target)
      if (r !== undefined) ret.push(r)
    })
    return ret
  }

  /**
   * Get the owner component
   *
   * If `componentType` is provided, this method will check the selected component type.
   * If a component type does not match, `null` is returned.
   */
  selectOwnerComponent(): any
  selectOwnerComponent<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
    UComponentExport,
  >(
    componentType: ComponentType<UData, UProperty, UMethod, UComponentExport>,
  ): ExportType<UData, UProperty, UMethod, UComponentExport> | null
  selectOwnerComponent<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
    UComponentExport,
  >(
    componentType?: ComponentType<UData, UProperty, UMethod, UComponentExport>,
  ): ExportType<UData, UProperty, UMethod, UComponentExport> | null {
    const target = this._$.ownerShadowRoot?.getHostNode()
    if (target === undefined) return null
    return componentType
      ? filterComponentExportWithType(this, target, componentType) ?? null
      : filterComponentExport(this, target) ?? null
  }

  getRelationNodes(relationKey: string): GeneralComponent[] {
    return this._$.getRelationNodes(relationKey).map(
      (target) => target.getMethodCaller() as any as GeneralComponent,
    )
  }

  /** Cast the component into a general-typed one */
  general(): GeneralComponent {
    return this
  }

  /**
   * Cast the component into the specified type
   *
   * Returns `null` if the component node is not the instance of the specified component.
   */
  asInstanceOf<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
    UComponentExport,
  >(
    componentType: ComponentType<UData, UProperty, UMethod, UComponentExport>,
  ): Component<UData, UProperty, UMethod, UComponentExport> | null {
    const inner = this._$.asInstanceOf(componentType._$)
    if (!inner) return null
    return this as unknown as Component<UData, UProperty, UMethod, UComponentExport>
  }
}

export class ComponentProto<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
  TComponentExport,
> {
  private proto: Component<TData, TProperty, TMethod, TComponentExport>

  constructor(methods: TMethod, componentExport?: () => TComponentExport) {
    this.proto = Object.create(ComponentCaller.prototype) as
      Component<TData, TProperty, TMethod, TComponentExport>
    Object.assign(this.proto, methods)
    this.proto._$export = componentExport
  }

  derive(): Component<TData, TProperty, TMethod, TComponentExport> {
    return Object.create(this.proto) as Component<TData, TProperty, TMethod, TComponentExport>
  }
}
