import type * as glassEasel from 'glass-easel'
import { type GeneralComponent } from './component'

export type IntersectionObserverMargins = {
  left?: number
  top?: number
  right?: number
  bottom?: number
}

/**
 * The intersection status passed to the listener of `IntersectionObserver.observe` .
 *
 * Besides the backend intersection status fields, it contains `id` , `dataset`
 * and `relativeRect` required by the mini program API.
 */
export type IntersectionStatus = glassEasel.backend.IntersectionStatus & {
  /** The ID of the observed node */
  id: string
  /** The dataset of the observed node */
  dataset: Record<string, any>
  /** The layout of the relative node, a.k.a. the root bounds */
  relativeRect: glassEasel.backend.BoundingClientRect
}

const normalizeMarginRect = (margins: IntersectionObserverMargins) => ({
  left: margins.left || 0,
  top: margins.top || 0,
  right: margins.right || 0,
  bottom: margins.bottom || 0,
})

const defaultMargins = {
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
}

/**
 * Filter out invalid thresholds and sort them in ascending order.
 *
 * The thresholds must be sorted for `getThresholdGreaterThan` to work.
 */
const processThresholds = (thresholds: number[]): number[] => {
  if (!Array.isArray(thresholds)) return [0]
  const valid = thresholds
    .filter((threshold) => 0 <= threshold && threshold <= 1)
    .sort((a, b) => a - b)
  return valid.length > 0 ? valid : [0]
}

/**
 * Search for the number of thresholds that are not greater than `ratio` .
 *
 * This is copied from the native-mode intersection observer implementation of
 * the mini program base library, so that the behavior of the `initialRatio`
 * option is aligned with the mini program.
 */
const getThresholdGreaterThan = (thresholds: readonly number[], ratio: number): number => {
  const thresholdsLen = thresholds.length

  let l = 0
  let r = thresholdsLen
  let m: number

  while (l !== r) {
    // eslint-disable-next-line no-bitwise
    m = (l + r) >> 1
    if (thresholds[m]! <= ratio) {
      l = m + 1
    } else {
      r = m
    }
  }

  return l
}

export class IntersectionObserver {
  private _$comp: GeneralComponent
  private _$thresholds: number[]
  private _$initialRatio: number
  private _$observeAll: boolean
  private _$selector: string | null = null
  private _$margins: IntersectionObserverMargins | null = null
  private _$observers: glassEasel.backend.Observer[] = []

  /** @internal */
  constructor(
    comp: GeneralComponent,
    thresholds: number[],
    initialRatio: number,
    observeAll: boolean,
  ) {
    this._$comp = comp
    this._$thresholds = processThresholds(thresholds)
    // `initialRatio === 0` historically stands for "not intersecting" in the mini
    // program, so it is converted to -1 (which is not a valid ratio) as the initial
    // state
    this._$initialRatio = initialRatio === 0 ? -1 : initialRatio
    this._$observeAll = observeAll
  }

  relativeTo(selector: string, margins?: IntersectionObserverMargins): this {
    this._$selector = selector
    this._$margins = margins ?? defaultMargins
    return this
  }

  relativeToViewport(margins?: IntersectionObserverMargins): this {
    this._$selector = null
    this._$margins = margins ?? defaultMargins
    return this
  }

  observe(targetSelector: string, listener: (status: IntersectionStatus) => void) {
    const shadowRoot = this._$comp._$.getShadowRoot()
    let targets: glassEasel.Element[]
    if (!shadowRoot) {
      targets = []
    } else if (this._$observeAll) {
      targets = shadowRoot.querySelectorAll(targetSelector)
    } else {
      const elem = shadowRoot.querySelector(targetSelector)
      if (elem === null) {
        targets = []
      } else {
        targets = [elem]
      }
    }
    let relativeElement: glassEasel.Element | null
    if (this._$selector === null || !shadowRoot) {
      relativeElement = null
    } else {
      const rel = shadowRoot.querySelector(this._$selector)
      if (rel === null) {
        // TODO warn no matched relative element
      } else {
        relativeElement = rel
      }
    }
    if (!this._$margins) {
      throw new Error('`relativeTo` or `relativeToViewport` should be called before observe')
    }
    const { left, top, right, bottom } = normalizeMarginRect(this._$margins)
    const margin = `${top}px ${right}px ${bottom}px ${left}px`
    targets.forEach((target) => {
      // The threshold slot the `initialRatio` falls into. The first status is
      // suppressed if it falls into the same threshold slot as the initial ratio;
      // afterwards the statuses are passed through as-is.
      let initialThreshold: number | null = getThresholdGreaterThan(
        this._$thresholds,
        this._$initialRatio,
      )
      const observer = target.createIntersectionObserver(
        relativeElement,
        margin,
        this._$thresholds,
        (args) => {
          const isIntersecting = args.isIntersecting ?? args.intersectionRatio > 0
          if (initialThreshold !== null) {
            const thresholdIndex = getThresholdGreaterThan(
              this._$thresholds,
              isIntersecting ? args.intersectionRatio : -1,
            )
            const initial = initialThreshold
            initialThreshold = null
            if (thresholdIndex === initial) return
          }
          listener({
            id: target.id,
            dataset: target.dataset || {},
            time: Date.now(),
            boundingClientRect: args.boundingClientRect,
            intersectionRatio: args.intersectionRatio,
            intersectionRect: args.intersectionRect,
            relativeRect: args.rootBounds!,
            rootBounds: args.rootBounds,
            isIntersecting,
          })
        },
      )
      if (observer === null) {
        // TODO warn no observer attached
      } else {
        this._$observers.push(observer)
      }
    })
  }

  disconnect() {
    const observers = this._$observers
    this._$observers = []
    observers.forEach((observer) => observer.disconnect())
  }
}
