/**
 * DOM-like Mode Backend Protocol
 *
 * glass-easel supports custom backends. A backend must provide the interfaces defined here
 * so that glass-easel can correctly output the required information to the backend.
 *
 * The DOM-like Mode protocol is designed for adapting to DOM interfaces.
 * It should typically only be used when interfacing with the DOM.
 *
 * Unlike Shadow Mode and Composed Mode, the DOM-like Mode follows the standard DOM API
 * conventions. Node operations (appendChild, removeChild, etc.) and properties (tagName, id,
 * classList, etc.) mirror the DOM Element interface. Some glass-easel-specific operations
 * are provided as methods on the Context rather than on individual nodes.
 *
 * ## Node Types
 *
 * Nodes follow DOM conventions:
 * - Element nodes (with tagName)
 * - Text nodes
 * - Document fragment nodes
 *
 * ## Interface Conventions
 *
 * Interfaces marked as `async` use a callback pattern: `async method(...): T` is actually
 * `method(..., (T) => void)`.
 *
 * glass-easel guarantees that a node's ancestor list never contains itself (no cycles).
 */

import { type Element as GlassEaselElement } from '../element'
import { type EventBubbleStatus, type EventOptions, type MutLevel } from '../event'
import { type BackendMode } from './shared'
import type * as suggestedBackend from './suggested_backend_protocol'

/**
 * A backend-provided object. Each Context instance can display a node tree on the screen.
 *
 * In DOM-like Mode, `Context` provides the core rendering context for glass-easel,
 * using DOM-compatible interfaces. Some glass-easel-specific operations (such as
 * setListenerStats, setModelBindingStat) are provided on the Context rather than on nodes.
 */
export interface Context extends Partial<suggestedBackend.ContextForDomLike<Element, Element>> {
  /** Protocol mode. Always `BackendMode.Domlike` in this protocol. */
  mode: BackendMode.Domlike

  /**
   * Destroy this Context instance.
   * glass-easel does not call this directly; other modules should call it.
   */
  destroy(): void

  /** Get the display area width of this Context. */
  getWindowWidth(): number

  /** Get the display area height of this Context. */
  getWindowHeight(): number

  /** Get the device pixel ratio of this Context. */
  getDevicePixelRatio(): number

  /** Get the current theme of this Context, typically `"light"` or `"dark"`. */
  getTheme(): string

  /**
   * Register a style sheet.
   * `path` is the style sheet path, `content` is the corresponding CSS style sheet
   * in a format the backend can interpret.
   * If the CSS contains `@import` or similar references, the referenced content
   * may also be registered via another `registerStyleSheetContent` call,
   * either before or after this one.
   */
  registerStyleSheetContent(path: string, content: unknown): void

  /**
   * Insert a style sheet item whose content comes from the specified path.
   * `styleScope` is an optional scope identifier. Returns the new style sheet index.
   * If styleScope is not a positive integer, it is treated as empty (globally effective).
   */
  appendStyleSheetPath(path: string, styleScope?: number): number

  /** Disable an inserted style sheet. */
  disableStyleSheet(index: number): void

  /**
   * Wait for the next render to complete (align with the backend vsync).
   * The backend must ensure the callback is asynchronous.
   * Setting new properties inside the callback should trigger CSS transitions.
   */
  render(cb: (err: Error | null) => void): void

  /**
   * Get the root node.
   * In DOM-like Mode, the root node is a normal node.
   */
  getRootNode(): Element

  /** The document object providing DOM-compatible node creation methods. */
  document: {
    /** Create a normal element node with the given tag name. */
    createElement(tagName: string): Element
    /** Create a text node with the given content. */
    createTextNode(content: string): Element
    /** Create a document fragment node. */
    createDocumentFragment(): Element
  }

  /**
   * Notify that node-related information has been created and set an associated value.
   * Called exactly once on each created node (except text nodes, which are not called).
   * In DOM-like Mode, this is a Context-level method instead of an Element method.
   */
  associateValue(element: Element, value: GlassEaselElement): void

