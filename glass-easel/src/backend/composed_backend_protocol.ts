import { type EventBubbleStatus, type EventOptions, type MutLevel } from '../event'
import {
  type BackendMode,
  type BoundingClientRect,
  type IntersectionStatus,
  type MediaQueryStatus,
  type Observer,
  type ScrollOffset,
} from './shared'
import type * as suggestedBackend from './suggested_backend_protocol'

export interface Context extends Partial<suggestedBackend.Context<Context>> {
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

export interface Element extends Partial<suggestedBackend.Element> {
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
  setModelBindingStat(attributeName: string, listener: ((newValue: unknown) => void) | null): void
  setEventDefaultPrevented(type: string, enabled: boolean): void
  createIntersectionObserver(
    relativeElement: Element | null,
    relativeElementMargin: string,
    thresholds: number[],
    listener: ((res: IntersectionStatus) => void) | null,
  ): Observer
  getContext(cb: (res: unknown) => void): void
}
