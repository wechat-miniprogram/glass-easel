import * as glassEasel from '../../src'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const protocolMethod = (instance: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalFn = descriptor.value as unknown as (...args: any[]) => any
  descriptor.value = function (this: Context | Element, ...args: any[]) {
    if (this._$currentMethod === null) this._$currentMethod = propertyKey
    const ret: unknown = originalFn.apply(this, args)
    this._$currentMethod = null
    return ret
  }
}

const enum ThrowOption {
  StyleScopeNotFound,
  StyleSheetNotFound,
  StyleSheetDoubleRegistration,
  StyleSheetNotRegistered,
}

export class Context implements glassEasel.composedBackend.Context {
  mode = glassEasel.BackendMode.Composed as glassEasel.BackendMode.Composed
  private _$throwOn: Record<ThrowOption, boolean> | boolean = false

  private _$windowWidth = 1
  private _$windowHeight = 1
  private _$devicePixelRatio = 1
  private _$theme = 'light'

  private _$styleSheetIdInc = 1
  public _$styleScopes = new Set<number>()
  private _$styleSheetContents = new Map<string, unknown>()

  public _$allElements: Node[] = []
  private _$renderCallbacks: ((err: Error | null) => void)[] | null = null
  private _$rootNode = new Root(this)
  private _$destroyed = false
  public _$currentMethod: string | null = null

  private _$eventEmitter:
    | null
    | ((
        target: glassEasel.Element,
        type: string,
        detail: unknown,
        options: glassEasel.EventOptions,
      ) => glassEasel.EventBubbleStatus) = null

  public shouldThrows(when?: ThrowOption) {
    if (when === undefined) return true
    if (this._$throwOn === true) return true
    if (typeof this._$throwOn !== 'boolean' && this._$throwOn[when]) return true
    return false
  }
  // eslint-disable-next-line class-methods-use-this
  private throws(message: string, when?: ThrowOption) {
    if (!this.shouldThrows(when)) return
    const method = this._$currentMethod || 'unknownMethod'
    this._$currentMethod = null
    throw new Error(`During ComposedBackend.Context#${method}: ${message}`)
  }

  @protocolMethod
  destroy(): void {
    if (this._$destroyed) this.throws('destroyed twice')
    this._$destroyed = true
    if (this._$allElements.length !== 0) {
      this.throws('destroyed with elements not yet destroyed')
    }
  }

  @protocolMethod
  getWindowWidth(): number {
    return this._$windowWidth
  }

  @protocolMethod
  getWindowHeight(): number {
    return this._$windowHeight
  }

  @protocolMethod
  getDevicePixelRatio(): number {
    return this._$devicePixelRatio
  }

  @protocolMethod
  getTheme(): string {
    return this._$theme
  }

  @protocolMethod
  registerStyleSheetContent(path: string, content: unknown): void {
    if (this._$styleSheetContents.has(path)) {
      this.throws(
        `Style sheet with path "${path}" registered twice`,
        ThrowOption.StyleSheetDoubleRegistration,
      )
    }
    this._$styleSheetContents.set(path, content)
  }

  @protocolMethod
  appendStyleSheetPath(path: string, styleScope?: number): number {
    const id = this._$styleSheetIdInc
    this._$styleSheetIdInc += 1
    this._$styleScopes.add(styleScope ?? 0)
    if (!this._$styleSheetContents.has(path)) {
      this.throws(
        `Style sheet added with path "${path}" not registered`,
        ThrowOption.StyleSheetNotRegistered,
      )
    }
    return id
  }

  @protocolMethod
  disableStyleSheet(index: number): void {
    if (index >= this._$styleSheetIdInc) {
      this.throws(`Style sheet with id "${index}" not exists`, ThrowOption.StyleSheetNotFound)
    }
  }

  @protocolMethod
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

  setRootNode(rootNode: Node): void {
    this._$rootNode = rootNode
  }

  @protocolMethod
  getRootNode(): Node {
    return this._$rootNode
  }

  @protocolMethod
  createElement(tagName: string, stylingName: string): Node {
    return new Element(this, tagName, stylingName)
  }

