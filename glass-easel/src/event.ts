import {
  FuncArrWithMeta,
} from './func_arr'
import {
  Element,
  Component,
  GeneralComponent,
  ShadowRoot,
  GeneralBackendElement,
  ExternalShadowRoot,
} from '.'

/**
 * Options for an event
 */
export type EventOptions = {
  originalEvent?: unknown
  bubbles?: boolean
  composed?: boolean
  capturePhase?: boolean
  extraFields?: { [key: string]: unknown }
}

/**
 * Options for an event listener
 */
export type EventListenerOptions = {
  /** Always stop bubbling after this listener */
  final?: boolean
  /** Mark mutated after this listener (ignored if `final` is true) */
  mutated?: boolean
  /** Listen in the capture phase */
  capture?: boolean
  /** The same as `capture` for compatibility */
  useCapture?: boolean
}

/**
 * Event bubbling control
 */
export const enum EventBubbleStatus {
  Normal = 0,
  NoDefault = 1,
}

export type EventListener<TDetail> = (ev: ShadowedEvent<TDetail>) => boolean | void

let relativeTimeStamp = Date.now()
let prevTimeStamp = relativeTimeStamp

const getCurrentTimeStamp = () => {
  const ts = Date.now()
  if (ts < prevTimeStamp) {
    relativeTimeStamp += ts - prevTimeStamp
  }
  prevTimeStamp = ts
  return ts - relativeTimeStamp
}

const enum MutLevel {
  None = 0,
  Mut = 1,
  Final = 2,
}

type EventFuncArr<TDetail> = {
  mutCount: number,
  finalCount: number,
  funcArr: FuncArrWithMeta<EventListener<TDetail>, MutLevel>,
}

export const enum FinalChanged {
  NotChanged = 0,
  Failed,
  Init,
  Added,
  Removed,
}

/** The target of an event */
export class EventTarget<TEvents extends { [type: string]: unknown }> {
  listeners = Object.create(null) as {
    [T in keyof TEvents]: EventFuncArr<TEvents[T]>
  }
  captureListeners: {
    [T in keyof TEvents]: EventFuncArr<TEvents[T]>
  } | null = null

  addListener<T extends string>(
    name: T,
    func: EventListener<TEvents[T]>,
    options: EventListenerOptions = {},
  ): FinalChanged {
    // eslint-disable-next-line no-nested-ternary
    const mutLevel = options.final
      ? MutLevel.Final
      : (options.mutated ? MutLevel.Mut : MutLevel.None)
    let listeners: { [T in keyof TEvents]: EventFuncArr<TEvents[T]> }
    if (options.capture || options.useCapture) {
      if (this.captureListeners) {
        listeners = this.captureListeners
      } else {
        listeners = Object.create(null) as {
          [T in keyof TEvents]: EventFuncArr<TEvents[T]>
        }
        this.captureListeners = listeners
      }
    } else {
      listeners = this.listeners
    }
    let efa: EventFuncArr<TEvents[T]>
    let initialized: boolean
    if (listeners[name]) {
      initialized = true
      efa = listeners[name]!
    } else {
      initialized = false
      efa = listeners[name] = {
        mutCount: 0,
        finalCount: 0,
        funcArr: new FuncArrWithMeta(),
      }
    }
    efa.funcArr.add(func, mutLevel)
    if (mutLevel === MutLevel.Final) efa.finalCount += 1
    else if (mutLevel === MutLevel.Mut) efa.mutCount += 1
    if (initialized) {
      return mutLevel === MutLevel.Final && efa.finalCount === 1
        ? FinalChanged.Added
        : FinalChanged.NotChanged
    }
    return MutLevel.Final ? FinalChanged.Added : FinalChanged.Init
  }

