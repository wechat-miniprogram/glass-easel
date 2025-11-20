import * as glassEasel from 'glass-easel'
import { type GeneralComponent } from './component'

export class ResizeObserver {
  private _$comp: GeneralComponent
  private _$observeAll: boolean
  private _$mode = glassEasel.backend.ResizeObserverMode.ContentBox
  private _$observers: glassEasel.backend.Observer[] = []

  /** @internal */
  constructor(comp: GeneralComponent, observeAll: boolean) {
    this._$comp = comp
    this._$observeAll = observeAll
  }

  contentBox(): this {
    this._$mode = glassEasel.backend.ResizeObserverMode.ContentBox
    return this
  }

  borderBox(): this {
    this._$mode = glassEasel.backend.ResizeObserverMode.BorderBox
    return this
  }

  observe(targetSelector: string, listener: (status: glassEasel.backend.ResizeStatus) => void) {
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
    targets.forEach((target) => {
      const observer = target.createResizeObserver(this._$mode, listener)
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
