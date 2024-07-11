import { domBackend, tmpl } from '../base/env'
import * as glassEasel from '../../src'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
  writeIdToDOM: true,
})
componentSpace.defineComponent({
  is: '',
})

describe('dynamic add observer', () => {
  it('should trigger data observers', () => {
    let actionOrder: number[] = []

    const Comp = componentSpace.defineComponent({
      observers: {
        data1() {
          actionOrder.push(1)
        },
      },
    })

    const elem = glassEasel.Component.createWithContext('root', Comp, domBackend).general()
    const elem2 = glassEasel.Component.createWithContext('root', Comp, domBackend).general()

    elem.setData({
      data1: 1,
      data2: 2,
    })
    expect(actionOrder).toStrictEqual([1])
    actionOrder = []

    elem.dynamicAddObserver(() => {
      actionOrder.push(2)
    }, 'data2')
    elem.dynamicAddObserver(() => {
      actionOrder.push(3)
    }, '**')
    elem.setData({
      data1: 11,
      data2: 22,
    })
    expect(actionOrder).toStrictEqual([1, 2, 3])
    actionOrder = []

    elem2.setData({
      data1: 1,
      data2: 2,
    })
    expect(actionOrder).toStrictEqual([1])
    actionOrder = []
  })
})

describe('listProperties', () => {
  it('should list properties', () => {
    const Comp = componentSpace.defineComponent({
      properties: {
        a: String,
        b: String,
        c: String,
      },
    })

    const Root = componentSpace.defineComponent({
      using: { comp: Comp },
      template: tmpl(`<comp id="comp" a="a" />`),
    })

    const root = glassEasel.Component.createWithContext('root', Root, domBackend).general()
    const comp = (root.$.comp as glassEasel.GeneralComponent).asInstanceOf(Comp)!

    expect(glassEasel.Component.listProperties(comp)).toStrictEqual(['a', 'b', 'c'])
    expect(glassEasel.Component.listChangedProperties(comp)).toStrictEqual(['a'])

    comp.setData({ b: 'b' })
    expect(glassEasel.Component.listChangedProperties(comp)).toStrictEqual(['a'])

    comp._$dataGroup.replaceProperty('c', 'c')
    expect(glassEasel.Component.listChangedProperties(comp)).toStrictEqual(['a', 'c'])
  })
})
