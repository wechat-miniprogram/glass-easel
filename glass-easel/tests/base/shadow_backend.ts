import * as glassEasel from '../../src'

export class Context implements glassEasel.backend.Context {
  mode = glassEasel.BackendMode.Shadow as const

  private _$windowWidth = 1
  private _$windowHeight = 1
  private _$devicePixelRatio = 1
  private _$theme = 'light'

  private _$styleSheetIdInc = 1
  public _$styleScopes = new Set<number>()
  private _$styleSheetContents = new Map<string, unknown>()

  public _$allElements: Node[] = []
  private _$renderCallbacks: ((err: Error | null) => void)[] | null = null
  private _$rootNode = new ShadowRoot(this, true)
  private _$destroyed = false
  public _$currentMethod: string | null = null

  private _$createEvent:
    | null
    | ((
        type: string,
        detail: unknown,
        options: glassEasel.EventOptions,
      ) => glassEasel.Event<unknown>) = null
  private _$eventEmitter:
    | null
    | ((
        event: glassEasel.Event<unknown>,
        currentTarget: glassEasel.Element,
        mark: Record<string, unknown> | null,
        target: glassEasel.Element,
        isCapture: boolean,
      ) => glassEasel.EventBubbleStatus) = null

  destroy(): void {
    if (this._$destroyed) throw new Error('destroyed twice')
    this._$destroyed = true
    if (this._$allElements.length !== 0) {
      throw new Error('destroyed with elements not yet destroyed')
    }
  }

  getWindowWidth(): number {
    return this._$windowWidth
  }

  getWindowHeight(): number {
    return this._$windowHeight
  }

  getDevicePixelRatio(): number {
    return this._$devicePixelRatio
  }

  getTheme(): string {
    return this._$theme
  }

  registerStyleSheetContent(path: string, content: unknown): void {
    if (this._$styleSheetContents.has(path)) {
      throw new Error(`Style sheet with path "${path}" registered twice`)
    }
    this._$styleSheetContents.set(path, content)
  }

  appendStyleSheetPath(path: string, styleScope?: number): number {
    const id = this._$styleSheetIdInc
    this._$styleSheetIdInc += 1
    this._$styleScopes.add(styleScope ?? 0)
    if (!this._$styleSheetContents.has(path)) {
      throw new Error(`Style sheet added with path "${path}" not registered`)
    }
    return id
  }

  disableStyleSheet(index: number): void {
    if (index >= this._$styleSheetIdInc) {
      throw new Error(`Style sheet with id "${index}" not exists`)
    }
  }

  render(cb: (err: Error | null) => void): void {
    if (this._$renderCallbacks) {
      this._$renderCallbacks.push(cb)
    } else {
      this._$renderCallbacks = [cb]
      setTimeout(() => {
        const callbacks = this._$renderCallbacks!
        this._$renderCallbacks = null
        callbacks.forEach((cb) => {
          cb(null)
        })
      }, 16)
    }
  }

  setRootNode(rootNode: ShadowRoot): void {
    this._$rootNode = rootNode
  }

  getRootNode(): ShadowRoot {
    return this._$rootNode
  }

  createFragment(): Fragment {
    return new Fragment(this, undefined)
  }

  onEvent(
    _createEvent: (
      type: string,
      detail: unknown,
      options: glassEasel.EventOptions,
    ) => glassEasel.Event<unknown>,
    _listener: (
      event: glassEasel.Event<unknown>,
      currentTarget: glassEasel.Element,
      mark: Record<string, unknown> | null,
      target: glassEasel.Element,
      isCapture: boolean,
    ) => glassEasel.EventBubbleStatus,
  ): void {
    this._$createEvent = _createEvent
    this._$eventEmitter = _listener
  }

  // eslint-disable-next-line class-methods-use-this
  createMediaQueryObserver(
    _status: glassEasel.backend.MediaQueryStatus,
    _listener: (res: { matches: boolean }) => void,
  ): glassEasel.backend.Observer {
    return {
      disconnect: () => {
        /* empty */
      },
    }
  }
}

