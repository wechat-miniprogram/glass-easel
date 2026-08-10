/**
 * Shadow Mode Backend Protocol
 *
 * glass-easel supports custom backends. A backend must provide the interfaces defined here
 * so that glass-easel can correctly output the required information to the backend.
 *
 * ## Backend Protocol Modes
 *
 * The backend protocol has two modes:
 * - **Shadow Mode**: glass-easel works only on the shadow tree; the backend handles
 *   shadow-to-composed tree composition.
 * - **Composed Mode**: glass-easel works on both the shadow tree and the composed tree.
 *
 * Each mode requires a different set of interfaces. Interfaces only needed in one mode
 * are noted accordingly.
 *
 * ## Node Types
 *
 * Nodes are divided into the following types:
 * - Normal node
 * - Text node (carries text only, no children)
 * - Fragment node (used to temporarily hold a node tree fragment)
 * - Component node (Shadow Mode only; has its own shadow tree, can be virtual or non-virtual)
 * - Component root node (Shadow Mode only; the shadowRoot node of a component)
 * - Virtual node (Shadow Mode only)
 *
 * ## Interface Conventions
 *
 * Interfaces marked as `async` use a callback pattern: `async method(...): T` is actually
 * `method(..., (T) => void)`.
 *
 * glass-easel guarantees that a node's ancestor list never contains itself (no cycles).
 */

/* eslint-disable class-methods-use-this */

import { type Element as GlassEaselElement } from '../element'
import { type Event, type EventBubbleStatus, type EventOptions, type MutLevel } from '../event'
import { type SlotMode } from '../shadow_root'
import { type BackendMode } from './shared'
import type * as suggestedBackend from './suggested_backend_protocol'

export * from './shared'

/**
 * A backend-provided object. Each Context instance can display a node tree on the screen.
 *
 * In Shadow Mode, `Context` provides the core rendering context for glass-easel.
 */
export interface Context extends Partial<suggestedBackend.Context<Context, Element>> {
  /** Protocol mode. Always `BackendMode.Shadow` in this protocol. */
  mode: BackendMode.Shadow

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
   * In Shadow Mode, the root node must be a component root node.
   */
  getRootNode(): ShadowRootContext

  /** Create a fragment node. Used to represent a node array for batch insertion and removal. */
  createFragment(): Element

  /**
   * Set the global event callback. This callback is the only one.
   * Shadow Mode only; for Composed Mode see the other `onEvent` signature.
   *
   * @param createEvent - Creates an event object from the given type, detail, and options.
   * @param listener - Called when an event occurs.
   */
  onEvent(
    createEvent: (type: string, detail: unknown, options: EventOptions) => Event<unknown>,
    listener: (
      event: Event<unknown>,
      currentTarget: GlassEaselElement,
      mark: Record<string, unknown> | null,
      target: GlassEaselElement,
      isCapture: boolean,
    ) => EventBubbleStatus | void,
  ): void
}

/**
 * Element interface for Shadow Mode.
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
   * For a component node, return its ShadowRootContext; otherwise return undefined.
   * Shadow Mode only.
   */
  getShadowRoot(): ShadowRootContext | undefined

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
   * Set the target slot name of this node.
   * Shadow Mode only.
   */
  setSlot(name: string): void

  /**
   * Mark this node as a slot node and set its slot name.
   * Shadow Mode only.
   */
  setSlotName(slot: string): void

  /**
   * Set the target slot of this node.
   * `undefined` means the node has no target slot;
   * `null` means the node's target slot is empty (composedParent is empty).
   * Shadow Mode only.
   */
  setSlotElement(slot: Element | null): void

  /**
   * Mark this node as slot-inherit.
   * For slot-inherit nodes, their children are not considered children in the composed tree,
   * but rather siblings after the node. This allows these children to have different target slots.
   * A node is only set as slot-inherit during initialization, before it has any children.
   * Shadow Mode only.
   */
  setInheritSlots(): void

  /**
   * Set the style of this node.
   * Not called on text nodes.
   */
  setStyle(styleText: string, styleSegmentIndex: number): void

  /**
   * Add a class to this node.
   * Not called on text nodes.
   * In Shadow Mode, styleScope is not passed.
   */
  addClass(className: string): void

  /**
   * Remove the specified class (if both name and styleScope match).
   * Not called on text nodes.
   * In Shadow Mode, styleScope is not passed.
   */
  removeClass(className: string): void

  /** Remove all classes. Not called on text nodes. */
  clearClasses(): void

  /**
   * Update a class alias of this node.
   * Not called on text nodes.
   * Shadow Mode only.
   */
  setClassAlias(className: string, targets: string[]): void

  /** Set an attribute on this node. `value` can be any type. Not called on text nodes. */
  setAttribute(name: string, value: unknown): void

  /** Remove an attribute from this node. Not called on text nodes. */
  removeAttribute(name: string): void

  /**
   * Set a dataset attribute on this node. `value` can be any type.
   * Not called on text nodes.
   * Shadow Mode only.
   */
  setDataset(name: string, value: unknown): void

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

/**
 * Represents a shadow tree environment.
 * Shadow Mode only.
 */
export interface ShadowRootContext extends Element {
  /**
   * Create a normal node.
   * `logicalName` is the node's own defined name.
   * `stylingName` is the alias set when used.
   * Shadow Mode only.
   */
  createElement(logicalName: string, stylingName: string): Element

  /**
   * Create a text node.
   * Shadow Mode only.
   */
  createTextNode(content: string): Element

  /**
   * Create a component node.
   * `tagName` is the component name (corresponding to stylingName).
   * `external` indicates whether this is an external component node
   * (a pre-built backend node tree joined directly with the rest).
   * `virtualHost` indicates whether this is a virtual component
   * (a component whose outermost node is a virtual node).
   * `styleScope` is the component's scope identifier.
   * `extraStyleScope` is the component's extra scope identifier.
   * `externalClasses` is the list of external classes.
   * Shadow Mode only.
   */
  createComponent(
    tagName: string,
    external: boolean,
    virtualHost: boolean,
    styleScope: number,
    extraStyleScope: number | null,
    externalClasses: string[] | undefined,
    slotMode: SlotMode | null,
    writeIdToDOM: boolean,
  ): Element

  /**
   * Create a virtual node.
   * Shadow Mode only.
   */
  createVirtualNode(virtualName: string): Element
}
