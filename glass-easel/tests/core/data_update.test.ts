import { domBackend, execWithWarn, tmpl } from '../base/env'
import * as glassEasel from '../../src'

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

describe('partial update', () => {
  test('should be able to merge updates', () => {
    const compDef = componentSpace
      .define()
      .data(() => ({
        a: 123,
        b: 'abc',
      }))
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    comp.updateData({ a: 456 })
    expect(comp.data.a).toBe(123)
    comp.applyDataUpdates()
    expect(comp.data.a).toBe(456)
    expect(comp.data.b).toBe('abc')
    comp.groupUpdates(() => {
      comp.updateData({ b: 'def' })
      comp.updateData({ a: 789 })
    })
    expect(comp.data).toStrictEqual({ a: 789, b: 'def' })
  })

  test('should be able to set self properties or receive properties', () => {
    let execArr = [] as string[]
    const itemComp = glassEasel
      .registerElement({
        options: {
          propertyEarlyInit: true,
        },
        properties: {
          s: {
            type: String,
            observer() {
              execArr.push('A')
            },
          },
        },
        observers: {
          s() {
            execArr.push('B')
          },
        },
        template: tmpl(`{{s}}`),
      })
      .general()
    const def = glassEasel.registerElement({
      options: {
        propertyEarlyInit: true,
      },
      using: {
        'x-c': itemComp,
      },
      properties: {
        list: {
          type: Array,
          default: () => [
            { k: 'a', v: 10 },
            { k: 'b', v: 20 },
          ],
          observer() {
            execArr.push('C')
          },
        },
      },
      observers: {
        list() {
          execArr.push('D')
        },
      },
      template: tmpl(`
        <block wx:for="{{list}}" wx:key="k">
          <x-c s="{{item.v}}" />
        </block>
      `),
    })
    const elem = glassEasel.Component.createWithContext('root', def, domBackend)
    glassEasel.Element.pretendAttached(elem)
    expect(domHtml(elem)).toBe('<x-c>10</x-c><x-c>20</x-c>')
    expect(execArr).toStrictEqual(['B', 'A', 'B', 'A'])
    execArr = []
    ;(elem.data.list[0]!.v as any) = 30
    elem.setData({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      list: elem.data.list as any,
    })
    expect(domHtml(elem)).toBe('<x-c>30</x-c><x-c>20</x-c>')
    expect(execArr).toStrictEqual(['D', 'B', 'A', 'B'])
    execArr = []
    elem.setData({ list: [] })
    expect(domHtml(elem)).toBe('')
    expect(execArr).toStrictEqual(['D', 'C'])
  })

  test('should be able to replace subfields', () => {
    const execArr = [] as string[]
    const childCompDef = componentSpace
      .define()
      .property('p', String)
      .lifetime('attached', function () {
        execArr.push(this.data.p)
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef.general(),
      })
      .template(
        tmpl(`
        <child id="c" p="{{obj.a}}" />
      `),
      )
      .data(() => ({
        obj: { a: 123 },
      }))
      .methods({
        setA() {
          this.groupUpdates(() => {
            this.replaceDataOnPath(['obj', 'a'], 456)
          })
        },
      })
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)
    const child = comp.getShadowRoot()!.getElementById('c')!.asInstanceOf(childCompDef)!
    expect(comp.data.obj.a).toBe(123)
    expect(child.data.p).toBe('123')
    comp.setA()
    expect(comp.data.obj.a).toBe(456)
    expect(child.data.p).toBe('456')
    comp.replaceDataOnPath(['obj'], { a: 789 })
    expect(comp.data.obj.a).toBe(456)
    expect(child.data.p).toBe('456')
    comp.applyDataUpdates()
    expect(comp.data.obj.a).toBe(789)
    expect(child.data.p).toBe('789')
    expect(execArr).toStrictEqual(['123'])
  })

  test('should be able to update list fields (without key)', () => {
    let execArr = [] as string[]
    const childCompDef = componentSpace
      .define()
      .property('p', String)
      .observer('p', function () {
        execArr.push(this.data.p)
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef.general(),
      })
      .template(
        tmpl(`
        <child wx:for="{{list}}" p="{{item}}" />
      `),
      )
      .data(() => ({
        list: ['A', 'B', 'C'],
      }))
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)
    const getP = () => {
      const ret = [] as string[]
      comp
        .getShadowRoot()!
        .childNodes[0]!.asElement()!
        .childNodes.forEach((child) => {
          ret.push(child.asElement()!.childNodes[0]!.asInstanceOf(childCompDef)!.data.p)
        })
      return ret
    }
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
    execArr = []
    comp.groupUpdates(() => {
      comp.replaceDataOnPath(['list', 1], 'D')
    })
    expect(getP()).toStrictEqual(['A', 'D', 'C'])
    expect(execArr).toStrictEqual(['D'])
  })

  test('should be able to update list fields (with key)', () => {
    let execArr = [] as string[]
    const childCompDef = componentSpace
      .define()
      .property('p', String)
      .observer('p', function () {
        execArr.push(this.data.p)
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef.general(),
      })
      .template(
        tmpl(`
        <child wx:for="{{list}}" wx:key="k" p="{{item.v}}" />
      `),
      )
      .data(() => ({
        list: [
          { k: 1, v: 'A' },
          { k: 2, v: 'B' },
          { k: 2, v: 'C' },
        ],
      }))
      .registerComponent()
    const comp = execWithWarn(1, () =>
      glassEasel.Component.createWithContext('root', compDef, domBackend),
    )
    glassEasel.Element.pretendAttached(comp)
    const getP = () => {
      const ret = [] as string[]
      comp
        .getShadowRoot()!
        .childNodes[0]!.asElement()!
        .childNodes.forEach((child) => {
          ret.push(child.asElement()!.childNodes[0]!.asInstanceOf(childCompDef)!.data.p)
        })
      return ret
    }
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
    execArr = []
    execWithWarn(1, () => {
      comp.groupUpdates(() => {
        comp.replaceDataOnPath(['list', 0, 'v'], 'D')
      })
    })
    expect(getP()).toStrictEqual(['D', 'B', 'C'])
    expect(execArr).toStrictEqual(['D'])
    execArr = []
    execWithWarn(1, () => {
      comp.groupUpdates(() => {
        comp.replaceDataOnPath(['list', 1, 'v'], 'E')
      })
    })
    expect(getP()).toStrictEqual(['D', 'E', 'C'])
    expect(execArr).toStrictEqual(['E'])
  })

  test('should be able to update list (full list update)', () => {
    let execArr = [] as string[]
    const childCompDef = componentSpace
      .define()
      .property('p', String)
      .observer('p', function () {
        execArr.push(this.data.p)
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef.general(),
      })
      .template(
        tmpl(`
          <child wx:for="{{list}}" wx:key="k" p="{{item.v}}" />
        `),
      )
      .data(() => ({
        list: [
          { k: 1, v: 'A' },
          { k: 2, v: 'B' },
          { k: 3, v: 'C' },
          { k: 4, v: 'D' },
        ],
      }))
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)
    const getP = () => {
      const ret = [] as string[]
      comp
        .getShadowRoot()!
        .childNodes[0]!.asElement()!
        .childNodes.forEach((child) => {
          ret.push(child.asElement()!.childNodes[0]!.asInstanceOf(childCompDef)!.data.p)
        })
      return ret
    }
    expect(getP()).toStrictEqual(['A', 'B', 'C', 'D'])
    expect(execArr).toStrictEqual(['A', 'B', 'C', 'D'])
    execArr = []
    comp.setData({
      list: [
        { k: 3, v: 'C' },
        { k: 5, v: 'E' },
        { k: 1, v: 'A' },
        { k: 6, v: 'F' },
      ],
    })
    expect(getP()).toStrictEqual(['C', 'E', 'A', 'F'])
    expect(execArr).toStrictEqual(['E', 'F', 'C', 'A'])
  })

  test('should be able to update list keys', () => {
    let execArr = [] as string[]
    const childCompDef = componentSpace
      .define()
      .property('p', String)
      .observer('p', function () {
        execArr.push(this.data.p)
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef.general(),
      })
      .template(
        tmpl(`
        <child wx:for="{{list}}" wx:key="k" p="{{item.v}}" />
      `),
      )
      .data(() => ({
        list: [
          { k: 1, v: 'A' },
          { k: 2, v: 'B' },
          { k: 2, v: 'C' },
        ],
      }))
      .registerComponent()
    const comp = execWithWarn(1, () =>
      glassEasel.Component.createWithContext('root', compDef, domBackend),
    )
    glassEasel.Element.pretendAttached(comp)
    const getP = () => {
      const ret = [] as string[]
      comp
        .getShadowRoot()!
        .childNodes[0]!.asElement()!
        .childNodes.forEach((child) => {
          ret.push(child.asElement()!.childNodes[0]!.asInstanceOf(childCompDef)!.data.p)
        })
      return ret
    }
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
    execArr = []
    execWithWarn(1, () => {
      comp.groupUpdates(() => {
        comp.replaceDataOnPath(['list', 1, 'k'], 1)
      })
    })
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    expect(execArr).toStrictEqual(['B', 'A', 'C'])
    execArr = []
    comp.groupUpdates(() => {
      comp.replaceDataOnPath(['list', 1, 'k'], 3)
    })
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    expect(execArr).toStrictEqual(['B', 'A'])
    execArr = []
    comp.groupUpdates(() => {
      comp.replaceDataOnPath(['list', 2, 'k'], 4)
    })
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    expect(execArr).toStrictEqual(['C'])
    execArr = []
    execWithWarn(1, () => {
      comp.groupUpdates(() => {
        comp.replaceDataOnPath(['list', 1, 'k'], 4)
      })
    })
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    expect(execArr).toStrictEqual(['C', 'B'])
  })

  test('should be able to do list-splice update (without key)', () => {
    let execArr = [] as string[]
    const childCompDef = componentSpace
      .define()
      .property('p', String)
      .observer('p', function () {
        execArr.push(this.data.p)
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef.general(),
      })
      .template(
        tmpl(`
        <child wx:for="{{list}}" p="{{item}}" />
      `),
      )
      .data(() => ({
        list: ['A', 'B', 'C'],
      }))
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)
    const getP = () => {
      const ret = [] as string[]
      comp
        .getShadowRoot()!
        .childNodes[0]!.asElement()!
        .childNodes.forEach((child) => {
          ret.push(child.asElement()!.childNodes[0]!.asInstanceOf(childCompDef)!.data.p)
        })
      return ret
    }
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
    execArr = []
    comp.groupUpdates(() => {
      comp.spliceArrayDataOnPath(['list'], 1, 1, ['D', 'Z'])
      comp.spliceArrayDataOnPath(['list'], 2, 1, ['E'])
    })
    expect(getP()).toStrictEqual(['A', 'D', 'E', 'C'])
    expect(execArr).toStrictEqual(['A', 'D', 'E', 'C'])
    execArr = []
    comp.groupUpdates(() => {
      comp.spliceArrayDataOnPath(['list'], 100, 0, ['F'])
    })
    expect(getP()).toStrictEqual(['A', 'D', 'E', 'C', 'F'])
    expect(execArr).toStrictEqual(['A', 'D', 'E', 'C', 'F'])
    execArr = []
    comp.groupUpdates(() => {
      comp.spliceArrayDataOnPath(['list'], 3, 3, [])
    })
    expect(getP()).toStrictEqual(['A', 'D', 'E'])
    expect(execArr).toStrictEqual(['A', 'D', 'E'])
    execArr = []
    comp.groupUpdates(() => {
      comp.spliceArrayDataOnPath(['list'], 0, 2, ['G'])
    })
    expect(getP()).toStrictEqual(['G', 'E'])
    expect(execArr).toStrictEqual(['G', 'E'])
  })

  test('should be able to do list-splice update (with invalid key)', () => {
    let execArr = [] as string[]
    const childCompDef = componentSpace
      .define()
      .property('p', String)
      .observer('p', function () {
        execArr.push(this.data.p)
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef.general(),
      })
      .template(
        tmpl(`
        <child wx:for="{{list}}" wx:key="index" p="{{item}}" />
      `),
      )
      .data(() => ({
        list: ['A', 'B', 'C'],
      }))
      .registerComponent()
    const comp = execWithWarn(1, () =>
      glassEasel.Component.createWithContext('root', compDef, domBackend),
    )
    glassEasel.Element.pretendAttached(comp)
    const getP = () => {
      const ret = [] as string[]
      comp
        .getShadowRoot()!
        .childNodes[0]!.asElement()!
        .childNodes.forEach((child) => {
          ret.push(child.asElement()!.childNodes[0]!.asInstanceOf(childCompDef)!.data.p)
        })
      return ret
    }
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
    execArr = []
    execWithWarn(1, () => {
      comp.groupUpdates(() => {
        comp.spliceArrayDataOnPath(['list'], 1, 1, ['D', 'Z'])
        comp.spliceArrayDataOnPath(['list'], 2, 1, ['E'])
      })
    })
    expect(getP()).toStrictEqual(['A', 'D', 'E', 'C'])
    expect(execArr).toStrictEqual(['C', 'A', 'D', 'E'])
    execArr = []
    execWithWarn(1, () => {
      comp.groupUpdates(() => {
        comp.spliceArrayDataOnPath(['list'], 100, 0, ['F'])
      })
    })
    expect(getP()).toStrictEqual(['A', 'D', 'E', 'C', 'F'])
    expect(execArr).toStrictEqual(['F', 'A', 'D', 'E', 'C'])
    execArr = []
    execWithWarn(1, () => {
      comp.groupUpdates(() => {
        comp.spliceArrayDataOnPath(['list'], 3, 3, [])
      })
    })
    expect(getP()).toStrictEqual(['A', 'D', 'E'])
    expect(execArr).toStrictEqual(['A', 'D', 'E'])
    execArr = []
    execWithWarn(1, () => {
      comp.groupUpdates(() => {
        comp.spliceArrayDataOnPath(['list'], 0, 2, ['G'])
      })
    })
    expect(getP()).toStrictEqual(['G', 'E'])
    expect(execArr).toStrictEqual(['G', 'E'])
  })

  test('should be able to do list-splice update (with key)', () => {
    let execArr = [] as string[]
    const childCompDef = componentSpace
      .define()
      .property('p', String)
      .observer('p', function () {
        execArr.push(this.data.p)
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef.general(),
      })
      .template(
        tmpl(`
        <child wx:for="{{list}}" wx:key="k" p="{{item.v}}" />
      `),
      )
      .data(() => ({
        list: [
          { k: 1, v: 'A' },
          { k: 2, v: 'B' },
          { k: 3, v: 'C' },
        ],
      }))
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)
    const getP = () => {
      const ret = [] as string[]
      comp
        .getShadowRoot()!
        .childNodes[0]!.asElement()!
        .childNodes.forEach((child) => {
          ret.push(child.asElement()!.childNodes[0]!.asInstanceOf(childCompDef)!.data.p)
        })
      return ret
    }
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
    execArr = []
    comp.groupUpdates(() => {
      comp.spliceArrayDataOnPath(['list'], 1, 1, [
        { k: 4, v: 'D' },
        { k: 5, v: 'Z' },
      ])
      comp.spliceArrayDataOnPath(['list'], 2, 1, [{ k: 5, v: 'E' }])
    })
    expect(getP()).toStrictEqual(['A', 'D', 'E', 'C'])
    expect(execArr).toStrictEqual(['D', 'E'])
    execArr = []
    comp.groupUpdates(() => {
      comp.spliceArrayDataOnPath(['list'], 100, 0, [{ k: 6, v: 'F' }])
    })
    expect(getP()).toStrictEqual(['A', 'D', 'E', 'C', 'F'])
    expect(execArr).toStrictEqual(['F'])
    execArr = []
    comp.groupUpdates(() => {
      comp.replaceDataOnPath(['list', 1, 'v'], 'DD')
      comp.spliceArrayDataOnPath(['list'], 3, 3, [])
    })
    expect(getP()).toStrictEqual(['A', 'DD', 'E'])
    expect(execArr).toStrictEqual(['DD'])
    execArr = []
    comp.groupUpdates(() => {
      comp.replaceDataOnPath(['list', 1, 'v'], 'D')
      comp.spliceArrayDataOnPath(['list'], 0, 0, [{ k: 3, v: 'C' }])
    })
    expect(getP()).toStrictEqual(['C', 'A', 'D', 'E'])
    expect(execArr).toStrictEqual(['C', 'D'])
    execArr = []
    comp.groupUpdates(() => {
      comp.replaceDataOnPath(['list', 1, 'v'], 'DD')
      comp.spliceArrayDataOnPath(['list'], 0, 2, [{ k: 7, v: 'G' }])
    })
    expect(getP()).toStrictEqual(['G', 'D', 'E'])
    expect(execArr).toStrictEqual(['G'])
    execArr = []
    execWithWarn(1, () => {
      comp.groupUpdates(() => {
        comp.spliceArrayDataOnPath(['list'], -1, 100, [{ k: 7, v: 'GG' }])
      })
    })
    expect(getP()).toStrictEqual(['G', 'D', 'E', 'GG'])
    expect(execArr).toStrictEqual(['GG', 'G'])
    execArr = []
    execWithWarn(1, () => {
      comp.groupUpdates(() => {
        comp.spliceArrayDataOnPath(['list'], 1, 1, [])
      })
    })
    expect(getP()).toStrictEqual(['G', 'E', 'GG'])
    expect(execArr).toStrictEqual(['G', 'GG'])
  })

  test('should be able to do list-splice update (with key and using index)', () => {
    let execArr = [] as string[]
    const childCompDef = componentSpace
      .define()
      .property('p', String)
      .observer('p', function () {
        execArr.push(this.data.p)
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef.general(),
      })
      .template(
        tmpl(`
        <child wx:for="{{list}}" wx:key="k" p="{{index}}:{{item.v}}" />
      `),
      )
      .data(() => ({
        list: [
          { k: 1, v: 'A' },
          { k: 2, v: 'B' },
          { k: 3, v: 'C' },
        ],
      }))
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)
    const getP = () => {
      const ret = [] as string[]
      comp
        .getShadowRoot()!
        .childNodes[0]!.asElement()!
        .childNodes.forEach((child) => {
          ret.push(child.asElement()!.childNodes[0]!.asInstanceOf(childCompDef)!.data.p)
        })
      return ret
    }
    expect(getP()).toStrictEqual(['0:A', '1:B', '2:C'])
    expect(execArr).toStrictEqual(['0:A', '1:B', '2:C'])
    execArr = []
    comp.groupUpdates(() => {
      comp.spliceArrayDataOnPath(['list'], 1, 1, [{ k: 4, v: 'D' }])
    })
    expect(getP()).toStrictEqual(['0:A', '1:D', '2:C'])
    expect(execArr).toStrictEqual(['1:D'])
    execArr = []
    comp.groupUpdates(() => {
      comp.spliceArrayDataOnPath(['list'], 1, 0, [{ k: 5, v: 'E' }])
    })
    expect(getP()).toStrictEqual(['0:A', '1:E', '2:D', '3:C'])
    expect(execArr).toStrictEqual(['1:E', '2:D', '3:C'])
    execArr = []
    comp.groupUpdates(() => {
      comp.spliceArrayDataOnPath(['list'], 1, 2, [])
    })
    expect(getP()).toStrictEqual(['0:A', '1:C'])
    expect(execArr).toStrictEqual(['1:C'])
  })

  test('should be able to update list with invalid key', () => {
    const compDef = componentSpace
      .define()
      .template(
        tmpl(`
          <block wx:for="{{ list }}" wx:key="index">{{ item.content }}</block>
        `),
      )
      .data(() => ({
        list: [{ content: 'A' }, { content: 'B' }, { content: 'C' }],
      }))
      .registerComponent()
    const comp = execWithWarn(1, () =>
      glassEasel.Component.createWithContext('root', compDef, domBackend),
    )
    glassEasel.Element.pretendAttached(comp)
    const getP = () => {
      const ret = [] as string[]
      comp
        .getShadowRoot()!
        .childNodes[0]!.asElement()!
        .childNodes.forEach((child) => {
          ret.push(child.asElement()!.childNodes[0]!.asTextNode()!.textContent)
        })
      return ret
    }
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    execWithWarn(1, () =>
      comp.setData({
        list: [{ content: 'A' }, { content: 'B' }, { content: 'C' }, { content: 'D' }],
      }),
    )
    expect(getP()).toStrictEqual(['A', 'B', 'C', 'D'])
    execWithWarn(1, () =>
      comp.setData({
        list: [{ content: 'A' }, { content: 'B' }],
      }),
    )
    expect(getP()).toStrictEqual(['A', 'B'])
    execWithWarn(1, () =>
      comp.setData({
        list: [{ content: 'B' }, { content: 'A' }, { content: 'C' }],
      }),
    )
    expect(getP()).toStrictEqual(['B', 'A', 'C'])
  })

  test('should update length while list partial update', () => {
    const compDef = componentSpace
      .define()
      .template(
        tmpl(`
          <div data:p="{{ arr.length }}" data:q="{{ arr[4].a }}">{{ arr.length }}</div>
        `),
      )
      .data(() => ({
        arr: [{ a: 12 }, { a: 34 }, { a: 56 }] as { a: number }[],
      }))
      .registerComponent()

    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)
    const a = comp.getShadowRoot()!.childNodes[0]!.asElement()!
    expect(a.dataset.p).toBe(3)
    expect(a.dataset.q).toBeUndefined()
    expect(a.childNodes[0]!.asTextNode()!.textContent).toBe('3')

    comp.setData({ 'arr[4]': { a: 78 } })
    expect(a.dataset.p).toBe(5)
    expect(a.dataset.q).toBe(78)
    expect(a.childNodes[0]!.asTextNode()!.textContent).toBe('5')

    comp.spliceArrayDataOnPath(['arr'], 1, 3, [{ a: 43 }, { a: 65 }])
    comp.applyDataUpdates()
    expect(a.dataset.p).toBe(4)
    expect(a.dataset.q).toBeUndefined()
    expect(a.childNodes[0]!.asTextNode()!.textContent).toBe('4')

    comp.replaceDataOnPath(['arr', 4, 'a'], 89)
    comp.spliceArrayDataOnPath(['arr'], 100, 0, [{ a: 123 }])
    comp.applyDataUpdates()
    expect(a.dataset.p).toBe(6)
    expect(a.dataset.q).toBe(89)
    expect(a.childNodes[0]!.asTextNode()!.textContent).toBe('6')

    comp.setData({ 'arr[9].a': 98 })
    expect(a.dataset.p).toBe(10)
    expect(a.dataset.q).toBe(89)
    expect(a.childNodes[0]!.asTextNode()!.textContent).toBe('10')
  })

  test('should update length while list partial update (without inner data)', () => {
    const compDef = componentSpace
      .define()
      .options({
        dataDeepCopy: glassEasel.DeepCopyKind.None,
      })
      .template(
        tmpl(`
          <div data:p="{{ arr.length }}" data:q="{{ arr[4].a }}">{{ arr.length }}</div>
        `),
      )
      .data(() => ({
        arr: [{ a: 12 }, { a: 34 }, { a: 56 }] as { a: number }[],
      }))
      .registerComponent()

    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)
    const a = comp.getShadowRoot()!.childNodes[0]!.asElement()!
    expect(a.dataset.p).toBe(3)
    expect(a.dataset.q).toBeUndefined()
    expect(a.childNodes[0]!.asTextNode()!.textContent).toBe('3')

    comp.setData({ 'arr[4]': { a: 78 } })
    expect(a.dataset.p).toBe(5)
    expect(a.dataset.q).toBe(78)
    expect(a.childNodes[0]!.asTextNode()!.textContent).toBe('5')

    comp.spliceArrayDataOnPath(['arr'], 1, 3, [{ a: 43 }, { a: 65 }])
    comp.applyDataUpdates()
    expect(a.dataset.p).toBe(4)
    expect(a.dataset.q).toBeUndefined()
    expect(a.childNodes[0]!.asTextNode()!.textContent).toBe('4')

    comp.spliceArrayDataOnPath(['arr'], 1, 2, [])
    comp.replaceDataOnPath(['arr', 3, 'a'], 89)
    comp.spliceArrayDataOnPath(['arr'], 1, 0, [{ a: 123 }])
    comp.applyDataUpdates()
    expect(a.dataset.p).toBe(5)
    expect(a.dataset.q).toBe(89)
    expect(a.childNodes[0]!.asTextNode()!.textContent).toBe('5')

    comp.setData({ 'arr[9].a': 98 })
    expect(a.dataset.p).toBe(10)
    expect(a.dataset.q).toBe(89)
    expect(a.childNodes[0]!.asTextNode()!.textContent).toBe('10')
  })

  test('should iterate Object entries', () => {
    const compDef = componentSpace
      .define()
      .data(() => ({
        obj: {
          arr: [123],
        },
      }))
      .template(
        tmpl(`
          <block wx:for="{{ obj }}">{{ item[0] }}</block>
          <block wx:for="{{ obj }}" wx:key="0">-{{ item[0] }}</block>
        `),
      )
      .registerComponent()

    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    const shadowRoot = comp.shadowRoot as glassEasel.ShadowRoot
    expect(shadowRoot.getComposedChildren()[2]!.asTextNode()!.textContent).toBe('123')
    expect(shadowRoot.getComposedChildren()[5]!.asTextNode()!.textContent).toBe('-123')

    comp.setData({
      'obj.arr[0]': 456,
    })
    expect(shadowRoot.getComposedChildren()[2]!.asTextNode()!.textContent).toBe('456')
    expect(shadowRoot.getComposedChildren()[5]!.asTextNode()!.textContent).toBe('-456')
  })

  test('should support custom property value comparer', () => {
    let execArr = [] as string[]
    const childCompDef = componentSpace
      .define()
      .property('p', {
        type: String,
        value: 'def',
        comparer(newValue, oldValue) {
          execArr.push('A')
          if (newValue === 'abc') return false
          if (newValue === 'ghi') return true
          return newValue !== oldValue
        },
        observer() {
          execArr.push('C')
        },
      })
      .observer('p', () => {
        execArr.push('B')
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef.general(),
      })
      .template(
        tmpl(`
          <child p="{{p}}" />
        `),
      )
      .data(() => ({
        p: 'def',
      }))
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    const child = comp.getShadowRoot()!.childNodes[0]!.asInstanceOf(childCompDef)!
    expect(execArr).toStrictEqual(['A', 'B'])
    execArr = []
    glassEasel.Element.pretendAttached(comp)
    comp.setData({ p: '' })
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
    execArr = []
    comp.setData({ p: 'abc' })
    expect(execArr).toStrictEqual(['A', 'B'])
    execArr = []
    comp.setData({ p: '' })
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
    execArr = []
    comp.setData({ p: 'ghi' })
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
    execArr = []
    comp.setData({ p: 'ghi' })
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
    execArr = []
    child.setData({ p: 'ghi' })
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
  })

  test('should support global property value comparer', () => {
    let execArr = [] as string[]
    const childCompDef = componentSpace
      .define()
      .options({
        propertyComparer: (newValue, oldValue) => {
          execArr.push('A')
          return newValue !== oldValue
        },
      })
      .property('p', {
        type: String,
        value: 'def',
        comparer: (newValue, oldValue) => {
          execArr.push('B')
          if (newValue === 'abc') return false
          if (newValue === 'ghi') return true
          return newValue !== oldValue
        },
        observer() {
          execArr.push('C')
        },
      })
      .property('pp', {
        type: String,
        value: 'def',
        observer() {
          execArr.push('D')
        },
      })
      .observer('p', () => {
        execArr.push('E')
      })
      .observer('pp', () => {
        execArr.push('F')
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef.general(),
      })
      .template(
        tmpl(`
          <child p="{{p}}" pp="{{pp}}" />
        `),
      )
      .data(() => ({
        p: 'def',
        pp: 'def',
      }))
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    const child = comp.getShadowRoot()!.childNodes[0]!.asInstanceOf(childCompDef)!
    expect(execArr).toStrictEqual(['B', 'A', 'E', 'F'])
    execArr = []
    glassEasel.Element.pretendAttached(comp)
    comp.setData({ p: '' })
    expect(execArr).toStrictEqual(['B', 'E', 'C'])
    execArr = []
    comp.setData({ p: 'abc' })
    expect(execArr).toStrictEqual(['B', 'E'])
    execArr = []
    comp.setData({ p: '' })
    expect(execArr).toStrictEqual(['B', 'E', 'C'])
    execArr = []
    comp.setData({ p: 'ghi' })
    expect(execArr).toStrictEqual(['B', 'E', 'C'])
    execArr = []
    comp.setData({ p: 'ghi' })
    expect(execArr).toStrictEqual(['B', 'E', 'C'])
    execArr = []
    child.setData({ p: 'ghi' })
    expect(execArr).toStrictEqual(['B', 'E', 'C'])
    execArr = []
    comp.setData({ pp: 'abc' })
    expect(execArr).toStrictEqual(['A', 'F', 'D'])
    execArr = []
    comp.setData({ pp: 'abc' })
    expect(execArr).toStrictEqual(['A', 'F'])
    execArr = []
    child.setData({ pp: 'abc' })
    expect(execArr).toStrictEqual(['A', 'F'])
    execArr = []
    comp.setData({ p: 'abc', pp: 'abc' })
    expect(execArr).toStrictEqual(['B', 'A', 'E', 'F'])
    execArr = []
    comp.setData({ p: 'ghi', pp: 'ghi' })
    expect(execArr).toStrictEqual(['B', 'A', 'E', 'F', 'C', 'D'])
  })

  test('should not allow updates before init done', () => {
    const compDef = componentSpace
      .define()
      .data(() => ({
        a: 123,
        b: ['a'],
      }))
      .init(({ self }) => {
        let throwCount = 0
        try {
          self.setData({ a: 456 })
        } catch {
          throwCount += 1
        }
        try {
          self.updateData({ b: ['c'] })
        } catch {
          throwCount += 1
        }
        try {
          self.replaceDataOnPath(['a'], 789)
        } catch {
          throwCount += 1
        }
        try {
          self.spliceArrayDataOnPath(['b'], 0, 0, ['b'])
        } catch {
          throwCount += 1
        }
        try {
          self.groupUpdates(() => undefined)
        } catch {
          throwCount += 1
        }
        expect(throwCount).toBe(5)
      })
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    expect(comp.data).toStrictEqual({ a: 123, b: ['a'] })
  })

  test('should allow set empty data', () => {
    const compDef = componentSpace
      .define()
      .data(() => ({
        a: 123,
        b: 'abc',
      }))
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    comp.updateData({ a: 456 })
    expect(comp.data.a).toBe(123)
    comp.setData(undefined)
    expect(comp.data.a).toBe(456)
  })

  test('should warn recursive updates', () => {
    const childCompDef = componentSpace
      .define()
      .property('a', String)
      .observer('a', function () {
        this.triggerEvent('b')
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef,
      })
      .template(
        tmpl(`
          <child wx:if="{{ cond }}" a="123" bind:b="ev" />
        `),
      )
      .data(() => ({
        cond: false,
      }))
      .methods({
        ev() {
          this.setData({ cond: true })
        },
      })
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)
    execWithWarn(1, () => {
      comp.setData({ cond: true })
    })
  })

  test('should preserve item when keys are invalid', () => {
    let execArr: string[] = []
    const childCompDef = componentSpace
      .define()
      .property('a', String)
      .observer('a', function () {
        execArr.push(`update:${this.data.a}`)
      })
      .lifetime('attached', function () {
        execArr.push(`create:${this.data.a}`)
      })
      .template(
        tmpl(`
          <block>{{a}}</block>
        `),
      )
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        child: childCompDef,
      })
      .data(() => ({
        list: [1],
      }))
      .template(
        tmpl(`
          <child wx:for="{{ list }}" wx:key="invalid" a="{{item}}-{{index}}"/>
        `),
      )
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)

    expect(domHtml(comp)).toBe('<child>1-0</child>')
    expect(execArr).toEqual(['update:1-0', 'create:1-0'])

    execArr = []
    execWithWarn(1, () => {
      comp.setData({
        list: [2, 1],
      })
    })
    expect(domHtml(comp)).toBe('<child>2-0</child><child>1-1</child>')
    expect(execArr).toEqual(['update:1-1', 'update:2-0', 'create:1-1'])

    execArr = []
    comp.spliceArrayDataOnPath(['list'], 0, 1, [])
    comp.applyDataUpdates()
    expect(domHtml(comp)).toBe('<child>1-0</child>')
    expect(execArr).toEqual(['update:1-0'])
  })

  test('should update data in nesting components', () => {
    let execArr: string[] = []
    const childCompDef = componentSpace
      .define()
      .options({ virtualHost: true })
      .property('a', {
        type: Boolean,
        value: false,
        observer(a) {
          execArr.push(`child:property:${a}`)
        },
      })
      .observer('a', function () {
        execArr.push(`child:observer:${this.data.a}`)
      })
      .template(
        tmpl(`
          <block>{{a}}</block>
        `),
      )
      .registerComponent()

    const middleCompDef = componentSpace
      .define()
      .options({ virtualHost: true })
      .usingComponents({
        child: childCompDef,
      })
      .property('a', {
        type: Boolean,
        value: false,
        observer(a) {
          execArr.push(`middle:property:${a}`)
        },
      })
      .observer('a', function () {
        execArr.push(`middle:observer:${this.data.a}`)
      })
      .template(
        tmpl(`
          <child id="child" a="{{a}}"/>
        `),
      )
      .registerComponent()

    const compDef = componentSpace
      .define()
      .usingComponents({
        middle: middleCompDef,
      })
      .data(() => ({
        a: false,
      }))
      .template(
        tmpl(`
          <middle id="middle" a="{{a}}"/>
        `),
      )
      .registerComponent()

    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    const middle = comp.$.middle as glassEasel.GeneralComponent
    const child = middle.$.child as glassEasel.GeneralComponent
    glassEasel.Element.pretendAttached(comp)

    expect(domHtml(comp)).toBe('false')
    expect(execArr).toEqual([
      'child:observer:false',
      'middle:observer:false',
      'child:observer:false',
    ])

    execArr = []
    comp.setData({ a: true })
    expect(domHtml(comp)).toBe('true')
    expect(execArr).toEqual([
      'middle:observer:true',
      'child:observer:true',
      'child:property:true',
      'middle:property:true',
    ])

    execArr = []
    child.setData({ a: false })
    expect(domHtml(comp)).toBe('false')
    expect(execArr).toEqual(['child:observer:false', 'child:property:false'])

    execArr = []
    comp.setData({ a: true })
    expect(domHtml(comp)).toBe('true')
    expect(execArr).toEqual(['middle:observer:true', 'child:observer:true', 'child:property:true'])
  })
})