const ensureNonNegativeInteger = (index: number | undefined) => {
  if (Number.isInteger(index) && index! >= 0) return index
  return undefined
}
const stringifyType = (v: unknown) => {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  return v.constructor.name
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
 */
const enum NODE_TYPE {
  ELEMENT_NODE = 1,
  TEXT_NODE = 3,
  DOCUMENT_NODE = 9, // for shadow root
  DOCUMENT_FRAGMENT_NODE = 11, // for virtual node and fragment
}

type NODE_CONSTRUCTOR_TYPES =
  | typeof Element
  | typeof ShadowRoot
  | typeof NativeNode
  | typeof Component
  | typeof VirtualNode
  | typeof TextNode
  | typeof Fragment
  | undefined
  | null

type NodeType<T extends NODE_CONSTRUCTOR_TYPES> = T extends typeof ShadowRoot
  ? ShadowRoot
  : T extends typeof Component
  ? Component
  : T extends typeof NativeNode
  ? NativeNode
  : T extends typeof Fragment
  ? Fragment
  : T extends typeof VirtualNode
  ? VirtualNode
  : T extends typeof TextNode
  ? TextNode
  : T extends typeof Element
  ? Element
  : T extends undefined
  ? undefined
  : T extends null
  ? null
  : never

function assertType<T extends NODE_CONSTRUCTOR_TYPES>(
  node: Node | undefined | null,
  type: T,
): asserts node is NodeType<T> {
  assertTypes(node, [type])
}
function assertTypes<T extends NODE_CONSTRUCTOR_TYPES>(
  node: Node | undefined | null,
  types: T[],
): asserts node is NodeType<T> {
  if (!types.some((type) => type === node || (node && type && node instanceof type))) {
    throw new Error(
      `expect a ${types
        .map((type) => {
          if (type === undefined) return 'undefined'
          if (type === null) return 'null'
          return type.name
        })
        .join(' or ')} but got ${stringifyType(node)}`,
    )
  }
}

/** An element for empty backend implementation */
abstract class Node implements glassEasel.backend.Element {
  public _$currentMethod: string | null = null
  public _$released = false
  public _$ownerContext: Context
  public _$ownerShadowRoot: ShadowRoot | undefined

  ELEMENT_NODE = NODE_TYPE.ELEMENT_NODE as const
  TEXT_NODE = NODE_TYPE.TEXT_NODE as const
  DOCUMENT_NODE = NODE_TYPE.DOCUMENT_NODE as const
  DOCUMENT_FRAGMENT_NODE = NODE_TYPE.DOCUMENT_FRAGMENT_NODE as const

  public abstract nodeType: NODE_TYPE
  public __wxElement: glassEasel.Element | undefined
  public _$wxElement: glassEasel.Element | undefined
  public containingSlot: NativeNode | VirtualNode | null | undefined
  public slotNodes: Node[] = []
  public id = ''
  public textContent: string = ''
  public hostNode: Component | undefined

  public _$childNodes: Node[] = []
  public _$parentNode: null | Node = null
  public _$virtual = false
  public _$slotName: string | null = null
  public _$inheritSlots: boolean = false
  public _$style = ''
  public _$styleScope = 0
  public _$extraStyleScope: number | null = null
  public _$externalClasses: Array<string> = []
  public _$rawClasses: Array<string> = []
  public _$classes: Array<string> | null = null
  public _$classAlias = Object.create(null) as Record<string, string[]>
  public _$attributes: Array<[string, unknown]> = []
  public _$dataset = Object.create(null) as Record<string, unknown>
  public _$styleScopeManager: glassEasel.StyleScopeManager | undefined

  constructor(ownerContext: Context, shadowRoot: ShadowRoot | undefined) {
    this._$ownerContext = ownerContext
    this._$ownerShadowRoot = shadowRoot
    ownerContext._$allElements.push(this)
  }

  // eslint-disable-next-line class-methods-use-this
  public assertFragment(frag: Node): asserts frag is Fragment {
    assertType(frag, Fragment)
    if (frag._$parentNode !== null) {
      throw new Error('fragment should have no parent')
    }
  }
  // eslint-disable-next-line class-methods-use-this
  public assertDetached(child: Node) {
    if (!(child instanceof Node))
      throw new Error(`expect an element but got ${stringifyType(child)}`)
    if (child._$parentNode !== null) throw new Error('newChild is not detached')
  }
  public assertChild(child: Node) {
    if (!(child instanceof Node))
      throw new Error(`expect an element but got ${stringifyType(child)}`)
    const index = this._$childNodes.indexOf(child)
    if (index === -1) throw new Error('element is not a child of `this`')
    if (child._$parentNode !== this) throw new Error('element is not a child of `this`')
    return index
  }
  public assertChildWithIndex(child: Node, index?: number) {
    const actualIndex = this.assertChild(child)
    const processedIndex = ensureNonNegativeInteger(index)
    if (processedIndex !== undefined && processedIndex !== actualIndex) {
      throw new Error(`index mismatched, expected ${actualIndex} but got ${processedIndex}`)
    }
    return actualIndex
  }
  // eslint-disable-next-line class-methods-use-this
  public assertIndex(index: number, arr: unknown[]) {
    if (index >= arr.length) {
      throw new Error(
        `provided index is invalid, got ${index} but only ${arr.length} children exist`,
      )
    }
  }
  // eslint-disable-next-line class-methods-use-this
  public assertDeleteCount(deleteCount: number, index: number, arr: unknown[]) {
    if (deleteCount + index > arr.length) {
      throw new Error(
        `try to remove ${deleteCount} children starting from ${index}, but there are only ${arr.length} children.`,
      )
    }
  }
  public assertStyleScope(styleScope: number | null) {
    if (styleScope !== null && !this._$ownerContext._$styleScopes.has(styleScope)) {
      // throw new Error(
      //   `set style scope to ${styleScope}, but its owner context do not have a style sheet with that scope`,
      // )
    }
  }

  forEachNonVirtualComposedChild(f: (node: Node) => boolean | void): boolean {
    if (this._$inheritSlots) return true
    const recNonVirtual = (child: Node): boolean => {
      if (child._$virtual) {
        return child.forEachNonVirtualComposedChild(f)
      }
      return f(child) !== false
    }
    if (this instanceof Component) {
      return recNonVirtual(this.shadowRoot as ShadowRoot)
    }
    if (this._$slotName !== null) {
      const childNodes = this._$ownerShadowRoot?.hostNode?.external
        ? this._$ownerShadowRoot.hostNode._$childNodes
        : this.slotNodes
      for (let i = 0; i < childNodes.length; i += 1) {
        const node = childNodes[i]!
        if (!node._$inheritSlots && recNonVirtual(node) === false) return false
      }
      return true
    }
    const recInheritSlots = (children: Node[]) => {
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i]!
        if (!recNonVirtual(child)) return false
        if (child._$inheritSlots) {
          if (!recInheritSlots(child._$childNodes)) return false
        }
      }
      return true
    }
    return recInheritSlots(this._$childNodes)
  }

  get childNodes(): Node[] {
    const childNodes: Node[] = []
    this.forEachNonVirtualComposedChild((node) => {
      childNodes.push(node)
    })
    return childNodes
  }

  getComposedParent(): Node | null {
    if (this instanceof ShadowRoot) return this.hostNode!
    if (this.containingSlot !== undefined) return this.containingSlot
    let parent = this._$parentNode
    while (parent?._$inheritSlots) {
      parent = parent._$parentNode
    }
    return parent
  }

  get parentNode(): Node | null {
    let parentNode = this.getComposedParent()
    while (parentNode?._$virtual) {
      parentNode = parentNode.getComposedParent()
    }
    return parentNode
  }

  get tagName(): string {
    if (this instanceof Element) {
      return (
        this.logicalTagName === 'wx-x' ? this.stylingTagName || '' : this.logicalTagName
      )?.toUpperCase()
    }
    return ''
  }

  get innerHTML(): string {
    if (this instanceof Element) {
      return this.childNodes.map((child) => child.outerHTML).join('')
    }
    return this.textContent || ''
  }

  get outerHTML(): string {
    const ret: string[] = []
    if (this instanceof Element) {
      const props: Record<string, string> = {}
      this._$attributes.forEach(([key]) => {
        const value = this.getAttribute(key)
        if (value !== null) {
          props[key.toLowerCase()] = value
        }
      })
      const tagName = this.tagName.toLowerCase()
      ret.push(`<${tagName}`)
      if (this.id) props.id = this.getAttribute('id')!
      if (this._$style) props.style = this.getAttribute('style')!
      if (this._$classes) props.class = this.getAttribute('class')!
      const propsStr = Object.entries(props)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ')
      if (propsStr.length > 0) ret.push(` ${propsStr}`)
      ret.push(`>${this.innerHTML}</${tagName}>`)
    } else {
      ret.push(this.innerHTML)
    }
    return ret.join('')
  }

  private _$resolveClassName(
    className: string,
    cb: (styleScope: number | undefined, name: string) => void,
  ): void {
    const ownerHost = this._$ownerShadowRoot?.hostNode
    const getRootScope = () => {
      let owner = ownerHost
      let cur = owner
      while (owner?._$ownerShadowRoot) {
        cur = owner
        owner = owner._$ownerShadowRoot.hostNode
      }
      return cur ? cur._$styleScope : undefined
    }
    const ownerClassAlias = ownerHost?._$classAlias
    if (ownerClassAlias && className in ownerClassAlias) {
      const slices = ownerClassAlias[className]
      if (!slices) return
      slices.forEach((target) => ownerHost._$resolveClassName(target, cb))
    } else if (className[0] === '~') {
      cb(getRootScope(), className.slice(1))
    } else if (className[0] === '^') {
      let n = className.slice(1)
      let owner = ownerHost?._$ownerShadowRoot?.hostNode
      while (n[0] === '^') {
        n = n.slice(1)
        owner = owner?._$ownerShadowRoot?.hostNode
      }
      const scopeId = owner?._$ownerShadowRoot ? owner._$styleScope : getRootScope()
      cb(scopeId, n)
    } else {
      if (ownerHost && ownerHost._$extraStyleScope !== null) {
        cb(ownerHost._$extraStyleScope, className)
      }
      cb(ownerHost?._$styleScope ?? glassEasel.StyleScopeManager.globalScope(), className)
    }
  }

  private _$updateResolvedClassNames(): void {
    const rawClasses = this._$rawClasses
    const oldClasses = this._$classes || []
    const newClasses: string[] = []
    let backendNames: string[] | null = this._$classes ? Array.from(this._$classes) : null

    for (let i = 0, l = rawClasses.length; i < l; i += 1) {
      const rawName = rawClasses[i]!
      // eslint-disable-next-line no-loop-func
      this._$resolveClassName(rawName, (styleScope, name) => {
        let prefix = ''
        if (styleScope !== undefined) {
          prefix = this._$styleScopeManager!.queryName(styleScope) || ''
        }
        const className = `${prefix ? `${prefix}--` : ''}${name}`
        if (!newClasses.includes(className)) newClasses.push(className)
      })
    }

    const exists: boolean[] = []
    for (let i = 0; i < newClasses.length; i += 1) {
      const index = oldClasses.indexOf(newClasses[i]!)
      if (index > -1) {
        exists[index] = true
      } else {
        if (!backendNames) backendNames = []
        backendNames.push(newClasses[i]!)
      }
    }
    for (let j = 0; j < oldClasses.length; j += 1) {
      if (!exists[j]) {
        backendNames!.splice(backendNames!.indexOf(oldClasses[j]!), 1)
      }
    }
    this._$classes = backendNames
  }

  getAttribute(name: string): string | null {
    // eslint-disable-next-line no-param-reassign
    name = name.toLowerCase()
    if (name === 'id') return this.id
    if (name === 'style') return this._$style
    if (name === 'class') {
      if (!this._$classes) return null
      return this._$classes.join(' ')
    }
    const attr = this._$attributes.find((attr) => attr[0] === name)
    if (!attr) return null
    const value = attr[1]
    if (value === false) return null
    return value === true || value === undefined || value === null ? '' : String(value)
  }

  release(): void {
    if (this._$released) throw new Error('element released twice')
    this._$released = true
    const index = this._$ownerContext._$allElements.indexOf(this)
    if (index === -1) throw new Error('element not found in its owner Context')
    this._$ownerContext._$allElements.splice(index, 1)
  }

  associateValue(v: glassEasel.Element): void {
    if (this._$wxElement) throw new Error(`associate value multiple times`)
    if (v !== this.__wxElement) throw new Error(`wrong associate value`)
    this._$wxElement = v
    if (v.ownerShadowRoot) {
      const ownerSpace = v.ownerShadowRoot.getHostNode()._$behavior.ownerSpace
      this._$styleScopeManager = ownerSpace.styleScopeManager
    }
  }

  getShadowRoot(): ShadowRoot | undefined {
    assertType(this, Component)
    return this.shadowRoot
  }

  appendChild(child: Node): void {
    assertTypes(this, [Element, Fragment])
    ;(this as Element)._$childNodes.push(child)
    if (!(this instanceof Fragment)) {
      this.assertDetached(child)
      child._$parentNode = this
    }
  }

  removeChild(child: Node, index?: number): void {
    assertType(this, Element)
    const actualIndex = this.assertChildWithIndex(child, index)
    this._$childNodes.splice(actualIndex, 1)
    child._$parentNode = null
  }

  insertBefore(child: Node, before: Node, index?: number): void {
    assertType(this, Element)
    this.assertDetached(child)
    const processedIndex = ensureNonNegativeInteger(index)
    if (before === undefined && processedIndex === undefined) {
      this.appendChild(child)
    } else if (before === undefined && processedIndex !== undefined) {
      this.assertIndex(processedIndex, this._$childNodes)
      this._$childNodes.splice(processedIndex, 0, child)
      child._$parentNode = this
    } else if (before !== undefined && processedIndex === undefined) {
      const actualIndex = this.assertChild(before)
      this._$childNodes.splice(actualIndex, 0, child)
      child._$parentNode = this
    } else if (before !== undefined && processedIndex !== undefined) {
      const actualIndex = this.assertChildWithIndex(before, processedIndex)
      this._$childNodes.splice(actualIndex, 0, child)
      child._$parentNode = this
    }
  }

  replaceChild(child: Node, oldChild: Node, index?: number): void {
    assertType(this, Element)
    this.assertDetached(child)
    const processedIndex = ensureNonNegativeInteger(index)
    if (oldChild === undefined && processedIndex === undefined) {
      this.appendChild(child)
    } else if (oldChild === undefined && processedIndex !== undefined) {
      this.assertIndex(processedIndex, this._$childNodes)
      const oldChild = this._$childNodes[processedIndex]
      this._$childNodes.splice(processedIndex, 1, child)
      oldChild!._$parentNode = null
      child._$parentNode = this
    } else if (oldChild !== undefined && processedIndex === undefined) {
      const actualIndex = this.assertChild(oldChild)
      this._$childNodes.splice(actualIndex, 1, child)
      oldChild._$parentNode = null
      child._$parentNode = this
    } else if (oldChild !== undefined && processedIndex !== undefined) {
      const actualIndex = this.assertChildWithIndex(oldChild, processedIndex)
      this._$childNodes.splice(actualIndex, 1, child)
      oldChild._$parentNode = null
      child._$parentNode = this
    }
  }

  spliceBefore(before: Node, deleteCount: number, list: Node): void {
    assertType(this, Element)
    this.assertFragment(list)
    const index = this.assertChild(before)
    this.assertDeleteCount(deleteCount, index, this._$childNodes)
    const removed = this._$childNodes.splice(index, deleteCount, ...list._$childNodes)
    list._$childNodes.forEach((newChild) => {
      this.assertDetached(newChild)
      newChild._$parentNode = this
    })
    list._$childNodes = []
    removed.forEach((child) => {
      child._$parentNode = null
    })
  }

  spliceAppend(list: Node): void {
    assertType(this, Element)
    this.assertFragment(list)
    this._$childNodes.splice(this._$childNodes.length, 0, ...list._$childNodes)
    list._$childNodes.forEach((newChild) => {
      this.assertDetached(newChild)
      newChild._$parentNode = this
    })
    list._$childNodes = []
  }

  spliceRemove(before: Node, deleteCount: number): void {
    assertType(this, Element)
    const index = this.assertChild(before)
    this.assertDeleteCount(deleteCount, index, this._$childNodes)
    const removed = this._$childNodes.splice(index, deleteCount)
    removed.forEach((child) => {
      child._$parentNode = null
    })
  }

  setId(id: string): void {
    assertType(this, Element)
    this.id = id
  }

  setSlotName(slot: string): void {
    assertType(this, Element)
    this._$slotName = slot
  }

  setContainingSlot(slot: NativeNode | VirtualNode | undefined | null): void {
    assertTypes(slot, [NativeNode, VirtualNode, undefined, null])
    this.containingSlot = slot
  }

  reassignContainingSlot(
    oldSlot: NativeNode | VirtualNode | null,
    newSlot: NativeNode | VirtualNode | null,
  ): void {
    assertTypes(oldSlot, [NativeNode, VirtualNode, null])
    assertTypes(newSlot, [NativeNode, VirtualNode, null])
    this.containingSlot = newSlot
  }

  spliceBeforeSlotNodes(before: number, deleteCount: number, list: Fragment): void {
    this.assertFragment(list)
    this.assertIndex(before, this.slotNodes)
    this.assertDeleteCount(deleteCount, before, this.slotNodes)
    this.slotNodes.splice(before, deleteCount, ...list._$childNodes)
    list._$childNodes = []
  }

  spliceAppendSlotNodes(list: Fragment): void {
    this.assertFragment(list)
    this.slotNodes.push(...list._$childNodes)
    list._$childNodes = []
  }

  spliceRemoveSlotNodes(before: number, deleteCount: number): void {
    this.assertIndex(before, this.slotNodes)
    this.assertDeleteCount(deleteCount, before, this.slotNodes)
    this.slotNodes.splice(before, deleteCount)
  }

  setInheritSlots(): void {
    assertType(this, VirtualNode)
    this._$inheritSlots = true
  }

  setStyle(styleText: string): void {
    assertType(this, Element)
    this._$style = styleText
  }

  addClass(elementClass: string): void {
    assertType(this, Element)
    const rawClasses = this._$rawClasses
    rawClasses.push(elementClass)
    this._$updateResolvedClassNames()
  }

  removeClass(elementClass: string): void {
    assertType(this, Element)
    const rawClasses = this._$rawClasses
    const index = rawClasses.indexOf(elementClass)
    if (index !== -1) {
      rawClasses.splice(index, 1)
      this._$updateResolvedClassNames()
    }
  }

  clearClasses(): void {
    assertType(this, Element)
    this._$rawClasses = []
    this._$updateResolvedClassNames()
  }

  setClassAlias(this: Component, className: string, targets: string[]): void {
    assertType(this, Component)
    this._$classAlias[className] = targets

    const recv = (node: Node) => {
      if (!(node instanceof Element)) return
      node._$updateResolvedClassNames()
      if (node instanceof Component) {
        recv(node.shadowRoot!)
      }
      const childNodes = node.childNodes
      for (let i = 0, l = childNodes.length; i < l; i += 1) {
        recv(childNodes[i]!)
      }
    }
    recv(this.shadowRoot!)
  }

  setAttribute(this: Element, name: string, value: unknown): void {
    assertType(this, Element)
    // eslint-disable-next-line no-param-reassign
    name = name.toLowerCase()
    const index = this._$attributes.findIndex((attr) => attr[0] === name)
    if (value === false) {
      if (index >= 0) {
        this._$attributes.splice(index, 1)
      }
    } else {
      if (index >= 0) {
        this._$attributes[index]![1] = value
      } else {
        this._$attributes.push([name, value])
      }
    }
  }

  removeAttribute(this: Element, name: string): void {
    assertType(this, Element)
    // eslint-disable-next-line no-param-reassign
    name = name.toLowerCase()
    const index = this._$attributes.findIndex((attr) => attr[0] === name)
    if (index >= 0) {
      this._$attributes.splice(index, 1)
    }
  }

  setDataset(this: Element, name: string, value: unknown): void {
    assertType(this, Element)
    this._$dataset[name] = value
  }

  setText(this: TextNode, content: string): void {
    assertType(this, TextNode)
    this.textContent = content
  }

  // eslint-disable-next-line class-methods-use-this
  getBoundingClientRect(cb: (res: glassEasel.backend.BoundingClientRect) => void): void {
    setTimeout(() => {
      cb({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      })
    }, 0)
  }

  // eslint-disable-next-line class-methods-use-this
  getScrollOffset(cb: (res: glassEasel.backend.ScrollOffset) => void): void {
    setTimeout(() => {
      cb({
        scrollLeft: 0,
        scrollTop: 0,
        scrollWidth: 0,
        scrollHeight: 0,
      })
    }, 0)
  }

  // eslint-disable-next-line class-methods-use-this
  setListenerStats(_type: string, _capture: boolean, _mutLevel: glassEasel.EventMutLevel): void {
    // empty
  }

  // eslint-disable-next-line class-methods-use-this
  setModelBindingStat(
    _attributeName: string,
    _listener: ((newValue: unknown) => void) | null,
  ): void {
    // empty
  }

  // eslint-disable-next-line class-methods-use-this
  createIntersectionObserver(
    _relativeElement: Node | null,
    _relativeElementMargin: string,
    _thresholds: number[],
    _listener: (res: glassEasel.backend.IntersectionStatus) => void,
  ): glassEasel.backend.Observer {
    return {
      disconnect: () => {
        /* empty */
      },
    }
  }

  // eslint-disable-next-line class-methods-use-this
  getContext(cb: (res: unknown) => void): void {
    cb(null)
  }
}

