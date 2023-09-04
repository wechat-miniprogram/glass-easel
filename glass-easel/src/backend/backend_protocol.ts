/* eslint-disable class-methods-use-this */

import { EventBubbleStatus, EventOptions } from '../event'
import { safeCallback } from '../func_arr'
import {
  BackendMode,
  BoundingClientRect,
  IntersectionStatus,
  MediaQueryStatus,
  Observer,
  ScrollOffset,
} from './mode'
import * as suggestedBackend from './suggested_backend_protocol'

export {
  BackendMode,
  BoundingClientRect,
  IntersectionStatus,
  MediaQueryStatus,
  Observer,
  ScrollOffset,
} from './mode'

export interface Context extends Partial<suggestedBackend.Context> {
  mode: BackendMode.Shadow
  destroy(): void
  getWindowWidth(): number
  getWindowHeight(): number
  getDevicePixelRatio(): number
  getTheme(): string
  registerStyleSheetContent(path: string, content: unknown): void
  appendStyleSheetPath(path: string, styleScope?: number): number
  disableStyleSheet(index: number): void
  render(cb: (err: Error | null) => void): void
  getRootNode(): ShadowRootContext
  createFragment(): Element
  onEvent(
    listener: (
      target: unknown,
      type: string,
      detail: unknown,
      options: EventOptions,
    ) => EventBubbleStatus,
  ): void
  createMediaQueryObserver(
    status: MediaQueryStatus,
    listener: (res: { matches: boolean }) => void,
  ): Observer
}

export interface Element extends Partial<suggestedBackend.Element> {
  release(): void
  associateValue(v: unknown): void
  getShadowRoot(): ShadowRootContext | undefined
  appendChild(child: Element): void
  removeChild(child: Element, index?: number): void
  insertBefore(child: Element, before: Element, index?: number): void
  replaceChild(child: Element, oldChild: Element, index?: number): void
  spliceBefore(before: Element, deleteCount: number, list: Element): void
  spliceAppend(list: Element): void
  spliceRemove(before: Element, deleteCount: number): void
  setId(id: string): void
  setSlotName(slot: string): void
  setContainingSlot(slot: Element | undefined | null): void
  reassignContainingSlot(oldSlot: Element | null, newSlot: Element | null): void
  spliceBeforeSlotNodes(before: number, deleteCount: number, list: Element): void
  spliceAppendSlotNodes(list: Element): void
  spliceRemoveSlotNodes(before: number, deleteCount: number): void
  setInheritSlots(): void
  setVirtualHost(): void
  setStyleScope(styleScope: number, hostStyleScope?: number): void
  setStyle(styleText: string): void
  addClass(elementClass: string, styleScope?: number): void
  removeClass(elementClass: string, styleScope?: number): void
  clearClasses(): void
  setAttribute(name: string, value: unknown): void
  removeAttribute(name: string): void
  setText(content: string): void
  getBoundingClientRect(cb: (res: BoundingClientRect) => void): void
  getScrollOffset(cb: (res: ScrollOffset) => void): void
  setEventDefaultPrevented(type: string, enabled: boolean): void
  setModelBindingStat(attributeName: string, listener: ((newValue: unknown) => void) | null): void
  createIntersectionObserver(
    relativeElement: Element | null,
    relativeElementMargin: string,
    thresholds: number[],
    listener: ((res: IntersectionStatus) => void) | null,
  ): Observer
}

export interface ShadowRootContext extends Element {
  createElement(logicalName: string, stylingName: string): Element
  createTextNode(content: string): Element
  createComponent(tagName: string): Element
  createVirtualNode(virtualName: string): Element
}

export const enum EmptyBackendElementType {
  Fragment,
  Element,
  TextNode,
  Component,
  VirtualNode,
}

/** An empty backend implementation */
export class EmptyBackendContext implements Context {
  mode: BackendMode.Shadow = BackendMode.Shadow
  private _$styleSheetIdInc = 1
  private _$renderCallbacks: ((err: Error) => void)[] | null = null
  private _$shadowRoot: EmptyBackendShadowRootContext = new EmptyBackendShadowRootContext()

  destroy(): void {
    // empty
  }

  getWindowWidth(): number {
    return 1
  }

  getWindowHeight(): number {
    return 1
  }

  getDevicePixelRatio(): number {
    return 1
  }

  getTheme(): string {
    return 'light'
  }

  registerStyleSheetContent(_path: string, _content: unknown): void {
    // empty
  }

  appendStyleSheetPath(_path: string, _styleScope?: number): number {
    const id = this._$styleSheetIdInc
    this._$styleSheetIdInc += 1
    return id
  }

  disableStyleSheet(_index: number): void {
    // empty
  }

  render(cb: (err: Error | null) => void): void {
    if (this._$renderCallbacks) {
      this._$renderCallbacks.push(cb)
    } else {
      const callbacks = (this._$renderCallbacks = [cb])
      setTimeout(() => {
        this._$renderCallbacks = null
        callbacks.forEach((cb) => {
          safeCallback('Render Callback', cb, this, [null])
        })
      }, 16)
    }
  }

