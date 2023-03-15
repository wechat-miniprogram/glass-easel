import { GeneralBackendContext, Node } from '../node'
import {
  BoundingClientRect,
  GetAllComputedStylesResponese,
  GetMatchedRulesResponese,
  ScrollOffset,
} from './mode'

interface GetWrapper<T> {
  get(): T
}

export interface Element {
  getAllComputedStyles(cb: (res: GetAllComputedStylesResponese) => void): void
  getBoundingClientRect(cb: (res: BoundingClientRect) => void): void
  getMatchedRules(cb: (res: GetMatchedRulesResponese) => void): void
  replaceStyleSheetInlineStyle(inlineStyle: string): void
  getScrollOffset(cb: (res: ScrollOffset) => void): void
  setScrollPosition(scrollLeft: number, scrollTop: number, duration: number): void
}

export interface Context {
  createContext(
    options: unknown,
    cb: (ContextWrapper: GetWrapper<Partial<Context> & GeneralBackendContext>) => void,
  ): void

  setFocusedNode(target: Node): void
  getFocusedNode(): Node | undefined

  elementFromPoint(left: number, top: number, cb: (node: Node) => void): void

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
}
