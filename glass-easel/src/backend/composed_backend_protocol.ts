/**
 * Composed Mode Backend Protocol
 *
 * glass-easel supports custom backends. A backend must provide the interfaces defined here
 * so that glass-easel can correctly output the required information to the backend.
 *
 * In Composed Mode, glass-easel works on both the shadow tree and the composed tree.
 * This is the preferred protocol as it is relatively simpler to implement.
 *
 * ## Node Types
 *
 * Nodes are divided into the following types:
 * - Normal node
 * - Text node (carries text only, no children)
 * - Fragment node (used to temporarily hold a node tree fragment)
 *
 * ## Interface Conventions
 *
 * Interfaces marked as `async` use a callback pattern: `async method(...): T` is actually
 * `method(..., (T) => void)`.
 *
 * glass-easel guarantees that a node's ancestor list never contains itself (no cycles).
 */

import { type Element as GlassEaselElement } from '../element'
import { type MutLevel, type EventBubbleStatus, type EventOptions } from '../event'
import { type BackendMode } from './shared'
import type * as suggestedBackend from './suggested_backend_protocol'

/**
 * A backend-provided object. Each Context instance can display a node tree on the screen.
 *
 * In Composed Mode, `Context` provides the core rendering context for glass-easel.
 */
export interface Context extends Partial<suggestedBackend.Context<Context, Element>> {
  /** Protocol mode. Always `BackendMode.Composed` in this protocol. */
  mode: BackendMode.Composed

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
   * In Composed Mode, the root node must be a normal node.
   */
  getRootNode(): Element

  /**
   * Create a normal node.
   * Composed Mode only.
   *
   * @param logicalName - The node's own defined name.
   * @param stylingName - The alias set when used.
   */
  createElement(logicalName: string, stylingName: string): Element

  /**
   * Create a text node.
   * Composed Mode only.
   */
  createTextNode(content: string): Element

  /** Create a fragment node. Used to represent a node array for batch insertion and removal. */
  createFragment(): Element

  /**
   * Set the global event callback. This callback is the only one.
   * Composed Mode only; for Shadow Mode see the other `onEvent` signature.
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
}

/**
 * Element interface for Composed Mode.
 * Represents a node in the backend node tree.
 */
export interface Element extends Partial<suggestedBackend.Element<Element>> {
  /** Internal reference to the glass-easel element. */
  __wxElement?: GlassEaselElement

  /** Release this node. */
  release(): void

  /**
   * Notify that node-related information has been created and set an associated value.
   * Called exactly once on each created node (except text nodes, which are not called).
   */
  associateValue(v: GlassEaselElement): void

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
  insertBefore(child: Element, before: Element, index?: number): void

  /**
   * Replace a child node. Behavior varies by parameters:
   * - Without `oldChild` and `index`: equivalent to append.
   * - With `oldChild` or `index`: replace that child.
   * - With both `oldChild` and `index`: `index` must equal `oldChild`'s position in the child list.
   * If `index` is not a non-negative integer, it is treated as undefined.
   * The inserted child is guaranteed to have no parent.
   */
  replaceChild(child: Element, oldChild: Element, index?: number): void

  /**
   * Remove `deleteCount` nodes starting from `before`, then insert all nodes from `list` at that position.
   * `list` must be a fragment node; it should be cleared but may be reused.
   * All inserted nodes are guaranteed to have no parent.
   */
  spliceBefore(before: Element, deleteCount: number, list: Element): void

  /**
   * Append all nodes contained in `list`.
   * `list` must be a fragment node; it should be cleared but may be reused.
   * All inserted nodes are guaranteed to have no parent.
   */
  spliceAppend(list: Element): void

  /** Remove `deleteCount` nodes starting from `before`. */
  spliceRemove(before: Element, deleteCount: number): void

  /** Set the node ID. */
  setId(id: string): void

  /**
   * Set the scope identifiers of this node. Set at most once per node.
   * If styleScope is not a positive integer, it is treated as empty.
   * When matching style rules using selectors other than class (e.g. tag name or ID selectors),
   * the style sheet's scope identifier must be empty or equal to this node's scope identifier.
   * Composed Mode only.
   */
  setStyleScope(styleScope: number, extraStyleScope?: number, hostStyleScope?: number): void

  /** Set the style of this node. Not called on text nodes. */
  setStyle(styleText: string): void

  /**
   * Add a class to this node.
   * If styleScope is not a non-negative integer, it is treated as empty.
   * When matching style rules using this class, the style sheet's scope identifier
   * must be empty or equal to this `styleScope`.
   * Not called on text nodes.
   */
  addClass(elementClass: string, styleScope?: number): void

  /**
   * Remove the specified class (if both name and styleScope match).
   * If styleScope is not a non-negative integer, it is treated as empty.
   * Not called on text nodes.
   */
  removeClass(elementClass: string, styleScope?: number): void

  /** Set an attribute on this node. `value` can be any type. Not called on text nodes. */
  setAttribute(name: string, value: unknown): void

  /** Remove an attribute from this node. Not called on text nodes. */
  removeAttribute(name: string): void

  /** Set the text content. Only called on text nodes. */
  setText(content: string): void

  /**
   * Sync data binding settings on this node.
   * `attributeName` is the field name; `listener` is the data binding update callback.
   * Only called on normal nodes.
   */
  setModelBindingStat(attributeName: string, listener: ((newValue: unknown) => void) | null): void

  /**
   * Sync event listener settings on this node.
   * `type` is the event name; `capture` indicates whether this is a capture listener;
   * `mutLevel` indicates the event response type:
   * - `MutLevel.None`: normal response.
   * - `MutLevel.Mut`: mutual-exclusive response; only the first mutual-exclusive listener
   *   is executed in a single event bubble round.
   * - `MutLevel.Final`: final response; stops event bubbling and prevents default behavior.
   * Not called on text nodes.
   */
  setListenerStats(type: string, capture: boolean, mutLevel: MutLevel): void
}
