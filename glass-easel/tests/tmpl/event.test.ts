import { tmpl, domBackend } from '../base/env'
import * as glassEasel from '../../src'

describe('event bindings', () => {
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
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
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
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
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
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
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
        <div capture-bind:customEv="on0c" bind:customEv="on0"><slot /></div>
        <div capture-bind:customEv="on1c" bind:customEv="on1"><slot name="a" /></div>
      `),
      methods: {
        on0: () => ops.push('s0'),
        on1: () => ops.push('s1'),
        on0c: () => ops.push('s0c'),
        on1c: () => ops.push('s1c'),
      },
    })

    const multi = glassEasel.registerElement({
      options: { multipleSlots: true },
      template: tmpl(`
        <div capture-bind:customEv="on0c" bind:customEv="on0"><slot /></div>
        <div capture-bind:customEv="on1c" bind:customEv="on1"><slot name="a" /></div>
      `),
      methods: {
        on0: () => ops.push('m0'),
        on1: () => ops.push('m1'),
        on0c: () => ops.push('m0c'),
        on1c: () => ops.push('m1c'),
      },
    })

    const dynamic = glassEasel.registerElement({
      options: { dynamicSlots: true },
      template: tmpl(`
        <div capture-bind:customEv="on0c" bind:customEv="on0"><slot /></div>
        <div capture-bind:customEv="on1c" bind:customEv="on1"><slot name="a" /></div>
      `),
      methods: {
        on0: () => ops.push('d0'),
        on1: () => ops.push('d1'),
        on0c: () => ops.push('d0c'),
        on1c: () => ops.push('d1c'),
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

    const parentElem = glassEasel.Component.createWithContext('root', parent, domBackend)
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
      'p3c',
      'p3',
      's0',
      'p0',
      'p1c',
      'm1c',
      'p4c',
      'p4',
      'm1',
      'p1',
      'p2c',
      'd1c',
      'p5c',
      'p5',
      'd1',
      'p2',
    ])
  })

  test('event function bindings', () => {
    const abc = glassEasel.registerElement({
      properties: { abc: String },
    })
    const def = glassEasel.registerElement({
      using: { abc: abc.general() },
      template: tmpl(`
        <wxs module="modA">
          exports.fA = function (newVal, oldVal, self, target) {
            self._test = 789
            target._test = newVal + ':' + oldVal
          }
        </wxs>
        <abc id="a" change:abc="{{ modA.fA }}" abc="{{ abc }}" />
      `),
      data: {
        abc: 123,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    const a = elem.getShadowRoot()!.getElementById('a')!
    expect((elem as unknown as { _test: number })._test).toBe(789)
    expect((a as unknown as { _test: string })._test).toBe('123:')
    elem.setData({ abc: 456 })
    expect((a as unknown as { _test: string })._test).toBe('456:123')
  })

  test('change property bindings', () => {
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
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    glassEasel.Element.pretendAttached(elem)
    const a = elem.getShadowRoot()!.getElementById('a')!
    expect((a as unknown as { _test: string })._test).toBe(123)
  })

  test('worklet directives', () => {
    let triggered = false
    const abc = glassEasel.registerElement({
      lifetimes: {
        workletChange(name: string, value: number) {
          expect(name).toBe('abc')
          expect(value).toBe(123)
          triggered = true
        },
      },
    })
    const def = glassEasel.registerElement({
      using: { abc: abc.general() },
      template: tmpl(`
        <abc id="a" worklet:abc="{{ 123 }}" />
      `),
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(triggered).toBe(true)
  })
})
