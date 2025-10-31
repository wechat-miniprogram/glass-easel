/* eslint-disable class-methods-use-this, @typescript-eslint/consistent-type-imports */
import type {
  BackendMode,
  Element,
  Event,
  EventBubbleStatus,
  EventOptions,
  GeneralBehavior,
  GeneralBehaviorBuilder,
  GeneralComponent,
  backend as GlassEaselBackend,
  Node,
  NormalizedComponentOptions,
  ShadowRoot,
  SlotMode,
  StyleScopeManager,
  templateEngine,
  typeUtils,
} from 'glass-easel'
import { type Channel } from './message_channel'
import { replayShadowBackend } from './replay'
import { EmptyTemplateEngine } from './template_engine'
import { type IDGenerator } from './utils'

export const enum ShadowSyncElementType {
  Fragment,
  Element,
  TextNode,
  Component,
  ShadowRoot,
  VirtualNode,
}

export class ShadowSyncElement implements GlassEaselBackend.Element {
  public _id: number

  public __wxElement: Element | undefined
  public shadowRoot: ShadowSyncShadowRoot | undefined

  /** @internal */
  static _prepareElement(
    context: ShadowSyncBackendContext,
    elem: ShadowSyncElement,
    logicalName: string,
    stylingName: string,
    ownerShadowRoot: ShadowSyncShadowRoot,
  ): ShadowSyncElement {
    context.channel.createElement(elem._id, logicalName, stylingName, ownerShadowRoot._id)
    return elem
  }

  static createElement(
    context: ShadowSyncBackendContext,
    logicalName: string,
    stylingName: string,
    ownerShadowRoot: ShadowSyncShadowRoot,
  ): ShadowSyncElement {
    return ShadowSyncElement._prepareElement(
      context,
      new ShadowSyncElement(context, ShadowSyncElementType.Element, ownerShadowRoot),
      logicalName,
      stylingName,
      ownerShadowRoot,
    )
  }

  /** @internal */
  static _prepareComponent(
    context: ShadowSyncBackendContext,
    componentElement: ShadowSyncElement,
    shadowRoot: ShadowSyncShadowRoot,
    tagName: string,
    external: boolean,
    virtualHost: boolean,
    styleScope: number,
    extraStyleScope: number | null,
    externalClasses: string[] | undefined,
    slotMode: SlotMode | null,
    writeIdToDOM: boolean,
    ownerShadowRoot: ShadowSyncShadowRoot,
  ): ShadowSyncElement {
    context._checkStyleScope(styleScope)
    context._checkStyleScope(extraStyleScope)
    componentElement.shadowRoot = shadowRoot
    context.channel.createComponent(
      componentElement._id,
      shadowRoot._id,
      tagName,
      external,
      virtualHost,
      styleScope,
      extraStyleScope,
      externalClasses,
      slotMode,
      writeIdToDOM,
      ownerShadowRoot._id,
    )
    return componentElement
  }

  static createComponent(
    context: ShadowSyncBackendContext,
    tagName: string,
    external: boolean,
    virtualHost: boolean,
    styleScope: number,
    extraStyleScope: number | null,
    externalClasses: string[] | undefined,
    slotMode: SlotMode,
    writeIdToDOM: boolean,
    ownerShadowRoot: ShadowSyncShadowRoot,
  ): ShadowSyncElement {
    return ShadowSyncElement._prepareComponent(
      context,
      new ShadowSyncElement(context, ShadowSyncElementType.Component, ownerShadowRoot),
      new ShadowSyncShadowRoot(context),
      tagName,
      external,
      virtualHost,
      styleScope,
      extraStyleScope,
      externalClasses,
      slotMode,
      writeIdToDOM,
      ownerShadowRoot,
    )
  }

  /** @internal */
  static _prepareTextNode(
    context: ShadowSyncBackendContext,
    elem: ShadowSyncElement,
    textContent: string,
    ownerShadowRoot: ShadowSyncShadowRoot,
  ): ShadowSyncElement {
    context.channel.createTextNode(elem._id, textContent, ownerShadowRoot._id)
    return elem
  }