  getRootNode(): EmptyBackendShadowRootContext {
    return this._$shadowRoot
  }

  createFragment(): EmptyBackendElement {
    return new EmptyBackendElement(EmptyBackendElementType.Fragment)
  }

  onEvent(
    _listener: (
      target: unknown,
      type: string,
      detail: unknown,
      options: EventOptions,
    ) => EventBubbleStatus,
  ): void {
    // empty
  }

  createMediaQueryObserver(
    _status: MediaQueryStatus,
    _listener: (res: { matches: boolean }) => void,
  ): Observer {
    return {
      disconnect: () => {
        /* empty */
      },
    }
  }
}

/** An element for empty backend implementation */
export class EmptyBackendElement implements Element {
  private _$shadowRoot: EmptyBackendShadowRootContext | null

  constructor(type: EmptyBackendElementType) {
    if (type === EmptyBackendElementType.Component) {
      this._$shadowRoot = new EmptyBackendShadowRootContext()
    } else {
      this._$shadowRoot = null
    }
  }

  release(): void {
    // empty
  }

  associateValue(_v: unknown): void {
    // empty
  }

  getShadowRoot(): EmptyBackendShadowRootContext | undefined {
    return this._$shadowRoot || undefined
  }

  appendChild(_child: EmptyBackendElement): void {
    // empty
  }

  removeChild(_child: EmptyBackendElement, _index: number): void {
    // empty
  }

  insertBefore(_child: EmptyBackendElement, _before: EmptyBackendElement, _index: number): void {
    // empty
  }

  replaceChild(_child: EmptyBackendElement, _oldChild: EmptyBackendElement, _index?: number): void {
    // empty
  }

  spliceBefore(
    _before: EmptyBackendElement,
    _deleteCount: number,
    _list: EmptyBackendElement,
  ): void {
    // empty
  }

  spliceAppend(_list: EmptyBackendElement): void {
    // empty
  }

  spliceRemove(_before: EmptyBackendElement, _deleteCount: number): void {
    // empty
  }

  setId(_id: string): void {
    // empty
  }

  setSlotName(_name: string): void {
    // empty
  }

  setContainingSlot(_slot: EmptyBackendElement): void {
    // empty
  }

  reassignContainingSlot(_oldSlot: Element | null, _newSlot: Element | null): void {
    // empty
  }

  spliceBeforeSlotNodes(_before: number, _deleteCount: number, _list: Element): void {
    // empty
  }

  spliceRemoveSlotNodes(_before: number, _deleteCount: number): void {
    // empty
  }

  spliceAppendSlotNodes(_list: Element): void {
    // empty
  }

  setInheritSlots(): void {
    // empty
  }

  setVirtualHost(): void {
    // empty
  }

  setStyleScope(_styleScope: number): void {
    // empty
  }

  setStyle(_styleText: string): void {
    // empty
  }

  addClass(_elementClass: string, _styleScope?: number): void {
    // empty
  }

  removeClass(_elementClass: string, _styleScope?: number): void {
    // empty
  }

  clearClasses(): void {
    // empty
  }

  setAttribute(_name: string, _value: unknown): void {
    // empty
  }

  removeAttribute(_name: string): void {
    // empty
  }

  setText(_content: string): void {
    // empty
  }

  getBoundingClientRect(cb: (res: BoundingClientRect) => void): void {
    setTimeout(() => {
      cb({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      })
    }, 0)
  }

  getScrollOffset(cb: (res: ScrollOffset) => void): void {
    setTimeout(() => {
      cb({
        scrollLeft: 0,
        scrollTop: 0,
        scrollWidth: 0,
        scrollHeight: 0,
      })
    }, 0)
  }

  setEventDefaultPrevented(_type: string, _enabled: boolean): void {
    // empty
  }

  setModelBindingStat(
    _attributeName: string,
    _listener: ((newValue: unknown) => void) | null,
  ): void {
    // empty
  }

  createIntersectionObserver(
    _relativeElement: Element | null,
    _relativeElementMargin: string,
    _thresholds: number[],
    _listener: (res: IntersectionStatus) => void,
  ): Observer {
    return {
      disconnect: () => {
        /* empty */
      },
    }
  }
}

/** A shadow root for empty backend implementation */
export class EmptyBackendShadowRootContext
  extends EmptyBackendElement
  implements ShadowRootContext
{
  // eslint-disable-next-line no-useless-constructor
  constructor() {
    super(EmptyBackendElementType.VirtualNode)
  }

  createElement(_tagName: string, _stylingName: string): EmptyBackendElement {
    return new EmptyBackendElement(EmptyBackendElementType.Element)
  }

  createTextNode(_content: string): EmptyBackendElement {
    return new EmptyBackendElement(EmptyBackendElementType.TextNode)
  }

  createComponent(_tagName: string): EmptyBackendElement {
    return new EmptyBackendElement(EmptyBackendElementType.Component)
  }

  createVirtualNode(_virtualName: string): EmptyBackendElement {
    return new EmptyBackendElement(EmptyBackendElementType.VirtualNode)
  }
}
