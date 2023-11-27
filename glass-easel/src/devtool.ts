import { type AnyComponent, type GeneralComponent } from './component'
import { ENV, globalOptions } from './global_options'

export type DevtoolInterface = {
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

let defaultDevtools: DevtoolInterface | null | undefined

export const getDevtool = (): DevtoolInterface | null | undefined => {
  if (!ENV.DEV) return null
  if (defaultDevtools === undefined) {
    defaultDevtools =
      globalOptions.devtool ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ((globalThis as any).__glass_easel_devtool__ as DevtoolInterface | undefined)
  }
  return defaultDevtools
}

export const performanceMeasureStart = (
  type: string,
  comp: AnyComponent | null = null,
  data?: Record<string, unknown>,
) => {
  getDevtool()?.addTimelinePerformanceMeasureStart(getDevtool()!.now(), type, comp, data)
}

export const performanceMeasureEnd = () => {
  getDevtool()?.addTimelinePerformanceMeasureEnd(getDevtool()!.now())
}

export const performanceMeasureRenderWaterfall = (
  type: string,
  waterfallType: string,
  comp: AnyComponent,
  render: () => void,
) => {
  const devtool = getDevtool()
  if (!devtool) {
    render()
    return
  }

  const pendingTimestamp = devtool.now()
  const nodeTreeContext = comp._$nodeTreeContext
  const measureId = nodeTreeContext.performanceTraceStart?.()
  performanceMeasureStart(type, comp)
  render()
  performanceMeasureEnd()
  nodeTreeContext.performanceTraceEnd?.(measureId!, ({ startTimestamp, endTimestamp }) => {
    devtool.addTimelineBackendWaterfall(waterfallType, [
      pendingTimestamp,
      startTimestamp,
      endTimestamp,
    ])
  })
}

export const addTimelineEvent = (type: string, data?: Record<string, unknown>) => {
  getDevtool()?.addTimelineEvent(getDevtool()!.now(), type, data)
}