  removeListener<T extends string>(
    name: T,
    func: EventListener<TEvents[T]>,
    options: EventListenerOptions = {},
  ): FinalChanged {
    const listeners = (options.capture || options.useCapture)
      ? this.captureListeners
      : this.listeners
    if (!listeners) return FinalChanged.Failed
    const efa = listeners[name]
    if (!efa) return FinalChanged.Failed
    const mutLevel = efa.funcArr.remove(func)
    if (mutLevel === null) return FinalChanged.Failed
    if (mutLevel === MutLevel.Final) efa.finalCount -= 1
    else if (mutLevel === MutLevel.Mut) efa.mutCount -= 1
    return mutLevel === MutLevel.Final && efa.finalCount === 0
      ? FinalChanged.Removed
      : FinalChanged.NotChanged
  }
}

export type ShadowedEvent<TDetail> = Required<Event<TDetail>> & {
  target: Element
  mark: { [name: string]: unknown } | null
  currentTarget: Element
}

export class Event<TDetail> {
  type: string
  timeStamp: number
  detail: TDetail
  bubbles: boolean
  composed: boolean
  /** @internal */
  private _$capturePhase: boolean
  /** @internal */
  private _$originalEvent: unknown
  /** @internal */
  private _$dispatched: boolean
  /** @internal */
  private _$eventBubblingControl: {
    stopped: boolean
    mutated: boolean
    noDefault: boolean
  }

  constructor(name: string, detail: TDetail, options: EventOptions = {}) {
    const ts = getCurrentTimeStamp()
    this.type = name
    this.timeStamp = ts
    this.detail = detail
    this.bubbles = options.bubbles || false
    this.composed = options.composed || false
    this._$capturePhase = options.capturePhase || false
    this._$eventBubblingControl = {
      stopped: false,
      mutated: false,
      noDefault: false,
    }
    this._$originalEvent = options.originalEvent
    this._$dispatched = false
    if (options.extraFields) {
      Object.assign(this, options.extraFields)
    }
  }

  getEventBubbleStatus(): EventBubbleStatus {
    if (this._$eventBubblingControl.noDefault) return EventBubbleStatus.NoDefault
    return EventBubbleStatus.Normal
  }

  wrapShadowedEvent(
    targetCaller: Element,
    mark: { [name: string]: unknown } | null,
    currentTargetCaller: Element,
  ): ShadowedEvent<TDetail> {
    const ret = Object.create(this) as ShadowedEvent<TDetail>
    ret.target = targetCaller
    ret.mark = mark
    ret.currentTarget = currentTargetCaller
    return ret
  }

  getOriginalEvent(): unknown {
    return this._$originalEvent
  }

  preventDefault() {
    this._$eventBubblingControl.noDefault = true
  }

  defaultPrevented() {
    return this._$eventBubblingControl.noDefault
  }

  stopPropagation() {
    this._$eventBubblingControl.stopped = true
  }

  propagationStopped() {
    return this._$eventBubblingControl.stopped
  }

  markMutated() {
    this._$eventBubblingControl.mutated = true
  }

  mutatedMarked() {
    return this._$eventBubblingControl.mutated
  }

