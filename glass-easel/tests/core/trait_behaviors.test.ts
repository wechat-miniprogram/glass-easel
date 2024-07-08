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

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

describe('trait behaviors', () => {
  test('should be able to retrieve implementations', () => {
    interface Add {
      op(a: number, b: number): number
    }
    interface Mul {
      op(a: number, b: number): number
    }
    const tbAdd1 = componentSpace.defineTraitBehavior<Add>()
    const tbAdd2 = componentSpace.defineTraitBehavior<Add>()
    const tbMul1 = componentSpace.defineTraitBehavior<Mul>()
    const compDef = componentSpace
      .define()
      .implement(tbAdd1, {
        op(a: number, b: number) {
          return a + b
        },
      })
      .init(({ implement, lifetime }) => {
        implement(tbMul1, {
          op(a: number, b: number) {
            return a * b
          },
        })
        lifetime('created', () => {
          let catched = false
          try {
            implement(tbAdd2, {
              op(a: number, b: number) {
                return a + b
              },
            })
          } catch {
            catched = true
          }
          expect(catched).toBe(true)
        })
      })
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend).general()
    expect(comp.hasBehavior(tbAdd1)).toStrictEqual(true)
    expect(comp.hasBehavior(tbAdd2)).toStrictEqual(false)
    expect(comp.hasBehavior(tbMul1)).toStrictEqual(true)
    expect(comp.traitBehavior(tbAdd1)!.op(2, 3)).toBe(5)
    expect(comp.traitBehavior(tbAdd2)).toBe(undefined)
    expect(comp.traitBehavior(tbMul1)!.op(2, 3)).toBe(6)
  })

  test('should be able to transform interfaces', () => {
    interface TraitIn {
      add(a: number, b: number): number
    }
    interface TraitOut {
      minus(a: number, b: number): number
    }
    const tb = componentSpace.defineTraitBehavior<TraitIn, TraitOut>((impl) => ({
      minus(a: number, b: number): number {
        return impl.add(a, -b)
      },
    }))
    const compDef = componentSpace
      .define()
      .implement(tb, {
        add(a: number, b: number) {
          return a + b
        },
      })
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    expect(comp.hasBehavior(tb)).toStrictEqual(true)
    expect((comp.traitBehavior(tb)! as unknown as { add: any }).add).toBe(undefined)
    expect(comp.traitBehavior(tb)!.minus(9, 4)).toBe(5)
  })

  test('should be able to use in relations', () => {
    const eventArr: number[] = []
    const tbParent = componentSpace.defineTraitBehavior<{ [k: string]: never }>()
    const tbChild = componentSpace.defineTraitBehavior<{
      setIndex(index: number): void
    }>()
    const parentDef = componentSpace
      .define()
      .init(({ implement, relation }) => {
        implement(tbParent, {})
        const child = relation({
          type: 'child',
          target: tbChild,
          linked() {
            eventArr.push(1)
            child.listAsTrait().forEach((c, index) => {
              c.setIndex(index)
            })
          },
        })
      })
      .registerComponent()
    const childDef = componentSpace
      .define()
      .template(tmpl('{{index}}'))
      .data(() => ({
        index: '',
      }))
      .init(({ self, implement, relation }) => {
        implement(tbChild, {
          setIndex(index: number) {
            self.setData({
              index: String.fromCharCode(index + 'A'.charCodeAt(0)),
            })
          },
        })
        relation({
          type: 'parent',
          target: tbParent,
          linked() {
            eventArr.push(2)
          },
        })
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        parent: parentDef,
        child: childDef,
      })
      .template(
        tmpl(`
        <parent>
          <child wx:for="{{list}}" />
        </parent>
      `),
      )
      .data(() => ({
        list: [1, 2, 3],
      }))
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)
    expect(eventArr).toStrictEqual([1, 2, 1, 2, 1, 2])
    expect(domHtml(comp)).toBe(
      '<parent is=""><child is="">A</child><child is="">B</child><child is="">C</child></parent>',
    )
  })
})
