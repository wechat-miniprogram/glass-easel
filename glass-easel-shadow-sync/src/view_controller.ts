/* eslint-disable class-methods-use-this */
import type {
  ComponentSpace,
  DataChange,
  DataValue,
  Element,
  EventListener,
  EventMutLevel,
  ExternalShadowRoot,
  GeneralBackendContext,
  GeneralBackendElement,
  GeneralComponent,
  NativeNode,
  Node,
  ShadowRoot,
  TextNode,
  VirtualNode,
  templateEngine,
  BehaviorBuilder,
  typeUtils,
} from 'glass-easel'

const dashToCamelCase = (dash: string): string =>
  dash.indexOf('-') <= 0 ? dash : dash.replace(/-(.|$)/g, (s) => (s[1] ? s[1].toUpperCase() : ''))

const camelCaseToDash = (camel: string): string =>
  camel.replace(/(^|.)([A-Z])/g, (s) => (s[0] ? `${s[0]}-` : '') + s[1]!.toLowerCase())
class EmptyTemplateEngine implements templateEngine.Template {
  private static _instance: EmptyTemplateEngine | undefined

  static create() {
    if (!EmptyTemplateEngine._instance) {
      EmptyTemplateEngine._instance = new EmptyTemplateEngine()
    }
    return EmptyTemplateEngine._instance
  }

  // eslint-disable-next-line class-methods-use-this
  createInstance(
    comp: GeneralComponent,
    createShadowRoot: (component: GeneralComponent) => ShadowRoot,
  ): templateEngine.TemplateInstance {
    return new EmptyTemplateInstance(comp, createShadowRoot(comp))
  }
}

class EmptyTemplateInstance implements templateEngine.TemplateInstance {
  comp: GeneralComponent
  shadowRoot: ShadowRoot

  constructor(comp: GeneralComponent, shadowRoot: ShadowRoot) {
    this.comp = comp
    this.shadowRoot = shadowRoot
  }

  // eslint-disable-next-line class-methods-use-this
  initValues(_data: DataValue) {
    // empty
  }

  // eslint-disable-next-line class-methods-use-this
  updateValues(_data: DataValue, _changes: DataChange[]) {
    // empty
  }
}

export class Fragment {
  public childNodes: Node[] = []

  appendChild(child: Node) {
    this.childNodes.push(child)
  }

  destroyBackendElement() {
    // do nothing
  }
}

export class ViewController {
  // private _nodeMap: (Node | Fragment | undefined)[] = []
  private _listenerMap = new WeakMap<
    Element,
    {
      normal: Map<string, EventListener<unknown>>
      capture: Map<string, EventListener<unknown>>
    }
  >()

  private _styleSheetIdMapping = Object.create(null) as Record<number, number>
  private _styleScopeIdMapping = Object.create(null) as Record<number, number>

  private _traceStartTimestampMapping = Object.create(null) as Record<number, number>

  // eslint-disable-next-line no-useless-constructor
  constructor(
    private _glassEasel: typeof import('glass-easel'),
    private _rootNode: GeneralBackendElement,
    private _backendContext: GeneralBackendContext,
    private _componentSpace: ComponentSpace,
  ) {
    //
  }

  create(
    initWindowSize: (res: {
      windowInfo: { width: number; height: number; devicePixelRatio: number }
      themeInfo: { theme: string }
    }) => void,
  ): void {
    const { _backendContext } = this
    initWindowSize({
      windowInfo: {
        width: _backendContext.getWindowWidth(),
        height: _backendContext.getWindowHeight(),
        devicePixelRatio: _backendContext.getDevicePixelRatio(),
      },
      themeInfo: {
        theme: _backendContext.getTheme(),
      },
    })
  }

  destroy(): void {
    //
  }

  initData(initData: Record<string, unknown>): void {
    //
  }

  onWindowResize(
    cb: (res: { width: number; height: number; devicePixelRatio: number }) => void,
  ): void {
    const { _backendContext } = this
    _backendContext.onWindowResize?.(cb)
  }

  onThemeChange(cb: (res: { theme: string }) => void): void {
    const { _backendContext } = this
    _backendContext.onThemeChange?.(cb)
  }

  render(cb: (err: Error | null) => void): void {
    const { _backendContext } = this
    _backendContext.render(cb)
  }

  createElement(logicalName: string, stylingName: string, ownerShadowRoot: ShadowRoot): Element {
    return ownerShadowRoot.createNativeNodeWithInit(logicalName, stylingName, undefined)
  }

  createElementOrComponent(
    logicalName: string,
    stylingName: string,
    ownerShadowRoot: ShadowRoot,
  ): Element {
    const comp = this.createExternalComponent(logicalName, stylingName, ownerShadowRoot)
    if (comp && typeof comp !== 'string') return comp

    return this.createElement(comp || logicalName, stylingName, ownerShadowRoot)
  }

