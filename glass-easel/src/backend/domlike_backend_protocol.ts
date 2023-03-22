/* eslint-disable class-methods-use-this */
/* global window, document */

import { EventOptions, EventBubbleStatus } from '../event'
import { safeCallback } from '../func_arr'
import {
  BackendMode,
  BoundingClientRect,
  Observer,
  MediaQueryStatus,
  IntersectionStatus,
} from './mode'

export interface Context {
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
  onEvent(
    listener: (
      target: unknown,
      type: string,
      detail: unknown,
      options: EventOptions,
    ) => EventBubbleStatus,
  ): void
  setElementEventDefaultPrevented(element: Element, type: string, enabled: boolean): void
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
}

export interface Element {
  appendChild(child: Element): void
  removeChild(child: Element, index?: number): void
  insertBefore(child: Element, before?: Element, index?: number): void
  replaceChild(child: Element, oldChild?: Element, index?: number): void
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
  getBoundingClientRect(): BoundingClientRect
  scrollLeft: number
  scrollTop: number
  scrollWidth: number
  scrollHeight: number
  __wxElement?: unknown
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

const DELEGATE_EVENTS = [
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'mousedown',
  'mousemove',
  'mouseout',
  'mouseover',
  'mouseup',
  'click',
]

export class CurrentWindowBackendContext implements Context {
  mode: BackendMode.Domlike = BackendMode.Domlike
  document = document as unknown as {
    createElement(tagName: string): Element
    createTextNode(content: string): Element
    createDocumentFragment(): Element
  }
  private _$styleSheets: HTMLElement[] = []
  private _$styleSheetRegistry = Object.create(null) as { [path: string]: string }
  private _$delegatedEventListeners = Object.create(null) as Record<string, true>
  private _$elementEventListeners = new WeakMap<Element, Record<string, true>>()
  private _$triggedEvents = new WeakSet<Event>()
  private _$eventListener?: (
    target: any,
    type: string,
    detail: any,
    options: EventOptions,
  ) => EventBubbleStatus | void

  destroy() {
    /* empty */
  }

  getWindowWidth(): number {
    return document.documentElement.clientWidth
  }

  getWindowHeight(): number {
    return document.documentElement.clientHeight
  }

  getDevicePixelRatio(): number {
    return window.devicePixelRatio
  }

  getTheme(): string {
    return 'light'
  }

  registerStyleSheetContent(path: string, content: unknown): void {
    this._$styleSheetRegistry[path] = String(content)
  }

  appendStyleSheetPath(path: string, styleScope?: number): number {
    const styleText = this._$styleSheetRegistry[path]
    if (styleText === undefined) throw new Error(`No style sheet registry "${path}"`)
    const s = document.createElement('style')
    s.innerText = styleText
    if (styleScope !== undefined) s.setAttribute('wx-style-scope', String(styleScope))
    document.head.appendChild(s)
    const id = this._$styleSheets.length
    this._$styleSheets.push(s)
    return id
  }

  disableStyleSheet(index: number) {
    const ss = this._$styleSheets[index]
    if (ss) document.head.removeChild(ss)
  }

  render(cb: (err: Error | null) => void) {
    window.requestAnimationFrame(() => {
      safeCallback('Render Callback', cb, this, [null])
    })
  }

  getRootNode(): Element {
    return document.body as unknown as Element
  }

  onEvent(
    listener: (
      target: any,
      type: string,
      detail: any,
      options: EventOptions,
    ) => EventBubbleStatus | void,
  ) {
    if (!this._$eventListener) {
      this._$initEvent()
    }
    this._$eventListener = listener
  }

