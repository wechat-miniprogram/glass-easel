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
    expect(domHtml(elem)).toBe('<comp is=""><div>2<span>1</span></div></comp>')
    elem.setData({
      c: 10,
    })
    expect(domHtml(elem)).toBe('<comp is=""><div>11<span>10</span></div></comp>')
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
    expect(domHtml(elem)).toBe('<comp is=""><div>cA<span></span></div><virtual>A</virtual></comp>')
    elem.setData({
      c: 'B',
    })
    expect(domHtml(elem)).toBe('<comp is=""><div>cB<span></span></div><virtual>B</virtual></comp>')
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
    expect(domHtml(elem)).toBe('<comp is="">123</comp>')
    elem.setData({
      c: 'ABC',
    })
    expect(domHtml(elem)).toBe('<comp is="">ABC</comp>')
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
})