  createExternalComponent(
    logicalName: string,
    stylingName: string,
    ownerShadowRoot: ShadowRoot | undefined,
  ): GeneralComponent | string | null {
    const { _glassEasel, _componentSpace, _backendContext } = this

    // find in the space otherwise
    const compDef = _componentSpace.getGlobalUsingComponent(logicalName)
    if (typeof compDef === 'string' || !compDef) {
      return compDef
    }
    const node = ownerShadowRoot
      ? ownerShadowRoot.createComponentByDef(stylingName, compDef)
      : _glassEasel.Component.createWithContext(stylingName, compDef, _backendContext)

    return node
  }

  createSimpleComponent(
    tagName: string,
    external: boolean,
    ownerShadowRoot: ShadowRoot | undefined,
    virtualHost: boolean,
    styleScope: number,
    extraStyleScope: number | null,
    externalClasses: string[] | undefined,
    chainDefinition: ((def: BehaviorBuilder) => BehaviorBuilder) | undefined,
    cb: (component: GeneralComponent) => void,
  ): void {
    const { _glassEasel, _backendContext } = this

    if (external) {
      const comp = this.createExternalComponent(tagName, tagName, ownerShadowRoot)
      if (comp && typeof comp !== 'string') return cb(comp)
    }

    const actualStyleScope =
      (styleScope !== undefined ? this._styleScopeIdMapping[styleScope] : undefined) ??
      _glassEasel.StyleScopeManager.globalScope()
    const actualExtraStyleScope =
      extraStyleScope !== null ? this._styleScopeIdMapping[extraStyleScope] : undefined
    const componentSpace = this._componentSpace
    const compDefBuilder = componentSpace.define().definition({
      options: {
        directSlots: !external,
        virtualHost,
        styleScope: actualStyleScope,
        extraStyleScope: actualExtraStyleScope,
        templateEngine: EmptyTemplateEngine,
      },
      externalClasses,
    })

    const compDef = (
      chainDefinition ? chainDefinition(compDefBuilder) : compDefBuilder
    ).registerComponent()

    const node = ownerShadowRoot
      ? ownerShadowRoot.createComponentByDef(tagName, compDef)
      : _glassEasel.Component.createWithContext(tagName, compDef, _backendContext)

    return cb(node)
  }

  createTextNode(textContent: string, ownerShadowRoot: ShadowRoot): TextNode {
    return ownerShadowRoot.createTextNode(textContent)
  }

  createVirtualNode(virtualName: string, ownerShadowRoot: ShadowRoot): VirtualNode {
    return ownerShadowRoot.createVirtualNode(virtualName)
  }

  createShadowRoot(hostNode: GeneralComponent): ShadowRoot {
    return hostNode.shadowRoot as ShadowRoot
  }

  createFragment(): Fragment {
    return new Fragment()
  }

  release(node: Node | ShadowRoot | Fragment): void {
    node.destroyBackendElement()
  }

  appendChild(parent: Element | undefined, child: Node): void {
    if (parent) {
      parent.appendChild(child)
    } else {
      const { _rootNode, _glassEasel } = this
      _rootNode.appendChild(child.getBackendElement() as any)
      _glassEasel.Element.pretendAttached(child as Element)
    }
  }

  removeChild(parent: Element | undefined, child: Node): void {
    if (parent) {
      parent.removeChild(child)
    } else {
      const { _rootNode, _glassEasel } = this
      _rootNode.removeChild(child.getBackendElement() as any)
      _glassEasel.Element.pretendAttached(child as Element)
    }
  }

  insertBefore(parent: Element | undefined, child: Node, before: Node): void {
    if (parent) {
      parent.insertBefore(child, before)
    } else {
      const { _rootNode, _glassEasel } = this
      _rootNode.insertBefore(child.getBackendElement() as any, before.getBackendElement() as any)
      _glassEasel.Element.pretendAttached(child as Element)
    }
  }

  replaceChild(parent: Element | undefined, child: Node, oldChild: Node): void {
    if (parent) {
      parent.replaceChild(child, oldChild)
    } else {
      const { _rootNode, _glassEasel } = this
      _rootNode.replaceChild(child.getBackendElement() as any, oldChild.getBackendElement() as any)
      _glassEasel.Element.pretendDetached(oldChild as Element)
      _glassEasel.Element.pretendDetached(child as Element)
    }
  }

  spliceBefore(parent: Element, before: Node, deleteCount: number, list: Fragment): void {
    const index = before.parentIndex
    if (deleteCount) parent.removeChildren(index, deleteCount)
    if (list.childNodes.length) parent.insertChildren(list.childNodes, index)
    list.childNodes = []
  }

