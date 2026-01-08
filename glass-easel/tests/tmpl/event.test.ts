// eslint-disable-next-line import/no-extraneous-dependencies
import { tmpl, domBackend, composedBackend, shadowBackend } from '../base/env'
import * as glassEasel from '../../src'

const testCases = (testBackend: glassEasel.GeneralBackendContext) => {
  beforeAll(() => {
    domBackend.onEvent(glassEasel.Event.triggerBackendEvent)
  })

  test('event listener filter', () => {
    const customHandler = (a: number, b: number) => a + b
    const template = tmpl(
      `
        <wxs module="w">module.exports = { customHandler: ${customHandler.toString()} }</wxs>
        <div
          id="a"
          bind:customEv="f"
          bind:dropEvent="shouldBeDropped"
          bind:customHandler="{{ w.customHandler }}"
        ></div>
      `,
      {},
      {
        C: (elem, evName, listener, final, mutated, capture, generalLvaluePath) => {
          const hostMethodCaller = elem.ownerShadowRoot?.getHostNode().getMethodCaller()
          expect(final).toBe(false)
          expect(mutated).toBe(false)
          expect(capture).toBe(false)
          switch (evName) {
            case 'customHandler': {
              expect(generalLvaluePath).toStrictEqual([
                glassEasel.template.GeneralLvaluePathPrefix.InlineScript,
                '',
                'w',
                'customHandler',
              ])
              break
            }
            default:
              expect(generalLvaluePath).toBe(undefined)
          }
          return (event) => {
            expect(event.getEventName()).toBe(evName)
            switch (evName) {
              case 'customEv': {
                event.target = Object.assign(event.target, { id: 'b' })
                return listener.apply(hostMethodCaller, [event])
              }
              case 'dropEvent': {
                return undefined
              }
              case 'customHandler': {
                const ret = (listener as any as typeof customHandler)(event.detail as number, 2)
                expect(ret).toBe(3)
                return undefined
              }
              default: {
                return listener.apply(hostMethodCaller, [event])
              }
            }
          }
        },
      },
    )

    let droppedEventCalled = false
    const eventOrder: number[] = []
    const def = glassEasel.registerElement({
      template,
      methods: {
        f(ev: glassEasel.ShadowedEvent<unknown>) {
          expect(this).toBe(elem.getMethodCaller())
          expect(ev.target.id).toBe('b')
          eventOrder.push(1)
        },
        shouldBeDropped() {
          droppedEventCalled = true
        },
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    const div = elem.getShadowRoot()!.getElementById('a')!

    div.triggerEvent('customEv')
    expect(eventOrder).toStrictEqual([1])

    div.triggerEvent('dropEvent')
    expect(droppedEventCalled).toBe(false)

    div.triggerEvent('customHandler', 1)
  })

  test('catch bindings', () => {
    const eventOrder: number[] = []
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="a" bind:customEv="evA">
          <div id="b" catch:customEv="evB">
            <div id="c" bind:customEv="evC" />
          </div>
        </div>
      `),
      methods: {
        evA() {
          eventOrder.push(1)
        },
        evB() {
          eventOrder.push(2)
        },
        evC() {
          eventOrder.push(3)
        },
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    const c = elem.getShadowRoot()!.getElementById('c')!
    c.triggerEvent('customEv', null, { bubbles: true })
    expect(eventOrder).toStrictEqual([3, 2])
  })

  test('mut-bind bindings', () => {
    const eventOrder: number[] = []
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="a" bind:customEv="evA">
          <div id="b" mut-bind:customEv="evB">
            <div id="c" mut-bind:customEv="evC" />
          </div>
        </div>
      `),
      methods: {
        evA() {
          eventOrder.push(1)
        },
        evB() {
          eventOrder.push(2)
        },
        evC() {
          eventOrder.push(3)
        },
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    const c = elem.getShadowRoot()!.getElementById('c')!
    c.triggerEvent('customEv', null, { bubbles: true })
    expect(eventOrder).toStrictEqual([3, 1])
  })

  test('dynamic catch bindings', () => {
    const eventOrder: number[] = []
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="a" bind:customEv="evA">
          <div id="b" catch:customEv="{{ evBHandler }}">
            <div id="c" />
          </div>
        </div>
      `),
      data: {
        evBHandler: 'evB',
      },
      methods: {
        evA() {
          eventOrder.push(1)
        },
        evB() {
          eventOrder.push(2)
        },
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    const c = elem.getShadowRoot()!.getElementById('c')!
    c.triggerEvent('customEv', null, { bubbles: true })
    expect(eventOrder).toStrictEqual([2])
    eventOrder.length = 0
    elem.setData({
      evBHandler: '',
    })
    c.triggerEvent('customEv', null, { bubbles: true })
    expect(eventOrder).toStrictEqual([1])
  })

  test('bubble cross shadow', () => {
    const ops: string[] = []

    const single = glassEasel.registerElement({
      template: tmpl(`
        <div capture-bind:customEv="on0c" bind:customEv="on0">
          <slot capture-bind:customEv="on1c" bind:customEv="on1" />
        </div>
        <div capture-bind:customEv="on2c" bind:customEv="on2">
          <slot name="a" capture-bind:customEv="on3c" bind:customEv="on3" />
        </div>
      `),
      methods: {
        on0: () => ops.push('s0'),
        on1: () => ops.push('s1'),
        on2: () => ops.push('s2'),
        on3: () => ops.push('s3'),
        on0c: () => ops.push('s0c'),
        on1c: () => ops.push('s1c'),
        on2c: () => ops.push('s2c'),
        on3c: () => ops.push('s3c'),
      },
    })

    const multi = glassEasel.registerElement({
      options: { multipleSlots: true },
      template: tmpl(`
        <div capture-bind:customEv="on0c" bind:customEv="on0">
          <slot capture-bind:customEv="on1c" bind:customEv="on1" />
        </div>
        <div capture-bind:customEv="on2c" bind:customEv="on2">
          <slot name="a" capture-bind:customEv="on3c" bind:customEv="on3" />
        </div>
      `),
      methods: {
        on0: () => ops.push('m0'),
        on1: () => ops.push('m1'),
        on2: () => ops.push('m2'),
        on3: () => ops.push('m3'),
        on0c: () => ops.push('m0c'),
        on1c: () => ops.push('m1c'),
        on2c: () => ops.push('m2c'),
        on3c: () => ops.push('m3c'),
      },
    })

    const dynamic = glassEasel.registerElement({
      options: { dynamicSlots: true },
      template: tmpl(`
        <div capture-bind:customEv="on0c" bind:customEv="on0">
          <slot capture-bind:customEv="on1c" bind:customEv="on1" />
        </div>
        <div capture-bind:customEv="on2c" bind:customEv="on2">
          <slot name="a" capture-bind:customEv="on3c" bind:customEv="on3" />
        </div>
      `),
      methods: {
        on0: () => ops.push('d0'),
        on1: () => ops.push('d1'),
        on2: () => ops.push('d2'),
        on3: () => ops.push('d3'),
        on0c: () => ops.push('d0c'),
        on1c: () => ops.push('d1c'),
        on2c: () => ops.push('d2c'),
        on3c: () => ops.push('d3c'),
      },
    })

    const parent = glassEasel.registerElement({
      using: {
        single: single.general(),
        multi: multi.general(),
        dynamic: dynamic.general(),
      },
      template: tmpl(`
        <single capture-bind:customEv="on0c" bind:customEv="on0">
          <div wx:if="1" id="s" slot="a" capture-bind:customEv="on3c" bind:customEv="on3" />S
        </single>
        <multi capture-bind:customEv="on1c" bind:customEv="on1">
          <div wx:if="1" id="m" slot="a" capture-bind:customEv="on4c" bind:customEv="on4" />M
        </multi>
        <dynamic capture-bind:customEv="on2c" bind:customEv="on2">
          <div wx:if="1" id="d" slot="a" capture-bind:customEv="on5c" bind:customEv="on5" />D
        </dynamic>
      `),
      methods: {
        on0: () => ops.push('p0'),
        on1: () => ops.push('p1'),
        on2: () => ops.push('p2'),
        on3: () => ops.push('p3'),
        on4: () => ops.push('p4'),
        on5: () => ops.push('p5'),
        on0c: () => ops.push('p0c'),
        on1c: () => ops.push('p1c'),
        on2c: () => ops.push('p2c'),
        on3c: () => ops.push('p3c'),
        on4c: () => ops.push('p4c'),
        on5c: () => ops.push('p5c'),
      },
    })

    const parentElem = glassEasel.Component.createWithContext('root', parent, testBackend)
    const singleElem = parentElem.$.s as glassEasel.Element
    const multiElem = parentElem.$.m as glassEasel.Element
    const dynamicElem = parentElem.$.d as glassEasel.Element

    glassEasel.Event.triggerEvent(singleElem, 'customEv', null, {
      bubbles: true,
      composed: true,
      capturePhase: true,
    })
    glassEasel.Event.triggerEvent(multiElem, 'customEv', null, {
      bubbles: true,
      composed: true,
      capturePhase: true,
    })
    glassEasel.Event.triggerEvent(dynamicElem, 'customEv', null, {
      bubbles: true,
      composed: true,
      capturePhase: true,
    })

    expect(ops).toEqual([
      'p0c',
      's0c',
      's1c',
      'p3c',
      'p3',
      's1',
      's0',
      'p0',
      'p1c',
      'm2c',
      'm3c',
      'p4c',
      'p4',
      'm3',
      'm2',
      'p1',
      'p2c',
      'd2c',
      'd3c',
      'p5c',
      'p5',
      'd3',
      'd2',
      'p2',
    ])
  })

  test('change property bindings', () => {
    const abc = glassEasel.registerElement({
      properties: { abc: String },
    })
    const def = glassEasel.registerElement({
      using: { abc: abc.general() },
      template: tmpl(`
        <wxs module="modA">
          exports.fA = function (newVal, oldVal, self, target) {
            self._test = 789
            target._test = newVal + ':' + (oldVal || '-')
          }
        </wxs>
        <abc id="a" change:abc="{{ modA.fA }}" abc="{{ abc }}" />
      `),
      data: {
        abc: 123,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    const a = elem.getShadowRoot()!.getElementById('a')!
    expect((elem as unknown as { _test: number })._test).toBe(789)
    expect((a as unknown as { _test: string })._test).toBe('123:-')
    elem.setData({ abc: 456 })
    expect((a as unknown as { _test: string })._test).toBe('456:123')
  })

  test('event function bindings', () => {
    const abc = glassEasel.registerElement({
      lifetimes: {
        attached() {
          this.triggerEvent('abc')
        },
      },
    })
    const def = glassEasel.registerElement({
      using: { abc: abc.general() },
      template: tmpl(`
        <wxs module="modA">
          exports.fA = function (ev) {
            ev.target._test = 123
          }
        </wxs>
        <abc id="a" bind:abc="{{ modA.fA }}" />
      `),
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    glassEasel.Element.pretendAttached(elem)
    const a = elem.getShadowRoot()!.getElementById('a')!
    expect((a as unknown as { _test: string })._test).toBe(123)
  })

  test('event function bindings (with conditional expression)', () => {
    const abc = glassEasel.registerElement({
      lifetimes: {
        attached() {
          this.triggerEvent('abc')
        },
      },
    })
    const def = glassEasel.registerElement({
      using: { abc: abc.general() },
      template: tmpl(`
        <wxs module="modA">
          exports.fA = function (ev) {
            ev.target._test = 123
          }
          exports.fB = function (ev) {
            ev.target._test = 456
          }
        </wxs>
        <abc id="a" bind:abc="{{ cond ? modA.fB : modA.fA }}" />
      `),
      data: {
        cond: false,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    glassEasel.Element.pretendAttached(elem)
    const a = elem.getShadowRoot()!.getElementById('a')!
    expect((a as unknown as { _test: string })._test).toBe(123)
    elem.setData({ cond: true })
    a.triggerEvent('abc')
    expect((a as unknown as { _test: string })._test).toBe(456)
  })

  test('worklet directives', () => {
    const triggered: string[] = []
    const abc = glassEasel.registerElement({
      lifetimes: {
        workletChange(name: string, value: number) {
          if (name === 'abc') {
            expect(value).toBe('abc')
          } else if (name === 'def') {
            expect(value).toBe('456')
          }
          triggered.push(name)
        },
      },
    })
    const def = glassEasel.registerElement({
      using: { abc: abc.general() },
      template: tmpl(`
        <abc id="a" worklet:abc="abc" worklet:def="456" />
      `),
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(triggered).toStrictEqual(['abc', 'def'])
  })

  test('handle listener return', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="a" bind:customEv="evA">
          <div id="b" catch:customEv="evB">
            <div id="c" bind:customEv="evC" bind:customEv="evCC" />
          </div>
        </div>
      `),
      methods: {
        evA() {
          return 1
        },
        evB() {
          return 2
        },
        evC() {
          return 3
        },
        evCC() {
          return 4
        },
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    const c = elem.getShadowRoot()!.getElementById('c')!
    let eventOrder: number[] = []
    c.triggerEvent('customEv', null, {
      bubbles: true,
      handleListenerReturn(ret) {
        expect(typeof ret).toBe('number')
        eventOrder.push(Number(ret))
      },
    })
    expect(eventOrder).toStrictEqual([3, 4, 2])
    eventOrder = []
    c.triggerEvent('customEv', null, {
      bubbles: true,
      handleListenerReturn(ret) {
        expect(typeof ret).toBe('number')
        eventOrder.push(Number(ret))
        return ret !== 4
      },
    })
    expect(eventOrder).toStrictEqual([3, 4])
  })

  test('event phase', () => {
    const eventPhase: [string, glassEasel.EventPhase][] = []
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="a" bind:customEv="evA">
          <div id="b" capture-bind:customEv="evB">
            <div id="c" bind:customEv="evC" />
          </div>
        </div>
      `),
      methods: {
        evA(e: glassEasel.ShadowedEvent<unknown>) {
          eventPhase.push(['a', e.eventPhase])
        },
        evB(e: glassEasel.ShadowedEvent<unknown>) {
          eventPhase.push(['b', e.eventPhase])
        },
        evC(e: glassEasel.ShadowedEvent<unknown>) {
          eventPhase.push(['c', e.eventPhase])
        },
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    const c = elem.getShadowRoot()!.getElementById('c')!
    const event = new glassEasel.Event(
      'customEv',
      {},
      { composed: true, capturePhase: true, bubbles: true },
    )
    expect(event.eventPhase).toBe(glassEasel.EventPhase.None)
    c.dispatchEvent(event)
    expect(event.eventPhase).toBe(glassEasel.EventPhase.None)
    expect(eventPhase).toStrictEqual([
      ['b', glassEasel.EventPhase.CapturingPhase],
      ['c', glassEasel.EventPhase.BubblingPhase],
      ['a', glassEasel.EventPhase.BubblingPhase],
    ])
  })

  test('has listeners', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="a">
          <div id="b" catch:customEv="evB">
            <div id="c" bind:customEv="evC" />
          </div>
        </div>
      `),
      methods: {
        evB(e: glassEasel.ShadowedEvent<unknown>) {
          expect(e.hasListener()).toBe(true)
        },
        evC(e: glassEasel.ShadowedEvent<unknown>) {
          expect(e.hasListener()).toBe(true)
        },
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    const c = elem.getShadowRoot()!.getElementById('c')!
    const a = elem.getShadowRoot()!.getElementById('a')!

    const event = new glassEasel.Event('customEv', {}, { composed: true, capturePhase: true })
    expect(event.hasListener()).toBe(false)
    c.dispatchEvent(event)
    expect(event.hasListener()).toBe(true)

    const event1 = new glassEasel.Event('customEv', {}, { composed: true, capturePhase: true })
    expect(event1.hasListener()).toBe(false)
    a.dispatchEvent(event1)
    expect(event1.hasListener()).toBe(false)
  })

  if (testBackend === domBackend) {
    test('prevent default', () => {
      const events: string[] = []
      const def = glassEasel.registerElement({
        template: tmpl(`
          <div id="a" bind:custom="evA">
            <div id="b" capture-bind:custom="evB">
              <div id="c" bind:custom="evC" />
            </div>
          </div>
        `),
        methods: {
          evA() {
            events.push('a')
          },
          evB() {
            events.push('b')
          },
          evC() {
            events.push('c')
            return false
          },
        },
      })
      const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
      const c = elem.getShadowRoot()!.getElementById('c')!
      const domElemC = c.getBackendElement() as unknown as HTMLDivElement
      const event = new Event('custom', { bubbles: true, composed: true, cancelable: true })
      domElemC.dispatchEvent(event)
      expect(events).toStrictEqual(['b', 'c'])
      expect(event.defaultPrevented).toBe(true)
    })

    test('stop propagation in native-rendering elements', () => {
      let op: string[] = []
      let breakpoints: string[] = []
      const comp = glassEasel.registerElement({
        options: {
          externalComponent: true,
        },
        template: tmpl(`
          <div id="a" bind:customEv="evA">
            <div id="b" bind:customEv="evB">
              <slot />
            </div>
          </div>
        `),
        listeners: {
          'this.customEv': 'evThis',
          customEv: 'evShadowRoot',
        },
        methods: {
          evThis() {
            op.push('this')
            return !breakpoints.includes('this')
          },
          evShadowRoot() {
            op.push('shadowRoot')
            return !breakpoints.includes('shadowRoot')
          },
          evA() {
            op.push('a')
            return !breakpoints.includes('a')
          },
          evB() {
            op.push('b')
            return !breakpoints.includes('b')
          },
        },
      })
      const root = glassEasel.registerElement({
        using: {
          comp,
        },
        template: tmpl(`
          <comp id="comp" bind:customEv="evComp">
            <div id="c" bind:customEv="evC" />
          </comp>
        `),
        methods: {
          evComp() {
            op.push('comp')
            return !breakpoints.includes('comp')
          },
          evC() {
            op.push('c')
            return !breakpoints.includes('c')
          },
        },
      })
      const elem = glassEasel.Component.createWithContext('root', root.general(), testBackend)
      const c = elem.$.c as glassEasel.Element

      op = []
      breakpoints = []
      glassEasel.triggerEvent(
        c,
        'customEv',
        {},
        { bubbles: true, composed: true, capturePhase: true },
      )
      expect(op).toStrictEqual(['c', 'b', 'a', 'shadowRoot', 'this', 'comp'])

      op = []
      breakpoints = ['shadowRoot']
      glassEasel.triggerEvent(
        c,
        'customEv',
        {},
        { bubbles: true, composed: true, capturePhase: true },
      )
      expect(op).toStrictEqual(['c', 'b', 'a', 'shadowRoot'])

      op = []
      breakpoints = ['b']
      glassEasel.triggerEvent(
        c,
        'customEv',
        {},
        { bubbles: true, composed: true, capturePhase: true },
      )
      expect(op).toStrictEqual(['c', 'b'])

      op = []
      breakpoints = ['c']
      glassEasel.triggerEvent(
        c,
        'customEv',
        {},
        { bubbles: true, composed: true, capturePhase: true },
      )
      expect(op).toStrictEqual(['c'])
    })
  }
}

describe('event bindings (DOM backend)', () => testCases(domBackend))
describe('event bindings (shadow backend)', () => testCases(shadowBackend))
describe('event bindings (composed backend)', () => testCases(composedBackend))
