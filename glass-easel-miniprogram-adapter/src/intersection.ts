import type * as glassEasel from 'glass-easel'
import { type GeneralComponent } from './component'

export type IntersectionObserverMargins = {
  left?: number
  top?: number
  right?: number
  bottom?: number
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
    this._$thresholds = thresholds
    this._$initialRatio = initialRatio
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

  observe(
    targetSelector: string,
    listener: (status: glassEasel.backend.IntersectionStatus) => void,
  ) {
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
      let initial: number | null = this._$initialRatio
      const observer = target.createIntersectionObserver(
        relativeElement,
        margin,
        this._$thresholds,
        (args) => {
          if (initial !== null) {
            let i = 0
            for (; i < this._$thresholds.length; i += 1) {
              const threshold = this._$thresholds[i]!
              if (initial === args.intersectionRatio) continue
              if ((initial - threshold) * (args.intersectionRatio - threshold) <= 0) break
            }
            initial = null
            if (i < this._$thresholds.length) return
          }
          listener(args)
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