  static createTextNode(
    context: ShadowSyncBackendContext,
    textContent: string,
    ownerShadowRoot: ShadowSyncShadowRoot,
  ): ShadowSyncElement {
    return ShadowSyncElement._prepareTextNode(
      context,
      new ShadowSyncElement(context, ShadowSyncElementType.TextNode, ownerShadowRoot),
      textContent,
      ownerShadowRoot,
    )
  }

  /** @internal */
  static _prepareVirtualNode(
    context: ShadowSyncBackendContext,
    elem: ShadowSyncElement,
    virtualName: string,
    ownerShadowRoot: ShadowSyncShadowRoot,
  ): ShadowSyncElement {
    context.channel.createVirtualNode(elem._id, virtualName, ownerShadowRoot._id)
    return elem
  }

  static createVirtualNode(
    context: ShadowSyncBackendContext,
    virtualName: string,
    ownerShadowRoot: ShadowSyncShadowRoot,
  ): ShadowSyncElement {
    return ShadowSyncElement._prepareVirtualNode(
      context,
      new ShadowSyncElement(context, ShadowSyncElementType.VirtualNode, ownerShadowRoot),
      virtualName,
      ownerShadowRoot,
    )
  }

  static createFragment(context: ShadowSyncBackendContext): ShadowSyncElement {
    const elem = new ShadowSyncElement(context, ShadowSyncElementType.Fragment, null)
    context.channel.createFragment(elem._id)
    return elem
  }

  protected constructor(
    protected _context: ShadowSyncBackendContext,
    public type: ShadowSyncElementType,
    public ownerShadowRoot: ShadowSyncShadowRoot | null,
  ) {
    const id = (this._id = _context._genElementId())
    _context._setElementId(id, this)
  }

  release(): void {
    this._context._removeElementId(this._id)
    this._context.channel.release(this._id)
  }

  associateValue(v: Element): void {
    this._context.channel.associateValue(this._id, this._context.getAssociateValueInfo(v))
  }

  getShadowRoot(): ShadowSyncShadowRoot | undefined {
    return this.shadowRoot
  }

  appendChild(child: ShadowSyncElement): void {
    this._context.channel.appendChild(this._id, child._id)
  }

  removeChild(child: ShadowSyncElement): void {
    this._context.channel.removeChild(this._id, child._id)
  }

  insertBefore(child: ShadowSyncElement, before: ShadowSyncElement): void {
    this._context.channel.insertBefore(this._id, child._id, before._id)
  }

  replaceChild(child: ShadowSyncElement, oldChild: ShadowSyncElement): void {
    this._context.channel.replaceChild(this._id, child._id, oldChild._id)
  }

  spliceBefore(before: ShadowSyncElement, deleteCount: number, list: ShadowSyncElement): void {
    this._context.channel.spliceBefore(this._id, before._id, deleteCount, list._id)
  }

  spliceAppend(list: ShadowSyncElement): void {
    this._context.channel.spliceAppend(this._id, list._id)
  }

  spliceRemove(start: ShadowSyncElement, deleteCount: number): void {
    this._context.channel.spliceRemove(this._id, start._id, deleteCount)
  }

  setId(id: string): void {
    this._context.channel.setId(this._id, id)
  }

  setSlot(name: string): void {
    this._context.channel.setSlot(this._id, name)
  }

  setSlotName(name: string): void {
    this._context.channel.setSlotName(this._id, name)
  }

  setSlotElement(slot: ShadowSyncElement | null): void {
    this._context.channel.setSlotElement(this._id, slot ? slot._id : slot)
  }

  setExternalSlot(slot: ShadowSyncElement): void {
    this._context.channel.setExternalSlot(this._id, slot._id)
  }

  setInheritSlots(): void {
    this._context.channel.setInheritSlots(this._id)
  }

