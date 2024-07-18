import { type Element as GlassEaselElement } from '../element'
import {
  type BoundingClientRect,
  type GetAllComputedStylesResponses,
  type GetMatchedRulesResponses,
  type ScrollOffset,
  type IntersectionStatus,
  type MediaQueryStatus,
  type Observer,
} from './shared'

interface GetWrapper<T> {
  get(): T
}

export type Element<E> = {
  getAllComputedStyles(cb: (res: GetAllComputedStylesResponses) => void): void
  getBoundingClientRect(cb: (res: BoundingClientRect) => void): void
  createIntersectionObserver(
    relativeElement: E | null,
    relativeElementMargin: string,
    thresholds: number[],
    listener: (res: IntersectionStatus) => void,
  ): Observer
  getMatchedRules(cb: (res: GetMatchedRulesResponses) => void): void
  getScrollOffset(cb: (res: ScrollOffset) => void): void
  setScrollPosition(scrollLeft: number, scrollTop: number, duration: number): void
  getContext(cb: (res: unknown) => void): void
}

export type ElementForDomLike = {
  getBoundingClientRect(): BoundingClientRect
  readonly scrollLeft: number
  readonly scrollTop: number
  readonly scrollWidth: number
  readonly scrollHeight: number
}

export interface Context<Ctx, Elem> {
  createContext(
    options: unknown,
    cb: (ContextWrapper: GetWrapper<Partial<Context<Ctx, Elem> & Ctx>>) => void,
  ): void

  setFocusedNode(target: Elem): void
  getFocusedNode(cb: (node: Elem | null) => void): void

  onWindowResize(
    cb: (res: { width: number; height: number; devicePixelRatio: number }) => void,
  ): void
  onThemeChange(cb: (res: { theme: string }) => void): void

  elementFromPoint(left: number, top: number, cb: (node: GlassEaselElement | null) => void): void

  createMediaQueryObserver(
    status: MediaQueryStatus,
    listener: (res: { matches: boolean }) => void,
  ): Observer

  // StyleSheet related
  addStyleSheetRule(
    mediaQueryStr: string,
    selector: string,
    callback: (ruleIndex: number | null) => void,
  ): void
  getStyleSheetIndexForNewRules(callback: (sheetIndex: number) => void): void
  resetStyleSheetRule(
    sheetIndex: number,
    ruleIndex: number,
    callback: (ruleIndex: number | null) => void,
  ): void
  modifyStyleSheetRuleSelector(
    sheetIndex: number,
    ruleIndex: number,
    selector: string,
    callback: (ruleIndex: number | null) => void,
  ): void
  addStyleSheetProperty(
    sheetIndex: number,
    ruleIndex: number,
    inlineStyle: string,
    callback: (propertyIndex: number | null) => void,
  ): void
  replaceStyleSheetAllProperties(
    sheetIndex: number,
    ruleIndex: number,
    inlineStyle: string,
    callback: (propertyIndex: number | null) => void,
  ): void
  setStyleSheetPropertyDisabled(
    sheetIndex: number,
    ruleIndex: number,
    propertyIndex: number,
    disabled: boolean,
    callback: (propertyIndex: number | null) => void,
  ): void
  removeStyleSheetProperty(
    sheetIndex: number,
    ruleIndex: number,
    propertyIndex: number,
    callback: (propertyIndex: number | null) => void,
  ): void
  replaceStyleSheetProperty(
    sheetIndex: number,
    ruleIndex: number,
    propertyIndex: number,
    inlineStyle: string,
    callback: (propertyIndex: number | null) => void,
  ): void
  performanceTraceStart(): number
  performanceTraceEnd(
    id: number,
    cb: (stats: { startTimestamp: number; endTimestamp: number }) => void,
  ): void
}

type UnshiftTarget<Fn, T> = Fn extends (...args: infer Args) => infer Ret
  ? (target: T, ...args: Args) => Ret
  : never

type UnshiftTargets<T, E> = { [K in keyof T]: UnshiftTarget<T[K], E> }

export type ContextForDomLike<Ctx, Elem> = Context<Ctx, Elem> &
  UnshiftTargets<
    Pick<
      Element<Elem>,
      | 'getAllComputedStyles'
      | 'createIntersectionObserver'
      | 'getMatchedRules'
      | 'getScrollOffset'
      | 'setScrollPosition'
      | 'getContext'
    >,
    Elem
  >
