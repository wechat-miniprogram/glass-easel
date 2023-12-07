import { tmpl, domBackend } from '../base/env'
import * as glassEasel from '../../src'

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

describe('model value binding', () => {
  test('model value binding on single data path', () => {
    let updateCount = 0
    const subComp = glassEasel.registerElement({
      template: tmpl(`
        <div id="a" data-a="{{ propA }}">
          <slot />
        </div>
      `),
      properties: {
        propA: Number,
      },
      observers: {
        propA() {
          updateCount += 1
        },
      },
    })
    const def = glassEasel.registerElement({
      using: {
        comp: subComp.general(),
      },
      template: tmpl(`
        <comp id="comp" model:prop-a="{{ a.b[c] }}">{{a.b[c]}}</comp>
      `),
      data: {
        a: {
          b: [10, 100],
        },
        c: 0,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def, domBackend)
    const comp = elem.getShadowRoot()!.getElementById('comp')! as glassEasel.GeneralComponent
    expect(domHtml(elem)).toBe('<comp><div>10</div></comp>')
    expect(updateCount).toBe(1)
    expect(comp.getShadowRoot()!.getElementById('a')!.dataset.a).toBe(10)
    comp.setData({ propA: 20 })
    expect(domHtml(elem)).toBe('<comp><div>20</div></comp>')
    expect(updateCount).toBe(3)
    expect(comp.getShadowRoot()!.getElementById('a')!.dataset.a).toBe(20)
    expect(elem.data.a).toEqual({ b: [20, 100] })
    elem.setData({ 'a.b[0]': 30 })
    expect(domHtml(elem)).toBe('<comp><div>30</div></comp>')
    expect(updateCount).toBe(4)
    expect(comp.getShadowRoot()!.getElementById('a')!.dataset.a).toBe(30)
    elem.setData({ 'a.b[1]': 200 })
    expect(updateCount).toBe(4)
    elem.setData({ c: 1 })
    expect(domHtml(elem)).toBe('<comp><div>200</div></comp>')
    expect(updateCount).toBe(5)
    expect(comp.getShadowRoot()!.getElementById('a')!.dataset.a).toBe(200)
    comp.setData({ propA: 300 })
    expect(domHtml(elem)).toBe('<comp><div>300</div></comp>')
    expect(updateCount).toBe(7)
    expect(comp.getShadowRoot()!.getElementById('a')!.dataset.a).toBe(300)
    expect(elem.data.a).toEqual({ b: [30, 300] })
  })

  test('model value binding for items', () => {
    const subComp = glassEasel.registerElement({
      template: tmpl('{{propB}}:{{propA}}'),
      properties: {
        propA: String,
        propB: Number,
      },
    })
    const def = glassEasel.registerElement({
      using: {
        comp: subComp.general(),
      },
      template: tmpl(`
        <block wx:for="{{list}}">
          <comp id="comp{{index}}" model:prop-a="{{ item.a }}" model:prop-b="{{ list[index + 1 - 1].b }}"></comp>
        </block>
      `),
      data: {
        list: [
          {
            a: 'X',
            b: 123,
          },
          {
            a: 'Y',
            b: 456,
          },
        ],
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def, domBackend)
    const comp0 = elem.getShadowRoot()!.getElementById('comp0')! as glassEasel.GeneralComponent
    const comp1 = elem.getShadowRoot()!.getElementById('comp1')! as glassEasel.GeneralComponent
    expect(domHtml(elem)).toBe('<comp>123:X</comp><comp>456:Y</comp>')
    comp0.setData({ propA: 'X0', propB: 1230 })
    expect(domHtml(elem)).toBe('<comp>1230:X0</comp><comp>456:Y</comp>')
    expect(elem.data.list).toEqual([
      { a: 'X0', b: 1230 },
      { a: 'Y', b: 456 },
    ])
    comp1.setData({ propA: 'Y0', propB: 4560 })
    expect(domHtml(elem)).toBe('<comp>1230:X0</comp><comp>4560:Y0</comp>')
    expect(elem.data.list).toEqual([
      { a: 'X0', b: 1230 },
      { a: 'Y0', b: 4560 },
    ])
    elem.setData({ list: [{ a: 'Z', b: 789 }] })
    expect(domHtml(elem)).toBe('<comp>789:Z</comp>')
  })

  test('invalid model value binding for items', () => {
    const subComp = glassEasel.registerElement({
      template: tmpl('{{propA}}'),
      properties: {
        propA: Number,
      },
    })
    const def = glassEasel.registerElement({
      using: {
        comp: subComp.general(),
      },
      template: tmpl(`
        <block wx:for="{{list || []}}" wx:for-item="sublist">
          <block wx:for="{{sublist.a}}">
            <comp id="comp" model:prop-a="{{item}}"></comp>
          </block>
        </block>
      `),
      data: {
        list: [{ a: [123] }],
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def, domBackend)
    const comp = elem.getShadowRoot()!.getElementById('comp')! as glassEasel.GeneralComponent
    expect(domHtml(elem)).toBe('<comp>123</comp>')
    comp.setData({ propA: 456 })
    expect(domHtml(elem)).toBe('<comp>456</comp>')
    expect(elem.data.list).toEqual([{ a: [123] }])
  })

  test('invalidate model value binding for non-lvalue', () => {
    const subComp = glassEasel.registerElement({
      template: tmpl('{{propA}}'),
      properties: {
        propA: Number,
      },
    })
    const def = glassEasel.registerElement({
      using: {
        comp: subComp.general(),
      },
      template: tmpl(`
        <block wx:for="{{ [123, 456] }}">
          <comp id="comp{{index}}" model:prop-a="{{ item }}" />
        </block>
      `),
      data: {},
    })
    const elem = glassEasel.Component.createWithContext('root', def, domBackend)
    const comp0 = elem.getShadowRoot()!.getElementById('comp0')! as glassEasel.GeneralComponent
    const comp1 = elem.getShadowRoot()!.getElementById('comp1')! as glassEasel.GeneralComponent
    expect(domHtml(elem)).toBe('<comp>123</comp><comp>456</comp>')
    comp0.setData({ propA: 321 })
    expect(domHtml(elem)).toBe('<comp>321</comp><comp>456</comp>')
    comp1.setData({ propA: 654 })
    expect(domHtml(elem)).toBe('<comp>321</comp><comp>654</comp>')
  })

  test('nested model value bindings', () => {
    const subCompA = glassEasel.registerElement({
      template: tmpl(`
        <div>{{propA}}</div>
      `),
      properties: {
        propA: Number,
      },
    })
    const subCompB = glassEasel.registerElement({
      using: {
        comp: subCompA.general(),
      },
      template: tmpl(`
        <comp id="comp" model:prop-a="{{ propB }}"></comp>
      `),
      properties: {
        propB: Number,
      },
    })
    const def = glassEasel.registerElement({
      using: {
        comp: subCompB.general(),
      },
      template: tmpl(`
        <comp id="comp" model:prop-b="{{ b }}"></comp>
      `),
      data: {
        b: 123,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def, domBackend)
    const compB = elem.getShadowRoot()!.getElementById('comp')!.asInstanceOf(subCompB)!
    const compA = compB.getShadowRoot()!.getElementById('comp')!.asInstanceOf(subCompA)!
    expect(domHtml(elem)).toBe('<comp><comp><div>123</div></comp></comp>')
    compA.setData({ propA: 45 })
    expect(domHtml(elem)).toBe('<comp><comp><div>45</div></comp></comp>')
    expect(elem.data.b).toBe(45)
    expect(compB.data.propB).toBe(45)
    expect(compA.data.propA).toBe(45)
    compB.setData({ propB: 67 })
    expect(domHtml(elem)).toBe('<comp><comp><div>67</div></comp></comp>')
    expect(elem.data.b).toBe(67)
    expect(compB.data.propB).toBe(67)
    expect(compA.data.propA).toBe(67)
    elem.setData({ b: 89 })
    expect(domHtml(elem)).toBe('<comp><comp><div>89</div></comp></comp>')
    expect(elem.data.b).toBe(89)
    expect(compB.data.propB).toBe(89)
    expect(compA.data.propA).toBe(89)
  })

  test('model value binding on native node (DOM input)', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div>{{s}}</div>
        <textarea id="a" model:value="{{s}}" />
      `),
      data: {
        s: 'initial',
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def, domBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div>initial</div><textarea value="initial"></textarea>')
    const input = elem.getShadowRoot()!.getElementById('a')!.$$ as unknown as HTMLInputElement
    input.value = 'changed'
    const ev = new Event('input') as InputEvent
    input.dispatchEvent(ev)
    expect(domHtml(elem)).toBe('<div>changed</div><textarea value="changed"></textarea>')
  })

  test('model value binding on native node (DOM checkbox)', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div>{{v}}</div>
        <input type="checkbox" id="a" model:checked="{{v}}" />
      `),
      data: {
        v: false,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def, domBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div>false</div><input type="checkbox">')
    const input = elem.getShadowRoot()!.getElementById('a')!.$$ as unknown as HTMLInputElement
    input.checked = true
    const ev = new Event('change') as InputEvent
    input.dispatchEvent(ev)
    expect(domHtml(elem)).toBe('<div>true</div><input type="checkbox" checked="">')
  })
})