  setStyle(styleText: string, styleSegmentIndex: number): void {
    this._context.channel.setStyle(this._id, styleText, styleSegmentIndex)
  }

  addClass(className: string): void {
    this._context.channel.addClass(this._id, className)
  }

  removeClass(className: string): void {
    this._context.channel.removeClass(this._id, className)
  }

  clearClasses(): void {
    this._context.channel.clearClasses(this._id)
  }

  setClassAlias(className: string, target: string[]): void {
    this._context.channel.setClassAlias(this._id, className, target)
  }

  setAttribute(name: string, value: any): void {
    this._context.channel.setAttribute(this._id, name, value)
  }

  removeAttribute(name: string): void {
    this._context.channel.removeAttribute(this._id, name)
  }

  setDataset(name: string, value: unknown): void {
    this._context.channel.setDataset(this._id, name, value)
  }

  setText(content: string): void {
    this._context.channel.setText(this._id, content)
  }

  getAllComputedStyles(cb: (res: GlassEaselBackend.GetAllComputedStylesResponses) => void): void {
    this._context.channel.getAllComputedStyles(this._id, cb)
  }

  getPseudoComputedStyles(
    pseudoType: string,
    cb: (res: GlassEaselBackend.GetAllComputedStylesResponses) => void,
  ): void {
    this._context.channel.getPseudoComputedStyles(this._id, pseudoType, cb)
  }

  getInheritedRules(cb: (res: GlassEaselBackend.GetInheritedRulesResponses) => void): void {
    this._context.channel.getInheritedRules(this._id, cb)
  }

  getBoundingClientRect(
    cb: (res: { left: number; top: number; width: number; height: number }) => void,
  ): void {
    this._context.channel.getBoundingClientRect(this._id, cb)
  }

  getBoxModel(
    cb: (res: {
      margin: GlassEaselBackend.BoundingClientRect
      border: GlassEaselBackend.BoundingClientRect
      padding: GlassEaselBackend.BoundingClientRect
      content: GlassEaselBackend.BoundingClientRect
    }) => void,
  ): void {
    this._context.channel.getBoxModel(this._id, cb)
  }

  getMatchedRules(cb: (res: GlassEaselBackend.GetMatchedRulesResponses) => void): void {
    this._context.channel.getMatchedRules(this._id, cb)
  }

  getScrollOffset(
    cb: (res: {
      scrollLeft: number
      scrollTop: number
      scrollWidth: number
      scrollHeight: number
    }) => void,
  ): void {
    this._context.channel.getScrollOffset(this._id, cb)
  }

  setScrollPosition(scrollLeft: number, scrollTop: number, duration: number): void {
    this._context.channel.setScrollPosition(this._id, scrollLeft, scrollTop, duration)
  }

  getPseudoTypes(cb: (res: string[]) => void): void {
    this._context.channel.getPseudoTypes(this._id, cb)
  }

  setModelBindingStat(attributeName: string, listener: ((newValue: unknown) => void) | null): void {
    this._context.channel.setModelBindingStat(this._id, attributeName, listener)
  }

  setListenerStats(type: string, capture: boolean, mutLevel: number): void {
    this._context.channel.setListenerStats(this._id, type, capture, mutLevel)
  }

  createIntersectionObserver(
    relativeElement: ShadowSyncElement | null,
    relativeElementMargin: string,
    thresholds: number[],
    listener: (res: GlassEaselBackend.IntersectionStatus) => void,
  ): GlassEaselBackend.Observer {
    const id = this._context.channel.createIntersectionObserver(
      this._id,
      relativeElement ? relativeElement._id : null,
      relativeElementMargin,
      thresholds,
      listener,
    )
    return {
      disconnect: () => {
        this._context.channel.disconnectObserver(id)
      },
    }
  }

  getContext(cb: (res: any) => void): void {
    this._context.channel.getContext(this._id, cb)
  }

  setWXSListenerStats(
    eventName: string,
    final: boolean,
    mutated: boolean,
    capture: boolean,
    lvaluePath: (string | number)[],
  ): void {
    this._context.channel.setWXSListenerStats(
      this._id,
      eventName,
      final,
      mutated,
      capture,
      lvaluePath,
    )
  }

