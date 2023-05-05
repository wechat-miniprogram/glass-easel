import { tmpl } from '../base/env'
import * as glassEasel from '../../src'

describe('binding expression', () => {
  test('keywords', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="n1" data-a="{{ false }}"></div>
        <div id="n2" data-a="{{ true }}"></div>
        <div id="n3" data-a="{{ null }}"></div>
        <div id="n4" data-a="{{ undefined }}"></div>
        <div id="n5" data-a="{{ truefalse }}"></div>
        <div id="n6" data-a="{{ { null: nullnull.undefined, truefalse } }}"></div>
      `),
      data: {
        false: 1,
        true: 1,
        null: 1,
        undefined: 1,
        nullnull: {
          undefined: 456,
        },
        truefalse: 123,
      },
    })
    const elem = glassEasel.createElement('root', def.general())
    const n1 = elem.getShadowRoot()!.getElementById('n1')!
    const n2 = elem.getShadowRoot()!.getElementById('n2')!
    const n3 = elem.getShadowRoot()!.getElementById('n3')!
    const n4 = elem.getShadowRoot()!.getElementById('n4')!
    const n5 = elem.getShadowRoot()!.getElementById('n5')!
    const n6 = elem.getShadowRoot()!.getElementById('n6')!
    expect(n1.dataset!.a).toEqual(false)
    expect(n2.dataset!.a).toEqual(true)
    expect(n3.dataset!.a).toEqual(null)
    expect(n4.dataset!.a).toEqual(undefined)
    expect(n5.dataset!.a).toEqual(123)
    expect(n6.dataset!.a).toStrictEqual({ null: 456, truefalse: 123 })
  })

  test('basic operators', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="n1" data-a="{{ a + ' ' + b + c }}"></div>
        <div id="n2" data-a="{{ b - c - 1 }}"></div>
        <div id="n3" data-a="{{ b * c }}"></div>
        <div id="n4" data-a="{{ b / c / 2 }}"></div>
        <div id="n5" data-a="{{ 10 + b % (c + 1) }}"></div>
      `),
      data: {
        a: 'A',
        b: 100,
        c: 5,
      },
    })
    const elem = glassEasel.createElement('root', def.general())
    const n1 = elem.getShadowRoot()!.getElementById('n1')!
    const n2 = elem.getShadowRoot()!.getElementById('n2')!
    const n3 = elem.getShadowRoot()!.getElementById('n3')!
    const n4 = elem.getShadowRoot()!.getElementById('n4')!
    const n5 = elem.getShadowRoot()!.getElementById('n5')!
    expect(n1.dataset!.a).toEqual('A 1005')
    expect(n2.dataset!.a).toEqual(94)
    expect(n3.dataset!.a).toEqual(500)
    expect(n4.dataset!.a).toEqual(10)
    expect(n5.dataset!.a).toEqual(14)
    elem.setData({ c: 10 })
    expect(n1.dataset!.a).toEqual('A 10010')
    expect(n2.dataset!.a).toEqual(89)
    expect(n3.dataset!.a).toEqual(1000)
    expect(n4.dataset!.a).toEqual(5)
    expect(n5.dataset!.a).toEqual(11)
  })

  test('unary operators', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="n1" data-a="{{ !a }}"></div>
        <div id="n2" data-a="{{ ~b }}"></div>
        <div id="n3" data-a="{{ +a }}"></div>
        <div id="n4" data-a="{{ -b }}"></div>
      `),
      data: {
        a: '123',
        b: 456,
      },
    })
    const elem = glassEasel.createElement('root', def.general())
    const n1 = elem.getShadowRoot()!.getElementById('n1')!
    const n2 = elem.getShadowRoot()!.getElementById('n2')!
    const n3 = elem.getShadowRoot()!.getElementById('n3')!
    const n4 = elem.getShadowRoot()!.getElementById('n4')!
    expect(n1.dataset!.a).toEqual(false)
    expect(n2.dataset!.a).toEqual(-457)
    expect(n3.dataset!.a).toEqual(123)
    expect(n4.dataset!.a).toEqual(-456)
    elem.setData({ a: null, b: '789' })
    expect(n1.dataset!.a).toEqual(true)
    expect(n2.dataset!.a).toEqual(-790)
    expect(n3.dataset!.a).toEqual(0)
    expect(n4.dataset!.a).toEqual(-789)
  })

  test('comparison operators', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="n1" data-a="{{ a < b }}"></div>
        <div id="n2" data-a="{{ a > b }}"></div>
        <div id="n3" data-a="{{ a <= b }}"></div>
        <div id="n4" data-a="{{ a >= b }}"></div>
        <div id="n5" data-a="{{ a == b }}"></div>
        <div id="n6" data-a="{{ a != b }}"></div>
        <div id="n7" data-a="{{ a === b }}"></div>
        <div id="n8" data-a="{{ a !== b }}"></div>
      `),
      data: {
        a: '10',
        b: 11,
      },
    })
    const elem = glassEasel.createElement('root', def.general())
    const n1 = elem.getShadowRoot()!.getElementById('n1')!
    const n2 = elem.getShadowRoot()!.getElementById('n2')!
    const n3 = elem.getShadowRoot()!.getElementById('n3')!
    const n4 = elem.getShadowRoot()!.getElementById('n4')!
    const n5 = elem.getShadowRoot()!.getElementById('n5')!
    const n6 = elem.getShadowRoot()!.getElementById('n6')!
    const n7 = elem.getShadowRoot()!.getElementById('n7')!
    const n8 = elem.getShadowRoot()!.getElementById('n8')!
    expect(n1.dataset!.a).toEqual(true)
    expect(n2.dataset!.a).toEqual(false)
    expect(n3.dataset!.a).toEqual(true)
    expect(n4.dataset!.a).toEqual(false)
    expect(n5.dataset!.a).toEqual(false)
    expect(n6.dataset!.a).toEqual(true)
    expect(n7.dataset!.a).toEqual(false)
    expect(n8.dataset!.a).toEqual(true)
    elem.setData({ b: 9 })
    expect(n1.dataset!.a).toEqual(false)
    expect(n2.dataset!.a).toEqual(true)
    expect(n3.dataset!.a).toEqual(false)
    expect(n4.dataset!.a).toEqual(true)
    expect(n5.dataset!.a).toEqual(false)
    expect(n6.dataset!.a).toEqual(true)
    expect(n7.dataset!.a).toEqual(false)
    expect(n8.dataset!.a).toEqual(true)
    elem.setData({ a: '9' })
    expect(n1.dataset!.a).toEqual(false)
    expect(n2.dataset!.a).toEqual(false)
    expect(n3.dataset!.a).toEqual(true)
    expect(n4.dataset!.a).toEqual(true)
    expect(n5.dataset!.a).toEqual(true)
    expect(n6.dataset!.a).toEqual(false)
    expect(n7.dataset!.a).toEqual(false)
    expect(n8.dataset!.a).toEqual(true)
    elem.setData({ b: '9' })
    expect(n1.dataset!.a).toEqual(false)
    expect(n2.dataset!.a).toEqual(false)
    expect(n3.dataset!.a).toEqual(true)
    expect(n4.dataset!.a).toEqual(true)
    expect(n5.dataset!.a).toEqual(true)
    expect(n6.dataset!.a).toEqual(false)
    expect(n7.dataset!.a).toEqual(true)
    expect(n8.dataset!.a).toEqual(false)
  })

  test('logic and bit logic operators', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="n1" data-a="{{ a & b }}"></div>
        <div id="n2" data-a="{{ a | b }}"></div>
        <div id="n3" data-a="{{ a ^ b }}"></div>
        <div id="n4" data-a="{{ a && b }}"></div>
        <div id="n5" data-a="{{ a || b }}"></div>
      `),
      data: {
        a: 3,
        b: 6,
      },
    })
    const elem = glassEasel.createElement('root', def.general())
    const n1 = elem.getShadowRoot()!.getElementById('n1')!
    const n2 = elem.getShadowRoot()!.getElementById('n2')!
    const n3 = elem.getShadowRoot()!.getElementById('n3')!
    const n4 = elem.getShadowRoot()!.getElementById('n4')!
    const n5 = elem.getShadowRoot()!.getElementById('n5')!
    expect(n1.dataset!.a).toEqual(2)
    expect(n2.dataset!.a).toEqual(7)
    expect(n3.dataset!.a).toEqual(5)
    expect(n4.dataset!.a).toEqual(6)
    expect(n5.dataset!.a).toEqual(3)
    elem.setData({ a: 0, b: 15 })
    expect(n1.dataset!.a).toEqual(0)
    expect(n2.dataset!.a).toEqual(15)
    expect(n3.dataset!.a).toEqual(15)
    expect(n4.dataset!.a).toEqual(0)
    expect(n5.dataset!.a).toEqual(15)
  })

  test('conditional operator', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="n1" data-a="{{ a ? b : c }}"></div>
      `),
      data: {
        a: {},
        b: 1,
        c: 2,
      },
    })
    const elem = glassEasel.createElement('root', def.general())
    const n1 = elem.getShadowRoot()!.getElementById('n1')!
    expect(n1.dataset!.a).toEqual(1)
    elem.setData({ a: 0 })
    expect(n1.dataset!.a).toEqual(2)
    elem.setData({ a: [], b: 3 })
    expect(n1.dataset!.a).toEqual(3)
  })

  test('operator order', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="n0" data-a="{{ false ? 1 || 2 : 3 || 4 }}"></div>
        <div id="n1" data-a="{{ 1 || 2 && 3 }}" data-b="{{ 0 && 1 || 2 }}"></div>
        <div id="n2" data-a="{{ 0 && 2 | 3 }}" data-b="{{ 2 | 3 && 0 }}"></div>
        <div id="n3" data-a="{{ 1 | 6 ^ 3 }}" data-b="{{ 3 ^ 6 | 1 }}"></div>
        <div id="n4" data-a="{{ 5 ^ 6 & 3 }}" data-b="{{ 3 & 6 ^ 5 }}"></div>
        <div id="n5" data-a="{{ 5 & 6 === 4 }}" data-b="{{ 4 == 6 & 5 }}"></div>
        <div id="n6" data-a="{{ 3 !== 2 > 1 }}" data-b="{{ 1 < 2 !== 3 }}"></div>
        <div id="n7" data-a="{{ 'A' + 2 > 1 }}" data-b="{{ 1 < 'A' + 2 }}"></div>
        <div id="n8" data-a="{{ 3 + 4 % 3 }}" data-b="{{ 4 % 3 + 3 }}"></div>
        <div id="n9" data-a="{{ - 1 + 3 }}" data-b="{{ 3 + - 1 }}"></div>
        <div id="n10" data-a="{{ - (1 + 3) }}" data-b="{{ 3 - (2 - 1) }}"></div>
      `),
    })
    const elem = glassEasel.createElement('root', def.general())
    const n0 = elem.getShadowRoot()!.getElementById('n0')!
    expect(n0.dataset!.a).toEqual(3)
    const n1 = elem.getShadowRoot()!.getElementById('n1')!
    expect(n1.dataset!.a).toEqual(1)
    expect(n1.dataset!.b).toEqual(2)
    const n2 = elem.getShadowRoot()!.getElementById('n2')!
    expect(n2.dataset!.a).toEqual(0)
    expect(n2.dataset!.b).toEqual(0)
    const n3 = elem.getShadowRoot()!.getElementById('n3')!
    expect(n3.dataset!.a).toEqual(5)
    expect(n3.dataset!.b).toEqual(5)
    const n4 = elem.getShadowRoot()!.getElementById('n4')!
    expect(n4.dataset!.a).toEqual(7)
    expect(n4.dataset!.b).toEqual(7)
    const n5 = elem.getShadowRoot()!.getElementById('n5')!
    expect(n5.dataset!.a).toEqual(0)
    expect(n5.dataset!.b).toEqual(0)
    const n6 = elem.getShadowRoot()!.getElementById('n6')!
    expect(n6.dataset!.a).toEqual(true)
    expect(n6.dataset!.b).toEqual(true)
    const n7 = elem.getShadowRoot()!.getElementById('n7')!
    expect(n7.dataset!.a).toEqual(false)
    expect(n7.dataset!.b).toEqual(false)
    const n8 = elem.getShadowRoot()!.getElementById('n8')!
    expect(n8.dataset!.a).toEqual(4)
    expect(n8.dataset!.b).toEqual(4)
    const n10 = elem.getShadowRoot()!.getElementById('n10')!
    expect(n10.dataset!.a).toEqual(-4)
    expect(n10.dataset!.b).toEqual(2)
  })

  test('array literals', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="a" data-a="{{ [123, a, 456] }}"></div>
      `),
    })
    const elem = glassEasel.createElement('root', def.general())
    const eA = elem.getShadowRoot()!.getElementById('a')!
    expect(eA.dataset!.a).toEqual([123, undefined, 456])
    elem.setData({ a: 789 })
    expect(eA.dataset!.a).toEqual([123, 789, 456])
  })

  test('object literal path analysis', () => {
    const onTChanged = jest.fn()
    const onUChanged = jest.fn()
    const subComp = glassEasel.registerElement({
      template: tmpl(''),
      properties: { t: String, u: String },
      observers: { t: onTChanged, u: onUChanged },
    })
    const comp = glassEasel.registerElement({
      using: { sub: subComp.general() },
      template: tmpl(`
        <template name="test">
          <sub t="{{ arr[0] || '' }}" u="{{ arr[1] || '' }}" />
        </template>
        <template is="test" data="{{ arr: [a[b], a[c]] }}" />
      `),
    })
    const elem = glassEasel.createElement('comp', comp.general())
    expect(onTChanged).toBeCalledTimes(1)
    expect(onUChanged).toBeCalledTimes(1)
    elem.setData({ a: [0, 1], b: 0, c: 1 })
    expect(onTChanged).toBeCalledTimes(2)
    expect(onUChanged).toBeCalledTimes(2)
    elem.setData({ b: 1 })
    expect(onTChanged).toBeCalledTimes(3)
    expect(onUChanged).toBeCalledTimes(2)
  })

  test('array literal path analysis', () => {
    const onTChanged = jest.fn()
    const onUChanged = jest.fn()
    const subComp = glassEasel.registerElement({
      template: tmpl(''),
      properties: { t: String, u: String },
      observers: { t: onTChanged, u: onUChanged },
    })
    const comp = glassEasel.registerElement({
      using: { sub: subComp.general() },
      template: tmpl(
        [
          '<template name="test">',
          '  <sub t="{{ t || \'\' }}" u="{{ u || \'\' }}"/>',
          '</template>',
          '<template is="test" data={{ t: a[b], u: a[c] }} />',
        ].join(''),
      ),
    })
    const elem = glassEasel.createElement('comp', comp.general())
    expect(onTChanged).toBeCalledTimes(1)
    expect(onUChanged).toBeCalledTimes(1)
    elem.setData({ a: [0, 1], b: 0, c: 1 })
    expect(onTChanged).toBeCalledTimes(2)
    expect(onUChanged).toBeCalledTimes(2)
    elem.setData({ b: 1 })
    expect(onTChanged).toBeCalledTimes(3)
    expect(onUChanged).toBeCalledTimes(2)
  })

  test('static member visit and update', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="a" data-a="{{ a }}"></div>
        <div id="b" data-a="{{ a.b }}"></div>
        <div id="c" data-a="{{ a.b.c }}"></div>
      `),
      data: {
        a: {
          b: 123,
        } as { b: number | { c: number } } | number,
      },
    })
    const elem = glassEasel.createElement('root', def)
    const eA = elem.getShadowRoot()!.getElementById('a')!
    const eB = elem.getShadowRoot()!.getElementById('b')!
    const eC = elem.getShadowRoot()!.getElementById('c')!
    expect(eA.dataset!.a).toEqual({ b: 123 })
    expect(eA.dataset!.a === elem.data.a).toBe(false)
    expect(eB.dataset!.a).toEqual(123)
    expect(eC.dataset!.a).toBeUndefined()
    elem.setData({ 'a.b': 456 })
    expect(eA.dataset!.a).toEqual({ b: 456 })
    expect(eA.dataset!.a === elem.data.a).toBe(false)
    expect(eB.dataset!.a).toEqual(456)
    expect(eC.dataset!.a).toBeUndefined()
    elem.setData({ 'a.b.c': 789 })
    expect(eA.dataset!.a).toEqual({ b: { c: 789 } })
    expect(eA.dataset!.a === elem.data.a).toBe(false)
    expect(eB.dataset!.a).toEqual({ c: 789 })
    expect(eB.dataset!.a === (elem.data.a as { [key: string]: glassEasel.DataValue }).b).toBe(false)
    expect(eC.dataset!.a).toEqual(789)
    elem.setData({ a: 0 })
    expect(eA.dataset!.a).toEqual(0)
    expect(eB.dataset!.a).toBeUndefined()
    expect(eC.dataset!.a).toBeUndefined()
  })

  test('dynamic member visit and update', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="a" data-a="{{ a }}"></div>
        <div id="b" data-a="{{ a.b[d] }}"></div>
        <div id="c" data-a="{{ a.b[d].c }}"></div>
      `),
      data: {
        a: {
          b: [123, 456],
        } as { b: (number | { c: number })[] } | number,
        d: 0,
      },
    })
    const elem = glassEasel.createElement('root', def)
    const eA = elem.getShadowRoot()!.getElementById('a')!
    const eB = elem.getShadowRoot()!.getElementById('b')!
    const eC = elem.getShadowRoot()!.getElementById('c')!
    expect(eA.dataset!.a).toEqual({ b: [123, 456] })
    expect(eA.dataset!.a === elem.data.a).toBe(false)
    expect(eB.dataset!.a).toEqual(123)
    expect(eC.dataset!.a).toBeUndefined()
    elem.setData({ d: 1 })
    expect(eA.dataset!.a).toEqual({ b: [123, 456] })
    expect(eA.dataset!.a === elem.data.a).toBe(false)
    expect(eB.dataset!.a).toEqual(456)
    expect(eC.dataset!.a).toBeUndefined()
    elem.setData({ 'a.b[1].c': 789 })
    expect(eA.dataset!.a).toEqual({ b: [123, { c: 789 }] })
    expect(eA.dataset!.a === elem.data.a).toBe(false)
    expect(eB.dataset!.a).toEqual({ c: 789 })
    expect(eB.dataset!.a === (elem.data.a as { [key: string]: glassEasel.DataValue }).b).toBe(false)
    expect(eC.dataset!.a).toEqual(789)
    elem.setData({ a: 0 })
    expect(eA.dataset!.a).toEqual(0)
    expect(eB.dataset!.a).toBeUndefined()
    expect(eC.dataset!.a).toBeUndefined()
  })

  test('nested dynamic member visit and update', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="a" data-a="{{ a[b[c]] }}"></div>
      `),
      data: {
        a: [10, 20, 30],
        b: [1, 2],
        c: 0,
      },
    })
    const elem = glassEasel.createElement('root', def.general())
    const eA = elem.getShadowRoot()!.getElementById('a')!
    expect(eA.dataset!.a).toEqual(20)
    elem.setData({ c: 1 })
    expect(eA.dataset!.a).toEqual(30)
    elem.setData({ 'b[1]': 0 })
    expect(eA.dataset!.a).toEqual(10)
    elem.setData({ b: [0, 1] })
    expect(eA.dataset!.a).toEqual(20)
    elem.setData({ a: [100, 200, 300] })
    expect(eA.dataset!.a).toEqual(200)
    elem.setData({ c: 0 })
    expect(eA.dataset!.a).toEqual(100)
  })
})
