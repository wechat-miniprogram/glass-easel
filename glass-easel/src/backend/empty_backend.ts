/* eslint-disable class-methods-use-this */

import { type Element as GlassEaselElement } from '../element'
import { type Event, type EventBubbleStatus, type EventOptions, type MutLevel } from '../event'
import { safeCallback } from '../func_arr'
import { type SlotMode } from '../shadow_root'
import { type Context, type Element, type ShadowRootContext } from './backend_protocol'
import { BackendMode } from './shared'

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
  /* @internal */
  private _$styleSheetIdInc = 1
  /* @internal */
  private _$renderCallbacks: ((err: Error) => void)[] | null = null
  /* @internal */
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
    _createEvent: (type: string, detail: unknown, options: EventOptions) => Event<unknown>,
    _listener: (
      event: Event<unknown>,
      currentTarget: GlassEaselElement,
      mark: Record<string, unknown> | null,
      target: GlassEaselElement,
      isCapture: boolean,
    ) => EventBubbleStatus,
  ): void {
    // empty
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

  associateValue(_v: GlassEaselElement): void {
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

  setSlot(_name: string): void {
    // empty
  }

  setSlotName(_name: string): void {
    // empty
  }

  setSlotElement(_slot: EmptyBackendElement | null): void {
    // empty
  }

  setInheritSlots(): void {
    // empty
  }

  setStyle(_styleText: string, _styleSegmentIndex: number): void {
    // empty
  }

  addClass(_className: string): void {
    // empty
  }

  removeClass(_className: string): void {
    // empty
  }

  clearClasses(): void {
    // empty
  }

  setClassAlias(_className: string, _target: string[]): void {
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

  setListenerStats(_type: string, _capture: boolean, _mutLevel: MutLevel): void {
    // empty
  }

  setModelBindingStat(
    _attributeName: string,
    _listener: ((newValue: unknown) => void) | null,
  ): void {
    // empty
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

  createComponent(
    _tagName: string,
    _external: boolean,
    _virtualHost: boolean,
    _styleScope: number,
    _extraStyleScope: number | null,
    _externalClasses: string[] | undefined,
    _slotMode: SlotMode | null,
    _writeIdToDOM: boolean,
  ): EmptyBackendElement {
    return new EmptyBackendElement(EmptyBackendElementType.Component)
  }

  createVirtualNode(_virtualName: string): EmptyBackendElement {
    return new EmptyBackendElement(EmptyBackendElementType.VirtualNode)
  }
}
