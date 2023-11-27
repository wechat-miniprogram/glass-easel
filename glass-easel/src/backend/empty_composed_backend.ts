/* eslint-disable class-methods-use-this */

import { type Element as GlassEaselElement } from '../element'
import { type EventBubbleStatus, type EventOptions, type MutLevel } from '../event'
import { safeCallback } from '../func_arr'
import { type Context, type Element } from './composed_backend_protocol'
import {
  BackendMode,
  type BoundingClientRect,
  type IntersectionStatus,
  type MediaQueryStatus,
  type Observer,
  type ScrollOffset,
} from './shared'

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

  getRootNode(): EmptyComposedBackendElement {
    return this._$rootNode
  }

  createElement(_tagName: string, _stylingName: string): EmptyComposedBackendElement {
    return new EmptyComposedBackendElement()
  }

  createTextNode(_tagName: string): EmptyComposedBackendElement {
    return new EmptyComposedBackendElement()
  }

  createFragment(): EmptyComposedBackendElement {
    return new EmptyComposedBackendElement()
  }

  onEvent(
    _listener: (
      target: GlassEaselElement,
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
  release(): void {
    // empty
  }

  associateValue(_v: unknown): void {
    // empty
  }

  appendChild(_child: EmptyComposedBackendElement): void {
    // empty
  }

  removeChild(_child: EmptyComposedBackendElement, _index?: number): void {
    // empty
  }

  insertBefore(
    _child: EmptyComposedBackendElement,
    _before: EmptyComposedBackendElement,
    _index?: number,
  ): void {
    // empty
  }

  replaceChild(
    _child: EmptyComposedBackendElement,
    _oldChild: EmptyComposedBackendElement,
    _index?: number,
  ): void {
    // empty
  }

  spliceBefore(
    _before: EmptyComposedBackendElement,
    _deleteCount: number,
    _list: EmptyComposedBackendElement,
  ): void {
    // empty
  }

  spliceAppend(_list: EmptyComposedBackendElement): void {
    // empty
  }

  spliceRemove(_before: EmptyComposedBackendElement, _deleteCount: number): void {
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
    _relativeElement: EmptyComposedBackendElement | null,
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