  private _$getEventDetail(ev: Event) {
    const detail: { [key: string]: unknown } = {}
    let e: Event = ev
    while (Object.getPrototypeOf(e) !== Event.prototype) {
      const keys = Object.keys(e)
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]!
        if (typeof (ev as unknown as { [key: string]: unknown })[key] === 'function') continue
        detail[key] = (ev as unknown as { [key: string]: unknown })[key]
      }
      e = Object.getPrototypeOf(e) as Event
    }
    return detail
  }

  private _$trigger(ev: Event, type: string, detail: unknown, bubbles: boolean, composed: boolean) {
    if (!this._$eventListener) return
    const target = ev.target
    const bubbleStatus = this._$eventListener(target, type, detail, {
      originalEvent: ev,
      bubbles,
      composed,
    })
    if (bubbleStatus === EventBubbleStatus.NoDefault) {
      ev.preventDefault()
    }
  }

  private _$initEvent() {
    const TAP_DIST = 10

    const possibleTaps = Object.create(null) as { [id: number]: { x: number; y: number } }
    const SIMULATED_MOUSE_ID = -1
    let disableMouseEvents = false

    const handleTapStart = (
      _ev: Event,
      t: { identifier: number; clientX: number; clientY: number },
    ) => {
      possibleTaps[t.identifier] = {
        x: t.clientX,
        y: t.clientY,
      }
    }

    const handleTapMove = (
      ev: Event,
      t: { identifier: number; clientX: number; clientY: number },
    ) => {
      const id = t.identifier
      if (possibleTaps[id]) {
        const u = possibleTaps[id]!
        if (Math.abs(u.x - t.clientX) > TAP_DIST || Math.abs(u.y - t.clientY) > TAP_DIST) {
          delete possibleTaps[id]
          this._$trigger(ev, 'canceltap', u, true, true)
        }
      }
    }

    const handleTapEnd = (
      ev: Event,
      t: { identifier: number; clientX: number; clientY: number },
    ) => {
      const id = t.identifier
      if (possibleTaps[id]) {
        const u = possibleTaps[id]!
        delete possibleTaps[id]
        if (Math.abs(u.x - t.clientX) > TAP_DIST || Math.abs(u.y - t.clientY) > TAP_DIST) {
          this._$trigger(ev, 'canceltap', u, true, true)
        } else {
          this._$trigger(ev, 'tap', u, true, true)
        }
      }
    }

    const handleTapCancel = (
      ev: Event,
      t: { identifier: number; clientX: number; clientY: number },
    ) => {
      const id = t.identifier
      if (possibleTaps[id]) {
        const u = possibleTaps[id]!
        delete possibleTaps[id]
        this._$trigger(ev, 'canceltap', u, true, true)
      }
    }

    document.body.addEventListener(
      'touchstart',
      (ev) => {
        this._$trigger(ev, 'touchstart', this._$getEventDetail(ev), ev.bubbles, ev.composed)
        disableMouseEvents = true
        const changedTouches = ev.changedTouches
        for (let i = 0; i < changedTouches.length; i += 1) {
          handleTapStart(ev, changedTouches[i]!)
        }
      },
      { capture: true },
    )
    document.body.addEventListener(
      'touchmove',
      (ev) => {
        this._$trigger(ev, 'touchmove', this._$getEventDetail(ev), ev.bubbles, ev.composed)
        const changedTouches = ev.changedTouches
        for (let i = 0; i < changedTouches.length; i += 1) {
          handleTapMove(ev, changedTouches[i]!)
        }
      },
      { capture: true },
    )
    document.body.addEventListener(
      'touchend',
      (ev) => {
        this._$trigger(ev, 'touchend', this._$getEventDetail(ev), ev.bubbles, ev.composed)
        const changedTouches = ev.changedTouches
        for (let i = 0; i < changedTouches.length; i += 1) {
          handleTapEnd(ev, changedTouches[i]!)
        }
      },
      { capture: true },
    )
    document.body.addEventListener(
      'touchcancel',
      (ev) => {
        this._$trigger(ev, 'touchcancel', this._$getEventDetail(ev), ev.bubbles, ev.composed)
        const changedTouches = ev.changedTouches
        for (let i = 0; i < changedTouches.length; i += 1) {
          handleTapCancel(ev, changedTouches[i]!)
        }
      },
      { capture: true },
    )
    document.body.addEventListener(
      'mousedown',
      (ev) => {
        this._$trigger(ev, 'mousedown', this._$getEventDetail(ev), ev.bubbles, ev.composed)
        if (disableMouseEvents) return
        handleTapStart(ev, {
          identifier: SIMULATED_MOUSE_ID,
          clientX: ev.clientX,
          clientY: ev.clientY,
        })
      },
      { capture: true },
    )
    document.body.addEventListener(
      'mousemove',
      (ev) => {
        this._$trigger(ev, 'mousemove', this._$getEventDetail(ev), ev.bubbles, ev.composed)
        if (disableMouseEvents) return
        handleTapMove(ev, {
          identifier: SIMULATED_MOUSE_ID,
          clientX: ev.clientX,
          clientY: ev.clientY,
        })
      },
      { capture: true },
    )
    document.body.addEventListener(
      'mouseup',
      (ev) => {
        this._$trigger(ev, 'mouseup', this._$getEventDetail(ev), ev.bubbles, ev.composed)
        if (disableMouseEvents) return
        handleTapEnd(ev, {
          identifier: SIMULATED_MOUSE_ID,
          clientX: ev.clientX,
          clientY: ev.clientY,
        })
      },
      { capture: true },
    )
    const listeners = this._$delegatedEventListeners
    listeners.touchstart = true
    listeners.touchmove = true
    listeners.touchend = true
    listeners.mousedown = true
    listeners.mousemove = true
    listeners.mouseup = true
  }

  setElementEventDefaultPrevented(element: Element, type: string, _enabled: boolean): void {
    // for non-passive events,
    // the default-prevented status can also be found in `EventBubbleStatus` ,
    // so there is nothing to do with non-passive events.
    if (!element) return

    const shouldDelegate = DELEGATE_EVENTS.includes(type)

    if (shouldDelegate) {
      if (this._$delegatedEventListeners[type]) return
      this._$delegatedEventListeners[type] = true

      document.body.addEventListener(
        type,
        (ev) => {
          this._$trigger(ev, type, this._$getEventDetail(ev), ev.bubbles, ev.composed)
        },
        { capture: true },
      )
      return
    }

    if (!this._$elementEventListeners.has(element)) {
      this._$elementEventListeners.set(element, Object.create(null))
    }
    const listeners = this._$elementEventListeners.get(element)!
    if (listeners[type]) return
    listeners[type] = true

    element.addEventListener(type, (ev) => {
      if (this._$triggedEvents.has(ev)) return
      this._$triggedEvents.add(ev)
      this._$trigger(ev, type, this._$getEventDetail(ev), ev.bubbles, ev.composed)
    })
  }

  createIntersectionObserver(
    targetElement: Element,
    relativeElement: Element | null,
    relativeElementMargin: string,
    thresholds: number[],
    listener: (res: IntersectionStatus) => void,
  ): Observer {
    const observer = new IntersectionObserver(
      (info) => {
        info.forEach((entry) => {
          listener({
            intersectionRatio: entry.intersectionRatio,
            boundingClientRect: entry.boundingClientRect,
            intersectionRect: entry.intersectionRect,
            relativeRect: entry.rootBounds!,
            time: entry.time,
          })
        })
      },
      {
        root: relativeElement as unknown as HTMLElement,
        rootMargin: relativeElementMargin,
        threshold: thresholds,
      },
    )
    observer.observe(targetElement as unknown as HTMLElement)
    return {
      disconnect() {
        observer.disconnect()
      },
    }
  }

  createMediaQueryObserver(
    status: MediaQueryStatus,
    listener: (res: { matches: boolean }) => void,
  ): Observer {
    const calcMatches = () => {
      const width = document.documentElement.clientWidth
      const height = document.documentElement.clientHeight
      if (status.width !== undefined && width !== status.width) return false
      if (status.maxWidth !== undefined && width > status.maxWidth) return false
      if (status.minWidth !== undefined && width < status.minWidth) return false
      if (status.width !== undefined && height !== status.height) return false
      if (status.maxHeight !== undefined && height > status.maxHeight) return false
      if (status.minHeight !== undefined && height < status.minHeight) return false
      const orientation = width > height ? 'landscape' : 'portrait'
      if (orientation !== status.orientation) return false
      return true
    }
    let curMatches: boolean | null = null
    const listenerFunc = () => {
      const matches = calcMatches()
      if (curMatches === matches) return
      curMatches = matches
      listener({ matches })
    }
    setTimeout(listenerFunc, 0)
    window.addEventListener('resize', listenerFunc)
    return {
      disconnect() {
        window.removeEventListener('resize', listenerFunc)
      },
    }
  }
}
