/* eslint-disable consistent-return, class-methods-use-this, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/consistent-type-imports */
import type {
  BehaviorBuilder,
  ComponentSpace,
  DataChange,
  Element,
  EventListener,
  EventMutLevel,
  GeneralBackendContext,
  GeneralBackendElement,
  GeneralComponent,
  backend as GlassEaselBackend,
  Node,
  ShadowRoot,
  SlotMode,
  TextNode,
  VirtualNode,
  composedBackend,
  domlikeBackend,
  backend as shadowBackend,
} from 'glass-easel'
import { EmptyTemplateEngine } from './template_engine'
import { dashToCamelCase, initValues, updateValues } from './utils'

// eslint-disable-next-line @typescript-eslint/ban-types
type OptionalKeys<T> = { [P in keyof T]-?: {} extends Pick<T, P> ? P : never }[keyof T]

type CallbackFunction<Args extends any[], Ret> = (...args: [...Args, (ret: Ret) => void]) => void
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ParametersOrNever<T> = T extends CallbackFunction<infer Arg, infer Ret> ? Arg : never
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type DefaultReturn<T> = T extends CallbackFunction<infer Arg, infer Ret> ? Ret : never

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

  private _customMethodHandler: ((element: Element | null, options: any) => void) | undefined

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

  createMediaQueryObserver(
    status: GlassEaselBackend.MediaQueryStatus,
    listener: (res: { matches: boolean }) => void,
  ): GlassEaselBackend.Observer | undefined {
    const { _backendContext } = this
    return _backendContext.createMediaQueryObserver?.(status, listener)
  }

  createIntersectionObserver(
    target: Element,
    relativeElement: Element | null,
    relativeElementMargin: string,
    threshold: number[],
    listener: (res: GlassEaselBackend.IntersectionStatus) => void,
  ): GlassEaselBackend.Observer | undefined {
    return (
      target.createIntersectionObserver(
        relativeElement,
        relativeElementMargin,
        threshold,
        listener,
      ) ?? undefined
    )
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

  private _$pendingCreateSimpleComponent: ((isReflectComponent: boolean) => void) | undefined
  private _$pendingAssignComponentId: ((component: GeneralComponent) => void) | undefined

  createSimpleComponent(
    tagName: string,
    external: boolean,
    ownerShadowRoot: ShadowRoot | undefined,
    virtualHost: boolean,
    styleScope: number,
    extraStyleScope: number | null,
    externalClasses: string[] | undefined,
    slotMode: SlotMode | null,
    writeIdToDOM: boolean,
    chainDefinition: ((def: BehaviorBuilder) => BehaviorBuilder) | undefined,
    cb: (component: GeneralComponent) => void,
  ): void {
    const { _glassEasel, _backendContext } = this
    this._$pendingAssignComponentId = (component) => {
      this._$pendingAssignComponentId = undefined
      cb(component)
    }
    this._$pendingCreateSimpleComponent = (isReflect) => {
      this._$pendingCreateSimpleComponent = undefined
      if (isReflect || external) {
        const comp = this.createExternalComponent(tagName, tagName, ownerShadowRoot)
        if (comp && typeof comp !== 'string') return this._$pendingAssignComponentId?.(comp)
      }

      const actualStyleScope =
        (styleScope !== undefined ? this._styleScopeIdMapping[styleScope] : undefined) ??
        _glassEasel.StyleScopeManager.globalScope()
      const actualExtraStyleScope =
        extraStyleScope !== null ? this._styleScopeIdMapping[extraStyleScope] : undefined
      const componentSpace = this._componentSpace
      const compDefBuilder = componentSpace.define().definition({
        options: {
          // externalComponent: external,
          multipleSlots: slotMode === _glassEasel.SlotMode.Multiple,
          dynamicSlots: slotMode === _glassEasel.SlotMode.Dynamic,
          virtualHost,
          styleScope: actualStyleScope,
          extraStyleScope: actualExtraStyleScope,
          writeIdToDOM,
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

      return this._$pendingAssignComponentId?.(node)
    }
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
      _glassEasel.Element.pretendDetached(child as Element)
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
      _glassEasel.Element.pretendAttached(child as Element)
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
    this._$pendingCreateSimpleComponent?.(data.isReflect as boolean)
  }

  setId(element: Element, id: string): void {
    element.id = id
  }

  setSlot(element: Element, name: string): void {
    element.slot = name
  }

  setSlotName(element: Element, name: string): void {
    const { _glassEasel } = this
    _glassEasel.Element.setSlotName(element, name)
  }

  setSlotElement(node: Node, slot: Element | null): void {
    const { _glassEasel } = this
    _glassEasel.Element.setSlotElement(node, slot)
  }

  setExternalSlot(_component: GeneralComponent, _slot: Element): void {
    // TODO
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

  setStyle(element: Element, styleText: string, styleSegmentIndex: number): void {
    element.setNodeStyle(styleText, styleSegmentIndex)
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
    if (Component.isComponent(element)) {
      const camelName = dashToCamelCase(name)
      const dataProxy = Component.getDataProxy(element)
      if (dataProxy.replaceProperty(camelName, value)) {
        dataProxy.applyDataUpdates(true)
        return
      }
      if (element.hasExternalClass(name)) {
        element.setExternalClass(name, value)
        return
      }
    }
    element.updateAttribute(name, value)
  }

  removeAttribute(element: Element, name: string): void {
    const { _glassEasel } = this
    const Component = _glassEasel.Component
    if (Component.isComponent(element)) {
      const camelName = dashToCamelCase(name)
      const dataProxy = Component.getDataProxy(element)
      if (dataProxy.replaceProperty(camelName, undefined)) {
        dataProxy.applyDataUpdates(true)
        return
      }
      if (element.hasExternalClass(name)) {
        element.setExternalClass(name, '')
        return
      }
    }
    element.removeAttribute(name)
  }

  setDataset(element: Element, name: string, value: unknown): void {
    element.setDataset(name, value)
  }

  setText(textNode: TextNode, textContent: string): void {
    textNode.textContent = textContent
  }

  setModelBindingStat(
    element: Element,
    attributeName: string,
    listener: (newValue: unknown) => void,
  ): void {
    const { _glassEasel } = this
    if (_glassEasel.Component.isComponent(element)) {
      const nodeDataProxy = _glassEasel.Component.getDataProxy(element)
      nodeDataProxy.setModelBindingListener(attributeName, listener)
    } else if (_glassEasel.NativeNode.isNativeNode(element)) {
      element.setModelBindingListener(attributeName, listener)
    }
  }

  private callSuggestedBackendMethod<M extends OptionalKeys<GlassEaselBackend.Element>>(
    element: Element,
    method: M,
    args: ParametersOrNever<GlassEaselBackend.Element[M]>,
    defaultReturn: DefaultReturn<GlassEaselBackend.Element[M]>,
    cb: (res: DefaultReturn<GlassEaselBackend.Element[M]>) => void,
  ): void {
    const { _glassEasel } = this
    const backendContext = element.getBackendContext()
    const backendElement = element.getBackendElement()
    if (!backendContext || !backendElement) {
      return cb(defaultReturn)
    }
    if (backendContext.mode === _glassEasel.BackendMode.Domlike) {
      if (!(backendContext as any)[method]) {
        return cb(defaultReturn)
      }
      ;(backendContext as any)[method](backendElement as domlikeBackend.Element, ...args, cb)
    } else {
      const be = backendElement as composedBackend.Element | shadowBackend.Element
      if (!be[method]) {
        return cb(defaultReturn)
      }
      ;(be as any)[method](...args, cb)
    }
  }

  getAllComputedStyles(
    element: Element,
    cb: (res: GlassEaselBackend.GetAllComputedStylesResponses) => void,
  ): void {
    this.callSuggestedBackendMethod(element, 'getAllComputedStyles', [], { properties: [] }, cb)
  }

  getPseudoComputedStyles(
    element: Element,
    pseudoType: string,
    cb: (res: GlassEaselBackend.GetAllComputedStylesResponses) => void,
  ): void {
    this.callSuggestedBackendMethod(
      element,
      'getPseudoComputedStyles',
      [pseudoType],
      { properties: [] },
      cb,
    )
  }

  getInheritedRules(
    element: Element,
    cb: (res: GlassEaselBackend.GetInheritedRulesResponses) => void,
  ): void {
    this.callSuggestedBackendMethod(element, 'getInheritedRules', [], { rules: [] }, cb)
  }

  replaceStyleSheetAllProperties(
    sheetIndex: number,
    ruleIndex: number,
    inlineStyle: string,
    callback: (propertyIndex: number | null) => void,
  ): void {
    const { _backendContext } = this
    if (!_backendContext.replaceStyleSheetAllProperties) {
      callback(null)
      return
    }
    _backendContext.replaceStyleSheetAllProperties(sheetIndex, ruleIndex, inlineStyle, callback)
  }

  getBoundingClientRect(
    element: Element,
    cb: (res: { left: number; top: number; width: number; height: number }) => void,
  ): void {
    element.getBoundingClientRect(cb)
  }

  getBoxModel(
    element: Element,
    cb: (res: {
      margin: GlassEaselBackend.BoundingClientRect
      border: GlassEaselBackend.BoundingClientRect
      padding: GlassEaselBackend.BoundingClientRect
      content: GlassEaselBackend.BoundingClientRect
    }) => void,
  ): void {
    const mockRect = { left: 0, top: 0, width: 0, height: 0 }
    const mockBoxModel = {
      margin: mockRect,
      border: mockRect,
      padding: mockRect,
      content: mockRect,
    }
    this.callSuggestedBackendMethod(element, 'getBoxModel', [], mockBoxModel, cb)
  }

  getMatchedRules(
    element: Element,
    cb: (res: GlassEaselBackend.GetMatchedRulesResponses) => void,
  ): void {
    this.callSuggestedBackendMethod(element, 'getMatchedRules', [], { inline: [], rules: [] }, cb)
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

  setScrollPosition(
    element: Element,
    scrollLeft: number,
    scrollTop: number,
    duration: number,
  ): void {
    const { _glassEasel } = this
    const backendContext = element.getBackendContext()
    const backendElement = element.getBackendElement()
    if (!backendContext || !backendElement) {
      return
    }
    if (backendContext.mode === _glassEasel.BackendMode.Domlike) {
      if (!backendContext.setScrollPosition) {
        return
      }
      backendContext.setScrollPosition?.(
        backendElement as domlikeBackend.Element,
        scrollLeft,
        scrollTop,
        duration,
      )
    } else {
      const be = backendElement as composedBackend.Element | shadowBackend.Element
      if (!be.setScrollPosition) {
        return
      }
      be.setScrollPosition?.(scrollLeft, scrollTop, duration)
    }
  }

  getContext(element: Element, cb: (res: any) => void): void {
    this.callSuggestedBackendMethod(element, 'getContext', [], null, cb)
  }

  getPseudoTypes(element: Element, cb: (res: string[]) => void): void {
    this.callSuggestedBackendMethod(element, 'getPseudoTypes', [], [], cb)
  }

  startOverlayInspect(callback: (event: string, node: Element | null) => void): void {
    const { _backendContext } = this
    if (!_backendContext.startOverlayInspect) {
      return
    }
    _backendContext.startOverlayInspect(callback)
  }

  stopOverlayInspect(): void {
    const { _backendContext } = this
    if (!_backendContext.stopOverlayInspect) {
      return
    }
    _backendContext.stopOverlayInspect()
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
    initValues(element, values)
  }

  updateValues(element: Element, changes: DataChange[]): void {
    updateValues(element, changes)
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

  handleCustomMethod(_element: Element | null, _options: unknown): void {
    // To be override
  }

  onCustomMethod(handler: (element: Element | null, options: any) => void) {
    this._customMethodHandler = handler
  }

  sendCustomMethod(element: Element | null, options: unknown): void {
    this._customMethodHandler?.(element, options)
  }
}

export { ChannelEventType, MessageChannelViewSide, getNodeId } from './message_channel'