  @protocolMethod
  createTextNode(textContent: string): Node {
    return new TextNode(this, textContent)
  }

  @protocolMethod
  createFragment(): Node {
    return new Fragment(this)
  }

  @protocolMethod
  onEvent(
    _listener: (
      target: glassEasel.Element,
      type: string,
      detail: unknown,
      options: glassEasel.EventOptions,
    ) => glassEasel.EventBubbleStatus,
  ): void {
    this._$eventEmitter = _listener
  }

  @protocolMethod
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
  DOCUMENT_NODE = 9,
  DOCUMENT_FRAGMENT_NODE = 11,
}

/** An element for empty backend implementation */
abstract class Node implements glassEasel.composedBackend.Element {
  public _$currentMethod: string | null = null
  private _$released = false
  private _$ownerContext: Context

  ELEMENT_NODE = NODE_TYPE.ELEMENT_NODE
  TEXT_NODE = NODE_TYPE.TEXT_NODE
  DOCUMENT_NODE = NODE_TYPE.DOCUMENT_NODE
  DOCUMENT_FRAGMENT_NODE = NODE_TYPE.DOCUMENT_FRAGMENT_NODE

  public abstract nodeType: NODE_TYPE
  public __wxElement: glassEasel.Element | undefined
  public childNodes: Node[] = []
  public parentNode: null | Node = null
  public id = ''
  public textContent: string | null = null

  private _$style = ''
  private _$styleScope = 0
  private _$classes: Array<[string, number | undefined]> = []
  private _$attributes: Array<[string, unknown]> = []
  private _$styleScopeManager: glassEasel.StyleScopeManager | undefined

  constructor(ownerContext: Context) {
    this._$ownerContext = ownerContext
    ownerContext._$allElements.push(this)
  }

  // eslint-disable-next-line class-methods-use-this
  private throws(message: string, when?: ThrowOption) {
    if (!this._$ownerContext.shouldThrows(when)) return
    const method = this._$currentMethod || 'unknownMethod'
    this._$currentMethod = null
    throw new Error(`During ComposedBackend.Element#${method}: ${message}`)
  }

  private assertFragment(frag: Node) {
    if (!(frag instanceof Fragment)) this.throws(`expect a fragment but got ${stringifyType(frag)}`)
    if (frag.parentNode !== null) {
      this.throws('fragment should have no parent')
    }
  }
  private assertDetached(child: Node) {
    if (!(child instanceof Node)) this.throws(`expect an element but got ${stringifyType(child)}`)
    if (child.parentNode !== null) this.throws('newChild is not detached')
  }
  private assertChild(child: Node) {
    if (!(child instanceof Node)) this.throws(`expect an element but got ${stringifyType(child)}`)
    const index = this.childNodes.indexOf(child)
    if (index === -1) this.throws('element is not a child of `this`')
    if (child.parentNode !== this) this.throws('element is not a child of `this`')
    return index
  }
  private assertChildWithIndex(child: Node, index?: number) {
    const actualIndex = this.assertChild(child)
    const processedIndex = ensureNonNegativeInteger(index)
    if (processedIndex !== undefined && processedIndex !== actualIndex) {
      this.throws(`index mismatched, expected ${actualIndex} but got ${processedIndex}`)
    }
    return actualIndex
  }
  private assertIndex(index: number) {
    if (index >= this.childNodes.length) {
      this.throws(
        `provided index is invalid, got ${index} but only ${this.childNodes.length} children exist`,
      )
    }
  }
  private assertDeleteCount(deleteCount: number, index: number) {
    if (deleteCount + index > this.childNodes.length) {
      this.throws(
        `try to remove ${deleteCount} children starting from ${index}, but there are only ${this.childNodes.length} children.`,
      )
    }
  }

