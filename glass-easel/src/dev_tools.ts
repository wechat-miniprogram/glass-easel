import { type AnyComponent, type GeneralComponent } from './component'
import type { Element } from './element'
import { ENV, globalOptions } from './global_options'

export interface DevTools {
  inspector?: InspectorDevTools
  performance?: PerformanceDevTools
}

export interface MountPointEnv {}

export interface InspectorDevTools {
  addMountPoint(root: Element, env: MountPointEnv): void
  removeMountPoint(root: Element): void
}

export interface PerformanceDevTools {
  now: () => number
  addTimelineEvent: (time: number, type: string, data?: Record<string, unknown>) => void
  addTimelineComponentEvent: (
    time: number,
    type: string,
    component: GeneralComponent,
    data?: Record<string, unknown>,
  ) => void
  addTimelinePerformanceMeasureStart: (
    time: number,
    type: string,
    component: GeneralComponent | string | null,
    data?: Record<string, unknown>,
  ) => void
  addTimelinePerformanceMeasureEnd: (time: number) => void
  addTimelineBackendWaterfall: (
    type: string,
    times: [
      number, // pending time
      number, // start time
      number, // end time
    ],
    data?: Record<string, unknown>,
  ) => void
}

let cachedDevTools: DevTools | undefined

const getDevTools = (): DevTools | null | undefined => {
  if (!ENV.DEV) return null
  if (cachedDevTools === undefined) {
    cachedDevTools =
      globalOptions.devTools ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ((globalThis as any).__glassEaselDevTools__ as DevTools | undefined)
  }
  return cachedDevTools
}

export const performanceMeasureStart = (
  type: string,
  comp: AnyComponent | string | null = null,
  data?: Record<string, unknown>,
) => {
  const perf = getDevTools()?.performance
  perf?.addTimelinePerformanceMeasureStart(perf.now(), type, comp, data)
}

export const performanceMeasureEnd = () => {
  const perf = getDevTools()?.performance
  perf?.addTimelinePerformanceMeasureEnd(perf.now())
}

export const performanceMeasureRenderWaterfall = (
  type: string,
  waterfallType: string,
  comp: AnyComponent,
  render: () => void,
) => {
  const perf = getDevTools()?.performance
  if (!perf) {
    render()
    return
  }

  const pendingTimestamp = perf.now()
  const nodeTreeContext = comp.getBackendContext()
  if (nodeTreeContext) {
    const measureId = nodeTreeContext.performanceTraceStart?.()
    performanceMeasureStart(type, comp)
    render()
    performanceMeasureEnd()
    nodeTreeContext.performanceTraceEnd?.(measureId!, ({ startTimestamp, endTimestamp }) => {
      perf.addTimelineBackendWaterfall(waterfallType, [
        pendingTimestamp,
        startTimestamp,
        endTimestamp,
      ])
    })
  } else {
    render()
  }
}

export const addTimelineEvent = (type: string, data?: Record<string, unknown>) => {
  const perf = getDevTools()?.performance
  perf?.addTimelineEvent(perf.now(), type, data)
}

export const attachInspector = (elem: Element) => {
  if (!ENV.DEV) return
  const inspector = getDevTools()?.inspector
  inspector?.addMountPoint(elem, {})
}

export const detachInspector = (elem: Element) => {
  if (!ENV.DEV) return
  const inspector = getDevTools()?.inspector
  inspector?.removeMountPoint(elem)
}