  callWxsPropChangeListener(newValue: any, oldValue: any, lvaluePath: (string | number)[]): void {
    this._context.channel.callWXSPropChangeListener(this._id, newValue, oldValue, lvaluePath)
  }
}

export class ShadowSyncShadowRoot
  extends ShadowSyncElement
  implements GlassEaselBackend.ShadowRootContext
{
  /** @internal */
  constructor(context: ShadowSyncBackendContext) {
    super(context, ShadowSyncElementType.ShadowRoot, null)
    this.ownerShadowRoot = this
  }

  createElement(logicalName: string, stylingName: string): ShadowSyncElement {
    return ShadowSyncElement.createElement(this._context, logicalName, stylingName, this)
  }
  createTextNode(content: string): ShadowSyncElement {
    return ShadowSyncElement.createTextNode(this._context, content, this)
  }
  createComponent(
    tagName: string,
    external: boolean,
    virtualHost: boolean,
    styleScope: number,
    extraStyleScope: number | null,
    externalClasses: string[] | undefined,
    slotMode: SlotMode,
    writeIdToDOM: boolean,
  ): ShadowSyncElement {
    return ShadowSyncElement.createComponent(
      this._context,
      tagName,
      external,
      virtualHost,
      styleScope,
      extraStyleScope,
      externalClasses,
      slotMode,
      writeIdToDOM,
      this,
    )
  }
  createVirtualNode(virtualName: string): ShadowSyncElement {
    return ShadowSyncElement.createVirtualNode(this._context, virtualName, this)
  }
}

export class ShadowSyncBackendContext implements GlassEaselBackend.Context {
  mode: BackendMode.Shadow = 1

  private _elementIdGen: IDGenerator
  private _elementIdMap: (ShadowSyncElement | undefined)[] = []

  private _shadowRoot: ShadowSyncShadowRoot

  private _$registeredStyleSheets = [] as [string, unknown][]
  private _$appendedStyleSheets = [] as [number, string, number | undefined][]
  private _$styleSheetIdInc = 1
  private _$styleScopeMap = new Map<number, string | undefined>()
  private _windowInfo = {
    width: 0,
    height: 0,
    devicePixelRatio: 0,
  }
  private _themeInfo = {
    theme: 'light',
  }
  private _windowResizeListener:
    | ((res: { width: number; height: number; devicePixelRatio: number }) => void)
    | undefined
  private _themeChangeListener: ((res: { theme: string }) => void) | undefined
  private _createEvent:
    | ((type: string, detail: any, options: EventOptions) => Event<unknown>)
    | null = null
  private _triggerEvent:
    | ((
        event: Event<unknown>,
        currentTarget: Element,
        mark: Record<string, unknown> | null,
        target: Element,
        isCapture: boolean,
      ) => EventBubbleStatus | void)
    | null = null

  private _traceIdGen: IDGenerator

  constructor(
    public channel: Channel,
    private styleScopeManager: StyleScopeManager,
    idGenerator: () => IDGenerator,
  ) {
    this._elementIdGen = idGenerator()
    this._traceIdGen = idGenerator()
    this._shadowRoot = new ShadowSyncShadowRoot(this)
    this.initContext()
  }

  initContext() {
    const { channel } = this
    channel.create(({ windowInfo, themeInfo }) => {
      this._windowInfo = windowInfo
      this._themeInfo = themeInfo
    })
    channel.onEvent(
      (type, detail, options) => this._createEvent!(type, detail, options),
      (event, currentTargetId, mark, targetId, isCapture) => {
        const currentTarget = this._elementIdMap[currentTargetId]?.__wxElement as Element
        const target = this._elementIdMap[targetId]?.__wxElement as Element
        if (!currentTarget || !target) return

        this._triggerEvent!(event, currentTarget, mark, target, isCapture)
      },
    )
    channel.onWindowResize((windowInfo) => {
      this._windowInfo = windowInfo
      this._windowResizeListener?.(windowInfo)
    })
    channel.onThemeChange((themeInfo) => {
      this._themeInfo = themeInfo
      this._themeChangeListener?.(themeInfo)
    })
  }

