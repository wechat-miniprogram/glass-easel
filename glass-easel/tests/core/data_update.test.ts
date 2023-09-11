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
    expect(execArr).toStrictEqual(['A', 'B', 'C'])
    execArr = []
    comp.groupUpdates(() => {
      comp.replaceDataOnPath(['list', 1, 'k'], 3)
    })
    expect(getP()).toStrictEqual(['A', 'B', 'C'])
    expect(execArr).toStrictEqual(['A', 'B'])
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
    expect(execArr).toStrictEqual(['B', 'C'])
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
    expect(execArr).toStrictEqual(['G', 'GG'])
    execArr = []
    execWithWarn(1, () => {
      comp.groupUpdates(() => {
        comp.spliceArrayDataOnPath(['list'], 1, 1, [])
      })
    })
    expect(getP()).toStrictEqual(['G', 'E', 'GG'])
    expect(execArr).toStrictEqual([])
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
})
