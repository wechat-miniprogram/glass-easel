import { tmpl, domBackend } from '../base/env'
import * as glassEasel from '../../src'

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

describe('binding map update enabled', () => {
  test('multi-target update', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div class="class-a {{c}}">
          <span id="b" data-a="{{c}}">{{c}}</span>
        </div>
      `),
      data: {
        c: 'abc',
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    const child = elem.getShadowRoot()!.getElementById('b')!
    expect(domHtml(elem)).toBe('<div class="class-a abc"><span>abc</span></div>')
    expect(child.dataset!.a).toBe('abc')
    elem.setData({ c: 'def' })
    expect(domHtml(elem)).toBe('<div class="class-a def"><span>def</span></div>')
    expect(child.dataset!.a).toBe('def')
  })

  test('model data path update', () => {
    const subComp = glassEasel.registerElement({
      template: tmpl(`
        <div>{{propA}}</div>
        <slot />
      `),
      properties: {
        propA: Number,
      },
    })
    const def = glassEasel.registerElement({
      using: {
        comp: subComp.general(),
      },
      template: tmpl(`
        <comp id="comp" model:prop-a="{{ list[index].a }}">{{ ['A', 'B', 'C'][index + 1] }}</comp>
      `),
      data: {
        index: 0,
        list: [{
          a: 123,
        }, {
          a: 456,
        }],
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def, domBackend)
    const comp = elem.getShadowRoot()!.getElementById('comp') as glassEasel.GeneralComponent
    expect(domHtml(elem)).toBe('<comp><div>123</div>B</comp>')
    comp.setData({ propA: 789 })
    expect(domHtml(elem)).toBe('<comp><div>789</div>B</comp>')
    expect(elem.data.list).toEqual([{ a: 789 }, { a: 456 }])
    elem.setData({ index: 1 })
    expect(domHtml(elem)).toBe('<comp><div>456</div>C</comp>')
    expect(elem.data.list).toEqual([{ a: 789 }, { a: 456 }])
    comp.setData({ propA: 123 })
    expect(domHtml(elem)).toBe('<comp><div>123</div>C</comp>')
    expect(elem.data.list).toEqual([{ a: 789 }, { a: 123 }])
  })
})

describe('binding map update forced', () => {
  test('mixed usage in multiple components', () => {
    const subComp = glassEasel.registerElement({
      properties: {
        content: String,
        propA: Number,
      },
      template: tmpl(`
        <div>{{content}}</div>
      `),
    })
    const def = glassEasel.registerElement({
      using: {
        'sub-comp': subComp.general(),
      },
      template: tmpl(`
        <sub-comp content="{{c}}" model:prop-a="{{a}}" />
      `, { updateMode: 'bindingMap' }),
      data: {
        a: 123,
        c: 'abc',
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def, domBackend)
    const child = (elem.getShadowRoot()!.childNodes[0] as glassEasel.GeneralComponent)
      .asInstanceOf(subComp)!
    expect(domHtml(elem)).toBe('<sub-comp><div>abc</div></sub-comp>')
    elem.setData({ c: 'def' })
    expect(domHtml(elem)).toBe('<sub-comp><div>def</div></sub-comp>')
    child.setData({ propA: 456 })
    expect(elem.data.a).toBe(456)
    child.setData({ propA: 789 })
    expect(elem.data.a).toBe(789)
  })

  test('ignore fields with usage in if position', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div>{{a}}</div>
        <div>{{b}}</div>
        <div>{{c}}</div>
        <div wx:if="{{b}}">{{c}}</div>
      `, { updateMode: 'bindingMap' }),
      data: {
        a: 1,
        b: 2,
        c: 3,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(domHtml(elem)).toBe('<div>1</div><div>2</div><div>3</div><div>3</div>')
    elem.setData({ b: 20 })
    expect(domHtml(elem)).toBe('<div>1</div><div>2</div><div>3</div><div>3</div>')
    elem.setData({ c: 30 })
    expect(domHtml(elem)).toBe('<div>1</div><div>2</div><div>3</div><div>3</div>')
    elem.setData({ a: 10 })
    expect(domHtml(elem)).toBe('<div>10</div><div>2</div><div>3</div><div>3</div>')
    elem.setData({ a: 100, b: 200 })
    expect(domHtml(elem)).toBe('<div>100</div><div>2</div><div>3</div><div>3</div>')
  })

  test('ignore fields with usage in for position', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div>{{a}}</div>
        <div>{{b}}</div>
        <div>{{c}}</div>
        <div wx:for="{{[1, b]}}">{{c}}</div>
      `, { updateMode: 'bindingMap' }),
      data: {
        a: 1,
        b: 2,
        c: 3,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(domHtml(elem)).toBe('<div>1</div><div>2</div><div>3</div><div>3</div><div>3</div>')
    elem.setData({ b: 20 })
    expect(domHtml(elem)).toBe('<div>1</div><div>2</div><div>3</div><div>3</div><div>3</div>')
    elem.setData({ c: 30 })
    expect(domHtml(elem)).toBe('<div>1</div><div>2</div><div>3</div><div>3</div><div>3</div>')
    elem.setData({ a: 10 })
    expect(domHtml(elem)).toBe('<div>10</div><div>2</div><div>3</div><div>3</div><div>3</div>')
    elem.setData({ a: 100, b: 200 })
    expect(domHtml(elem)).toBe('<div>100</div><div>2</div><div>3</div><div>3</div><div>3</div>')
  })

  test('ignore fields with usage in template position', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <template name="child">
          <div>{{c}}</div>
        </template>
        <div>{{a}}</div>
        <div>{{b}}</div>
        <div>{{c}}</div>
        <template is="{{b}}" data="{{ {c} }}"></template>
      `, { updateMode: 'bindingMap' }),
      data: {
        a: 1,
        b: 'child',
        c: 3,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(domHtml(elem)).toBe('<div>1</div><div>child</div><div>3</div><div>3</div>')
    elem.setData({ b: 20 })
    expect(domHtml(elem)).toBe('<div>1</div><div>child</div><div>3</div><div>3</div>')
    elem.setData({ c: 30 })
    expect(domHtml(elem)).toBe('<div>1</div><div>child</div><div>3</div><div>3</div>')
    elem.setData({ a: 10 })
    expect(domHtml(elem)).toBe('<div>10</div><div>child</div><div>3</div><div>3</div>')
    elem.setData({ a: 100, b: 200 })
    expect(domHtml(elem)).toBe('<div>100</div><div>child</div><div>3</div><div>3</div>')
  })

  test('ignore fields with usage in slot position', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div>{{a}}</div>
        <div>{{b}}</div>
        <slot name="{{b}}"></slot>
      `, { updateMode: 'bindingMap' }),
      data: {
        a: 1,
        b: 2,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(domHtml(elem)).toBe('<div>1</div><div>2</div>')
    elem.setData({ b: 20 })
    expect(domHtml(elem)).toBe('<div>1</div><div>2</div>')
    elem.setData({ a: 10 })
    expect(domHtml(elem)).toBe('<div>10</div><div>2</div>')
    elem.setData({ a: 100, b: 200 })
    expect(domHtml(elem)).toBe('<div>100</div><div>2</div>')
  })
})