  getAssociateValueInfo(node: Node): Record<string, unknown> {
    const behavior = node.asGeneralComponent()?.getComponentDefinition().behavior
    return {
      isReflect: behavior && ShadowSyncBackendContext._reflectingComponentBehaviors.has(behavior),
    }
  }

  destroy(): void {
    this.channel.destroy()
  }

  getWindowWidth(): number {
    return this._windowInfo.width
  }

  getWindowHeight(): number {
    return this._windowInfo.height
  }

  getDevicePixelRatio(): number {
    return this._windowInfo.devicePixelRatio
  }

  onWindowResize(
    cb: (res: { width: number; height: number; devicePixelRatio: number }) => void,
  ): void {
    this._windowResizeListener = cb
  }

  getTheme(): string {
    return this._themeInfo.theme
  }

  onThemeChange(cb: (res: { theme: string }) => void): void {
    this._themeChangeListener = cb
  }

  registerStyleSheetContent(path: string, content: any): void {
    this._$registeredStyleSheets.push([path, content])
    this.channel.registerStyleSheetContent(path, content)
  }

  _checkStyleScope(styleScope: number | null | undefined) {
    if (styleScope !== null && styleScope !== undefined && !this._$styleScopeMap.has(styleScope)) {
      const stylePrefix = this.styleScopeManager.queryName(styleScope)
      this._$styleScopeMap.set(styleScope, stylePrefix)
      this.channel.registerStyleScope(styleScope, stylePrefix)
    }
  }

  appendStyleSheetPath(path: string, styleScope: number | undefined): number {
    this._checkStyleScope(styleScope)
    const id = this._$styleSheetIdInc
    this._$styleSheetIdInc += 1
    this._$appendedStyleSheets.push([id, path, styleScope])
    this.channel.appendStyleSheetPath(id, path, styleScope)
    return id
  }

  disableStyleSheet(index: number): void {
    this.channel.disableStyleSheet(index)
  }

  replaceStyleSheetAllProperties(
    sheetIndex: number,
    ruleIndex: number,
    inlineStyle: string,
    callback: (propertyIndex: number | null) => void,
  ): void {
    this.channel.replaceStyleSheetAllProperties(sheetIndex, ruleIndex, inlineStyle, callback)
  }

  startOverlayInspect(cb: (event: string, node: Element | null) => void): void {
    this.channel.startOverlayInspect((event, elementId) => {
      cb(event, elementId ? (this._elementIdMap[elementId]!.__wxElement as Element) : null)
    })
  }

  stopOverlayInspect(): void {
    this.channel.stopOverlayInspect()
  }

  render(cb: (err: Error | null) => void) {
    this.channel.render(cb)
  }

  getRootNode(): ShadowSyncShadowRoot {
    return this._shadowRoot
  }

  createFragment(): ShadowSyncElement {
    return ShadowSyncElement.createFragment(this)
  }

  onEvent(
    _createEvent: (type: string, detail: any, options: EventOptions) => Event<unknown>,
    _listener: (
      event: Event<unknown>,
      currentTarget: Element,
      mark: Record<string, unknown> | null,
      target: Element,
      isCapture: boolean,
    ) => EventBubbleStatus | void,
  ): void {
    this._createEvent = _createEvent
    this._triggerEvent = _listener
  }

  createMediaQueryObserver(
    status: GlassEaselBackend.MediaQueryStatus,
    listener: (res: { matches: boolean }) => void,
  ): GlassEaselBackend.Observer {
    const id = this.channel.createMediaQueryObserver(status, listener)
    return {
      disconnect: () => {
        this.channel.disconnectObserver(id)
      },
    }
  }

  _genElementId() {
    return this._elementIdGen.gen()
  }

