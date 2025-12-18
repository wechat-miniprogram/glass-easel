import { tmpl, domBackend } from '../base/env'
import * as glassEasel from '../../src'

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

describe('native rendering mode', () => {
  test('basic tree building', () => {
    const def = glassEasel.registerElement({
      options: { externalComponent: true },
      template: tmpl(`
        <div class="{{a}}" hidden="{{hidden}}" custom-attr="{{b}}">
          <span style="color: red" custom-attr="v"> {{a}} </span>
        </div>
      `),
      data: {
        a: 'A',
        b: false,
        hidden: true,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(elem.$$).toBeInstanceOf(Element)
    expect(domHtml(elem)).toBe(
      '<div class="A" hidden=""><span style="color: red" custom-attr="v"> A </span></div><virtual></virtual>',
    )
    elem.setData({
      a: 'BB',
      b: true,
      hidden: false,
    })
    expect(domHtml(elem)).toBe(
      '<div class="BB" custom-attr=""><span style="color: red" custom-attr="v"> BB </span></div><virtual></virtual>',
    )
  })

  test('slot shrinking', () => {
    const subComp = glassEasel.registerElement({
      options: { externalComponent: true },
      template: tmpl(`
        <div>{{a}}<span><slot /></span></div>
      `),
      properties: {
        a: Number,
      },
    })
    const def = glassEasel.registerElement({
      using: {
        comp: subComp.general(),
      },
      template: tmpl(`
        <comp id="comp" a="{{c + 1}}">{{c}}</comp>
      `),
      data: {
        c: 1,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(domHtml(elem)).toBe('<comp><div>2<span>1</span></div></comp>')
    elem.setData({
      c: 10,
    })
    expect(domHtml(elem)).toBe('<comp><div>11<span>10</span></div></comp>')
  })

  test('slot appending', () => {
    const subComp = glassEasel.registerElement({
      options: { externalComponent: true },
      template: tmpl(`
        <div>{{a}}<span></span></div>
      `),
      properties: {
        a: String,
      },
    })
    const def = glassEasel.registerElement({
      using: {
        comp: subComp.general(),
      },
      template: tmpl(`
        <comp a="c{{c}}">{{c}}</comp>
      `),
      data: {
        c: 'A',
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(domHtml(elem)).toBe('<comp><div>cA<span></span></div><virtual>A</virtual></comp>')
    elem.setData({
      c: 'B',
    })
    expect(domHtml(elem)).toBe('<comp><div>cB<span></span></div><virtual>B</virtual></comp>')
  })

  test('default template', () => {
    const subComp = glassEasel.registerElement({
      options: { externalComponent: true },
    })
    const def = glassEasel.registerElement({
      using: {
        comp: subComp,
      },
      template: tmpl(`
        <comp>{{c}}</comp>
      `),
      data: {
        c: 123,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(domHtml(elem)).toBe('<comp>123</comp>')
    elem.setData({
      c: 'ABC',
    })
    expect(domHtml(elem)).toBe('<comp>ABC</comp>')
  })

  test('event handling', () => {
    const ops: number[] = []
    const def = glassEasel.registerElement({
      options: {
        externalComponent: true,
      },
      template: tmpl(`
        <div id="outer" bind:touchstart="outerStart" bind:touchend="outerEnd">
          <span id="inner" bind:touchstart="innerStart" bind:touchend="innerEnd">
            <slot />
          </span>
        </div>
      `),
      methods: {
        outerStart() {
          ops.push(1)
        },
        innerStart() {
          ops.push(2)
        },
        outerEnd() {
          throw new Error('unreachable')
        },
        innerEnd() {
          ops.push(3)
          return false
        },
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(domHtml(elem)).toBe('<div><span></span></div>')
    const evOps = {
      bubbles: true,
      composed: true,
    }
    glassEasel.triggerExternalEvent(
      elem,
      elem.$.inner as glassEasel.GeneralBackendElement,
      'touchstart',
      {},
      evOps,
    )
    glassEasel.triggerExternalEvent(
      elem,
      elem.$.inner as glassEasel.GeneralBackendElement,
      'touchend',
      {},
      evOps,
    )
    expect(ops).toStrictEqual([2, 1, 3])
  })

  test('nesting event handling', () => {
    let ops: number[] = []
    const native = glassEasel.registerElement({
      options: {
        externalComponent: true,
      },
      template: tmpl(`
        <div id="div" bind:touchstart="onStart">
          <slot />
        </div>
      `),
      methods: {
        onStart() {
          ops.push(1)
        },
      },
    })
    const normal = glassEasel.registerElement({
      template: tmpl(`
        <div id="div" capture-bind:touchstart="captureStart" bind:touchstart="onStart">
          <slot />
        </div>
      `),
      methods: {
        captureStart() {
          ops.push(2)
        },
        onStart() {
          ops.push(3)
        },
      },
    })
    const comp = glassEasel.registerElement({
      using: {
        native,
        normal,
      },
      template: tmpl(`
        <native capture-bind:touchstart="captureStart" bind:touchstart="onStart">
          <normal>
            <native id="inner"/>
          </normal>
        </native>
      `),
      methods: {
        captureStart() {
          ops.push(4)
        },
        onStart() {
          ops.push(5)
        },
      },
    })
    const elem = glassEasel.Component.createWithContext('root', comp.general(), domBackend)
    expect(domHtml(elem)).toBe(
      '<native><div><normal><div><native><div></div></native></div></normal></div></native>',
    )
    const inner = (elem.$.inner as glassEasel.Element).asInstanceOf(native)!

    glassEasel.triggerExternalEvent(
      inner,
      inner.$.div as glassEasel.GeneralBackendElement,
      'touchstart',
      {},
      { bubbles: true, capturePhase: true, composed: true },
    )
    expect(ops).toStrictEqual([4, 2, 1, 3, 1, 5])

    ops = []
    glassEasel.triggerExternalEvent(
      inner,
      inner.$.div as glassEasel.GeneralBackendElement,
      'touchstart',
      {},
      { bubbles: false, capturePhase: true, composed: true },
    )
    expect(ops).toStrictEqual([4, 2, 1])

    ops = []
    glassEasel.triggerExternalEvent(
      inner,
      inner.$.div as glassEasel.GeneralBackendElement,
      'touchstart',
      {},
      { bubbles: true, capturePhase: false, composed: true },
    )
    expect(ops).toStrictEqual([1, 3, 1, 5])

    ops = []
    glassEasel.triggerExternalEvent(
      inner,
      inner.$.div as glassEasel.GeneralBackendElement,
      'touchstart',
      {},
      { bubbles: true, capturePhase: true, composed: false },
    )
    expect(ops).toStrictEqual([1])

    ops = []
    glassEasel.triggerExternalEvent(
      inner,
      inner.$$ as glassEasel.GeneralBackendElement,
      'touchstart',
      {},
      { bubbles: true, capturePhase: true, composed: true },
    )
    expect(ops).toStrictEqual([4, 2, 3, 1, 5])

    ops = []
    glassEasel.triggerExternalEvent(
      inner,
      inner.$$ as glassEasel.GeneralBackendElement,
      'touchstart',
      {},
      { bubbles: true, capturePhase: true, composed: false },
    )
    expect(ops).toStrictEqual([])
  })
})