  /**
   * Set the global event callback. This callback is the only one.
   * Composed/DOM-like Mode signature.
   *
   * @param listener - Called when an event occurs.
   */
  onEvent(
    listener: (
      element: GlassEaselElement,
      type: string,
      detail: unknown,
      options: EventOptions,
      target?: Element,
    ) => EventBubbleStatus | void,
  ): void

  /**
   * Sync event listener settings on the given element.
   * In DOM-like Mode, this is a Context-level method instead of an Element method.
   *
   * `type` is the event name; `capture` indicates whether this is a capture listener;
   * `mutLevel` indicates the event response type:
   * - `MutLevel.None`: normal response.
   * - `MutLevel.Mut`: mutual-exclusive response; only the first mutual-exclusive listener
   *   is executed in a single event bubble round.
   * - `MutLevel.Final`: final response; stops event bubbling and prevents default behavior.
   * Not called on text nodes.
   */
  setListenerStats(element: Element, type: string, capture: boolean, mutLevel: MutLevel): void

  /**
   * Sync data binding settings on the given element.
   * In DOM-like Mode, this is a Context-level method instead of an Element method.
   *
   * `attributeName` is the field name; `listener` is the data binding update callback.
   * Only called on normal nodes.
   */
  setModelBindingStat(
    element: Element,
    attributeName: string,
    listener: ((newValue: unknown) => void) | null,
  ): void
}

/**
 * Element interface for DOM-like Mode.
 * Follows the standard DOM Element interface conventions.
 */
export interface Element extends Partial<suggestedBackend.ElementForDomLike> {
  /** Internal storage for model listeners. */
  _$wxArgs?: {
    modelListeners: { [name: string]: ((newValue: unknown) => void) | null }
  }

  /** Internal reference to the glass-easel element. */
  __wxElement?: GlassEaselElement

  /**
   * Append a child node.
   * The inserted child is guaranteed to have no parent.
   */
  appendChild(child: Element): void

  /**
   * Remove a child node. The removed child may be reused later.
   * If `index` is provided, it must equal the child's position in the child list.
   * If `index` is not a non-negative integer, it is treated as undefined.
   */
  removeChild(child: Element, index?: number): void

  /**
   * Insert a child node. Behavior varies by parameters:
   * - Without `before` and `index`: equivalent to append.
   * - With `before` or `index`: insert before that position.
   * - With both `before` and `index`: `index` must equal `before`'s position in the child list.
   * If `index` is not a non-negative integer, it is treated as undefined.
   * The inserted child is guaranteed to have no parent.
   */
  insertBefore(child: Element, before?: Element, index?: number): void

  /**
   * Replace a child node. Behavior varies by parameters:
   * - Without `oldChild` and `index`: equivalent to append.
   * - With `oldChild` or `index`: replace that child.
   * - With both `oldChild` and `index`: `index` must equal `oldChild`'s position in the child list.
   * If `index` is not a non-negative integer, it is treated as undefined.
   * The inserted child is guaranteed to have no parent.
   */
  replaceChild(child: Element, oldChild?: Element, index?: number): void

  /** The tag name of this element. */
  tagName: string

  /** The ID of this element. */
  id: string

  /** The class list of this element, providing `add` and `remove` methods. */
  classList: {
    /** Add a class to this element. */
    add(elementClass: string): void
    /** Remove a class from this element. */
    remove(elementClass: string): void
  }

  /** Set an attribute on this element. `value` can be any type. Not called on text nodes. */
  setAttribute(name: string, value: unknown): void

  /** Remove an attribute from this element. Not called on text nodes. */
  removeAttribute(name: string): void

  /** The text content of this node. Only meaningful for text nodes. */
  textContent: string

  /** The next sibling node, or undefined if none. */
  nextSibling: Element | undefined

  /** The child nodes of this element. */
  childNodes: Element[]

  /** The parent node, or null if none. */
  parentNode: Element | null

  /** Add an event listener (DOM-compatible overload for known HTMLElement event map). */
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void

  /** Add an event listener (generic overload). */
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void
}