  _setElementId(id: number, elem: ShadowSyncElement) {
    this._elementIdMap[id] = elem
  }

  _getElementId(id: number) {
    return this._elementIdMap[id]
  }

  _removeElementId(id: number) {
    this._elementIdGen.release(id)
    this._elementIdMap[id] = undefined
  }

  performanceTraceStart(): number {
    const id = this._traceIdGen.gen()
    this.channel.performanceStartTrace(id)
    return id
  }

  performanceTraceEnd(
    id: number,
    cb: (stats: { startTimestamp: number; endTimestamp: number }) => void,
  ): void {
    this._traceIdGen.release(id)
    this.channel.performanceEndTrace(id, cb)
  }

  reInitContext() {
    this.initContext()
    this._$registeredStyleSheets.forEach(([path, content]) => {
      this.channel.registerStyleSheetContent(path, content)
    })
    this._$styleScopeMap.forEach((stylePrefix, styleScope) => {
      this.channel.registerStyleScope(styleScope, stylePrefix)
    })
    this._$appendedStyleSheets.forEach(([id, path, styleScope]) => {
      this.channel.appendStyleSheetPath(id, path, styleScope)
    })
  }

  replay(
    glassEasel: typeof import('glass-easel'),
    roots: Node[],
    getShadowSyncElement: (elem: Node) => ShadowSyncElement,
  ) {
    roots.forEach((root) => {
      replayShadowBackend(glassEasel, this, root, {
        createElement: (ownerShadowRoot: ShadowSyncShadowRoot, elem) => {
          let be
          if (glassEasel.TextNode.isTextNode(elem)) {
            be = ShadowSyncElement._prepareTextNode(
              this,
              getShadowSyncElement(elem),
              elem.textContent,
              ownerShadowRoot,
            )
          } else if (glassEasel.NativeNode.isNativeNode(elem)) {
            be = ShadowSyncElement._prepareElement(
              this,
              getShadowSyncElement(elem),
              elem.is,
              elem.stylingName,
              ownerShadowRoot,
            )
          } else if (glassEasel.VirtualNode.isVirtualNode(elem)) {
            // shadowRoot is created by createComponent, ignore it
            be = ShadowSyncElement._prepareVirtualNode(
              this,
              getShadowSyncElement(elem),
              elem.is,
              ownerShadowRoot,
            )
          } else if (glassEasel.Component.isComponent(elem)) {
            const options = elem.getComponentOptions()
            be = ShadowSyncElement._prepareComponent(
              this,
              getShadowSyncElement(elem),
              getShadowSyncElement(elem.getShadowRoot()!) as ShadowSyncShadowRoot,
              elem.tagName,
              elem.isExternal(),
              elem.isVirtual(),
              options.styleScope ?? glassEasel.StyleScopeManager.globalScope(),
              options.extraStyleScope,
              Object.keys(elem.getExternalClasses()),
              elem.getShadowRoot()?.getSlotMode() ?? null,
              options.writeIdToDOM,
              ownerShadowRoot,
            )
          } else {
            throw new Error(`Unknown elem type ${elem.constructor.name}`)
          }
          return be
        },
      })
      this._shadowRoot.appendChild(getShadowSyncElement(root))
    })
  }

  onWXSCallMethod(handler: (component: GeneralComponent, method: string, args: any[]) => void) {
    this.channel.onWXSCallMethod((componentId, method, args) => {
      const component = this._getElementId(componentId)!.__wxElement as GeneralComponent
      handler(component, method, args)
    })
  }

  private static _reflectingComponentBehaviors = new Set<GeneralBehavior>()

