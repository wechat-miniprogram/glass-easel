import { tmpl, domBackend } from '../base/env'
import * as glassEasel from '../../src'
import { virtual as matchElementWithDom } from '../base/match'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
  writeIdToDOM: true,
})
componentSpace.defineComponent({
  is: '',
})

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

describe('placeholder', () => {
  test('using simple placeholder and waiting', () => {
    const def = componentSpace.define()
      .placeholders({
        child: '',
      })
      .definition({
        using: {
          child: 'placeholder/simple/child',
          'child-another': 'placeholder/simple/child',
        },
        template: tmpl(`
          <div>
            <child>
              <span />
            </child>
            <child-another wx:if="{{b}}" id="b" />
          </div>
        `),
      })
      .registerComponent()
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(domHtml(elem)).toBe('<div><child><span></span></child></div>')
    matchElementWithDom(elem)

    componentSpace.defineComponent({
      is: 'placeholder/simple/child',
      template: tmpl('child<div><slot/></div>'),
    })
    expect(domHtml(elem)).toBe('<div><child>child<div><span></span></div></child></div>')
    matchElementWithDom(elem)

    elem.setData({
      b: true,
    })
    expect(domHtml(elem)).toBe('<div><child>child<div><span></span></div></child><child-another id="b"></child-another></div>')
    matchElementWithDom(elem)
  })

  test('using placeholder across component spaces and waiting', () => {
    const mainCs = new glassEasel.ComponentSpace()
    mainCs.defineComponent({ is: '' })
    const extraCs = new glassEasel.ComponentSpace()
    mainCs.importSpace('space://extra', extraCs, false)
    mainCs.importSpace('space-private://extra', extraCs, true)

    const def = mainCs.defineComponent({
      using: {
        child: 'space://extra/child',
        'child-private': 'space-private://extra/child',
      },
      placeholders: {
        child: '',
        'child-private': '',
      },
      template: tmpl(`
        <child />
        <child-private />
      `),
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(domHtml(elem)).toBe('<child></child><child-private></child-private>')
    matchElementWithDom(elem)

    extraCs.defineComponent({
      is: 'child',
      template: tmpl('A'),
    })
    expect(domHtml(elem)).toBe('<child></child><child-private>A</child-private>')
    matchElementWithDom(elem)

    extraCs.exportComponent('child', 'child')
    expect(domHtml(elem)).toBe('<child>A</child><child-private>A</child-private>')
    matchElementWithDom(elem)
  })

  test('trigger lifetimes when replacing', () => {
    const callOrder: number[] = []
    const placeholder = componentSpace.defineComponent({
      properties: {
        n: Number,
      },
      template: tmpl('<span>{{n + 1}}<slot/></span>'),
      lifetimes: {
        created() {
          callOrder.push(1)
        },
        attached() {
          callOrder.push(2)
        },
        detached() {
          callOrder.push(3)
        },
        moved() {
          callOrder.push(0)
        },
      },
    })
    componentSpace.defineComponent({
      is: 'placeholder/lifetime/a',
      lifetimes: {
        attached() {
          callOrder.push(7)
        },
        detached() {
          callOrder.push(0)
        },
        moved() {
          callOrder.push(8)
        },
      },
    })
    const def = componentSpace.defineComponent({
      is: 'placeholder/lifetime/parent',
      using: {
        child: 'child',
        a: '../lifetime/a',
        placeholder: placeholder.general(),
      },
      placeholders: {
        child: 'placeholder',
      },
      template: tmpl(`
        <child n="2">
          <a />
        </child>
      `),
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    expect(callOrder).toStrictEqual([1])
    glassEasel.Element.pretendAttached(elem)
    expect(callOrder).toStrictEqual([1, 2, 7])
    expect(domHtml(elem)).toBe('<child><span>3<a></a></span></child>')
    matchElementWithDom(elem)
    callOrder.splice(0, 99)

    componentSpace.defineComponent({
      is: 'placeholder/lifetime/child',
      properties: {
        n: String,
      },
      template: tmpl('<div>{{n + 1}}</div>'),
      lifetimes: {
        created() {
          callOrder.push(4)
        },
        attached() {
          callOrder.push(5)
        },
        detached() {
          callOrder.push(0)
        },
        moved() {
          callOrder.push(6)
        },
      },
    })
    expect(callOrder).toStrictEqual([4, 3, 5, 8])
    expect(domHtml(elem)).toBe('<child><div>21</div></child>')
    matchElementWithDom(elem)
  })
})
