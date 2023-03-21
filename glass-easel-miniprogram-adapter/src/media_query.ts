import * as glassEasel from 'glass-easel'
import { GeneralComponent } from './component'

export class MediaQueryObserver {
  private _$comp: GeneralComponent
  private _$observer: glassEasel.backend.Observer | null = null

  /** @internal */
  constructor(comp: GeneralComponent) {
    this._$comp = comp
  }

  observe(
    descriptor: glassEasel.backend.MediaQueryStatus,
    listener: (status: { matches: boolean }) => void,
  ) {
    if (this._$observer) this._$observer.disconnect()
    this._$observer = this._$comp._$.getBackendContext().createMediaQueryObserver(
      descriptor,
      listener,
    )
  }

  disconnect() {
    if (this._$observer) this._$observer.disconnect()
    this._$observer = null
  }
}
