import * as glassEasel from 'glass-easel'
import { tmpl } from './base/env'
import { MiniProgramEnv } from '../src'
import { StyleIsolation } from '../src/types'

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

describe('selector query', () => {
  test('select single component (without custom export)', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('child/comp', {
      component: true,
      styleIsolation: StyleIsolation.Shared,
    })
    codeSpace.addCompiledTemplate('child/comp', tmpl('{{a}}'))
    // eslint-disable-next-line arrow-body-style
    const childDef = codeSpace.componentEnv('child/comp', ({ Component }) => {
      return Component()
        .lifetime('attached', function () {
          // eslint-disable-next-line no-use-before-define
          const owner = this.selectOwnerComponent(selfDef)!
          owner.update()
          expect(this.selectOwnerComponent()).toBe(owner)
          // eslint-disable-next-line no-use-before-define
          expect(owner.general().asInstanceOf(selfDef)).toBe(owner)
          expect(owner.general().asInstanceOf(childDef)).toBe(null)
          expect(this.selectOwnerComponent(childDef)).toBe(null)
        })
        .data(() => ({
          a: 123,
        }))
        .register()
    })

    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        child: '/child/comp',
      },
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div>
        <child id="c1" />
        <child id="c2" data-a="A" />
      </div>
    `),
    )
    // eslint-disable-next-line arrow-body-style
    const selfDef = codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      return Component()
        .methods({
          update() {
            // eslint-disable-next-line
            this.selectComponent('#c1').setData({ a: 456 })
            const c2 = this.selectComponent('#c2', childDef)!
            expect(c2.is).toBe('child/comp')
            expect(c2.id).toBe('c2')
            expect(c2.dataset).toStrictEqual({ a: 'A' })
            c2.setData({ a: 789 })
            expect(this.selectComponent('#c2', selfDef)).toBe(null)
            expect(this.selectComponent('#c3')).toBe(null)
            expect(this.selectOwnerComponent()).toBe(null)
          },
        })
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(domHtml(root.getComponent())).toBe('<div><child>456</child><child>789</child></div>')
  })

  test('select single component (with custom export)', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('child1/comp', {
      component: true,
      styleIsolation: StyleIsolation.Shared,
    })
    codeSpace.addComponentStaticConfig('child2/comp', { component: false })
    codeSpace.addCompiledTemplate('child1/comp', tmpl('{{a}}'))
    codeSpace.addCompiledTemplate('child2/comp', tmpl('{{a}}'))

    const child1Def = codeSpace.componentEnv('child1/comp', ({ Component }) =>
      Component()
        .data(() => ({
          a: 123,
        }))
        .export(function () {
          return {
            id: 1,
            set: (d: { a: number }) => {
              this.setData(d)
            },
          }
        })
        .register(),
    )

    const child2Def = codeSpace.componentEnv('child2/comp', ({ Component }) =>
      Component()
        .definition({
          data: () => ({
            a: 123,
          }),
          export() {
            return {
              id: 2,
              set: (d: { a: number }) => {
                this.setData(d)
              },
            }
          },
        })
        .register(),
    )

    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        child1: '/child1/comp',
        child2: '/child2/comp',
      },
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div id="d">
        <child1 id="c1" />
        <child2 id="c2" />
      </div>
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      const selfDef = Component()
        .lifetime('attached', function () {
          expect(this.selectComponent('#d')).toBe(null)
          expect(this.selectComponent('#c1', child2Def)).toBe(null)
          expect(this.selectComponent('#c1', selfDef)).toBe(null)
          expect(this.selectComponent('#c2', child1Def)).toBe(null)
          expect(this.selectComponent('#c2', selfDef)).toBe(null)

          const c1any = this.selectComponent('#c1') as { id: number }
          const c1 = this.selectComponent('#c1', child1Def)!
          const c2any = this.selectComponent('#c2') as { id: number }
          const c2 = this.selectComponent('#c2', child2Def)!

          expect(c1any.id).toBe(c1.id)
          expect(c2any.id).toBe(c2.id)

          c1.set({ a: 456 })
          c2.set({ a: 789 })
        })
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(domHtml(root.getComponent())).toBe('<div><child1>456</child1><child2>789</child2></div>')
  })

  test('select single component (with custom export on behavior)', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('child1/comp', {
      component: true,
      styleIsolation: StyleIsolation.Shared,
    })
    codeSpace.addComponentStaticConfig('child2/comp', { component: false })
    codeSpace.addCompiledTemplate('child1/comp', tmpl('{{a}}'))
    codeSpace.addCompiledTemplate('child2/comp', tmpl('{{a}}'))

    // eslint-disable-next-line arrow-body-style
    const child1Def = codeSpace.componentEnv('child1/comp', ({ Behavior, Component }) => {
      const beh = Behavior()
        .data(() => ({
          a: 123,
        }))
        .export(function () {
          return {
            id: 1,
            set: (d: { a: number }) => {
              this.setData(d)
            },
          }
        })
        .register()

      return Component().behavior(beh).register()
    })

    const child2Def = codeSpace.componentEnv('child2/comp', ({ Behavior, Component }) => {
      const beh = Behavior()
        .definition({
          data: () => ({
            a: 123,
          }),
          export() {
            return {
              id: 2,
              set: (d: { a: number }) => {
                this.setData(d)
              },
            }
          },
        })
        .register()

      return Component().behavior(beh).register()
    })

    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        child1: '/child1/comp',
        child2: '/child2/comp',
      },
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div id="d">
        <child1 id="c1" />
        <child2 id="c2" />
      </div>
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      const selfDef = Component()
        .lifetime('attached', function () {
          expect(this.selectComponent('#d')).toBe(null)
          expect(this.selectComponent('#c1', child2Def)).toBe(null)
          expect(this.selectComponent('#c1', selfDef)).toBe(null)
          expect(this.selectComponent('#c2', child1Def)).toBe(null)
          expect(this.selectComponent('#c2', selfDef)).toBe(null)

          const c1any = this.selectComponent('#c1') as { id: number }
          const c1 = this.selectComponent('#c1', child1Def)!
          const c2any = this.selectComponent('#c2') as { id: number }
          const c2 = this.selectComponent('#c2', child2Def)!

          expect(c1any.id).toBe(c1.id)
          expect(c2any.id).toBe(c2.id)

          c1.set({ a: 456 })
          c2.set({ a: 789 })
        })
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(domHtml(root.getComponent())).toBe('<div><child1>456</child1><child2>789</child2></div>')
  })

  test('select all components', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('child/comp', {
      component: true,
      styleIsolation: StyleIsolation.Shared,
    })
    codeSpace.addCompiledTemplate('child/comp', tmpl('{{a}}'))
    // eslint-disable-next-line arrow-body-style
    const childDef = codeSpace.componentEnv('child/comp', ({ Component }) => {
      return Component()
        .data(() => ({
          a: 123,
        }))
        .register()
    })

    codeSpace.addComponentStaticConfig('child/comp2', {
      component: true,
      styleIsolation: StyleIsolation.Shared,
    })
    codeSpace.addCompiledTemplate('child/comp2', tmpl('{{a}}'))
    // eslint-disable-next-line arrow-body-style
    codeSpace.componentEnv('child/comp2', ({ Component }) => {
      Component()
        .data(() => ({
          a: 456,
        }))
        .register()
    })

    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        child: '/child/comp',
        'child-b': '/child/comp2',
      },
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div id="d">
        <child class="c" />
        <child class="c" />
        <child-b class="c" />
      </div>
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      const selfDef = Component()
        .lifetime('attached', function () {
          // eslint-disable-next-line
          this.selectAllComponents('.c').forEach((item, i) => item.setData({ a: i }))
          this.selectAllComponents('.c', childDef).forEach((item, i) => item.setData({ a: i }))
          expect(this.selectAllComponents('.c', childDef).length).toBe(2)
          expect(this.selectAllComponents('.c', selfDef)).toStrictEqual([])
        })
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(domHtml(root.getComponent())).toBe(
      '<div><child class="c">0</child><child class="c">1</child><child-b class="c">2</child-b></div>',
    )
  })

  test('query single element info', () =>
    new Promise<any[]>((resolve) => {
      const env = new MiniProgramEnv()
      const codeSpace = env.createCodeSpace('', true)
      const resList = [] as any[]

      codeSpace.addComponentStaticConfig('child/comp', {
        component: true,
      })
      codeSpace.addCompiledTemplate('child/comp', tmpl('{{a}}'))
      codeSpace.componentEnv('child/comp', ({ Component }) => {
        Component().property('p', String).register()
      })

      codeSpace.addComponentStaticConfig('path/to/comp', {
        usingComponents: {
          child: '/child/comp',
        },
      })
      codeSpace.addCompiledTemplate(
        'path/to/comp',
        tmpl(`
      <div data-a="{{ 1 }}" mark:a="a2">
        <span id="bb" class="s" data-b="{{ 1 }}" mark:b="b2" />
        <child id="cc" class="s" data-c="{{ 1 }}" mark:c="c2" p="123" />
      </div>
    `),
      )
      codeSpace.componentEnv('path/to/comp', ({ Component }) => {
        Component()
          .lifetime('attached', function () {
            this.createSelectorQuery()
              .select('.invalid')
              .fields({})
              .select('.s')
              .boundingClientRect((res) => {
                expect(res.id).toBe('bb')
                expect(res.dataset).toStrictEqual({ b: 1 })
                expect(typeof res.left).toBe('number')
                expect(typeof res.top).toBe('number')
                expect(typeof res.right).toBe('number')
                expect(typeof res.bottom).toBe('number')
                expect(typeof res.width).toBe('number')
                expect(typeof res.height).toBe('number')
                resList.push(res)
              })
              .select('#bb')
              .scrollOffset((res) => {
                expect(res.id).toBe('bb')
                expect(res.dataset).toStrictEqual({ b: 1 })
                expect(typeof res.scrollLeft).toBe('number')
                expect(typeof res.scrollTop).toBe('number')
                expect(typeof res.scrollWidth).toBe('number')
                expect(typeof res.scrollHeight).toBe('number')
                resList.push(res)
              })
              .select('#cc')
              .fields(
                {
                  mark: true,
                  rect: true,
                  size: true,
                  scrollOffset: true,
                  properties: ['p'],
                },
                (res) => {
                  expect(res.id).toBe(undefined)
                  expect(res.dataset).toBe(undefined)
                  expect(res.mark).toStrictEqual({ a: 'a2', c: 'c2' })
                  expect(typeof res.left).toBe('number')
                  expect(typeof res.top).toBe('number')
                  expect(typeof res.right).toBe('number')
                  expect(typeof res.bottom).toBe('number')
                  expect(typeof res.width).toBe('number')
                  expect(typeof res.height).toBe('number')
                  expect(typeof res.scrollLeft).toBe('number')
                  expect(typeof res.scrollTop).toBe('number')
                  expect(typeof res.scrollWidth).toBe('number')
                  expect(typeof res.scrollHeight).toBe('number')
                  expect(res.p).toBe('123')
                  resList.push(res)
                },
              )
              .in(this.selectComponent('#cc'))
              .select('#cc')
              .boundingClientRect((res) => {
                expect(res).toBe(null)
              })
              .exec((r) => {
                r.shift()
                r.pop()
                expect(r).toStrictEqual(resList)
                this.createSelectorQuery().exec(() => {
                  resolve(resList)
                })
              })
          })
          .register()
      })

      const ab = env.associateBackend()
      const root = ab.createRoot('body', codeSpace, 'path/to/comp')
      glassEasel.Element.pretendAttached(root.getComponent())
    }).then((resList: any[]) => {
      expect(resList.length).toBe(3)
      return undefined
    }))

  test('query multiple element info', () =>
    new Promise<undefined>((resolve) => {
      const env = new MiniProgramEnv()
      const codeSpace = env.createCodeSpace('', true)

      codeSpace.addComponentStaticConfig('child/comp', {
        component: true,
      })
      codeSpace.addCompiledTemplate('child/comp', tmpl('{{a}}'))
      codeSpace.componentEnv('child/comp', ({ Component }) => {
        Component()
          .options({
            propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
          })
          .property('p', {
            type: Array,
            value: [1, 2, 3],
          })
          .register()
      })

      codeSpace.addComponentStaticConfig('path/to/comp', {
        usingComponents: {
          child: '/child/comp',
        },
      })
      codeSpace.addCompiledTemplate(
        'path/to/comp',
        tmpl(`
      <div data-a="{{ 1 }}" mark:a="a2">
        <span id="bb" class="s" data-b="{{ 1 }}" mark:b="b2" />
        <child id="cc" class="s" data-c="{{ 1 }}" mark:c="c2" />
      </div>
    `),
      )
      codeSpace.componentEnv('path/to/comp', ({ Component }) => {
        Component()
          .lifetime('attached', function () {
            this.createSelectorQuery()
              .selectAll('.s')
              .fields(
                {
                  mark: true,
                  properties: ['p'],
                },
                (res) => {
                  expect(res).toStrictEqual([
                    {
                      mark: {
                        a: 'a2',
                        b: 'b2',
                      },
                    },
                    {
                      mark: {
                        a: 'a2',
                        c: 'c2',
                      },
                      p: [1, 2, 3],
                    },
                  ])
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  expect(res[1]!.p).toBe(this.selectComponent('#cc').data.p)
                  resolve(undefined)
                },
              )
              .exec()
          })
          .register()
      })

      const ab = env.associateBackend()
      const root = ab.createRoot('body', codeSpace, 'path/to/comp')
      glassEasel.Element.pretendAttached(root.getComponent())
    }))

  test('query viewport info', () =>
    new Promise<undefined>((resolve) => {
      const env = new MiniProgramEnv()
      const codeSpace = env.createCodeSpace('', true)

      codeSpace.addComponentStaticConfig('path/to/comp', {})
      codeSpace.addCompiledTemplate('path/to/comp', tmpl(''))
      codeSpace.componentEnv('path/to/comp', ({ Component }) => {
        Component()
          .lifetime('attached', function () {
            this.createSelectorQuery()
              .selectViewport()
              .fields(
                {
                  id: true,
                  dataset: true,
                  mark: true,
                  rect: true,
                  size: true,
                  scrollOffset: true,
                  properties: ['p'],
                },
                (res) => {
                  expect(res.id).toBe('')
                  expect(res.dataset).toStrictEqual({})
                  expect(res.mark).toStrictEqual({})
                  expect(typeof res.left).toBe('number')
                  expect(typeof res.top).toBe('number')
                  expect(typeof res.right).toBe('number')
                  expect(typeof res.bottom).toBe('number')
                  expect(typeof res.width).toBe('number')
                  expect(typeof res.height).toBe('number')
                  expect(typeof res.scrollLeft).toBe('number')
                  expect(typeof res.scrollTop).toBe('number')
                  expect(typeof res.scrollWidth).toBe('number')
                  expect(typeof res.scrollHeight).toBe('number')
                  expect(res.p).toBe(undefined)
                  resolve(undefined)
                },
              )
              .exec()
          })
          .register()
      })

      const ab = env.associateBackend()
      const root = ab.createRoot('body', codeSpace, 'path/to/comp')
      glassEasel.Element.pretendAttached(root.getComponent())
    }))

  test('query context', () =>
    new Promise<undefined>((resolve) => {
      const env = new MiniProgramEnv()
      const codeSpace = env.createCodeSpace('', true)

      codeSpace.addComponentStaticConfig('path/to/comp', {})
      codeSpace.addCompiledTemplate('path/to/comp', tmpl(''))
      codeSpace.componentEnv('path/to/comp', ({ Component }) => {
        Component()
          .lifetime('attached', function () {
            this.createSelectorQuery()
              .selectViewport()
              .context((res) => {
                expect(res.context).toBeUndefined()
                resolve(undefined)
              })
              .exec()
          })
          .register()
      })

      const ab = env.associateBackend()
      const root = ab.createRoot('body', codeSpace, 'path/to/comp')
      glassEasel.Element.pretendAttached(root.getComponent())
    }))
})

describe('intersection observer', () => {
  test('create intersection observer', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {},
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
        <div id="a">
          <div id="b" />
          <div id="b" />
        </div>
      `),
    )
    // eslint-disable-next-line arrow-body-style
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      return Component()
        .lifetime('attached', function () {
          const o1 = this.createIntersectionObserver().relativeToViewport()
          o1.observe('#a', () => {
            /* empty */
          })
          const o2 = this.createIntersectionObserver({
            thresholds: [1],
            initialRatio: 0,
            observeAll: true,
          }).relativeTo('#a')
          o2.observe('#b', () => {
            /* empty */
          })
          o1.disconnect()
          o2.disconnect()
        })
        .register()
    })

    const backendContext = new glassEasel.EmptyComposedBackendContext()
    const ab = env.associateBackend(backendContext)
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    glassEasel.Element.pretendAttached(root.getComponent())
  })
})

describe('media query observer', () => {
  test('create media query observer', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {},
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
        <div id="a" />
      `),
    )
    // eslint-disable-next-line arrow-body-style
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      return Component()
        .lifetime('attached', function () {
          const o = this.createMediaQueryObserver()
          o.observe({ orientation: 'landscape' }, () => {
            /* empty */
          })
          o.disconnect()
        })
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(domHtml(root.getComponent())).toBe('<div></div>')
  })
})
