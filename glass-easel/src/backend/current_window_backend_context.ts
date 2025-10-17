/* eslint-disable class-methods-use-this */
/* global window, document */

import { type Element as GlassEaselElement } from '../element'
import { type Node as GlassEaselNode } from '../node'
import { EventBubbleStatus, MutLevel, type EventOptions } from '../event'
import { safeCallback } from '../func_arr'
import { triggerWarning } from '../warning'
import { type Context, type Element } from './domlike_backend_protocol'
import {
  BackendMode,
  type IntersectionStatus,
  type MediaQueryStatus,
  type Observer,
} from './shared'
import type * as shared from './shared'

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
  'mouseenter',
  'mouseleave',
  'click',
]

const ALL_PSEUDO_TYPES = ['before', 'after']

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

  protected _$initEvent() {
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

    element.addEventListener(
      type,
      (ev) => {
        if (this._$triggedEvents.has(ev)) return
        this._$triggedEvents.add(ev)
        if (defaultPrevented) ev.preventDefault()
        this._$trigger(ev, type, this._$getEventDetail(ev), ev.bubbles, ev.composed)
      },
      { capture },
    )
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

  getFocusedNode(cb: (node: GlassEaselNode | null) => void): void {
    let node = document.activeElement as Element | null
    while (!node?.__wxElement) {
      node = node?.parentNode || null
    }
    cb(node?.__wxElement ?? null)
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

  elementFromPoint(left: number, top: number, cb: (node: GlassEaselElement | null) => void): void {
    let node = document.elementFromPoint(left, top) as Element | null
    while (node !== null && !node.__wxElement) {
      node = node?.parentNode || null
    }
    cb(node?.__wxElement ?? null)
  }

  getAllComputedStyles(
    target: Element,
    cb: (computedStyle: { properties: { name: string; value: string }[] }) => void,
  ): void {
    const style = window.getComputedStyle(target as unknown as HTMLElement)
    const properties = collectStyleSheetProperties(style)
    cb({ properties })
  }

  getPseudoComputedStyles(
    target: Element,
    pseudoType: string,
    cb: (res: shared.GetAllComputedStylesResponses) => void,
  ): void {
    const style = window.getComputedStyle(target as unknown as HTMLElement, `::${pseudoType}`)
    const properties = collectStyleSheetProperties(style)
    cb({ properties })
  }

  getBoxModel(
    target: Element,
    cb: (res: {
      margin: shared.BoundingClientRect
      border: shared.BoundingClientRect
      padding: shared.BoundingClientRect
      content: shared.BoundingClientRect
    }) => void,
  ): void {
    const rect = (target as unknown as HTMLElement).getBoundingClientRect()
    const computed = window.getComputedStyle(target as unknown as HTMLElement)

    const marginLeft = parseFloat(computed.marginLeft)
    const marginTop = parseFloat(computed.marginTop)
    const marginRight = parseFloat(computed.marginRight)
    const marginBottom = parseFloat(computed.marginBottom)

    const borderLeft = parseFloat(computed.borderLeftWidth)
    const borderTop = parseFloat(computed.borderTopWidth)
    const borderRight = parseFloat(computed.borderRightWidth)
    const borderBottom = parseFloat(computed.borderBottomWidth)

    const paddingLeft = parseFloat(computed.paddingLeft)
    const paddingTop = parseFloat(computed.paddingTop)
    const paddingRight = parseFloat(computed.paddingRight)
    const paddingBottom = parseFloat(computed.paddingBottom)

    const border = rect
    const margin = {
      left: border.left - marginLeft,
      top: border.top - marginTop,
      width: border.width + marginRight + marginLeft,
      height: border.height + marginTop + marginBottom,
    }
    const padding = {
      left: border.left + borderLeft,
      top: border.top + borderTop,
      width: border.width - borderRight - borderLeft,
      height: border.height - borderTop - borderBottom,
    }
    const content = {
      left: padding.left + paddingLeft,
      top: padding.top + paddingTop,
      width: padding.width - paddingRight - paddingLeft,
      height: padding.height - paddingTop - paddingBottom,
    }
    cb({ margin, border, padding, content })
  }

  getPseudoTypes(target: Element, cb: (res: string[]) => void): void {
    const ret: string[] = []
    const htmlElement = target as unknown as HTMLElement
    ALL_PSEUDO_TYPES.forEach((pseudoType) => {
      const pseudoClass = `::${pseudoType}`
      const pseudoStyle = window.getComputedStyle(htmlElement, pseudoClass)
      const pseudoExists =
        pseudoStyle.getPropertyValue('content') !== 'none' &&
        pseudoStyle.getPropertyValue('display') !== 'none' &&
        pseudoStyle.getPropertyValue('visibility') !== 'hidden'
      if (!pseudoExists) return
      ret.push(pseudoType)
    })
    cb(ret)
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

  private queryMatchedRules(
    sheetIndex: number,
    sheet: CSSStyleSheet,
    elem: HTMLElement,
    pseudoType?: string,
  ): shared.CSSRule[] {
    const rules: shared.CSSRule[] = []
    const pseudoRegexp = pseudoType ? new RegExp(`:{1,2}${pseudoType}$`) : null
    forEachStyleSheetRule(sheet, (ruleIndex, cssRule, ancestors) => {
      if (cssRule instanceof CSSStyleRule) {
        const mediaQueries: string[] = []
        for (let i = 0; i < ancestors.length; i += 1) {
          const cssRule = ancestors[i]!
          if (cssRule instanceof CSSMediaRule) {
            if (!matchMedia(cssRule.conditionText).matches) {
              return
            }
            mediaQueries.push(`@media ${cssRule.conditionText}`)
          } else if (
            typeof CSSLayerBlockRule !== 'undefined' &&
            cssRule instanceof CSSLayerBlockRule
          ) {
            mediaQueries.push(`@layer ${cssRule.name}`)
          }
        }
        const selector = cssRule.selectorText
        let selectorMatches = false
        const selectors = splitCSSSelectors(selector).map((selector) => {
          const matches = pseudoRegexp
            ? pseudoRegexp.test(selector) && elem.matches(selector.replace(pseudoRegexp, ''))
            : elem.matches(selector)
          selectorMatches ||= matches
          return {
            text: selector,
            matches,
          }
        })
        if (!selectorMatches) return
        const propertyText = cssRule.style.cssText
        const properties = collectStyleSheetProperties(cssRule.style)
        rules.push({
          sheetIndex,
          ruleIndex,
          inlineText: cssRule.cssText,
          mediaQueries,
          selector,
          selectors,
          properties,
          propertyText,
          weightHighBits: 0, // FIXME infer priority values
        })
      }
    })
    return rules
  }

  getMatchedRules(target: Element, cb: (res: shared.GetMatchedRulesResponses) => void): void {
    const elem = target as unknown as HTMLElement
    const sheets = document.styleSheets
    const rules: shared.CSSRule[] = []
    for (let i = 0; i < sheets.length; i += 1) {
      const sheet = sheets[i]!
      rules.push(...this.queryMatchedRules(i, sheet, elem))
    }
    const inlineText = elem.style.cssText
    const inline = collectStyleSheetProperties(elem.style)
    cb({ inline, inlineText, rules })
  }

  getPseudoMatchedRules(
    target: Element,
    pseudoType: string,
    cb: (res: shared.GetMatchedRulesResponses) => void,
  ): void {
    const elem = target as unknown as HTMLElement
    const sheets = document.styleSheets
    const rules: shared.CSSRule[] = []
    for (let i = 0; i < sheets.length; i += 1) {
      const sheet = sheets[i]!
      rules.push(...this.queryMatchedRules(i, sheet, elem, pseudoType))
    }
    cb({ inline: [], rules })
  }

  private iframe: HTMLIFrameElement | null = null

  private getIframe(): HTMLIFrameElement {
    if (!this.iframe) {
      this.iframe = document.createElement('iframe')
      this.iframe.style.display = 'none'
      document.body.appendChild(this.iframe)
    }
    return this.iframe
  }

  private getDefaultComputedStyles(target: Element): Record<string, string> {
    const iframeWindow = this.getIframe().contentWindow!
    const iframeDocument = iframeWindow.document
    const ele = iframeDocument.createElement(target.tagName)
    iframeDocument.body.appendChild(ele)
    const computed = iframeWindow.getComputedStyle(ele)
    const styles: Record<string, string> = {}
    for (let i = 0; i < computed.length; i += 1) {
      const name = computed[i]!
      styles[name] = computed.getPropertyValue(name)
    }
    ele.remove()
    return styles
  }

  private getModifiedComputedStyles(target: Element): Record<string, string> {
    const defaultStyles = this.getDefaultComputedStyles(target)
    const computedStyles = window.getComputedStyle(target as unknown as HTMLElement)
    const styles: Record<string, string> = {}
    for (let i = 0; i < computedStyles.length; i += 1) {
      const prop = computedStyles[i]!
      if (['blockSize'].includes(prop)) continue
      if (computedStyles.getPropertyValue(prop) !== defaultStyles[prop]) {
        styles[prop] = computedStyles.getPropertyValue(prop)
      }
    }
    return styles
  }

  getInheritedRules(target: Element, cb: (res: shared.GetInheritedRulesResponses) => void): void {
    const computed = this.getModifiedComputedStyles(target)
    const documentElement = window.document.documentElement
    const ret: shared.CSSRule[][] = []
    for (
      let currEle = target.parentNode;
      currEle && (currEle as any) !== documentElement;
      currEle = currEle.parentNode
    ) {
      const matchedRules: shared.CSSRule[] = []
      let matched!: shared.CSSRule[]
      this.getMatchedRules(currEle, ({ rules }) => {
        matched = rules
      })
      for (let i = 0; i < matched.length; i += 1) {
        const rule = matched[i]!
        const containsComputedName = rule.properties.some((property) => {
          const computedName = property.name.replace(/-(.|$)/g, (s) =>
            s[1] ? s[1].toUpperCase() : '',
          )
          return computedName in computed
        })
        if (containsComputedName) {
          matchedRules.push(rule)
        }
      }
      if (matchedRules.length) ret.push(matchedRules)
    }
    cb({ rules: ret })
  }

  private findStyleRule(sheetIndex: number, ruleIndex: number): CSSStyleRule | null {
    const sheets = document.styleSheets
    const sheet = sheets[sheetIndex]
    const rule = sheet?.cssRules[ruleIndex]
    if (rule?.constructor.name === 'CSSStyleRule') {
      return rule as CSSStyleRule
    }
    return null
  }

  replaceStyleSheetAllProperties(
    sheetIndex: number,
    ruleIndex: number,
    inlineStyle: string,
    cb: (propertyIndex: number | null) => void,
  ) {
    const rule = this.findStyleRule(sheetIndex, ruleIndex)
    if (!rule) {
      cb(null)
      return
    }
    rule.style.cssText = inlineStyle
    cb(0)
  }

  private _stopOverlayInspectHandler: (() => void) | null = null

  startOverlayInspect(cb: (event: string, node: GlassEaselElement | null) => void): void {
    if (this._stopOverlayInspectHandler) return
    const originalPointerEvents = window.document.body.style.pointerEvents
    window.document.body.style.pointerEvents = 'none'

    const handleClick = (e: MouseEvent) => {
      e.preventDefault()
      const { x, y } = e
      window.document.body.style.pointerEvents = originalPointerEvents
      this.elementFromPoint(x, y, (node) => {
        if (!this._stopOverlayInspectHandler) return
        window.document.body.style.pointerEvents = 'none'
        cb('tap', node)
      })
    }

    const handleMouseMove = debounce((e: MouseEvent) => {
      if (e.type === 'mouseout') {
        cb('mouseout', null)
      } else if (e.type === 'mousemove') {
        const { x, y } = e
        window.document.body.style.pointerEvents = originalPointerEvents
        this.elementFromPoint(x, y, (node) => {
          if (!this._stopOverlayInspectHandler) return
          window.document.body.style.pointerEvents = 'none'
          cb('mouseover', node)
        })
      }
    }, 100)

    window.addEventListener('click', handleClick)
    window.addEventListener('mousemove', handleMouseMove, {
      passive: true,
      capture: true,
    })
    window.addEventListener('mouseout', handleMouseMove, {
      passive: true,
      capture: true,
    })

    this._stopOverlayInspectHandler = () => {
      window.document.body.style.pointerEvents = originalPointerEvents
      window.removeEventListener('click', handleClick)
      window.removeEventListener('mousemove', handleMouseMove, { capture: true })
      window.removeEventListener('mouseout', handleMouseMove, { capture: true })
    }
  }

  stopOverlayInspect(): void {
    if (!this._stopOverlayInspectHandler) return
    this._stopOverlayInspectHandler()
    this._stopOverlayInspectHandler = null
  }
}

const debounce = <Func extends (...args: any[]) => void>(func: Func, wait: number): Func => {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return ((...args: Parameters<Func>) => {
    if (timeout !== null) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      timeout = null
      func(...args)
    }, wait)
  }) as Func
}