  get tagName(): string {
    if (this instanceof Element) {
      return (
        this._$logicalTagName === 'wx-x' ? this._$stylingTagName : this._$logicalTagName
      ).toUpperCase()
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
      if (this._$classes.length) props.class = this.getAttribute('class')!
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

  getAttribute(name: string): string | null {
    // eslint-disable-next-line no-param-reassign
    name = name.toLowerCase()
    if (name === 'id') return this.id
    if (name === 'style') return this._$style
    if (name === 'class')
      return this._$classes.length
        ? this._$classes
            .map(([name, styleScope]) => {
              let prefix = ''
              if (styleScope !== undefined) {
                prefix = this._$styleScopeManager!.queryName(styleScope) || ''
              }
              return `${prefix ? `${prefix}--` : ''}${name}`
            })
            .join(' ')
        : null
    const attr = this._$attributes.find((attr) => attr[0] === name)
    if (!attr) return null
    const value = attr[1]
    if (value === false) return null
    return value === true || value === undefined || value === null ? '' : String(value)
  }

  @protocolMethod
  release(): void {
    if (this._$released) this.throws('element released twice')
    this._$released = true
    const index = this._$ownerContext._$allElements.indexOf(this)
    if (index === -1) this.throws('element not found in its owner Context')
    this._$ownerContext._$allElements.splice(index, 1)
  }

  @protocolMethod
  associateValue(v: glassEasel.Element): void {
    this.__wxElement = v
    if (v.ownerShadowRoot) {
      const ownerSpace = v.ownerShadowRoot.getHostNode()._$behavior.ownerSpace
      this._$styleScopeManager = ownerSpace.styleScopeManager
    }
  }

  @protocolMethod
  appendChild(child: Node): void {
    this.assertDetached(child)
    this.childNodes.push(child)
    child.parentNode = this
  }

  @protocolMethod
  removeChild(child: Node, index?: number): void {
    const actualIndex = this.assertChildWithIndex(child, index)
    this.childNodes.splice(actualIndex, 1)
    child.parentNode = null
  }

  @protocolMethod
  insertBefore(child: Node, before: Node, index?: number): void {
    this.assertDetached(child)
    const processedIndex = ensureNonNegativeInteger(index)
    if (before === undefined && processedIndex === undefined) {
      this.appendChild(child)
    } else if (before === undefined && processedIndex !== undefined) {
      this.assertIndex(processedIndex)
      this.childNodes.splice(processedIndex, 0, child)
      child.parentNode = this
    } else if (before !== undefined && processedIndex === undefined) {
      const actualIndex = this.assertChild(before)
      this.childNodes.splice(actualIndex, 0, child)
      child.parentNode = this
    } else if (before !== undefined && processedIndex !== undefined) {
      const actualIndex = this.assertChildWithIndex(before, processedIndex)
      this.childNodes.splice(actualIndex, 0, child)
      child.parentNode = this
    }
  }

  @protocolMethod
  replaceChild(child: Node, oldChild: Node, index?: number): void {
    this.assertDetached(child)
    const processedIndex = ensureNonNegativeInteger(index)
    if (oldChild === undefined && processedIndex === undefined) {
      this.appendChild(child)
    } else if (oldChild === undefined && processedIndex !== undefined) {
      this.assertIndex(processedIndex)
      const oldChild = this.childNodes[processedIndex]
      this.childNodes.splice(processedIndex, 1, child)
      oldChild!.parentNode = null
      child.parentNode = this
    } else if (oldChild !== undefined && processedIndex === undefined) {
      const actualIndex = this.assertChild(oldChild)
      this.childNodes.splice(actualIndex, 1, child)
      oldChild.parentNode = null
      child.parentNode = this
    } else if (oldChild !== undefined && processedIndex !== undefined) {
      const actualIndex = this.assertChildWithIndex(oldChild, processedIndex)
      this.childNodes.splice(actualIndex, 1, child)
      oldChild.parentNode = null
      child.parentNode = this
    }
  }

  @protocolMethod
  spliceBefore(before: Node, deleteCount: number, list: Node): void {
    this.assertFragment(list)
    const index = this.assertChild(before)
    this.assertDeleteCount(deleteCount, index)
    const removed = this.childNodes.splice(index, deleteCount, ...list.childNodes)
    list.childNodes.forEach((newChild) => {
      newChild.parentNode = this
    })
    list.childNodes = []
    removed.forEach((child) => {
      child.parentNode = null
    })
  }

  @protocolMethod
  spliceAppend(list: Node): void {
    this.assertFragment(list)
    this.childNodes.splice(this.childNodes.length, 0, ...list.childNodes)
    list.childNodes.forEach((newChild) => {
      newChild.parentNode = this
    })
    list.childNodes = []
  }

  @protocolMethod
  spliceRemove(before: Node, deleteCount: number): void {
    const index = this.assertChild(before)
    this.assertDeleteCount(deleteCount, index)
    const removed = this.childNodes.splice(index, deleteCount)
    removed.forEach((child) => {
      child.parentNode = null
    })
  }

  @protocolMethod
  setId(id: string): void {
    this.id = id
  }

  @protocolMethod
  setStyleScope(styleScope: number): void {
    if (!this._$ownerContext._$styleScopes.has(styleScope)) {
      this.throws(
        `set style scope to ${styleScope}, but its owner context do not have a style sheet with that scope`,
        ThrowOption.StyleScopeNotFound,
      )
    }
    this._$styleScope = styleScope
  }

  @protocolMethod
  setStyle(styleText: string): void {
    this._$style = styleText
  }

  @protocolMethod
  addClass(elementClass: string, styleScope?: number): void {
    const scope = ensureNonNegativeInteger(styleScope)
    const index = this._$classes.findIndex((c) => c[0] === elementClass && c[1] === scope)
    if (index === -1) this._$classes.push([elementClass, scope])
  }

  @protocolMethod
  removeClass(elementClass: string, styleScope?: number): void {
    const scope = ensureNonNegativeInteger(styleScope)
    const index = this._$classes.findIndex((c) => c[0] === elementClass && c[1] === scope)
    if (index !== -1) this._$classes.splice(index, 1)
  }

  @protocolMethod
  clearClasses(): void {
    this._$classes = []
  }

  @protocolMethod
  setAttribute(name: string, value: unknown): void {
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

  @protocolMethod
  removeAttribute(name: string): void {
    // eslint-disable-next-line no-param-reassign
    name = name.toLowerCase()
    const index = this._$attributes.findIndex((attr) => attr[0] === name)
    if (index >= 0) {
      this._$attributes.splice(index, 1)
    }
  }

  @protocolMethod
  setText(content: string): void {
    this.textContent = content
  }

  @protocolMethod
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

  @protocolMethod
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

  @protocolMethod
  // eslint-disable-next-line class-methods-use-this
  setListenerStats(_type: string, _capture: boolean, _mutLevel: glassEasel.EventMutLevel): void {
    // empty
  }

  @protocolMethod
  // eslint-disable-next-line class-methods-use-this
  setModelBindingStat(
    _attributeName: string,
    _listener: ((newValue: unknown) => void) | null,
  ): void {
    // empty
  }

  @protocolMethod
  // eslint-disable-next-line class-methods-use-this
  createIntersectionObserver(
    _relativeElement: glassEasel.composedBackend.Element | null,
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

  @protocolMethod
  // eslint-disable-next-line class-methods-use-this
  getContext(cb: (res: unknown) => void): void {
    cb(null)
  }
}

class Root extends Node {
  public nodeType = NODE_TYPE.DOCUMENT_NODE
}

export class Element extends Node {
  public nodeType = NODE_TYPE.ELEMENT_NODE
  public _$logicalTagName: string
  public _$stylingTagName: string

  constructor(ownerContext: Context, logicalTagName: string, stylingTagName: string) {
    super(ownerContext)
    this._$logicalTagName = logicalTagName
    this._$stylingTagName = stylingTagName
  }
}

export class TextNode extends Node {
  public nodeType = NODE_TYPE.TEXT_NODE
  constructor(ownerContext: Context, textContent: string) {
    super(ownerContext)
    this.textContent = textContent
  }
}

export class Fragment extends Node {
  public nodeType = NODE_TYPE.DOCUMENT_FRAGMENT_NODE
}