  dispatch(target: Element, externalTarget?: GeneralBackendElement) {
    if (this._$dispatched) {
      throw new Error('Event cannot be dispatched twice')
    }
    this._$dispatched = true
    const evName = this.type
    const crossShadow = this.composed
    const bubbles = this.bubbles
    const inExternalOnly = externalTarget && !crossShadow
    const eventBubblingControl = this._$eventBubblingControl

    // calls listeners on a single element
    const callEventFuncArr = (
      targetCaller: Element,
      mark: Record<string, unknown> | null,
      cur: Element,
      isCapture: boolean,
    ) => {
      const eventTarget = cur._$eventTarget
      if (!eventTarget) return
      const listeners = isCapture ? eventTarget.captureListeners : eventTarget.listeners
      if (!listeners) return
      const efa = listeners[evName]
      if (!efa) return
      const skipMut = this.mutatedMarked()
      const isComp = cur instanceof Component
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const curCaller = isComp ? cur.getMethodCaller() : cur
      const ev = this.wrapShadowedEvent(targetCaller, mark, curCaller)
      const ret = efa.funcArr.call(
        curCaller,
        [ev],
        (mulLevel) => !skipMut || mulLevel !== MutLevel.Mut,
        isComp ? cur as GeneralComponent : undefined,
      )
      if (ret === false || efa.finalCount > 0) {
        ev.stopPropagation()
        ev.preventDefault()
      } else if (efa.mutCount > 0) {
        ev.markMutated()
      }
    }

    const forEachBubblePath = (
      target: Element,
      f: (target: Element, targetCaller: Element, mark: Record<string, unknown>) => boolean | void,
    ) => {
      const recShadow = (target: Element): Element | null => {
        let cur = target
        const targetCaller = target instanceof Component
          ? target.getMethodCaller() as Element
          : target
        const mark = target.collectMarks()
        for (;;) {
          if (f(cur, targetCaller, mark) === false) return null
          let next
          if (crossShadow) {
            if (cur instanceof ShadowRoot) return cur.getHostNode()
            next = cur.parentNode
            while (next?._$inheritSlots) {
              next = next.parentNode
            }
            if (next instanceof Component && !next._$external) {
              const slot = (next.shadowRoot as ShadowRoot).getContainingSlot(cur)
              if (!slot) return null
              next = recShadow(slot)
            }
          } else {
            next = cur.parentNode
          }
          if (!next) return null
          cur = next
        }
      }
      let cur = target
      for (;;) {
        const next = recShadow(cur)
        if (!next) break
        cur = next
      }
    }

    // capture phase
    if (this._$capturePhase && !eventBubblingControl.stopped && !inExternalOnly) {
      const bubblingPath: [Element, Element, Record<string, unknown>][] = []
      forEachBubblePath(target, (target, targetCaller, mark) => {
        bubblingPath.push([target, targetCaller, mark])
      })
      for (let i = bubblingPath.length - 1; i >= 0; i -= 1) {
        const [cur, targetCaller, mark] = bubblingPath[i]!
        if (cur._$eventTarget) {
          callEventFuncArr(targetCaller, mark, cur, true)
          if (eventBubblingControl.stopped) break
        }
      }
    }

    // bubble phase in external component
    if (!eventBubblingControl.stopped && externalTarget) {
      if (target instanceof Component && target._$external) {
        (target.shadowRoot as ExternalShadowRoot).handleEvent(externalTarget, this)
      }
    }

    // bubble phase
    if (!eventBubblingControl.stopped && !inExternalOnly) {
      let atTarget = true
      forEachBubblePath(target, (target, targetCaller, mark) => {
        if (!atTarget && target instanceof Component && target._$external) {
          const sr = target.shadowRoot as ExternalShadowRoot
          sr.handleEvent(sr.slot, this)
        }
        atTarget = false
        if (target._$eventTarget) {
          callEventFuncArr(targetCaller, mark, target, false)
        }
        return bubbles && !eventBubblingControl.stopped
      })
    }
  }

  static dispatchEvent<TDetail>(target: Element, event: Event<TDetail>) {
    return event.dispatch(target)
  }

  static dispatchExternalEvent<TDetail>(
    component: GeneralComponent,
    target: GeneralBackendElement,
    event: Event<TDetail>,
  ) {
    return event.dispatch(component, target)
  }

  static triggerEvent<TDetail>(
    this: void,
    target: Element,
    name: string,
    detail: TDetail,
    options?: EventOptions,
  ) {
    const ev = new Event(name, detail, options)
    Event.dispatchEvent(target, ev)
  }

  static triggerExternalEvent<TDetail>(
    this: void,
    component: GeneralComponent,
    target: GeneralBackendElement,
    name: string,
    detail: TDetail,
    options?: EventOptions,
  ) {
    const ev = new Event(name, detail, options)
    Event.dispatchExternalEvent(component, target, ev)
  }
}