abstract class Element extends Node {
  public logicalTagName: string
  public stylingTagName: string | undefined

  constructor(
    ownerContext: Context,
    shadowRoot: ShadowRoot,
    tagName: string,
    stylingTagName: string | undefined,
  ) {
    super(ownerContext, shadowRoot)
    this.logicalTagName = tagName
    this.stylingTagName = stylingTagName
  }
}

export class VirtualNode extends Element {
  public override nodeType = NODE_TYPE.DOCUMENT_FRAGMENT_NODE
  public override _$virtual = true as const

  constructor(ownerContext: Context, shadowRoot: ShadowRoot, virtualName: string) {
    super(ownerContext, shadowRoot, virtualName, undefined)
  }
}

export class ShadowRoot extends VirtualNode implements glassEasel.backend.ShadowRootContext {
  public override nodeType = NODE_TYPE.DOCUMENT_NODE

  constructor(ownerContext: Context, private _$isRoot = false) {
    super(ownerContext, undefined as unknown as this, 'shadow')
    this._$ownerShadowRoot = this
  }

  createElement(logicalName: string, stylingName: string): NativeNode {
    if (this._$isRoot) throw new Error('Cannot call createElement on root shadowRoot')
    return new NativeNode(this._$ownerContext, this, logicalName, stylingName)
  }