const collectStyleSheetProperties = (style: CSSStyleDeclaration) => {
  const properties: shared.CSSProperty[] = []
  for (let i = 0; i < style.length; i += 1) {
    const name = style[i]!
    const important = style.getPropertyPriority(name) === 'important'
    const value = style.getPropertyValue(name)
    properties.push({ name, value, important })
  }
  return properties
}

const forEachStyleSheetRule = (
  sheet: CSSStyleSheet,
  f: (ruleIndex: number, cssRule: CSSRule, ancestors: CSSGroupingRule[]) => void,
) => {
  let ruleIndex = 0
  const ancestors: CSSGroupingRule[] = []
  const rec = (rules: CSSRuleList) => {
    for (let i = 0; i < rules.length; i += 1) {
      const cssRule = rules[i]!
      if (
        cssRule instanceof CSSConditionRule ||
        (typeof CSSLayerBlockRule !== 'undefined' && cssRule instanceof CSSLayerBlockRule)
      ) {
        ancestors.push(cssRule)
        rec(cssRule.cssRules)
        ancestors.pop()
      } else {
        f(ruleIndex, cssRule, ancestors)
        ruleIndex += 1
      }
    }
  }
  rec(sheet.cssRules)
}

function splitCSSSelectors(selectorText: string) {
  let currentSelector = ''
  const selectors = []
  let depth = 0
  let inString: false | string = false
  let escapeNext = false
  let inComment = false

  for (let i = 0; i < selectorText.length; i += 1) {
    const char = selectorText[i]!

    if (escapeNext) {
      currentSelector += char
      escapeNext = false
      continue
    }

    if (inComment) {
      if (char === '*' && i < selectorText.length - 1 && selectorText[i + 1] === '/') {
        inComment = false
        i += 1
      }
      continue
    }

    if (inString) {
      if (char === '\\') {
        escapeNext = true
      } else if (char === inString) {
        inString = false
      }
      currentSelector += char
      continue
    }

    switch (char) {
      case '/':
        if (selectorText[i + 1] === '*') {
          inComment = true
          i += 1
          break
        }
        currentSelector += char
        break
      case '\\':
        escapeNext = true
        currentSelector += char
        break
      case '"':
      case "'":
        inString = char
        currentSelector += char
        break
      case '(':
      case '[':
      case '{':
        depth += 1
        currentSelector += char
        break
      case ')':
      case ']':
      case '}':
        if (depth > 0) depth -= 1
        currentSelector += char
        break
      case ',':
        if (depth === 0) {
          selectors.push(currentSelector.trim())
          currentSelector = ''
        } else {
          currentSelector += char
        }
        break
      default:
        currentSelector += char
    }
  }

  if (currentSelector.trim()) selectors.push(currentSelector.trim())
  return selectors
}
