/* eslint-disable class-methods-use-this */

import { type EventBubbleStatus, type EventOptions, type MutLevel } from '../event'
import { safeCallback } from '../func_arr'
import { type Context, type Element, type ShadowRootContext } from './backend_protocol'
import {
  BackendMode,
  type BoundingClientRect,
  type IntersectionStatus,
  type MediaQueryStatus,
  type Observer,
  type ScrollOffset,
} from './shared'

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

  setDataset(_name: string, _value: unknown): void {
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

  setListenerStats(_type: string, _capture: boolean, _mutLevel: MutLevel): void {
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

  getContext(cb: (res: unknown) => void): void {
    cb(null)
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
