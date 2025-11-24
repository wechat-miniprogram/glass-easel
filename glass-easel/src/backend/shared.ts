export const BM = {
  DYNAMIC: true,
  SHADOW: false,
  COMPOSED: false,
  DOMLIKE: false,
}

export const enum BackendMode {
  Shadow = 1,
  Composed = 2,
  Domlike = 3,
}

export type BoundingClientRect = {
  left: number
  top: number
  width: number
  height: number
}

export type ScrollOffset = {
  scrollLeft: number
  scrollTop: number
  scrollWidth: number
  scrollHeight: number
}

export type CSSProperty = {
  name: string
  value: string
  disabled?: boolean
  invalid?: boolean
  important?: boolean
}
export type CSSRule = {
  sheetIndex: number
  ruleIndex: number
  inlineText: string
  mediaQueries: string[]
  selector: string
  selectors: {
    text: string
    matches: boolean
  }[]
  properties: CSSProperty[]
  filename?: string
  startLine?: number
  startColumn?: number
  propertyText?: string
  weightHighBits?: number // the priority value of the layer level (0 by default)
  weightLowBits?: number // the priority value of the selector level (calculated from selector by default)
  inactive?: boolean
  styleScope?: string | number
}

export type GetMatchedRulesResponses = {
  inline: CSSProperty[]
  inlineText?: string
  rules: CSSRule[]
}

export type GetInheritedRulesResponses = {
  rules: CSSRule[][]
}

export type GetAllComputedStylesResponses = {
  properties: { name: string; value: string }[]
}

export interface Observer {
  disconnect(): void
}

export type IntersectionStatus = {
  intersectionRatio: number
  boundingClientRect: BoundingClientRect
  intersectionRect: BoundingClientRect
  relativeRect: BoundingClientRect
  time: number
}

export const enum ResizeObserverMode {
  ContentBox = 1,
  BorderBox = 2,
}

export type ResizeStatus = {
  boundingContentBoxWidth: number
  boundingContentBoxHeight: number
  boundingBorderBoxWidth: number
  boundingBorderBoxHeight: number
}

export type MediaQueryStatus = {
  minWidth?: number
  maxWidth?: number
  width?: number
  minHeight?: number
  maxHeight?: number
  height?: number
  orientation?: string
}
