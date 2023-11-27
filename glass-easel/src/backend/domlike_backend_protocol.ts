import { type Element as GlassEaselElement } from '../element'
import { type EventBubbleStatus, type EventOptions, type MutLevel } from '../event'
import {
  type BackendMode,
  type BoundingClientRect,
  type IntersectionStatus,
  type MediaQueryStatus,
  type Observer,
} from './shared'
import type * as suggestedBackend from './suggested_backend_protocol'

export interface Context extends Partial<suggestedBackend.Context<Context>> {
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
  createIntersectionObserver(
    targetElement: Element,
    relativeElement: Element | null,
    relativeElementMargin: string,
    thresholds: number[],
    listener: (res: IntersectionStatus) => void,
  ): Observer
  createMediaQueryObserver(
    status: MediaQueryStatus,
    listener: (res: { matches: boolean }) => void,
  ): Observer
  getContext(element: Element, cb: (res: unknown) => void): void
}

export interface Element extends Partial<suggestedBackend.Element> {
  _$wxArgs?: {
    modelListeners: { [name: string]: ((newValue: unknown) => void) | null }
  }
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
  getBoundingClientRect(): BoundingClientRect
  scrollLeft: number
  scrollTop: number
  scrollWidth: number
  scrollHeight: number
  __wxElement?: GlassEaselElement
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
