import {
  tmpl,
  multiTmpl,
  domBackend,
  execWithWarn,
  composedBackend,
  shadowBackend,
} from '../base/env'
import { virtual as matchElementWithDom } from '../base/match'
import * as glassEasel from '../../src'

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

const testCases = (testBackend: glassEasel.GeneralBackendContext) => {
  test('basic tree building', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <div style="font-weight: bold">
          <span>Hello world!</span>
        </div>
      `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div style="font-weight: bold"><span>Hello world!</span></div>')
    matchElementWithDom(elem)
  })

  test('comments inside template', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <!-- abc -->
          <span>Hello world!</span>
        `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<span>Hello world!</span>')
    matchElementWithDom(elem)
  })

  test('meta tags inside template', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <!META>
          <span>Hello world!</span>
        `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<span>Hello world!</span>')
    matchElementWithDom(elem)
  })

  test('basic data binding', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <div class="{{a}}">
          <span>{{c}}</span>
        </div>
      `),
        data: {
          a: 123,
          c: 'abc',
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend).general()
    expect(domHtml(elem)).toBe('<div class="123"><span>abc</span></div>')
    matchElementWithDom(elem)
    elem.setData({
      a: true,
      c: false,
    })
    expect(domHtml(elem)).toBe('<div class="true"><span>false</span></div>')
    matchElementWithDom(elem)
  })

  test('if blocks', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <div wx:if="{{cond1}}">a</div>
        <div wx:if="{{cond2}}">b</div>
        <div wx:else>c</div>
        <div wx:if="{{cond1?2:0}}">d</div>
        <div wx:elif="{{cond2}}">e</div>
        <div wx:else>f</div>
      `),
        data: {
          cond1: false,
          cond2: '',
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div>c</div><div>f</div>')
    matchElementWithDom(elem)
    elem.setData({
      cond1: true,
    })
    expect(domHtml(elem)).toBe('<div>a</div><div>c</div><div>d</div>')
    matchElementWithDom(elem)
    elem.setData({
      cond2: 1,
    })
    expect(domHtml(elem)).toBe('<div>a</div><div>b</div><div>d</div>')
    matchElementWithDom(elem)
    elem.setData({
      cond1: null,
    })
    expect(domHtml(elem)).toBe('<div>b</div><div>e</div>')
    matchElementWithDom(elem)
  })

  test('if blocks in template-is', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <template name="sub1">
            <div>{{ aa }}</div>
          </template>
          <template name="sub2">
            <div>{{ aa }}</div>
          </template>
          <template wx:if="{{ cond }}" is="sub1" data="{{ aa: b }}" />
          <template wx:else is="sub2" data="{{ aa: c }}"></template>
        `),
        data: {
          cond: false,
          b: 123,
          c: 456,
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div>456</div>')
    matchElementWithDom(elem)
    elem.setData({
      cond: true,
    })
    expect(domHtml(elem)).toBe('<div>123</div>')
    matchElementWithDom(elem)
    elem.setData({
      cond: false,
      c: 789,
    })
    expect(domHtml(elem)).toBe('<div>789</div>')
    matchElementWithDom(elem)
  })

  test('if blocks in include', () => {
    const def = glassEasel
      .registerElement({
        template: multiTmpl({
          '': '<include wx:if="{{!cond}}" src="./a.wxml" />',
          a: '<div>{{a}}</div>',
        }),
        data: {
          cond: false,
          a: 123,
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div>123</div>')
    matchElementWithDom(elem)
    elem.setData({
      cond: true,
    })
    expect(domHtml(elem)).toBe('')
    matchElementWithDom(elem)
    elem.setData({
      cond: false,
      a: 456,
    })
    expect(domHtml(elem)).toBe('<div>456</div>')
    matchElementWithDom(elem)
  })

  test('if blocks in slot', () => {
    const childComp = glassEasel
      .registerElement({
        options: {
          multipleSlots: true,
        },
        template: tmpl(`
          <slot wx:if="{{ cond1 }}" name="a" />
          <slot wx:elif="{{ cond2 }}" name="c" />
          <slot wx:else name="b"></slot>
        `),
        data: {
          cond1: true,
          cond2: false,
        },
      })
      .general()
    const def = glassEasel
      .registerElement({
        using: {
          child: childComp.general(),
        },
        template: tmpl(`
          <child id="c">
            <span slot="b"></span>
            <div slot="a">A</div>
            <div slot="c">C</div>
          </child>
        `),
        data: {
          cond: false,
          b: 123,
          c: 456,
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    const child = elem.getShadowRoot()!.getElementById('c')!.asInstanceOf(childComp)!
    expect(domHtml(elem)).toBe('<child><div>A</div></child>')
    matchElementWithDom(elem)
    child.setData({
      cond1: false,
      cond2: true,
    })
    expect(domHtml(elem)).toBe('<child><div>C</div></child>')
    matchElementWithDom(elem)
    child.setData({
      cond1: false,
      cond2: false,
    })
    expect(domHtml(elem)).toBe('<child><span></span></child>')
    matchElementWithDom(elem)
  })

  test('for blocks without key', () => {
    const ops: Array<[number, string]> = []
    const itemComp = glassEasel
      .registerElement({
        properties: { s: { type: String } },
        lifetimes: {
          attached() {
            ops.push([-1, this.data.s.toString()])
          },
          detached() {
            ops.push([-2, this.data.s.toString()])
          },
        },
      })
      .general()
    const def = glassEasel
      .registerElement({
        using: {
          'x-c': itemComp,
        },
        template: tmpl(`
        <div wx:for="{{list}}" wx:for-item="v" wx:for-index="k">
          <x-c s="{{v}}">{{k}}</x-c>
        </div>
      `),
        data: {
          list: [10, 20],
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div><x-c>0</x-c></div><div><x-c>1</x-c></div>')
    matchElementWithDom(elem)
    expect(ops).toEqual([
      [-1, '10'],
      [-1, '20'],
    ])
    ops.length = 0
    elem.setData({
      list: [20, 10],
    })
    expect(domHtml(elem)).toBe('<div><x-c>0</x-c></div><div><x-c>1</x-c></div>')
    matchElementWithDom(elem)
    expect(ops).toEqual([])
    ops.length = 0
    elem.setData({
      list: [30, 40, 50, 60],
    })
    expect(domHtml(elem)).toBe(
      '<div><x-c>0</x-c></div><div><x-c>1</x-c></div><div><x-c>2</x-c></div><div><x-c>3</x-c></div>',
    )
    matchElementWithDom(elem)
    expect(ops).toEqual([
      [-1, '50'],
      [-1, '60'],
    ])
    ops.length = 0
    elem.setData({
      list: [50],
    })
    expect(domHtml(elem)).toBe('<div><x-c>0</x-c></div>')
    matchElementWithDom(elem)
    expect(ops).toEqual([
      [-2, '40'],
      [-2, '50'],
      [-2, '60'],
    ])
  })

  test('for blocks with key', () => {
    const ops: Array<[number, string]> = []
    const itemComp = glassEasel
      .registerElement({
        properties: { s: String },
        lifetimes: {
          attached() {
            ops.push([-1, this.data.s.toString()])
          },
          detached() {
            ops.push([-2, this.data.s.toString()])
          },
          moved() {
            ops.push([-3, this.data.s.toString()])
          },
        },
      })
      .general()
    const def = glassEasel
      .registerElement({
        using: {
          'x-c': itemComp,
        },
        template: tmpl(`
        <block wx:for="{{list}}" wx:key="k">
          <x-c data-i="{{index}}" s="{{item.k}}:{{item.v}}">{{item.v}}</x-c>
        </block>
      `),
        data: {
          list: [
            { k: 'a', v: 10 },
            { k: 'b', v: 20 },
          ],
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    const listBlock = elem.getShadowRoot()!.childNodes[0] as glassEasel.VirtualNode
    const checkIndex = () => {
      for (let i = 0; i < listBlock.childNodes.length; i += 1) {
        const itemBlock = listBlock.childNodes[i] as glassEasel.Element
        expect((itemBlock.childNodes[0] as glassEasel.Element).dataset.i).toBe(i)
      }
    }
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<x-c>10</x-c><x-c>20</x-c>')
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([
      [-1, 'a:10'],
      [-1, 'b:20'],
    ])
    ops.length = 0
    elem.setData({
      list: [
        { k: 'c', v: 30 },
        { k: 'a', v: 40 },
        { k: 'd', v: 50 },
        { k: 'b', v: 60 },
        { k: 'e', v: 70 },
      ],
    })
    expect(domHtml(elem)).toBe('<x-c>30</x-c><x-c>40</x-c><x-c>50</x-c><x-c>60</x-c><x-c>70</x-c>')
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([
      [-1, 'c:30'],
      [-1, 'd:50'],
      [-1, 'e:70'],
    ])
    ops.length = 0
    elem.setData({
      list: [
        { k: 'c', v: 30 },
        { k: 'b', v: 60 },
        { k: 'a', v: 40 },
        { k: 'd', v: 50 },
        { k: 'e', v: 70 },
      ],
    })
    expect(domHtml(elem)).toBe('<x-c>30</x-c><x-c>60</x-c><x-c>40</x-c><x-c>50</x-c><x-c>70</x-c>')
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([[-3, 'b:60']])
    ops.length = 0
    elem.setData({
      list: [
        { k: 'c', v: 30 },
        { k: 'b', v: 40 },
        { k: 'd', v: 50 },
        { k: 'e', v: 60 },
        { k: 'a', v: 70 },
      ],
    })
    expect(domHtml(elem)).toBe('<x-c>30</x-c><x-c>40</x-c><x-c>50</x-c><x-c>60</x-c><x-c>70</x-c>')
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([[-3, 'a:40']])
    ops.length = 0
    elem.setData({
      list: [
        { k: 'c', v: 30 },
        { k: 'b', v: 40 },
        { k: 'd', v: 50 },
        { k: 'e', v: 60 },
        { k: 'a', v: 70 },
      ],
    })
    expect(domHtml(elem)).toBe('<x-c>30</x-c><x-c>40</x-c><x-c>50</x-c><x-c>60</x-c><x-c>70</x-c>')
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([])
    ops.length = 0
    elem.setData({
      list: [
        { k: 'b', v: 80 },
        { k: 'e', v: 90 },
      ],
    })
    expect(domHtml(elem)).toBe('<x-c>80</x-c><x-c>90</x-c>')
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([
      [-2, 'c:30'],
      [-2, 'd:50'],
      [-2, 'a:70'],
    ])
  })

  test('nested for blocks', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <block wx:for="{{list}}" wx:for-index="i" wx:for-item="item">
          <div id="{{j}}{{i}}" wx:for="{{item}}" wx:for-index="j">{{item}}</div>
        </block>
      `),
        data: {
          list: [
            { a: '1', b: '2' },
            { c: '3', d: '4' },
          ],
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(
      (elem.getShadowRoot()!.getElementById('a0')!.childNodes[0] as glassEasel.TextNode)
        .textContent,
    ).toBe('1')
    expect(
      (elem.getShadowRoot()!.getElementById('b0')!.childNodes[0] as glassEasel.TextNode)
        .textContent,
    ).toBe('2')
    expect(
      (elem.getShadowRoot()!.getElementById('c1')!.childNodes[0] as glassEasel.TextNode)
        .textContent,
    ).toBe('3')
    expect(
      (elem.getShadowRoot()!.getElementById('d1')!.childNodes[0] as glassEasel.TextNode)
        .textContent,
    ).toBe('4')
    elem.setData({
      list: [{ a: 'A', b: 'B' }],
    })
    expect(
      (elem.getShadowRoot()!.getElementById('a0')!.childNodes[0] as glassEasel.TextNode)
        .textContent,
    ).toBe('A')
    expect(
      (elem.getShadowRoot()!.getElementById('b0')!.childNodes[0] as glassEasel.TextNode)
        .textContent,
    ).toBe('B')
    elem.setData({
      list: [{ e: 'A', f: 'B' }],
    })
    expect(
      (elem.getShadowRoot()!.getElementById('e0')!.childNodes[0] as glassEasel.TextNode)
        .textContent,
    ).toBe('A')
    expect(
      (elem.getShadowRoot()!.getElementById('f0')!.childNodes[0] as glassEasel.TextNode)
        .textContent,
    ).toBe('B')
  })

  test('for blocks expanding object without key', () => {
    const ops: Array<[number, string]> = []
    const itemComp = glassEasel
      .registerElement({
        properties: { s: { type: String } },
        lifetimes: {
          attached() {
            ops.push([-1, this.data.s.toString()])
          },
          detached() {
            ops.push([-2, this.data.s.toString()])
          },
        },
      })
      .general()
    const def = glassEasel
      .registerElement({
        using: {
          'x-c': itemComp,
        },
        template: tmpl(`
        <div wx:for="{{list}}" wx:for-item="v" wx:for-index="k">
          <x-c s="{{k}}:{{v}}">{{k}}</x-c>
        </div>
      `),
        data: {
          list: { a: 10, b: 20 },
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div><x-c>a</x-c></div><div><x-c>b</x-c></div>')
    matchElementWithDom(elem)
    expect(ops).toEqual([
      [-1, 'a:10'],
      [-1, 'b:20'],
    ])
    ops.length = 0
    elem.setData({
      list: { a: 20, b: 10 },
    })
    expect(domHtml(elem)).toBe('<div><x-c>a</x-c></div><div><x-c>b</x-c></div>')
    matchElementWithDom(elem)
    expect(ops).toEqual([])
    ops.length = 0
    elem.setData({
      list: {
        a: 30,
        b: 40,
        c: 50,
        d: 60,
      },
    })
    expect(domHtml(elem)).toBe(
      '<div><x-c>a</x-c></div><div><x-c>b</x-c></div><div><x-c>c</x-c></div><div><x-c>d</x-c></div>',
    )
    matchElementWithDom(elem)
    expect(ops).toEqual([
      [-1, 'c:50'],
      [-1, 'd:60'],
    ])
    ops.length = 0
    elem.setData({
      list: { c: 50 },
    })
    expect(domHtml(elem)).toBe('<div><x-c>c</x-c></div>')
    matchElementWithDom(elem)
    expect(ops).toEqual([
      [-2, 'b:40'],
      [-2, 'c:50'],
      [-2, 'd:60'],
    ])
  })

  test('for blocks expanding object with key', () => {
    const ops: Array<[number, string]> = []
    const itemComp = glassEasel.registerElement({
      properties: { s: String },
      lifetimes: {
        attached() {
          ops.push([-1, this.data.s.toString()])
        },
        detached() {
          ops.push([-2, this.data.s.toString()])
        },
        moved() {
          ops.push([-3, this.data.s.toString()])
        },
      },
    })
    const def = glassEasel.registerElement({
      using: {
        'x-c': itemComp.general(),
      },
      template: tmpl(`
        <block wx:for="{{list}}" wx:key="k">
          <x-c data-i="{{index}}" s="{{item.k}}:{{item.v}}">{{item.v}}</x-c>
        </block>
      `),
      data: {
        list: { f1: { k: 'a', v: 10 }, f2: { k: 'b', v: 20 } } as Record<
          string,
          { k: string; v: number }
        >,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    const listBlock = elem.getShadowRoot()!.childNodes[0] as glassEasel.VirtualNode
    const checkIndex = () => {
      const keys = Object.keys(elem.data.list)
      for (let i = 0; i < listBlock.childNodes.length; i += 1) {
        const itemBlock = listBlock.childNodes[i] as glassEasel.Element
        expect((itemBlock.childNodes[0] as glassEasel.Element).dataset.i).toBe(keys[i])
      }
    }
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<x-c>10</x-c><x-c>20</x-c>')
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([
      [-1, 'a:10'],
      [-1, 'b:20'],
    ])
    ops.length = 0
    elem.setData({
      list: {
        f3: { k: 'c', v: 30 },
        f4: { k: 'd', v: 40 },
        f1: { k: 'a', v: 50 },
        f5: { k: 'e', v: 60 },
        f6: { k: 'f', v: 70 },
        f2: { k: 'b', v: 80 },
      },
    })
    expect(domHtml(elem)).toBe(
      '<x-c>30</x-c><x-c>40</x-c><x-c>50</x-c><x-c>60</x-c><x-c>70</x-c><x-c>80</x-c>',
    )
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([
      [-1, 'c:30'],
      [-1, 'd:40'],
      [-1, 'e:60'],
      [-1, 'f:70'],
    ])
    ops.length = 0
    elem.setData({
      list: {
        f1: { k: 'a', v: 50 },
        f5: { k: 'e', v: 60 },
        f6: { k: 'f', v: 70 },
        f2: { k: 'b', v: 80 },
        f3: { k: 'g', v: 30 },
        f4: { k: 'h', v: 40 },
      },
    })
    expect(domHtml(elem)).toBe(
      '<x-c>50</x-c><x-c>60</x-c><x-c>70</x-c><x-c>80</x-c><x-c>30</x-c><x-c>40</x-c>',
    )
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([
      [-2, 'c:30'],
      [-2, 'd:40'],
      [-1, 'g:30'],
      [-1, 'h:40'],
    ])
    ops.length = 0
    elem.setData({
      list: {
        f5: { k: 'e', v: 10 },
        f3: { k: 'g', v: 20 },
        f6: { k: 'f', v: 30 },
        f1: { k: 'a', v: 40 },
        f2: { k: 'b', v: 50 },
      },
    })
    expect(domHtml(elem)).toBe('<x-c>10</x-c><x-c>20</x-c><x-c>30</x-c><x-c>40</x-c><x-c>50</x-c>')
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([
      [-3, 'g:30'],
      [-3, 'a:50'],
      [-2, 'h:40'],
    ])
    ops.length = 0
    elem.setData({
      list: {
        f1: { k: 'a', v: 10 },
        f2: { k: 'c', v: 20 },
        f3: { k: 'e', v: 30 },
        f4: { k: 'f', v: 40 },
        f5: { k: 'b', v: 50 },
        f6: { k: 'g', v: 60 },
        f7: { k: 'h', v: 70 },
      },
    })
    expect(domHtml(elem)).toBe(
      '<x-c>10</x-c><x-c>20</x-c><x-c>30</x-c><x-c>40</x-c><x-c>50</x-c><x-c>60</x-c><x-c>70</x-c>',
    )
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([
      [-3, 'a:40'],
      [-1, 'c:20'],
      [-3, 'g:20'],
      [-1, 'h:70'],
    ])
    ops.length = 0
    elem.setData({
      list: {
        f7: { k: 'h', v: 60 },
        f3: { k: 'e', v: 50 },
        f4: { k: 'f', v: 40 },
        f2: { k: 'c', v: 30 },
        f5: { k: 'b', v: 20 },
        f1: { k: 'a', v: 10 },
      },
    })
    expect(domHtml(elem)).toBe(
      '<x-c>60</x-c><x-c>50</x-c><x-c>40</x-c><x-c>30</x-c><x-c>20</x-c><x-c>10</x-c>',
    )
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([
      [-3, 'h:70'],
      [-3, 'c:20'],
      [-2, 'g:60'],
      [-3, 'a:10'],
    ])
    ops.length = 0
    elem.setData({
      list: {
        f8: { k: 'f', v: 80 },
        f7: { k: 'e', v: 70 },
        f6: { k: 'd', v: 60 },
        f5: { k: 'a', v: 50 },
        f4: { k: 'c', v: 40 },
        f3: { k: 'b', v: 30 },
        f2: { k: 'g', v: 20 },
        f1: { k: 'h', v: 10 },
      },
    })
    expect(domHtml(elem)).toBe(
      '<x-c>80</x-c><x-c>70</x-c><x-c>60</x-c><x-c>50</x-c><x-c>40</x-c><x-c>30</x-c><x-c>20</x-c><x-c>10</x-c>',
    )
    matchElementWithDom(elem)
    checkIndex()
    expect(ops).toEqual([
      [-3, 'f:40'],
      [-1, 'd:60'],
      [-3, 'a:10'],
      [-1, 'g:20'],
      [-3, 'h:60'],
    ])
  })

  test('for blocks expending string', () => {
    const ops: Array<[number, string]> = []
    const itemComp = glassEasel
      .registerElement({
        properties: { s: String },
        lifetimes: {
          attached() {
            ops.push([-1, this.data.s.toString()])
          },
          detached() {
            ops.push([-2, this.data.s.toString()])
          },
          moved() {
            ops.push([-3, this.data.s.toString()])
          },
        },
      })
      .general()
    const def = glassEasel
      .registerElement({
        using: {
          'x-c': itemComp,
        },
        template: tmpl(`
        <block wx:for="{{s}}" wx:key="*this">
          <x-c s="{{item}}">{{item}}</x-c>
        </block>
      `),
        data: {
          s: 'x',
        },
      })
      .general()
    const elem = execWithWarn(1, () =>
      glassEasel.Component.createWithContext('root', def, testBackend),
    )
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<x-c>x</x-c>')
    matchElementWithDom(elem)
    expect(ops).toEqual([[-1, 'x']])
    ops.length = 0
    execWithWarn(1, () => {
      elem.setData({
        s: 'abc',
      })
    })
    expect(domHtml(elem)).toBe('<x-c>a</x-c><x-c>b</x-c><x-c>c</x-c>')
    matchElementWithDom(elem)
    expect(ops).toEqual([
      [-2, 'x'],
      [-1, 'a'],
      [-1, 'b'],
      [-1, 'c'],
    ])
    ops.length = 0
    execWithWarn(1, () => {
      elem.setData({
        s: 'cab',
      })
    })
    expect(domHtml(elem)).toBe('<x-c>c</x-c><x-c>a</x-c><x-c>b</x-c>')
    matchElementWithDom(elem)
    ops.length = 0
    execWithWarn(1, () => {
      elem.setData({
        s: '',
      })
    })
    expect(domHtml(elem)).toBe('')
    matchElementWithDom(elem)
    expect(ops).toEqual([
      [-2, 'c'],
      [-2, 'a'],
      [-2, 'b'],
    ])
  })

  test('for blocks expending number', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <block wx:for="{{n}}">
          <span>{{item}}</span>
        </block>
      `),
        data: { n: 3 },
      })
      .general()
    const elem = execWithWarn(1, () =>
      glassEasel.Component.createWithContext('root', def, testBackend),
    )
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<span>0</span><span>1</span><span>2</span>')
    matchElementWithDom(elem)
    execWithWarn(1, () => elem.setData({ n: 2 }))
    expect(domHtml(elem)).toBe('<span>0</span><span>1</span>')
    matchElementWithDom(elem)
  })

  test('slot inside for blocks', () => {
    const x = glassEasel.registerElement({})
    const def = glassEasel.registerElement({
      using: { x },
      template: tmpl(`
        <x>
          <block wx:for="{{n}}">
            <s>{{item}}</s>
          </block>
        </x>
      `),
      data: { n: [0, 1, 2] },
    })
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<x><s>0</s><s>1</s><s>2</s></x>')
    matchElementWithDom(elem)
    elem.spliceArrayDataOnPath(['n'], 3, 0, [3, 4])
    elem.applyDataUpdates()
    expect(domHtml(elem)).toBe('<x><s>0</s><s>1</s><s>2</s><s>3</s><s>4</s></x>')
    matchElementWithDom(elem)
    elem.spliceArrayDataOnPath(['n'], 0, 0, [5, 6])
    elem.applyDataUpdates()
    expect(domHtml(elem)).toBe('<x><s>5</s><s>6</s><s>0</s><s>1</s><s>2</s><s>3</s><s>4</s></x>')
    matchElementWithDom(elem)
    elem.spliceArrayDataOnPath(['n'], 2, 3, [7, 8])
    elem.applyDataUpdates()
    expect(domHtml(elem)).toBe('<x><s>5</s><s>6</s><s>7</s><s>8</s><s>3</s><s>4</s></x>')
    matchElementWithDom(elem)
    elem.spliceArrayDataOnPath(['n'], 0, 3, [])
    elem.applyDataUpdates()
    expect(domHtml(elem)).toBe('<x><s>8</s><s>3</s><s>4</s></x>')
    matchElementWithDom(elem)
    elem.spliceArrayDataOnPath(['n'], 1, 2, [])
    elem.applyDataUpdates()
    expect(domHtml(elem)).toBe('<x><s>8</s></x>')
    matchElementWithDom(elem)
  })

  test('template include', () => {
    const def = glassEasel
      .registerElement({
        template: multiTmpl({
          '': '<include src="./a.wxml" /><span>{{a}}</span>',
          a: '<div>{{a}}{{b}}</div>',
        }),
        data: {
          a: 123,
          b: 'abc',
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div>123abc</div><span>123</span>')
    matchElementWithDom(elem)
    elem.setData({ a: 456 })
    expect(domHtml(elem)).toBe('<div>456abc</div><span>456</span>')
    matchElementWithDom(elem)
    elem.setData({ b: 'def' })
    expect(domHtml(elem)).toBe('<div>456def</div><span>456</span>')
    matchElementWithDom(elem)
  })

  test('template undefined include', () => {
    const def = glassEasel
      .registerElement({
        template: multiTmpl({
          '': '<div><include src="./a.wxml" /></div>',
        }),
        data: {
          a: 123,
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div></div>')
    matchElementWithDom(elem)
  })

  test('template-name data', () => {
    const def = glassEasel
      .registerElement({
        template: multiTmpl({
          child: `
            <template name="child">
              <span wx:for="{{list}}" wx:if="{{item.shown}}">{{index}}:{{item.data}}</span>
            </template>
          `,
          '': `
            <import src="./child" />
            <div>
              <template is="child" data="{{ list: arr }}" />
            </div>
          `,
        }),
        data: {
          arr: [
            { shown: true, data: 123 },
            { shown: false, data: 456 },
            { shown: true, data: 789 },
          ],
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div><span>0:123</span><span>2:789</span></div>')
    matchElementWithDom(elem)
    elem.setData({ 'arr[0].shown': false })
    expect(domHtml(elem)).toBe('<div><span>2:789</span></div>')
    matchElementWithDom(elem)
    elem.setData({
      arr: [
        { shown: false, data: 789 },
        { shown: true, data: 456 },
      ],
    })
    expect(domHtml(elem)).toBe('<div><span>1:456</span></div>')
    matchElementWithDom(elem)
  })

  test('template-name data shortcut', () => {
    const def = glassEasel
      .registerElement({
        template: multiTmpl({
          child: `
            <template name="child">
              <span>{{ obj.a }}</span>
            </template>
            <template name="child2">
              <span>{{ a }}</span>
            </template>
          `,
          '': `
            <import src="./child" />
            <div>
              <template is="child" data="{{ obj }}" />
            </div>
            <div>
              <template is="child2" data="{{ ...obj }}" />
            </div>
          `,
        }),
        data: {
          obj: { a: 123 },
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div><span>123</span></div><div><span>123</span></div>')
    matchElementWithDom(elem)
    elem.setData({ obj: { a: 456 } })
    expect(domHtml(elem)).toBe('<div><span>456</span></div><div><span>456</span></div>')
    matchElementWithDom(elem)
    elem.setData({ 'obj.a': 789 })
    expect(domHtml(elem)).toBe('<div><span>789</span></div><div><span>789</span></div>')
    matchElementWithDom(elem)
  })

  test('template-name data cascaded passing', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <template name="child">
            <template is="child2" data="{{ a }}" />
          </template>
          <template name="child2">
            <span>{{ a }}</span>
          </template>
          <div>
            <template is="child" data="{{ ...obj }}" />
          </div>
        `),
        data: {
          obj: { a: 123 },
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div><span>123</span></div>')
    matchElementWithDom(elem)
    elem.setData({ obj: { a: 456 } })
    expect(domHtml(elem)).toBe('<div><span>456</span></div>')
    matchElementWithDom(elem)
    elem.setData({ 'obj.a': 789 })
    expect(domHtml(elem)).toBe('<div><span>789</span></div>')
    matchElementWithDom(elem)
  })

  test('static template-is', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <template name="child">
          <span wx:if="{{!hidden}}">{{a + b.c + d}}</span>
        </template>
        <div>
          <template is="child" data="{{b: {c: 40}, d: 5, ...b}}" />
        </div>
      `),
        data: {
          b: {
            a: 300,
          },
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div><span>345</span></div>')
    matchElementWithDom(elem)
    elem.setData({ b: { a: 200, d: 7 } })
    expect(domHtml(elem)).toBe('<div><span>247</span></div>')
    matchElementWithDom(elem)
    elem.setData({ 'b.a': 100 })
    expect(domHtml(elem)).toBe('<div><span>147</span></div>')
    matchElementWithDom(elem)
    elem.setData({ 'b.hidden': true })
    expect(domHtml(elem)).toBe('<div></div>')
    matchElementWithDom(elem)
  })

  test('dynamic template-is', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <template name="childA">
          <span>{{a}}</span>
        </template>
        <template name="childB">
          <span>{{b}}</span>
        </template>
        <div>
          <template is="child{{childType}}" data="{{a, b}}" />
        </div>
      `),
        data: {
          childType: '',
          a: 123,
          b: 456,
        },
        properties: {},
        methods: {},
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div></div>')
    matchElementWithDom(elem)
    elem.setData({ childType: 'A' })
    expect(domHtml(elem)).toBe('<div><span>123</span></div>')
    matchElementWithDom(elem)
    elem.setData({ childType: 'B' })
    expect(domHtml(elem)).toBe('<div><span>456</span></div>')
    matchElementWithDom(elem)
    elem.setData({ a: 0 })
    expect(domHtml(elem)).toBe('<div><span>456</span></div>')
    matchElementWithDom(elem)
    elem.setData({ b: 789 })
    expect(domHtml(elem)).toBe('<div><span>789</span></div>')
    matchElementWithDom(elem)
  })

  test('template-is inside for block', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <template name="child1">
          <span>{{index}}:{{a}}</span>
        </template>
        <template name="child2">
          <span>{{index}}:{{b}}</span>
        </template>
        <div>
          <block wx:for="{{list}}">
            <template is="child{{item}}" data="{{a, b, index}}" />
          </block>
        </div>
      `),
        data: {
          list: [],
          a: 123,
          b: 456,
        },
        properties: {},
        methods: {},
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div></div>')
    matchElementWithDom(elem)
    elem.setData({ list: [1, 2] })
    expect(domHtml(elem)).toBe('<div><span>0:123</span><span>1:456</span></div>')
    matchElementWithDom(elem)
    elem.setData({ list: [2, 1, 1] })
    expect(domHtml(elem)).toBe('<div><span>0:456</span><span>1:123</span><span>2:123</span></div>')
    matchElementWithDom(elem)
    elem.setData({ a: 0 })
    expect(domHtml(elem)).toBe('<div><span>0:456</span><span>1:0</span><span>2:0</span></div>')
    matchElementWithDom(elem)
    elem.setData({ b: 789 })
    expect(domHtml(elem)).toBe('<div><span>0:789</span><span>1:0</span><span>2:0</span></div>')
    matchElementWithDom(elem)
  })

  test('undefined template-is', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <div>
          <template is="child" data="{{ b }}" />
        </div>
      `),
        data: {
          b: 123,
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div></div>')
    matchElementWithDom(elem)
  })

  test('undefined template-data', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <template name="child">
            <span>{{ a }}</span>
          </template>
          <div>
            <template is="child" />
            <template is="child" data="{{ b }}" />
          </div>
        `),
        data: {
          a: 123,
          b: 789,
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    expect(domHtml(elem)).toBe('<div><span></span><span></span></div>')
    matchElementWithDom(elem)
    elem.setData({ a: 456 })
    expect(domHtml(elem)).toBe('<div><span></span><span></span></div>')
    matchElementWithDom(elem)
  })

  test('cascaded template', () => {
    const def = glassEasel
      .registerElement({
        template: multiTmpl({
          '': `
          <import src="./template/s" />
          <template is="S" data="{{ {c} }}" />
        `,
          'template/s': `
          <import src="./i.wxml" />
          <template name="S">
            <div>key: {{ c.i }}</div>
            <template is="{{ c.i }}" />
          </template>
        `,
          'template/i': `
          <template name="A"><div>value: a</div></template>
          <template name="B"><div>value: b</div></template>
        `,
        }),
        data: {
          c: {
            i: 'A',
          },
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend).asInstanceOf(def)!
    expect(domHtml(elem)).toBe('<div>key: A</div><div>value: a</div>')
    matchElementWithDom(elem)

    elem.setData({ 'c.i': 'B' })
    expect(domHtml(elem)).toBe('<div>key: B</div><div>value: b</div>')
    matchElementWithDom(elem)
  })

  test('custom scripts', () => {
    const def = glassEasel
      .registerElement({
        template: multiTmpl({
          '': `
          <wxs module="a" src="./scripts/abc" />
          <div>{{ a.test(1, 3) + 2 }}</div>
        `,
          'scripts/abc.wxs': `
          module.exports = require('def')
        `,
          'scripts/def.wxs': `
          exports.test = function (a, b) {
            return a + b
          }
        `,
        }),
        data: {},
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend).asInstanceOf(def)!
    expect(domHtml(elem)).toBe('<div>6</div>')
    matchElementWithDom(elem)
  })

  test('custom inline scripts', () => {
    const def = glassEasel
      .registerElement({
        template: multiTmpl({
          '': `
            <wxs module="a"> exports.test = require("./scripts/def").test </wxs>
            <div>{{ a.test(1, 3) + 2 }}</div>
          `,
          'scripts/def.wxs': `
            exports.test = function (a, b) {
              return a + b
            }
          `,
        }),
        data: {},
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend).asInstanceOf(def)!
    expect(domHtml(elem)).toBe('<div>6</div>')
    matchElementWithDom(elem)
  })

  test('custom scripts across files', () => {
    const def = glassEasel
      .registerElement({
        template: multiTmpl({
          '': `
            <import src="./a" />
            <template is="child" />
          `,
          a: `
            <wxs module="a"> exports.test = function (a, b) { return a - b } </wxs>
            <wxs module="b" src="./scripts/def.wxs"></wxs>
            <template name="child">
              <div>{{ a.test(1, 2) }} {{ b.test(1, 2) }}</div>
            </template>
          `,
          'scripts/def.wxs': `
            exports.test = function (a, b) {
              return a + b
            }
          `,
        }),
        data: {},
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend).asInstanceOf(def)!
    expect(domHtml(elem)).toBe('<div>-1 3</div>')
    matchElementWithDom(elem)
  })

  test('custom scripts with template', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <wxs module="a">module.exports={ foo: 'foo' }</wxs>
          <template name="test">
            <div>{{a.foo}}</div>
          </template>
          <template is="test" data="{{ a: { foo: 'bar' } }}" />
          <div>{{a.foo}}</div>
        `),
        data: {},
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend).asInstanceOf(def)!
    expect(domHtml(elem)).toBe('<div>foo</div><div>foo</div>')
    matchElementWithDom(elem)
  })

  test('block slot', () => {
    const childComp = glassEasel.registerElement({
      options: {
        multipleSlots: true,
      },
      template: tmpl(`
        <div>
          <slot name="child-slot" />
        </div>
      `),
    })
    const def = glassEasel
      .registerElement({
        using: {
          'child-comp': childComp,
        },
        template: tmpl(`
        <child-comp>
          <block slot="{{d}}">123</block>
        </child-comp>
      `),
        data: {
          d: 'child-slot',
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<child-comp><div>123</div></child-comp>')
    matchElementWithDom(elem)
    elem.setData({
      d: '',
    })
    expect(domHtml(elem)).toBe('<child-comp><div></div></child-comp>')
    matchElementWithDom(elem)
  })

  test('let variable', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <div data:a="{{a}}" data:b="{{b}}" data:c="{{c}}" let:a="" let:b="{{d}}" let:c="{{b * 10}}">
            <span>{{c}}</span>
          </div>
        `),
        data: {
          d: 123,
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    const div = elem.getShadowRoot()!.childNodes[0]!.asElement()!
    expect(domHtml(elem)).toBe('<div><span>1230</span></div>')
    expect(div.dataset.a).toBe('')
    expect(div.dataset.b).toBe(123)
    expect(div.dataset.c).toBe(1230)
    matchElementWithDom(elem)
    elem.setData({
      d: 456,
    })
    expect(domHtml(elem)).toBe('<div><span>4560</span></div>')
    expect(div.dataset.a).toBe('')
    expect(div.dataset.b).toBe(456)
    expect(div.dataset.c).toBe(4560)
    matchElementWithDom(elem)
  })

  test('let variable on block', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <block let:c="{{d * 10}}">
            <span>{{c}}</span>
          </block>
        `),
        data: {
          d: 123,
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<span>1230</span>')
    matchElementWithDom(elem)
    elem.setData({
      d: 456,
    })
    expect(domHtml(elem)).toBe('<span>4560</span>')
    matchElementWithDom(elem)
  })

  test('tag name cases', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <Div></Div>
        `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div></div>')
    matchElementWithDom(elem)
  })

  test('dataset name cases', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <div data-camelCase="{{ 123 }}"></div>
        `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div></div>')
    matchElementWithDom(elem)
    expect(elem.getShadowRoot()!.childNodes[0]!.asElement()!.dataset.camelcase).toBe(123)
  })

  test('attribute name cases', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <div hidDen></div>
        `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div hidden=""></div>')
    matchElementWithDom(elem)
  })

  test('attribute types', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
          <div
            a="{{true}}"
            b="{{false}}"
            c="{{null}}"
            d="{{undefined}}"
            e="{{arr}}"
            f="{{obj}}"
            g="{{0}}"
            h="{{NaN}}"
            i="{{infinity}}"
            j
          ></div>
        `),
        data: {
          arr: [],
          obj: {},
          NaN,
          infinity: Infinity,
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe(
      '<div a="" c="" d="" e="" f="[object Object]" g="0" h="NaN" i="Infinity" j=""></div>',
    )
    matchElementWithDom(elem)
  })

  test('property name cases', () => {
    const subComp = glassEasel.registerElement({
      properties: {
        propName: String,
      },
    })
    const def = glassEasel
      .registerElement({
        using: {
          child: subComp.general(),
        },
        template: tmpl(`
          <child propName="abc" />
        `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(subComp)!.data.propName).toBe('abc')
  })

  test('setting native node attr', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <a hidden="{{hidden}}" href="{{url}}"></a>
      `),
        data: {
          hidden: false,
          url: 'abc',
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<a href="abc"></a>')
    matchElementWithDom(elem)
    elem.setData({
      hidden: true,
      url: '',
    })
    expect(domHtml(elem)).toBe('<a href="" hidden=""></a>')
    matchElementWithDom(elem)
  })

  test('setting element id', () => {
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <div id="{{d}}">123</div>
      `),
        data: {
          d: 'abc',
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div>123</div>')
    matchElementWithDom(elem)
    expect(domHtml(elem.getShadowRoot()!.getElementById('abc')!)).toBe('123')
    elem.setData({
      d: 'def',
    })
    expect(elem.getShadowRoot()!.getElementById('abc')).toBe(undefined)
    expect(domHtml(elem.getShadowRoot()!.getElementById('def')!)).toBe('123')
  })

  test('setting element slot', () => {
    const subComp = glassEasel.registerElement({
      options: {
        multipleSlots: true,
      },
      template: tmpl(`
        <div><slot name="a" /></div>
        <span><slot name="b" /></span>
      `),
    })
    const def = glassEasel
      .registerElement({
        using: {
          'sub-comp': subComp,
        },
        template: tmpl(`
        <sub-comp>
          <a slot="{{s}}"></a>
        </sub-comp>
      `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<sub-comp><div></div><span></span></sub-comp>')
    matchElementWithDom(elem)
    elem.setData({
      s: 'a',
    })
    expect(domHtml(elem)).toBe('<sub-comp><div><a></a></div><span></span></sub-comp>')
    matchElementWithDom(elem)
    elem.setData({
      s: 'b',
    })
    expect(domHtml(elem)).toBe('<sub-comp><div></div><span><a></a></span></sub-comp>')
    matchElementWithDom(elem)
  })

  test('setting element dataset', () => {
    const subComp = glassEasel.registerElement({
      template: tmpl(`
        <slot id="a" data:a-b="789" />
      `),
    })
    const def = glassEasel
      .registerElement({
        using: {
          'sub-comp': subComp,
        },
        template: tmpl(`
          <sub-comp id="sub" data:a-b="456">
            <div id="a" data:a-b="123" />
          </sub-comp>
        `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<sub-comp><div></div></sub-comp>')
    matchElementWithDom(elem)
    expect(elem.getShadowRoot()!.getElementById('a')!.dataset['a-b']).toBe('123')
    const sub = elem.getShadowRoot()!.getElementById('sub')!.asGeneralComponent()!
    expect(sub.dataset['a-b']).toBe('456')
    expect(sub.getShadowRoot()!.getElementById('a')!.dataset['a-b']).toBe('789')
  })

  test('setting element dataset (legacy syntax)', () => {
    const subComp = glassEasel.registerElement({
      template: tmpl(`
        <slot id="a" data-a-b="789" />
      `),
    })
    const def = glassEasel
      .registerElement({
        using: {
          'sub-comp': subComp,
        },
        template: tmpl(`
          <sub-comp id="sub" data-a-b="456">
            <div id="a" data-a-b="123" />
          </sub-comp>
        `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<sub-comp><div></div></sub-comp>')
    matchElementWithDom(elem)
    expect(elem.getShadowRoot()!.getElementById('a')!.dataset.aB).toBe('123')
    const sub = elem.getShadowRoot()!.getElementById('sub')!.asGeneralComponent()!
    expect(sub.dataset.aB).toBe('456')
    expect(sub.getShadowRoot()!.getElementById('a')!.dataset.aB).toBe('789')
  })

  test('setting slot name', () => {
    const subComp = glassEasel.registerElement({
      options: {
        multipleSlots: true,
      },
      template: tmpl(`
        <a><slot name="{{a}}" /></a>
        <b><slot name="{{b}}" /></b>
        <c><slot name="{{c}}" /></c>
      `),
      data: {
        a: '',
        b: '',
        c: 's',
      },
    })
    const def = glassEasel
      .registerElement({
        using: {
          'sub-comp': subComp.general(),
        },
        template: tmpl(`
        <sub-comp id="sub">
          <s slot="s"></s>
        </sub-comp>
      `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    const subElem = (elem.$.sub as glassEasel.GeneralComponent).asInstanceOf(subComp)!
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<sub-comp><a></a><b></b><c><s></s></c></sub-comp>')
    matchElementWithDom(elem)
    subElem.setData({
      b: 's',
    })
    expect(domHtml(elem)).toBe('<sub-comp><a></a><b><s></s></b><c></c></sub-comp>')
    matchElementWithDom(elem)
    subElem.setData({
      a: 's',
    })
    expect(domHtml(elem)).toBe('<sub-comp><a><s></s></a><b></b><c></c></sub-comp>')
    matchElementWithDom(elem)
    subElem.setData({
      b: '',
      c: '',
    })
    expect(domHtml(elem)).toBe('<sub-comp><a><s></s></a><b></b><c></c></sub-comp>')
    matchElementWithDom(elem)
    subElem.setData({
      c: 's',
    })
    expect(domHtml(elem)).toBe('<sub-comp><a><s></s></a><b></b><c></c></sub-comp>')
    matchElementWithDom(elem)
    subElem.setData({
      b: 's',
    })
    expect(domHtml(elem)).toBe('<sub-comp><a><s></s></a><b></b><c></c></sub-comp>')
    matchElementWithDom(elem)
    subElem.setData({
      a: 'a',
      b: 'b',
    })
    expect(domHtml(elem)).toBe('<sub-comp><a></a><b></b><c><s></s></c></sub-comp>')
    matchElementWithDom(elem)
    subElem.setData({
      c: '',
    })
    expect(domHtml(elem)).toBe('<sub-comp><a></a><b></b><c></c></sub-comp>')
    matchElementWithDom(elem)
  })

  test('binding event listeners', () => {
    const ops: any[] = []
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <div mark:a="123" data:n="wrong">
          <span id="child" mark:b="{{d}}" data:dA="a" data:d-b="b" data-d-c="{{d}}" bind:customEv="ev"/>
        </div>
      `),
        methods: {
          ev(ev: any) {
            // eslint-disable-next-line no-use-before-define
            expect(this).toBe(elem)
            ops.push(ev)
          },
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div><span></span></div>')
    matchElementWithDom(elem)
    const child = elem.getShadowRoot()!.getElementById('child')!
    child.triggerEvent('customEv')
    const ev = ops.shift() as glassEasel.ShadowedEvent<any>
    expect(ev.mark).toEqual({ a: '123', b: undefined })
    expect(ev.target.dataset).toEqual({ dA: 'a', 'd-b': 'b', dC: undefined })
    elem.setData({ d: true })
    child.triggerEvent('customEv')
    const ev2 = ops.shift() as glassEasel.ShadowedEvent<any>
    expect(ev2.mark).toEqual({ a: '123', b: true })
    expect(ev2.target.dataset).toEqual({ dA: 'a', 'd-b': 'b', dC: true })
  })

  test('binding dynamic event listeners', () => {
    let ops: number[] = []
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <span id="child" bind:customEv="{{ handlerName || '' }}"/>
      `),
        methods: {
          a() {
            ops.push(1)
          },
          b() {
            ops.push(2)
          },
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    const child = elem.getShadowRoot()!.getElementById('child')!
    child.triggerEvent('customEv')
    expect(ops).toStrictEqual([])
    ops = []
    elem.setData({
      handlerName: 'a',
    })
    child.triggerEvent('customEv')
    expect(ops).toStrictEqual([1])
    ops = []
    elem.setData({
      handlerName: 'b',
    })
    child.triggerEvent('customEv')
    expect(ops).toStrictEqual([2])
    ops = []
  })

  test('binding event on slot', () => {
    const ops: any[] = []
    const def = glassEasel
      .registerElement({
        template: tmpl(`
        <div data:n="wrong">
          <slot id="child" mark:b="{{ 123 }}" data:a="abc" bind:customEv="ev" />
        </div>
      `),
        methods: {
          ev(ev: any) {
            // eslint-disable-next-line no-use-before-define
            expect(this).toBe(elem)
            ops.push(ev)
          },
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div></div>')
    matchElementWithDom(elem)
    const child = elem.getShadowRoot()!.getElementById('child')!
    child.triggerEvent('customEv', null, { bubbles: true })
    const ev = ops.shift() as glassEasel.ShadowedEvent<any>
    expect(ev.mark).toStrictEqual({ b: 123 })
    expect(ev.target.dataset).toStrictEqual({ a: 'abc' })
  })

  test('setting properties', () => {
    const cs = new glassEasel.ComponentSpace()
    const subComp = cs.defineComponent({
      template: tmpl(`
        <div hidden="{{a}} {{style}} a-{{propA + 1}} b-{{dataB + 1}}"></div>
      `),
      properties: {
        a: Boolean,
        style: String,
        propA: Number,
        dataB: String,
      },
    })
    const def = cs
      .defineComponent({
        using: {
          'sub-comp': subComp.general(),
        },
        template: tmpl(`
          <sub-comp a style="abc" prop-a="3" data-b="5" />
        `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<sub-comp><div hidden="true abc a-4 b-51"></div></sub-comp>')
    matchElementWithDom(elem)
  })

  test('setting array as classNames', () => {
    const cs = new glassEasel.ComponentSpace()
    const ssm = cs.styleScopeManager
    const subComp = cs.defineComponent({
      externalClasses: ['ext-class'],
      template: tmpl(`
        <div class="inner ext-class"></div>
      `),
    })
    const def = cs
      .defineComponent({
        options: {
          styleScope: ssm.register('p'),
        },
        using: {
          'sub-comp': subComp.general(),
        },
        data: () => ({
          classes: 'static',
          extClass: 'a-class',
        }),
        template: tmpl(`
        <sub-comp class="{{classes}}" ext-class="{{extClass}}" />
      `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe(
      '<sub-comp class="p--static"><div class="inner p--a-class"></div></sub-comp>',
    )
    matchElementWithDom(elem)
    elem.setData({
      classes: ['static', 'dynamic'],
    })
    expect(domHtml(elem)).toBe(
      '<sub-comp class="p--static p--dynamic"><div class="inner p--a-class"></div></sub-comp>',
    )
    matchElementWithDom(elem)
    elem.setData({
      classes: '',
      extClass: ['a-class', 'dynamic'],
    })
    expect(domHtml(elem)).toBe(
      '<sub-comp class=""><div class="inner p--a-class p--dynamic"></div></sub-comp>',
    )
    matchElementWithDom(elem)
    elem.setData({
      extClass: 'static',
    })
    expect(domHtml(elem)).toBe('<sub-comp class=""><div class="inner p--static"></div></sub-comp>')
    matchElementWithDom(elem)
  })

  test('setting external classes', () => {
    const cs = new glassEasel.ComponentSpace(
      undefined,
      undefined,
      glassEasel.getDefaultComponentSpace().styleScopeManager,
    )
    const ssm = cs.styleScopeManager
    const subComp = cs.defineComponent({
      externalClasses: ['class', 'data-class'],
      template: tmpl(`
        <div class="class data-class"></div>
      `),
      data: {
        a: 's',
      },
    })
    const def = cs
      .defineComponent({
        options: {
          styleScope: ssm.register('p'),
        },
        using: {
          'sub-comp': subComp.general(),
        },
        template: tmpl(`
        <sub-comp class="static {{ dynamic || '' }}" data-class="a-class" />
      `),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe(
      '<sub-comp class="p--static"><div class="p--static p--a-class"></div></sub-comp>',
    )
    matchElementWithDom(elem)
    elem.setData({
      dynamic: 'dynamic',
    })
    expect(domHtml(elem)).toBe(
      '<sub-comp class="p--static p--dynamic"><div class="p--static p--a-class p--dynamic"></div></sub-comp>',
    )
    matchElementWithDom(elem)
    elem.setData({
      dynamic: '',
    })
    expect(domHtml(elem)).toBe(
      '<sub-comp class="p--static"><div class="p--static p--a-class"></div></sub-comp>',
    )
    matchElementWithDom(elem)
  })

  test('setting nested external classes', () => {
    const cs = new glassEasel.ComponentSpace(
      undefined,
      undefined,
      glassEasel.getDefaultComponentSpace().styleScopeManager,
    )
    const ssm = cs.styleScopeManager
    const subComp = cs.defineComponent({
      externalClasses: ['class', 'ext-class'],
      template: tmpl(`
        <div class="class ext-class"></div>
      `),
    })
    const def = cs
      .defineComponent({
        options: {
          styleScope: ssm.register('p'),
        },
        using: {
          sub: subComp.general(),
        },
        properties: {
          dynamic: String,
        },
        externalClasses: ['a-class'],
        template: tmpl(`
          <sub class="static {{ dynamic || '' }}" ext-class="a-class" />
        `),
      })
      .general()
    const parent = cs.defineComponent({
      options: {
        styleScope: ssm.register('pp'),
        extraStyleScope: glassEasel.StyleScopeManager.globalScope(),
      },
      using: {
        def,
      },
      data: {
        dynamic1: '',
        dynamic2: '',
      },
      template: tmpl(`<def dynamic="{{dynamic1}}" a-class="root {{dynamic2}}" />`),
    })
    const elem = glassEasel.Component.createWithContext('root', parent, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe(
      '<def wx-host="p"><sub class="p--static"><div class="p--static root pp--root"></div></sub></def>',
    )
    matchElementWithDom(elem)
    elem.setData({
      dynamic1: 'dynamic',
    })
    expect(domHtml(elem)).toBe(
      '<def wx-host="p"><sub class="p--static p--dynamic"><div class="p--static root pp--root p--dynamic"></div></sub></def>',
    )
    matchElementWithDom(elem)
    elem.setData({
      dynamic1: '',
      dynamic2: 'dynamic',
    })
    expect(domHtml(elem)).toBe(
      '<def wx-host="p"><sub class="p--static"><div class="p--static root pp--root dynamic pp--dynamic"></div></sub></def>',
    )
    matchElementWithDom(elem)
  })

  test('class list syntax (virtual-tree update)', () => {
    const cs = new glassEasel.ComponentSpace()
    const def = cs
      .defineComponent({
        data: () => ({
          classA: false,
        }),
        template: tmpl(
          `
            <div class:c />
            <div class:a="{{classA}}" class:c class:-b="{{!classA}}" class="-d" />
          `,
          { updateMode: 'virtualTree' },
        ),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    let changeCount = 0
    glassEasel.MutationObserver.create(() => {
      changeCount += 1
    }).observe(elem.getShadowRoot()!.childNodes[1]!, { properties: true })
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div class="c"></div><div class="-d c -b"></div>')
    matchElementWithDom(elem)
    elem.setData({
      classA: true,
    })
    expect(domHtml(elem)).toBe('<div class="c"></div><div class="-d c a"></div>')
    matchElementWithDom(elem)
    expect(changeCount).toBe(1)
    elem.setData({
      classA: false,
    })
    expect(domHtml(elem)).toBe('<div class="c"></div><div class="-d c -b"></div>')
    matchElementWithDom(elem)
    expect(changeCount).toBe(2)
  })

  test('class list syntax (binding-map update)', () => {
    const cs = new glassEasel.ComponentSpace()
    const def = cs
      .defineComponent({
        data: () => ({
          classA: false,
        }),
        template: tmpl(
          `
            <div class:c />
            <div class:a="{{classA}}" class:c class:-b="{{!classA}}" class="-d" />
          `,
          { updateMode: 'bindingMap' },
        ),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    let changeCount = 0
    glassEasel.MutationObserver.create(() => {
      changeCount += 1
    }).observe(elem.getShadowRoot()!.childNodes[1]!, { properties: true })
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<div class="c"></div><div class="-d c -b"></div>')
    matchElementWithDom(elem)
    elem.setData({
      classA: true,
    })
    expect(domHtml(elem)).toBe('<div class="c"></div><div class="-d c a"></div>')
    matchElementWithDom(elem)
    expect(changeCount).toBe(1)
    elem.setData({
      classA: false,
    })
    expect(domHtml(elem)).toBe('<div class="c"></div><div class="-d c -b"></div>')
    matchElementWithDom(elem)
    expect(changeCount).toBe(2)
  })

  test('style list syntax (virtual-tree update)', () => {
    const cs = new glassEasel.ComponentSpace()
    const def = cs
      .defineComponent({
        data: () => ({
          fontSize: 16,
          c: null as string | null,
        }),
        template: tmpl(
          `
            <div style:color="red" />
            <div style:font-size="{{ fontSize }}px" style:color="red" style:-wx-color="{{ c }}" style="-wx-font: serif" />
          `,
          { updateMode: 'virtualTree' },
        ),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe(
      '<div style="color:red;"></div><div style="-wx-font:serif;font-size:16px;color:red;-wx-color:;"></div>',
    )
    matchElementWithDom(elem)
    elem.setData({
      fontSize: 20,
      c: 'blue',
    })
    expect(domHtml(elem)).toBe(
      '<div style="color:red;"></div><div style="-wx-font:serif;font-size:20px;color:red;-wx-color:blue;"></div>',
    )
    matchElementWithDom(elem)
    elem.setData({
      c: null,
    })
    expect(domHtml(elem)).toBe(
      '<div style="color:red;"></div><div style="-wx-font:serif;font-size:20px;color:red;-wx-color:;"></div>',
    )
    matchElementWithDom(elem)
  })

  test('style list syntax (binding-map update)', () => {
    const cs = new glassEasel.ComponentSpace()
    const def = cs
      .defineComponent({
        data: () => ({
          fontSize: 16,
          c: null as string | null,
        }),
        template: tmpl(
          `
            <div style:color="red" />
            <div style:font-size="{{ fontSize }}px" style:color="red" style:-wx-color="{{ c }}" style="-wx-font: serif" />
          `,
          { updateMode: 'bindingMap' },
        ),
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe(
      '<div style="color:red;"></div><div style="-wx-font:serif;font-size:16px;color:red;-wx-color:;"></div>',
    )
    matchElementWithDom(elem)
    elem.setData({
      fontSize: 20,
      c: 'blue',
    })
    expect(domHtml(elem)).toBe(
      '<div style="color:red;"></div><div style="-wx-font:serif;font-size:20px;color:red;-wx-color:blue;"></div>',
    )
    matchElementWithDom(elem)
    elem.setData({
      c: null,
    })
    expect(domHtml(elem)).toBe(
      '<div style="color:red;"></div><div style="-wx-font:serif;font-size:20px;color:red;-wx-color:;"></div>',
    )
    matchElementWithDom(elem)
  })

  test('pass object to child components', () => {
    const cs = new glassEasel.ComponentSpace()
    let ops = 0
    const subComp = cs.defineComponent({
      template: tmpl(`
        <div class="{{ prop.a }}"></div>
      `),
      properties: {
        prop: Object,
      },
      observers: {
        prop() {
          ops += 1
        },
      },
    })
    const def = cs
      .defineComponent({
        using: {
          'sub-comp': subComp.general(),
        },
        template: tmpl(`
        <sub-comp prop="{{obj}}" />
      `),
        data: {
          obj: {
            a: 'a1',
          },
          num: 0,
        },
      })
      .general()
    const elem = glassEasel.Component.createWithContext('root', def, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<sub-comp><div class="a1"></div></sub-comp>')
    matchElementWithDom(elem)
    expect(ops).toBe(1)
    elem.setData({
      'obj.b': 'b1',
    })
    expect(ops).toBe(2)
    elem.setData({
      num: 1,
    })
    expect(ops).toBe(2)
    elem.setData({
      obj: { a: 'a2' },
    })
    expect(domHtml(elem)).toBe('<sub-comp><div class="a2"></div></sub-comp>')
    matchElementWithDom(elem)
    expect(ops).toBe(3)
  })

  test('recursive component', () => {
    const cs = new glassEasel.ComponentSpace()
    cs.updateComponentOptions({
      writeFieldsToNode: false,
    })
    type INode = {
      className: string
      childNodes: INode[]
      before?: string
      after?: string
    }
    const Node = cs
      .define('node')
      .options({
        virtualHost: true,
        dataDeepCopy: glassEasel.DeepCopyKind.None,
        propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
      })
      .property('childNodes', {
        type: Array,
        default: () => [] as INode[],
      })
      .externalClasses(['class'])
      .template(
        tmpl(`
          <div class="class">
            <block wx:for="{{childNodes}}">
              <block wx:if="{{item.before}}">{{item.before}}</block>
              <node child-nodes="{{item.childNodes}}" class="{{item.className}}" />
              <block wx:if="{{item.after}}">{{item.after}}</block>
            </block>
          </div>
        `),
      )
      .registerComponent()
    cs.setGlobalUsingComponent('node', Node.general())
    const Parent = cs
      .define()
      .usingComponents({ node: Node })
      .options({
        dataDeepCopy: glassEasel.DeepCopyKind.None,
        propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
      })
      .template(
        tmpl(`
          <node child-nodes="{{node.childNodes}}" class="{{node.className}}" />
        `),
      )
      .data(() => ({
        node: {
          className: 'root',
          childNodes: [
            {
              className: 'c1',
              childNodes: [
                {
                  className: 'c11',
                  childNodes: [],
                  before: '[',
                  after: ']',
                },
              ],
            },
            {
              className: 'c2',
              childNodes: [],
            },
          ],
        } satisfies INode,
      }))
      .registerComponent()
    const elem = glassEasel.Component.createWithContext('root', Parent, testBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe(
      '<div class="root"><div class="c1">[<div class="c11"></div>]</div><div class="c2"></div></div>',
    )
    matchElementWithDom(elem)
  })
}

describe('node tree structure (DOM backend)', () => testCases(domBackend))
describe('node tree structure (shadow backend)', () => testCases(shadowBackend))
describe('node tree structure (composed backend)', () => testCases(composedBackend))
