import * as glassEasel from 'glass-easel'
import { tmpl } from './base/env'
import { MiniProgramEnv } from '../src'

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

describe('trait behavior', () => {
  test('implement trait behavior', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('path/to/comp', {})
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div>{{r}}</div>
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component, Behavior }) => {
      const trait = Behavior.trait<
        { add(a: number, b: number): number },
        { minus(a: number, b: number): number }
      >(({ add }) => ({
        minus(a, b) {
          return add(a, -b)
        },
      }))
      Component()
        .data(() => ({
          r: 0,
        }))
        .init(({ self, setData, lifetime, implement }) => {
          implement(trait, { add: (a, b) => a + b })
          lifetime('attached', () => {
            const r = self.traitBehavior(trait)!.minus(5, 3)
            setData({ r })
          })
          expect(self.hasBehavior(trait)).toBe(true)
        })
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(domHtml(root.getComponent())).toBe('<div>2</div>')
  })

  test('trait behavior in relations', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    const childTrait = codeSpace.traitBehavior<{
      setA(a: number): void
    }>()
    const parentTrait = codeSpace.traitBehavior()

    codeSpace.addComponentStaticConfig('child/list', {
      component: true,
    })
    codeSpace.addCompiledTemplate(
      'child/list',
      tmpl(`
      <div>{{count}}</div><slot />
    `),
    )
    // eslint-disable-next-line arrow-body-style
    codeSpace.componentEnv('child/list', ({ Component }) => {
      return Component()
        .data(() => ({
          count: 0,
        }))
        .implement(parentTrait, {})
        .init(({ relation, setData }) => {
          const childRel = relation({
            type: 'child',
            target: childTrait,
            linked(child) {
              // eslint-disable-next-line no-use-before-define
              expect(child.asInstanceOf(itemDef)).not.toBe(null)
              setData({ count: this.data.count + 1 })
              childRel.listAsTrait().forEach((c, index) => {
                c.setA(index + 2)
              })
            },
          })
        })
        .register()
    })

    codeSpace.addComponentStaticConfig('child/item', {
      component: true,
    })
    codeSpace.addCompiledTemplate('child/item', tmpl('{{a}}'))
    // eslint-disable-next-line arrow-body-style
    const itemDef = codeSpace.componentEnv('child/item', ({ Component }) => {
      return Component()
        .data(() => ({
          a: 0,
        }))
        .init(({ implement, relation, setData }) => {
          implement(childTrait, {
            setA(a: number) {
              setData({ a })
            },
          })
          relation({
            type: 'parent',
            target: parentTrait,
          })
        })
        .register()
    })

    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        list: '/child/list',
        item: '/child/item',
      },
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <list>
        <item />
        <item />
      </list>
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component().register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(domHtml(root.getComponent())).toBe(
      '<list is="child/list"><div>2</div><item is="child/item">2</item><item is="child/item">3</item></list>',
    )
  })
})