  spliceAppend(parent: Element, list: Fragment): void {
    parent.insertChildren(list.childNodes, -1)
    list.childNodes = []
  }

  spliceRemove(parent: Element, start: Node, deleteCount: number): void {
    parent.removeChildren(start.parentIndex, deleteCount)
  }

  associateValue(node: Node, data: Record<string, unknown>): void {
    // To be override
  }

  setId(element: Element, id: string): void {
    element.id = id
  }

  setSlotName(element: Element, name: string): void {
    const { _glassEasel } = this
    _glassEasel.Element.setSlotName(element, name)
  }

  setContainingSlot(node: Node, slot: Element | null | undefined): void {
    const { _glassEasel } = this
    _glassEasel.Element._$updateContainingSlot(node, slot)
  }

  reassignContainingSlot(node: Node, oldSlot: Element | null, newSlot: Element | null): void {
    const { _glassEasel } = this
    _glassEasel.Element.insertChildReassign(
      node.parentNode!,
      node,
      oldSlot,
      newSlot,
      node.parentIndex,
    )
  }

  spliceBeforeSlotNodes(slot: Element, before: number, count: number, list: Fragment): void {
    const { _glassEasel } = this
    _glassEasel.Element._$spliceSlotNodes(slot, before, count, list.childNodes)
    list.childNodes = []
  }

  spliceAppendSlotNodes(slot: Element, list: Fragment): void {
    const { _glassEasel } = this
    _glassEasel.Element._$spliceSlotNodes(slot, -1, 0, list.childNodes)
    list.childNodes = []
  }

  spliceRemoveSlotNodes(slot: Element, before: number, count: number): void {
    const { _glassEasel } = this
    _glassEasel.Element._$spliceSlotNodes(slot, before, count, undefined)
  }

  setInheritSlots(element: Element): void {
    const { _glassEasel } = this
    _glassEasel.Element.setInheritSlots(element)
  }

  registerStyleScope(scopeId: number, stylePrefix?: string): void {
    const { _componentSpace } = this
    const styleScopeManager = _componentSpace.styleScopeManager
    const actualScopeId = styleScopeManager.register(stylePrefix || '')
    this._styleScopeIdMapping[scopeId] = actualScopeId
  }

  setStyle(element: Element, styleText: string): void {
    element.style = styleText
  }

  addClass(element: Element, className: string): void {
    element.classList!.toggle(className, true)
  }

  removeClass(element: Element, className: string): void {
    element.classList!.toggle(className, false)
  }

  clearClasses(element: Element): void {
    element.classList!.setClassNames('')
  }

  setClassAlias(element: GeneralComponent, className: string, target: string[]): void {
    element.setExternalClass(className, target)
  }

  setAttribute(element: Element, name: string, value: any): void {
    const { _glassEasel } = this
    const Component = _glassEasel.Component
    const camelName = dashToCamelCase(name)
    if (element instanceof Component && _glassEasel.Component.hasProperty(element, camelName)) {
      element.replaceDataOnPath([camelName], value)
      element.applyDataUpdates()
    } else {
      element.updateAttribute(name, value)
    }
  }

  removeAttribute(element: Element, name: string): void {
    const { _glassEasel } = this
    const Component = _glassEasel.Component
    const camelName = dashToCamelCase(name)
    if (element instanceof Component && _glassEasel.Component.hasProperty(element, camelName)) {
      element.replaceDataOnPath([camelName], undefined)
      element.applyDataUpdates()
    } else {
      element.removeAttribute(name)
    }
  }

  setDataset(element: Element, name: string, value: unknown): void {
    element.setDataset(name, value)
  }

  setText(textNode: TextNode, textContent: string): void {
    textNode.textContent = textContent
  }

  setModelBindingStat(
    nativeNode: NativeNode,
    attributeName: string,
    listener: (newValue: unknown) => void,
  ): void {
    nativeNode.setModelBindingListener(attributeName, listener)
  }

  getBoundingClientRect(
    element: Element,
    cb: (res: { left: number; top: number; width: number; height: number }) => void,
  ): void {
    element.getBoundingClientRect(cb)
  }

  getScrollOffset(
    element: Element,
    cb: (res: {
      scrollLeft: number
      scrollTop: number
      scrollWidth: number
      scrollHeight: number
    }) => void,
  ): void {
    element.getScrollOffset(cb)
  }

  getContext(element: Element, cb: (res: any) => void): void {
    cb(null)
  }

