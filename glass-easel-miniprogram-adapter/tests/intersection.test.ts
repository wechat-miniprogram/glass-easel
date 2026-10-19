import * as glassEasel from 'glass-easel'
import { tmpl } from './base/env'
import { MiniProgramEnv } from '../src'
import { type GeneralComponent } from '../src/component'
import { type IntersectionStatus } from '../src/intersection'

type BackendStatus = glassEasel.backend.IntersectionStatus

const rootBounds = { left: 0, top: 0, width: 100, height: 200 }

const makeStatus = (
  intersectionRatio: number,
  isIntersecting: boolean = intersectionRatio > 0,
): BackendStatus => ({
  intersectionRatio,
  isIntersecting,
  boundingClientRect: { left: 10, top: 20, width: 30, height: 40 },
  intersectionRect: { left: 10, top: 20, width: 30, height: 40 },
  rootBounds,
  time: 12345,
})

const createComponent = (): glassEasel.GeneralComponent => {
  const env = new MiniProgramEnv()
  const codeSpace = env.createCodeSpace('', true)
  codeSpace.addComponentStaticConfig('path/to/comp', {})
  codeSpace.addCompiledTemplate(
    'path/to/comp',
    tmpl('<div id="target" data-foo="bar"></div><div id="rel"></div>'),
  )
  codeSpace.componentEnv('path/to/comp', ({ Component }) => {
    Component().register()
  })
  const ab = env.associateBackend()
  const root = ab.createRoot('body', codeSpace, 'path/to/comp')
  glassEasel.Element.pretendAttached(root.getComponent())
  return root.getComponent()
}

// Replace the target element's backend observer with a controllable one, so that
// the statuses can be delivered manually (jsdom has no IntersectionObserver).
const interceptTargetObserver = (comp: glassEasel.GeneralComponent) => {
  const target = comp.getShadowRoot()!.querySelector('#target')!
  const backendOptions: {
    relativeElement: glassEasel.Element | null
    margin: string
    thresholds: number[]
  } = {
    relativeElement: null,
    margin: '',
    thresholds: [],
  }
  let deliver: ((res: BackendStatus) => void) | null = null
  let disconnected = false
  const patchTarget = target as unknown as {
    createIntersectionObserver: (
      relativeElement: glassEasel.Element | null,
      margin: string,
      thresholds: number[],
      listener: (res: BackendStatus) => void,
    ) => glassEasel.backend.Observer
  }
  patchTarget.createIntersectionObserver = (relativeElement, margin, thresholds, listener) => {
    backendOptions.relativeElement = relativeElement
    backendOptions.margin = margin
    backendOptions.thresholds = thresholds
    deliver = listener
    return {
      disconnect: () => {
        disconnected = true
      },
    }
  }
  return {
    backendOptions,
    deliver: (res: BackendStatus) => {
      if (deliver === null) throw new Error('the observer is not created yet')
      deliver(res)
    },
    isDisconnected: () => disconnected,
  }
}

const observeAndDeliver = (
  options: { thresholds?: number[]; initialRatio?: number },
  statuses: BackendStatus[],
) => {
  const comp = createComponent()
  const intercepted = interceptTargetObserver(comp)
  const collected: IntersectionStatus[] = []
  const adapterComp = comp.getMethodCaller() as unknown as GeneralComponent
  const observer = adapterComp.createIntersectionObserver(options)
  observer.relativeToViewport().observe('#target', (status) => {
    collected.push(status)
  })
  statuses.forEach((res) => intercepted.deliver(res))
  return { collected, intercepted, observer }
}