  static hookReflectTemplateEngine(
    TemplateEngine: templateEngine.TemplateEngine = EmptyTemplateEngine,
  ) {
    return class SyncTemplateEngine implements templateEngine.Template {
      static create(behavior: GeneralBehavior, componentOptions: NormalizedComponentOptions) {
        ShadowSyncBackendContext._reflectingComponentBehaviors.add(behavior)
        return new SyncTemplateEngine(TemplateEngine.create(behavior, componentOptions))
      }

      // eslint-disable-next-line no-useless-constructor
      constructor(public template: templateEngine.Template) {
        //
      }

      updateTemplate(behavior: GeneralBehavior): void {
        this.template.updateTemplate?.(behavior)
      }

      createInstance(
        elem: GeneralComponent,
        createShadowRoot: (component: GeneralComponent) => ShadowRoot,
      ): templateEngine.TemplateInstance {
        const context = elem.getBackendContext()
        if (!(context instanceof ShadowSyncBackendContext)) {
          throw new Error('')
        }
        const { channel } = context
        const backendElement = elem.getBackendElement() as ShadowSyncElement
        const actualInstance = this.template.createInstance(elem, createShadowRoot)

        const instance: templateEngine.TemplateInstance = {
          shadowRoot: actualInstance.shadowRoot,
          initValues: (data) => {
            channel.initValues(backendElement._id, data)
            actualInstance.initValues(data)
          },
          updateValues: (data, changes) => {
            channel.updateValues(backendElement._id, changes)
            actualInstance.updateValues(data, changes)
          },
          updateTemplate: (template, data) => {
            actualInstance.updateTemplate?.(template, data)
          },
        }

        return instance
      }
    }
  }
}

export const hookBuilderToSyncData = <TBuilder extends GeneralBehaviorBuilder>(
  builder: TBuilder,
  getComponentFromMethodCaller?: (methodCaller: GeneralComponent) => GeneralComponent | undefined
): TBuilder => {
  const properties: string[] = []

  const getContextFromMethodCaller = (methodCaller: GeneralComponent) => {
    const component: GeneralComponent = getComponentFromMethodCaller?.(methodCaller) || methodCaller
    const context = component.getBackendContext() as ShadowSyncBackendContext
    const backendElement = component.getBackendElement() as ShadowSyncElement
    if (!(context instanceof ShadowSyncBackendContext)) {
      throw new Error('')
    }
    return { component, context, backendElement }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const builderPrototype = Object.getPrototypeOf(builder)

  let pendingChanges: any[] | undefined

  const addObserver = (builder: any, name: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    builderPrototype.observer.call(builder, name, function (this: any, newValue: any) {
      const { context, backendElement } = getContextFromMethodCaller(this)

      if (!pendingChanges) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return, promise/always-return
        Promise.resolve().then(() => {
          context.channel.updateValues(backendElement._id, pendingChanges!)
          pendingChanges = undefined
        })
      }

      pendingChanges = pendingChanges || []
      pendingChanges.push([[name], newValue, undefined, undefined])
    })
  }

  Object.setPrototypeOf(
    builder,
    Object.create(builderPrototype, {
      property: {
        value(name: string, def: typeUtils.PropertyListItem<typeUtils.PropertyType, any>) {
          properties.push(name)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          builderPrototype.property.call(this, name, def)
          addObserver(this, name)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return this
        },
      },
      staticData: {
        value(data: Record<string, unknown>) {
          const keys = Object.keys(data || {})
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          builderPrototype.staticData.call(this, data)
          keys.forEach((key) => {
            properties.push(key)
            addObserver(this, key)
          })
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return this
        },
      },
    }),
  )

  return builder.init(({ self, lifetime }) => {
    lifetime('created', () => {
      const { component, context, backendElement } = getContextFromMethodCaller(self)
      context.channel.initValues(
        backendElement._id,
        properties.reduce((initValues, property) => {
          initValues[property] = component.data[property]
          return initValues
        }, {} as Record<string, unknown>),
      )
    })
  }) as TBuilder
}

export const getNodeId = (node: Node) =>
  (node.getBackendElement() as unknown as ShadowSyncElement)._id

export { Channel, ChannelEventType, MessageChannelDataSide } from './message_channel'
export { ReplayHandler, replayShadowBackend } from './replay'
export { getLinearIdGenerator, getRandomIdGenerator } from './utils'