  setListenerStats(
    element: Element,
    type: string,
    capture: boolean,
    mutLevel: EventMutLevel,
    listener: EventListener<unknown>,
  ): void {
    const { _glassEasel, _listenerMap } = this
    const elemListenerMap = _listenerMap
    if (!elemListenerMap.has(element)) {
      elemListenerMap.set(element, {
        normal: new Map(),
        capture: new Map(),
      })
    }
    const listenerMap = elemListenerMap.get(element)!
    const listeners = capture ? listenerMap.capture : listenerMap.normal
    if (listeners.has(type)) element.removeListener(type, listeners.get(type)!)
    element.addListener(type, listener, {
      mutated: mutLevel === _glassEasel.EventMutLevel.Mut,
      final: mutLevel === _glassEasel.EventMutLevel.Final,
      capture,
    })
    listeners.set(type, listener)
  }

  initValues(element: Element, values: Record<string, unknown>): void {
    const { _glassEasel } = this
    const Component = _glassEasel.Component
    if (!(element instanceof Component)) return

    const data: Record<string, unknown> = {}
    const keys = Object.keys(values)
    let externalClassDirty = false
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]!
      let dashName
      // eslint-disable-next-line no-cond-assign
      if (((dashName = camelCaseToDash(key)), element.hasExternalClass(dashName))) {
        element.scheduleExternalClassChange(dashName, values[key] as string)
        externalClassDirty = true
      } else {
        data[key] = values[key]
      }
    }
    element.setData(values as any)
    if (externalClassDirty) element.applyExternalClassChanges()
  }

  updateValues(element: Element, changes: DataChange[]): void {
    const { _glassEasel } = this
    const Component = _glassEasel.Component
    if (!(element instanceof Component)) return

    let dataDirty = false
    let externalClassDirty = false

    for (let i = 0; i < changes.length; i += 1) {
      const [path, newData, spliceIndex, spliceDel] = changes[i]!
      let dashName
      if (
        path.length === 1 &&
        typeof path[0] === 'string' &&
        // eslint-disable-next-line no-cond-assign
        ((dashName = camelCaseToDash(path[0])), element.hasExternalClass(dashName))
      ) {
        element.scheduleExternalClassChange(dashName, newData as string)
        externalClassDirty = true
      } else if (spliceDel !== undefined && spliceDel !== null) {
        element.spliceArrayDataOnPath(path, spliceIndex, spliceDel, newData)
        dataDirty = true
      } else {
        element.replaceDataOnPath(path, newData)
        dataDirty = true
      }
    }
    if (dataDirty) element.applyDataUpdates()
    if (externalClassDirty) element.applyExternalClassChanges()
  }

  registerStyleSheetContent(path: string, content: unknown): void {
    const { _backendContext } = this
    _backendContext.registerStyleSheetContent(path, content)
  }

  appendStyleSheetPath(index: number, path: string, styleScope?: number): void {
    const { _backendContext, _styleSheetIdMapping } = this
    const styleSheetIndex = _backendContext.appendStyleSheetPath(path, styleScope)
    _styleSheetIdMapping[index] = styleSheetIndex
  }

  disableStyleSheet(index: number): void {
    const { _backendContext, _styleSheetIdMapping } = this
    const styleSheetIndex = _styleSheetIdMapping[index]!
    _backendContext.disableStyleSheet(styleSheetIndex)
  }

  performanceStartTrace(index: number): void {
    this._traceStartTimestampMapping[index] = Date.now()
  }

  performanceEndTrace(
    index: number,
    cb: (stats: { startTimestamp: number; endTimestamp: number }) => void,
  ): void {
    const endTimestamp = Date.now()
    const startTimestamp = this._traceStartTimestampMapping[index]!
    delete this._traceStartTimestampMapping[index]
    cb({ startTimestamp, endTimestamp })
  }
}

// class EmptyTemplateEngine implements templateEngine.Template {
//   static create(rootBehavior: GeneralBehavior, options: NormalizedComponentOptions) {
//     return new EmptyTemplateEngine()
//   }

//   createInstance(
//     elem: typeUtils.GeneralComponentInstance,
//     createShadowRoot: (comp: typeUtils.GeneralComponentInstance) => ShadowRoot,
//   ): templateEngine.TemplateInstance {
//     return new EmptyTemplateInstance(elem, createShadowRoot)
//   }
// }

// class EmptyTemplateInstance implements templateEngine.TemplateInstance {
//   shadowRoot: ShadowRoot

//   constructor(
//     component: typeUtils.GeneralComponentInstance,
//     createShadowRoot: (comp: typeUtils.GeneralComponentInstance) => ShadowRoot,
//   ) {
//     this.shadowRoot = createShadowRoot(component)
//   }

//   initValues(data: DataValue) {
//     // 组件被创建，初始数据是 data
//   }

//   updateValues(data: DataValue, changes: DataChange[]) {
//     // 组件更新，新的数据是 data ，变更内容描述在 changes 中
//   }
// }

export { ChannelEventType, MessageChannelViewSide } from './message_channel'
