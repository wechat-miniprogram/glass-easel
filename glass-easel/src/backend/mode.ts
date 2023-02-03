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
  disabled: boolean
  invalid: boolean
}
export type CSSRule = {
  sheetIndex: number
  ruleIndex: number
  mediaQueries: string[]
  selector: string
  properties: CSSProperty[]
  weightHighBits: number
  weightLowBits: number
}

export type GetMatchedRulesResponese = {
  inline: CSSProperty[]
  rules: CSSRule[]
}

export type GetAllComputedStylesResponese = {
  properties: CSSProperty[]
}
