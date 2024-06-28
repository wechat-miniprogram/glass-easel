/* eslint-disable class-methods-use-this */

import { type Element as GlassEaselElement } from '../element'
import { type Event, type EventBubbleStatus, type EventOptions, type MutLevel } from '../event'
import { type BackendMode } from './shared'
import type * as suggestedBackend from './suggested_backend_protocol'

export * from './shared'

export interface Context extends Partial<suggestedBackend.Context<Context, Element>> {
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

export interface Element extends Partial<suggestedBackend.Element<Element>> {
  __wxElement?: GlassEaselElement
  release(): void
  associateValue(v: GlassEaselElement): void
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
  setStyle(styleText: string): void
  addClass(className: string): void
  removeClass(className: string): void
  clearClasses(): void
  setClassAlias(className: string, targets: string[]): void
  setAttribute(name: string, value: unknown): void
  removeAttribute(name: string): void
  setDataset(name: string, value: unknown): void
  setText(content: string): void
  setModelBindingStat(attributeName: string, listener: ((newValue: unknown) => void) | null): void
  setListenerStats(type: string, capture: boolean, mutLevel: MutLevel): void
}

export interface ShadowRootContext extends Element {
  createElement(logicalName: string, stylingName: string): Element
  createTextNode(content: string): Element
  createComponent(
    tagName: string,
    external: boolean,
    virtualHost: boolean,
    styleScope: number,
    extraStyleScope: number | null,
    externalClasses: string[] | undefined,
  ): Element
  createVirtualNode(virtualName: string): Element
}
