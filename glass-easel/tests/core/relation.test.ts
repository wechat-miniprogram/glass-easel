/* eslint-disable no-restricted-syntax */
import { domBackend } from '../base/env'
import * as glassEasel from '../../src'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
})
componentSpace.defineComponent({
  is: '',
})

describe('Relation', () => {
  test('should link when another component is lazily loaded', () => {
    const childLinkedList: ['linked' | 'unlinked', glassEasel.GeneralComponent][] = []
    const childDef = componentSpace.defineComponent({
      is: 'child',
      relations: {
        parent: {
          type: 'ancestor',
          linked(target) {
            childLinkedList.push(['linked', target])
          },
          unlinked(target) {
            childLinkedList.push(['unlinked', target])
          },
        },
      },
    })
    const child = glassEasel.Component.createWithContext('child', childDef, domBackend)

    expect(childLinkedList).toEqual([])

    const parentLinkedList: ['linked' | 'unlinked', glassEasel.GeneralComponent][] = []
    const parentDef = componentSpace.defineComponent({
      is: 'parent',
      relations: {
        child: {
          type: 'descendant',
          linked(target) {
            parentLinkedList.push(['linked', target])
          },
          unlinked(target) {
            parentLinkedList.push(['unlinked', target])
          },
        },
      },
    })
    const parent = glassEasel.Component.createWithContext('parent', parentDef, domBackend)
    glassEasel.Element.pretendAttached(parent)

    expect(childLinkedList).toStrictEqual([])
    expect(parentLinkedList).toStrictEqual([])

    parent.appendChild(child)

    expect(childLinkedList).toStrictEqual([['linked', parent]])
    expect(parentLinkedList).toStrictEqual([['linked', child]])

    parent.removeChild(child)

    expect(childLinkedList).toStrictEqual([
      ['linked', parent],
      ['unlinked', parent],
    ])
    expect(parentLinkedList).toStrictEqual([
      ['linked', child],
      ['unlinked', child],
    ])
  })
})
