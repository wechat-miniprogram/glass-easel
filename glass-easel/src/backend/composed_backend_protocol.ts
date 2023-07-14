/* eslint-disable class-methods-use-this */

import { EventOptions, EventBubbleStatus } from '../event'
import { safeCallback } from '../func_arr'
import {
  BackendMode,
  BoundingClientRect,
  ScrollOffset,
  Observer,
  MediaQueryStatus,
  IntersectionStatus,
} from './mode'

export interface Context {
  mode: BackendMode.Composed
  destroy(): void
  getWindowWidth(): number
  getWindowHeight(): number
  getDevicePixelRatio(): number
  getTheme(): string
  registerStyleSheetContent(path: string, content: unknown): void
  appendStyleSheetPath(path: string, styleScope?: number): number
  disableStyleSheet(index: number): void
  render(cb: (err: Error | null) => void): void
  getRootNode(): Element
  createElement(logicalName: string, stylingName: string): Element
  createTextNode(content: string): Element
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

export interface Element {
  release(): void
  associateValue(v: unknown): void
  appendChild(child: Element): void
  removeChild(child: Element, index?: number): void
  insertBefore(child: Element, before: Element, index?: number): void
  replaceChild(child: Element, oldChild: Element, index?: number): void
  spliceBefore(before: Element, deleteCount: number, list: Element): void
  spliceAppend(list: Element): void
  spliceRemove(before: Element, deleteCount: number): void
  setId(id: string): void
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
  __wxElement?: unknown
}

/** An empty backend implementation */
export class EmptyComposedBackendContext implements Context {
  mode: BackendMode.Composed = BackendMode.Composed
  private _$styleSheetIdInc = 1
  private _$renderCallbacks: ((err: Error) => void)[] | null = null
  private _$rootNode: EmptyComposedBackendElement = new EmptyComposedBackendElement()

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

  getRootNode(): Element {
    return this._$rootNode
  }

  createElement(_tagName: string, _stylingName: string): Element {
    return new EmptyComposedBackendElement()
  }

  createTextNode(_tagName: string): Element {
    return new EmptyComposedBackendElement()
  }

  createFragment(): Element {
    return new EmptyComposedBackendElement()
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
export class EmptyComposedBackendElement implements Element {
  __wxElement: unknown = undefined

  release(): void {
    // empty
  }

  associateValue(_v: unknown): void {
    // empty
  }

  appendChild(_child: Element): void {
    // empty
  }

  removeChild(_child: Element, _index?: number): void {
    // empty
  }

  insertBefore(_child: Element, _before?: Element, _index?: number): void {
    // empty
  }

  replaceChild(_child: Element, _oldChild?: Element, _index?: number): void {
    // empty
  }

  spliceBefore(_before: Element, _deleteCount: number, _list: Element): void {
    // empty
  }

  spliceAppend(_list: Element): void {
    // empty
  }

  spliceRemove(_before: Element, _deleteCount: number): void {
    // empty
  }

  setId(_id: string): void {
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