describe('intersection observer', () => {
  test('the first status is delivered when crossing a threshold of the initial ratio', () => {
    const { collected } = observeAndDeliver({ thresholds: [0], initialRatio: 0 }, [makeStatus(1)])
    expect(collected.length).toBe(1)
  })

  test('the first status is suppressed when the ratio is unchanged', () => {
    const { collected } = observeAndDeliver({ thresholds: [0], initialRatio: 0 }, [makeStatus(0)])
    expect(collected.length).toBe(0)
  })

  test('the first status is suppressed when no threshold is reached', () => {
    const { collected } = observeAndDeliver({ thresholds: [0.5], initialRatio: 0.2 }, [
      makeStatus(0.4),
    ])
    expect(collected.length).toBe(0)
  })

  test('statuses after the first one are delivered as-is', () => {
    const { collected } = observeAndDeliver({ thresholds: [0], initialRatio: 0 }, [
      makeStatus(1),
      makeStatus(1),
    ])
    expect(collected.length).toBe(2)
  })

  test('the suppression of the first status is executed only once', () => {
    const { collected } = observeAndDeliver({ thresholds: [0.2], initialRatio: 0 }, [
      makeStatus(0.1),
      makeStatus(0.1),
    ])
    expect(collected.length).toBe(1)
  })

  test('the delivered status contains the mini program fields', () => {
    const timeBefore = Date.now()
    const { collected } = observeAndDeliver({ thresholds: [0], initialRatio: 0 }, [makeStatus(1)])
    expect(collected.length).toBe(1)
    const status = collected[0]!
    expect(status.id).toBe('target')
    expect(status.dataset).toEqual({ foo: 'bar' })
    expect(status.intersectionRatio).toBe(1)
    expect(status.intersectionRect).toEqual({ left: 10, top: 20, width: 30, height: 40 })
    expect(status.boundingClientRect).toEqual({ left: 10, top: 20, width: 30, height: 40 })
    expect(status.relativeRect).toEqual(rootBounds)
    expect(status.rootBounds).toEqual(rootBounds)
    expect(status.isIntersecting).toBe(true)
    expect(status.time).toBeGreaterThanOrEqual(timeBefore)
  })

  test('falls back to the ratio when isIntersecting is absent', () => {
    const statusWithoutIntersecting = {
      intersectionRatio: 1,
      boundingClientRect: { left: 10, top: 20, width: 30, height: 40 },
      intersectionRect: { left: 10, top: 20, width: 30, height: 40 },
      rootBounds,
      time: 12345,
    } as BackendStatus
    const { collected } = observeAndDeliver({ thresholds: [0], initialRatio: 0 }, [
      statusWithoutIntersecting,
    ])
    expect(collected.length).toBe(1)
    expect(collected[0]!.isIntersecting).toBe(true)
  })

  test('thresholds are filtered and sorted', () => {
    const { intercepted } = observeAndDeliver(
      { thresholds: [1, -1, 0.5, 2, 0.2], initialRatio: 0 },
      [],
    )
    expect(intercepted.backendOptions.thresholds).toEqual([0.2, 0.5, 1])
  })

  test('relativeTo passes the relative element and margins to the backend', () => {
    const comp = createComponent()
    const intercepted = interceptTargetObserver(comp)
    const adapterComp = comp.getMethodCaller() as unknown as GeneralComponent
    const observer = adapterComp.createIntersectionObserver({})
    observer
      .relativeTo('#rel', { left: 1, top: 2, right: 3, bottom: 4 })
      .observe('#target', () => {})
    expect(intercepted.backendOptions.relativeElement).toBe(
      comp.getShadowRoot()!.querySelector('#rel'),
    )
    expect(intercepted.backendOptions.margin).toBe('2px 3px 4px 1px')
  })

  test('relativeToViewport passes null relative element and zero margins', () => {
    const comp = createComponent()
    const intercepted = interceptTargetObserver(comp)
    const adapterComp = comp.getMethodCaller() as unknown as GeneralComponent
    const observer = adapterComp.createIntersectionObserver({})
    observer.relativeToViewport().observe('#target', () => {})
    expect(intercepted.backendOptions.relativeElement).toBe(null)
    expect(intercepted.backendOptions.margin).toBe('0px 0px 0px 0px')
  })

  test('disconnect disconnects the backend observers', () => {
    const { intercepted, observer } = observeAndDeliver({ thresholds: [0], initialRatio: 0 }, [])
    observer.disconnect()
    expect(intercepted.isDisconnected()).toBe(true)
  })
})
