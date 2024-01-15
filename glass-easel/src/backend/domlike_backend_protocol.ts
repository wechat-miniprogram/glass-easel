import { type Element as GlassEaselElement } from '../element'
import { type EventBubbleStatus, type EventOptions, type MutLevel } from '../event'
import { type BackendMode } from './shared'
import type * as suggestedBackend from './suggested_backend_protocol'

export interface Context extends Partial<suggestedBackend.ContextForDomLike<Element>> {
  mode: BackendMode.Domlike
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
  document: {
    createElement(tagName: string): Element
    createTextNode(content: string): Element
    createDocumentFragment(): Element
  }
  associateValue(element: Element, value: GlassEaselElement): void
  onEvent(
    listener: (
      target: GlassEaselElement,
      type: string,
      detail: unknown,
      options: EventOptions,
    ) => EventBubbleStatus | void,
  ): void
  setListenerStats(element: Element, type: string, capture: boolean, mutLevel: MutLevel): void
  setModelBindingStat(
    element: Element,
    attributeName: string,
    listener: ((newValue: unknown) => void) | null,
  ): void
}

export interface Element extends Partial<suggestedBackend.ElementForDomLike> {
  _$wxArgs?: {
    modelListeners: { [name: string]: ((newValue: unknown) => void) | null }
  }
  __wxElement?: GlassEaselElement
  appendChild(child: Element): void
  removeChild(child: Element, index?: number): void
  insertBefore(child: Element, before?: Element, index?: number): void
  replaceChild(child: Element, oldChild?: Element, index?: number): void
  tagName: string
  id: string
  classList: {
    add(elementClass: string): void
    remove(elementClass: string): void
  }
  setAttribute(name: string, value: unknown): void
  removeAttribute(name: string): void
  textContent: string
  nextSibling: Element | undefined
  childNodes: Element[]
  parentNode: Element | null
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void
}
