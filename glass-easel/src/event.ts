import { type GeneralBackendElement } from './backend'
import { type GeneralComponent } from './component'
import { addTimelineEvent, performanceMeasureEnd, performanceMeasureStart } from './dev_tools'
import { type Element } from './element'
import { type ExternalShadowRoot } from './external_shadow_tree'
import { FuncArrWithMeta } from './func_arr'
import { ENV } from './global_options'
import { isComponent, isShadowRoot } from './type_symbol'

/**
 * Options for an event
 */
export type EventOptions = {
  originalEvent?: unknown
  bubbles?: boolean
  composed?: boolean
  capturePhase?: boolean
  extraFields?: { [key: string]: unknown }
  handleListenerReturn?: (ret: unknown) => boolean | void
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

export const enum MutLevel {
  None = 0,
  Mut = 1,
  Final = 2,
}

type EventFuncArr<TDetail> = {
  mutCount: number
  finalCount: number
  funcArr: FuncArrWithMeta<EventListener<TDetail>, MutLevel>
}

export const enum FinalChanged {
  NotChanged = 0,
  Failed,
  None,
  Final,
  Mut,
}

export const enum EventPhase {
  None,
  CapturingPhase,
  AtTarget,
  BubblingPhase,
}

/** The target of an event */
export class EventTarget<TEvents extends { [type: string]: unknown }> {
  listeners = Object.create(null) as {
    [T in keyof TEvents]: EventFuncArr<TEvents[T]>
  }
  captureListeners:
    | {
        [T in keyof TEvents]: EventFuncArr<TEvents[T]>
      }
    | null = null

  addListener<T extends string>(
    name: T,
    func: EventListener<TEvents[T]>,
    options: EventListenerOptions = {},
  ): FinalChanged {
    // eslint-disable-next-line no-nested-ternary
    const mutLevel = options.final ? MutLevel.Final : options.mutated ? MutLevel.Mut : MutLevel.None
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
        funcArr: new FuncArrWithMeta('listener'),
      }
    }
    efa.funcArr.add(func, mutLevel)
    if (mutLevel === MutLevel.Final) {
      efa.finalCount += 1
      return initialized && efa.finalCount !== 1 ? FinalChanged.NotChanged : FinalChanged.Final
    }
    if (mutLevel === MutLevel.Mut) {
      efa.mutCount += 1
      return initialized && !(efa.mutCount === 1 && efa.finalCount === 0)
        ? FinalChanged.NotChanged
        : FinalChanged.Mut
    }
    return initialized ? FinalChanged.NotChanged : FinalChanged.None
  }

  removeListener<T extends string>(
    name: T,
    func: EventListener<TEvents[T]>,
    options: EventListenerOptions = {},
  ): FinalChanged {
    const listeners = options.capture || options.useCapture ? this.captureListeners : this.listeners
    if (!listeners) return FinalChanged.Failed
    const efa = listeners[name]
    if (!efa) return FinalChanged.Failed
    const mutLevel = efa.funcArr.remove(func)
    if (mutLevel === null) return FinalChanged.Failed

    if (mutLevel === MutLevel.Final) {
      efa.finalCount -= 1
      // eslint-disable-next-line no-nested-ternary
      return efa.finalCount !== 0
        ? FinalChanged.NotChanged
        : efa.mutCount > 0
        ? FinalChanged.Mut
        : FinalChanged.None
    }
    if (mutLevel === MutLevel.Mut) {
      efa.mutCount -= 1
      return efa.mutCount !== 0 || efa.finalCount !== 0
        ? FinalChanged.NotChanged
        : FinalChanged.None
    }
    return FinalChanged.NotChanged
  }

  getListeners() {
    const finalListeners = Object.create(null) as Record<
      string,
      (EventListenerOptions & { listener: EventListener<unknown> })[]
    >
    const resolveListeners = (
      listeners: { [T in keyof TEvents]: EventFuncArr<TEvents[T]> },
      capture: boolean,
    ) => {
      const names = Object.keys(listeners)
      for (let i = 0; i < names.length; i += 1) {
        const name = names[i]!
        const efa = listeners[name] as EventFuncArr<unknown>
        if (!finalListeners[name]) finalListeners[name] = []
        const funcArr = efa.funcArr.getArr()
        if (funcArr) {
          for (let j = 0; j < funcArr.length; j += 1) {
            const funcInfo = funcArr[j]!
            finalListeners[name]!.push({
              listener: funcInfo.f,
              mutated: funcInfo.data === MutLevel.Mut,
              final: funcInfo.data === MutLevel.Final,
              capture,
              useCapture: capture,
            })
          }
        }
      }
    }
    resolveListeners(this.listeners, false)
    if (this.captureListeners) {
      resolveListeners(this.captureListeners, false)
    }
    return finalListeners
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
  extraFields: Record<string, unknown> | undefined
  eventPhase: EventPhase = EventPhase.None
  /** @internal */
  private _$eventName: string
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
  /** @internal */
  private _$handleListenerReturn: ((ret: unknown) => boolean | void) | undefined

  constructor(name: string, detail: TDetail, options: EventOptions = {}) {
    const ts = getCurrentTimeStamp()
    this._$eventName = this.type = name
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
    this._$handleListenerReturn = options.handleListenerReturn
    if (options.extraFields) {
      Object.assign(this, options.extraFields)
      this.extraFields = options.extraFields
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

  getEventName(): string {
    return this._$eventName
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

  listenerReturnHandler() {
    return this._$handleListenerReturn
  }

  isCapturePhase() {
    return this.eventPhase === EventPhase.CapturingPhase
  }

  callListener(
    currentTarget: Element,
    mark: Record<string, unknown> | null,
    target: Element,
    isCapture: boolean,
  ) {
    const evName = this._$eventName

    const eventTarget = currentTarget._$eventTarget
    if (!eventTarget) return
    const listeners = isCapture ? eventTarget.captureListeners : eventTarget.listeners
    if (!listeners) return
    const efa = listeners[evName]
    if (!efa) return
    const skipMut = this.mutatedMarked()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const targetCaller = isComponent(target) ? target.getMethodCaller() || target : target
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const currentTargetCaller = isComponent(currentTarget)
      ? currentTarget.getMethodCaller() || currentTarget
      : currentTarget
    const ev = this.wrapShadowedEvent(targetCaller, mark, currentTargetCaller)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ;(this as any)._hasListeners = true
    const ret = efa.funcArr.call(
      currentTargetCaller,
      [ev],
      (mulLevel) => !skipMut || mulLevel !== MutLevel.Mut,
      isComponent(target) ? target : undefined,
      this._$handleListenerReturn,
    )
    if (ret === false || efa.finalCount > 0) {
      ev.stopPropagation()
      ev.preventDefault()
    } else if (efa.mutCount > 0) {
      ev.markMutated()
    }
  }

  dispatch(target: Element, externalTarget?: GeneralBackendElement) {
    if (this._$dispatched) {
      throw new Error('Event cannot be dispatched twice')
    }
    if (ENV.DEV) {
      addTimelineEvent(this._$eventName, { event: this })
      performanceMeasureStart('event.dispatch')
    }
    this._$dispatched = true
    const crossShadow = this.composed
    const bubbles = this.bubbles
    const inExternalOnly = externalTarget && !crossShadow
    const eventBubblingControl = this._$eventBubblingControl

    const forEachBubblePath = (
      target: Element,
      f: (currentTarget: Element, target: Element, mark: Record<string, unknown>) => boolean | void,
    ) => {
      const recShadow = (target: Element): Element | null => {
        let currentTarget = target
        const mark = target.collectMarks()
        for (;;) {
          if (f(currentTarget, target, mark) === false) return null
          let next
          if (crossShadow) {
            if (isShadowRoot(currentTarget)) return currentTarget.getHostNode()
            if (currentTarget.containingSlot === null) return null
            if (currentTarget.containingSlot) {
              next = recShadow(currentTarget.containingSlot)
            } else {
              next = currentTarget.parentNode
              while (next?._$inheritSlots) {
                next = next.parentNode
              }
            }
          } else {
            next = currentTarget.parentNode
          }
          if (!next) return null
          currentTarget = next
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
      this.eventPhase = EventPhase.CapturingPhase
      const bubblingPath: [Element, Element, Record<string, unknown>][] = []
      forEachBubblePath(target, (currentTarget, target, mark) => {
        bubblingPath.push([currentTarget, target, mark])
      })
      for (let i = bubblingPath.length - 1; i >= 0; i -= 1) {
        const [currentTarget, target, mark] = bubblingPath[i]!
        if (currentTarget._$eventTarget) {
          this.callListener(currentTarget, mark, target, true)
          if (eventBubblingControl.stopped) break
        }
      }
    }

    this.eventPhase = EventPhase.AtTarget

    // bubble phase in external component
    if (!eventBubblingControl.stopped && externalTarget) {
      if (isComponent(target) && target._$external) {
        ;(target.shadowRoot as ExternalShadowRoot).handleEvent(externalTarget, this)
      }
    }

    // bubble phase
    if (!eventBubblingControl.stopped && !inExternalOnly) {
      let atTarget = true
      forEachBubblePath(target, (currentTarget, target, mark) => {
        if (!atTarget && isComponent(currentTarget) && currentTarget._$external) {
          const sr = currentTarget.shadowRoot as ExternalShadowRoot
          sr.handleEvent(sr.slot, this)
        }
        atTarget = false
        this.eventPhase = EventPhase.BubblingPhase
        if (currentTarget._$eventTarget && !eventBubblingControl.stopped) {
          this.callListener(currentTarget, mark, target, false)
        }
        return bubbles && !eventBubblingControl.stopped
      })
    }

    this.eventPhase = EventPhase.None

    if (ENV.DEV) performanceMeasureEnd()
    return this.getEventBubbleStatus()
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
    return Event.dispatchEvent(target, ev)
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
    return Event.dispatchExternalEvent(component, target, ev)
  }
}