  createTextNode(content: string): TextNode {
    if (this._$isRoot) throw new Error('Cannot call createTextNode on root shadowRoot')
    return new TextNode(this._$ownerContext, this, content)
  }

  createComponent(
    tagName: string,
    external: boolean,
    virtualHost: boolean,
    styleScope: number,
    extraStyleScope: number | null,
    externalClasses: string[] | undefined,
  ): Component {
    const comp = new Component(this._$ownerContext, this, tagName, external)
    const shadowRoot = new ShadowRoot(this._$ownerContext)
    comp.shadowRoot = shadowRoot
    shadowRoot.hostNode = comp
    comp._$virtual = virtualHost
    if (externalClasses) {
      comp._$externalClasses = externalClasses
      externalClasses.forEach((className) => {
        comp._$classAlias[className] = []
      })
    }
    comp.assertStyleScope(styleScope)
    comp.assertStyleScope(extraStyleScope)
    comp._$styleScope = styleScope
    comp._$extraStyleScope = extraStyleScope
    return comp
  }

  createVirtualNode(virtualName: string): VirtualNode {
    if (this._$isRoot) throw new Error('Cannot call createVirtualNode on root shadowRoot')
    return new VirtualNode(this._$ownerContext, this, virtualName)
  }
}

export class Component extends Element {
  public override nodeType = NODE_TYPE.ELEMENT_NODE
  public shadowRoot: ShadowRoot | undefined
  public external = false

  constructor(ownerContext: Context, shadowRoot: ShadowRoot, tagName: string, _external: boolean) {
    super(ownerContext, shadowRoot, tagName, undefined)
    this.external = _external
  }
}

export class NativeNode extends Element {
  public override nodeType = NODE_TYPE.ELEMENT_NODE
}

export class TextNode extends Node {
  public override nodeType = NODE_TYPE.TEXT_NODE

  constructor(ownerContext: Context, shadowRoot: ShadowRoot, textContent: string) {
    super(ownerContext, shadowRoot)
    this.textContent = textContent
  }
}

export class Fragment extends Node {
  public override nodeType = NODE_TYPE.DOCUMENT_FRAGMENT_NODE
}
