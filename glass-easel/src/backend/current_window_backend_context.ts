/* eslint-disable class-methods-use-this */
/* global window, document */

import { type Element as GlassEaselElement } from '../element'
import { EventBubbleStatus, MutLevel, type EventOptions } from '../event'
import { safeCallback } from '../func_arr'
import { triggerWarning } from '../warning'
import { type Context, type Element } from './domlike_backend_protocol'
import {
  BackendMode,
  type ScrollOffset,
  type IntersectionStatus,
  type MediaQueryStatus,
  type Observer,
} from './shared'

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
  /* @internal */
  private _$styleSheets: (HTMLElement | undefined)[] = []
  /* @internal */
  private _$styleSheetRegistry = Object.create(null) as { [path: string]: string }
  /* @internal */
  private _$delegatedEventListeners = Object.create(null) as Record<string, true>
  /* @internal */
  private _$elementEventListeners = new WeakMap<Element, Record<string, true>>()
  /* @internal */
  private _$elementCaptureEventListeners = new WeakMap<Element, Record<string, true>>()
  /* @internal */
  private _$triggedEvents = new WeakSet<Event>()
  /* @internal */
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
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  registerStyleSheetContent(path: string, content: unknown): void {
    this._$styleSheetRegistry[path] = String(content)
  }

  appendStyleSheetPath(path: string, styleScope?: number): number {
    const styleText = this._$styleSheetRegistry[path]
    if (styleText === undefined) throw new Error(`No style sheet registry "${path}"`)
    if (styleText === '') {
      const id = this._$styleSheets.length
      this._$styleSheets.push(undefined)
      return id
    }
    const s = document.createElement('style')
    s.type = 'text/css'
    s.innerHTML = styleText
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

  associateValue(element: Element, value: GlassEaselElement): void {
    element.__wxElement = value
  }

  onEvent(
    listener: (
      target: GlassEaselElement,
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

  /* @internal */
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

  /* @internal */
  private _$trigger(ev: Event, type: string, detail: unknown, bubbles: boolean, composed: boolean) {
    if (!this._$eventListener || !ev.target) return

    let t: Element | null = ev.target as any as Element
    while (t && !t.__wxElement) t = t.parentNode
    if (!t) return

    const bubbleStatus = this._$eventListener(t.__wxElement!, type, detail, {
      originalEvent: ev,
      bubbles,
      composed,
      capturePhase: true,
    })
    if (bubbleStatus === EventBubbleStatus.NoDefault) {
      ev.preventDefault()
    }
  }

  /* @internal */
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

    const handleTouchStart = (ev: TouchEvent) => {
      disableMouseEvents = true
      const changedTouches = ev.changedTouches
      for (let i = 0; i < changedTouches.length; i += 1) {
        handleTapStart(ev, changedTouches[i]!)
      }
      const target = ev.target as unknown as HTMLElement & { __touchCount?: number }
      if (!target.__touchCount) {
        target.__touchCount = 0
        target.addEventListener('touchend', handleTouchEnd)
        target.addEventListener('touchcancel', handleTouchCancel)
      }
      target.__touchCount += changedTouches.length
    }

    const handleTouchMove = (ev: TouchEvent) => {
      const changedTouches = ev.changedTouches
      for (let i = 0; i < changedTouches.length; i += 1) {
        handleTapMove(ev, changedTouches[i]!)
      }
    }

    const handleTouchEnd = (ev: TouchEvent) => {
      const changedTouches = ev.changedTouches
      for (let i = 0; i < changedTouches.length; i += 1) {
        handleTapEnd(ev, changedTouches[i]!)
      }
      const target = ev.target as unknown as HTMLElement & { __touchCount?: number }
      target.__touchCount! -= changedTouches.length
      if (target.__touchCount! <= 0) {
        target.__touchCount = 0
        target.removeEventListener('touchend', handleTouchEnd)
        target.removeEventListener('touchcancel', handleTouchCancel)
      }
    }

    const handleTouchCancel = (ev: TouchEvent) => {
      const changedTouches = ev.changedTouches
      for (let i = 0; i < changedTouches.length; i += 1) {
        handleTapCancel(ev, changedTouches[i]!)
      }
      const target = ev.target as unknown as HTMLElement & { __touchCount?: number }
      target.__touchCount! -= changedTouches.length
      if (target.__touchCount! <= 0) {
        target.__touchCount = 0
        target.removeEventListener('touchend', handleTouchEnd)
        target.removeEventListener('touchcancel', handleTouchCancel)
      }
    }

    const handleMouseDown = (ev: MouseEvent) => {
      if (disableMouseEvents) return
      handleTapStart(ev, {
        identifier: SIMULATED_MOUSE_ID,
        clientX: ev.clientX,
        clientY: ev.clientY,
      })
    }

    const handleMouseOver = (ev: MouseEvent) => {
      if (disableMouseEvents) return
      handleTapMove(ev, {
        identifier: SIMULATED_MOUSE_ID,
        clientX: ev.clientX,
        clientY: ev.clientY,
      })
    }

    const handleMouseUp = (ev: MouseEvent) => {
      if (disableMouseEvents) return
      handleTapEnd(ev, {
        identifier: SIMULATED_MOUSE_ID,
        clientX: ev.clientX,
        clientY: ev.clientY,
      })
    }

    document.body.addEventListener('touchstart', handleTouchStart, { capture: true })
    document.body.addEventListener('touchmove', handleTouchMove, { capture: true })
    document.body.addEventListener('mousedown', handleMouseDown, { capture: true })
    document.body.addEventListener('mousemove', handleMouseOver, { capture: true })
    document.body.addEventListener('mouseup', handleMouseUp, { capture: true })
  }

  setListenerStats(element: Element, type: string, capture: boolean, mutLevel: MutLevel): void {
    // for non-passive events,
    // the default-prevented status can also be found in `EventBubbleStatus` ,
    // so there is nothing to do with non-passive events.
    if (!element) return

    const shouldDelegate = DELEGATE_EVENTS.includes(type)
    const defaultPrevented = mutLevel === MutLevel.Final

    if (shouldDelegate) {
      if (this._$delegatedEventListeners[type]) return
      this._$delegatedEventListeners[type] = true

      document.body.addEventListener(
        type,
        (ev) => {
          if (defaultPrevented) ev.preventDefault()
          this._$trigger(ev, type, this._$getEventDetail(ev), ev.bubbles, ev.composed)
        },
        { capture: true },
      )
      return
    }

    const elementEventListeners = capture
      ? this._$elementCaptureEventListeners
      : this._$elementEventListeners
    if (!elementEventListeners.has(element)) elementEventListeners.set(element, Object.create(null))
    const listeners = elementEventListeners.get(element)!
    if (listeners[type]) return
    listeners[type] = true

    element.addEventListener(type, (ev) => {
      if (this._$triggedEvents.has(ev)) return
      this._$triggedEvents.add(ev)
      if (defaultPrevented) ev.preventDefault()
      this._$trigger(ev, type, this._$getEventDetail(ev), ev.bubbles, ev.composed)
    })
  }

  setModelBindingStat(
    element: Element,
    attributeName: string,
    listener: ((newValue: unknown) => void) | null,
  ): void {
    const updateEventListener = (evName: string, valueFn: () => void) => {
      if (!element._$wxArgs) {
        element._$wxArgs = {
          modelListeners: Object.create(null) as {
            [name: string]: ((newValue: unknown) => void) | null
          },
        }
      }
      if (element._$wxArgs.modelListeners[attributeName] === undefined) {
        if (!listener) return
        element._$wxArgs.modelListeners[attributeName] = listener
        element.addEventListener(evName, () => {
          const listener = element._$wxArgs?.modelListeners[attributeName]
          listener?.(valueFn())
        })
      }
      element._$wxArgs.modelListeners[attributeName] = listener
    }
    const tagName = element.tagName
    let valid = false
    if (tagName === 'INPUT') {
      const elem = element as unknown as HTMLInputElement
      const type = elem.type
      if (type === 'checkbox') {
        if (attributeName === 'checked') {
          valid = true
          updateEventListener('change', () => elem.checked)
        }
      } else if (type === 'radio') {
        if (attributeName === 'checked') {
          valid = true
          updateEventListener('change', () => elem.checked)
        }
      } else {
        if (attributeName === 'value') {
          valid = true
          updateEventListener('input', () => elem.value)
        }
      }
    } else if (tagName === 'TEXTAREA') {
      const elem = element as unknown as HTMLTextAreaElement
      if (attributeName === 'value') {
        valid = true
        updateEventListener('input', () => elem.value)
      }
    } else if (tagName === 'SELECT') {
      const elem = element as unknown as HTMLSelectElement
      if (attributeName === 'value') {
        valid = true
        updateEventListener('change', () => elem.value)
      }
    }
    if (!valid) {
      triggerWarning(
        `unsupported model binding on "${attributeName}" of "${tagName.toLowerCase()}" element.`,
      )
    }
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

  getContext(element: Element, cb: (res: unknown) => void): void {
    cb(element)
  }

  setFocusedNode(target: Element): void {
    ;(target as unknown as HTMLElement).focus()
  }

  getFocusedNode(cb: (node: Element | null) => void): void {
    let node = document.activeElement as Element | null
    while (!node?.__wxElement) {
      node = node?.parentNode || null
    }
    cb(node)
  }

  onWindowResize(
    cb: (res: { width: number; height: number; devicePixelRatio: number }) => void,
  ): void {
    window.addEventListener('resize', () => {
      cb({
        width: this.getWindowWidth(),
        height: this.getWindowHeight(),
        devicePixelRatio: this.getDevicePixelRatio(),
      })
    })
  }

  onThemeChange(cb: (res: { theme: string }) => void): void {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      cb({ theme: this.getTheme() })
    })
  }

  elementFromPoint(left: number, top: number, cb: (node: Element | null) => void): void {
    let node = document.elementFromPoint(left, top) as Element | null
    while (!node?.__wxElement) {
      node = node?.parentNode || null
    }
    cb(node)
  }

  getAllComputedStyle(
    target: Element,
    cb: (computedStyle: { name: string; value: string }[]) => void,
  ): void {
    const style = window.getComputedStyle(target as unknown as HTMLElement)
    const res: { name: string; value: string }[] = []
    for (let i = 0; i < style.length; i += 1) {
      const name = style[i]!
      res.push({ name, value: style.getPropertyValue(name) })
    }
    cb(res)
  }

  getScrollOffset(target: Element, cb: (res: ScrollOffset) => void): void {
    const elem = target as unknown as HTMLElement
    const scrollLeft = elem.scrollLeft
    const scrollTop = elem.scrollTop
    const scrollWidth = elem.scrollWidth
    const scrollHeight = elem.scrollHeight
    cb({ scrollLeft, scrollTop, scrollWidth, scrollHeight })
  }

  setScrollPosition(
    target: Element,
    scrollLeft: number,
    scrollTop: number,
    duration: number,
  ): void {
    if (scrollLeft <= 0 && scrollTop <= 0) {
      ;(target as unknown as HTMLElement).scrollIntoView({
        behavior: duration !== 0 ? 'smooth' : 'auto',
      })
    } else {
      const { left, top } = (target as unknown as HTMLElement).getBoundingClientRect()
      window.scrollTo({
        left: left + scrollLeft,
        top: top + scrollTop,
        behavior: duration !== 0 ? 'smooth' : 'auto',
      })
    }
  }
}
