import * as glassEasel from 'glass-easel'
import { tmpl } from './base/env'
import {
  MiniProgramEnv,
  StyleIsolation,
  BehaviorConstructor,
  ComponentConstructor,
  types,
} from '../src'

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

describe('define', () => {
  test('define basic behaviors and components', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addStyleSheet('app', 'app.css')
    codeSpace.addStyleSheet('path/to/comp', 'path/to/comp.css')

    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div class="ab">{{a}}-{{b}}</div>
    `),
    )

    const beh = codeSpace
      .behavior()
      .definition({
        data: {
          a: 123,
        },
      })
      .register()

    codeSpace
      .component('path/to/comp')
      .definition({
        behaviors: [beh],
        properties: {
          b: Number,
        },
      })
      .register()

    const ab = env.associateBackend()
    ab.registerStyleSheetContent('app.css', '')
    ab.registerStyleSheetContent('path/to/comp.css', '.ab { color: red }')
    const root = ab.createRoot('body', codeSpace, 'path/to/comp?b=456')
    expect(domHtml(root.getComponent())).toBe('<div class="ab">123-456</div>')
  })

  test('define basic behaviors and components with global vars', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)
    const callOrder = [] as number[]

    codeSpace.addComponentStaticConfig('path/to/comp', {})

    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div>{{a}}-{{b}}-{{c}}</div>
    `),
    )

    const g = {} as { Behavior: BehaviorConstructor; Component: ComponentConstructor }
    codeSpace.globalComponentEnv(g, 'path/to/comp', () => {
      const Behavior = g.Behavior
      const Component = g.Component

      const beh = Behavior({
        data: {
          a: 123,
        },
        observers: {
          a() {
            callOrder.push(1)
          },
        },
      })

      const traitBeh = Behavior.trait<{ a: () => void }>()

      Component({
        options: {
          propertyEarlyInit: true,
        },
        behaviors: [beh],
        properties: {
          b: Number,
        },
        data: () => ({
          c: 789,
        }),
        observers: [
          {
            fields: 'b',
            observer() {
              callOrder.push(2)
            },
          },
        ],
        created() {
          callOrder.push(3)
        },
        attached() {
          this.setData({
            a: 321,
            b: 654,
          } as { b: number })
          callOrder.push(4)
        },
        detached() {
          callOrder.push(5)
        },
        moved() {
          callOrder.push(6)
        },
        ready() {
          callOrder.push(7)
        },
        lifetimes: {
          invalid() {
            /* empty */
          },
        },
        pageLifetimes: {
          invalid() {
            /* empty */
          },
        },
        relations: {
          invalid: {
            type: 'parent',
            // FIXME the target should accept wrapped behaviors
            target: traitBeh._$,
          },
        },
        externalClasses: [],
      })
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp?b=456')
    expect(domHtml(root.getComponent())).toBe('<div>123-456-789</div>')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(domHtml(root.getComponent())).toBe('<div>321-654-789</div>')
    root.getComponent().triggerLifetime('ready', [])
    root.getComponent().triggerLifetime('moved', [])
    glassEasel.Element.pretendDetached(root.getComponent())
    expect(callOrder).toStrictEqual([2, 3, 1, 2, 4, 7, 6, 5])
  })

  test('define legacy pages', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)
    const callOrder = [] as number[]

    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div>{{a}}-{{b}}</div>
    `),
    )

    codeSpace.componentEnv('path/to/comp', ({ Behavior, Page }) => {
      const beh = Behavior()
        .property('a', String)
        .lifetime('attached', function () {
          expect(this.hasBehavior(beh)).toBe(true)
          const self = this as unknown as {
            myMethod: () => number
            myData: any
          }
          expect(self.myMethod()).toBe(123)
          expect(self.myData).toStrictEqual({ myField: 456 })
          callOrder.push(1)
        })
        .register()

      Page({
        behaviors: [beh],
        data: {
          b: 'def',
        },
        myMethod() {
          return 123
        },
        myData: {
          myField: 456,
        },
      })
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp?a=abc')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(domHtml(root.getComponent())).toBe('<div>abc-def</div>')
    expect(callOrder).toStrictEqual([1])
  })

  test('options generics', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('comp/a', {
      component: true,
      componentGenerics: {
        c: true,
      },
    })
    codeSpace.addCompiledTemplate(
      'comp/a',
      tmpl(`
      <c />
    `),
    )
    codeSpace.componentEnv('comp/a', ({ Component }) => {
      Component().register()
    })

    codeSpace.addComponentStaticConfig('comp/b', {
      component: true,
    })
    codeSpace.addCompiledTemplate(
      'comp/b',
      tmpl(`
      <span>B</span>
    `),
    )
    codeSpace.componentEnv('comp/b', ({ Component }) => {
      Component().register()
    })

    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        a: '/comp/a',
        b: '/comp/b',
      },
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <a generic:c="b" />
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component().register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe('<a><c><span>B</span></c></a>')
  })

  test('options placeholder', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('comp/a', {
      component: true,
    })
    codeSpace.addCompiledTemplate(
      'comp/a',
      tmpl(`
      <div>A</div>
    `),
    )
    codeSpace.componentEnv('comp/a', ({ Component }) => {
      Component().register()
    })

    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        a: '/comp/b',
        ph: '/comp/a',
      },
      componentPlaceholder: {
        a: 'ph',
      },
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <a />
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component().register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe('<a><div>A</div></a>')

    codeSpace.addComponentStaticConfig('comp/b', {
      component: true,
    })
    codeSpace.addCompiledTemplate(
      'comp/b',
      tmpl(`
      <span>B</span>
    `),
    )
    codeSpace.componentEnv('comp/b', ({ Component }) => {
      Component().register()
    })

    expect(domHtml(root.getComponent())).toBe('<a><span>B</span></a>')
  })

  test('options pureDataPattern (js)', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div>{{_a}}-{{b}}</div>
    `),
    )

    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component()
        .options({
          pureDataPattern: /^_/,
        })
        .data(() => ({
          _a: 123,
          b: 456,
        }))
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe('<div>-456</div>')
  })

  test('options pureDataPattern (json)', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('path/to/comp', {
      pureDataPattern: '^_',
    })

    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div>{{_a}}-{{b}}</div>
    `),
    )

    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component()
        .options({
          pureDataPattern: /^_/,
        })
        .data(() => ({
          _a: 123,
          b: 456,
        }))
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe('<div>-456</div>')
  })

  test('options addGlobalClass', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addStyleSheet('child/comp', 'empty-style-sheet', 'child-comp')
    codeSpace.addComponentStaticConfig('child/comp', {
      component: true,
      addGlobalClass: true,
    })
    codeSpace.addCompiledTemplate(
      'child/comp',
      tmpl(`
      <div class="def"></div>
    `),
    )
    codeSpace.componentEnv('child/comp', ({ Component }) => {
      Component()
        .options({
          virtualHost: true,
        })
        .register()
    })

    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        child: '/child/comp',
      },
      addGlobalClass: true,
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div class="abc">
        <child />
      </div>
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component().register()
    })

    const ab = env.associateBackend()
    ab.registerStyleSheetContent('empty-style-sheet', '')
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe(
      '<div class="abc"><div class="def child-comp--def"></div></div>',
    )
  })

  test('options styleIsolation shared', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addStyleSheet('child/comp', 'empty-style-sheet', 'child-comp')
    codeSpace.addComponentStaticConfig('child/comp', {
      component: true,
      styleIsolation: StyleIsolation.Shared,
    })
    codeSpace.addCompiledTemplate(
      'child/comp',
      tmpl(`
      <div class="def"></div>
    `),
    )
    codeSpace.componentEnv('child/comp', ({ Component }) => {
      Component()
        .options({
          virtualHost: true,
        })
        .register()
    })

    codeSpace.addStyleSheet('path/to/comp', 'empty-style-sheet', 'comp')
    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        child: '/child/comp',
      },
      styleIsolation: StyleIsolation.PageShared,
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div class="abc">
        <child />
      </div>
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component().register()
    })

    const ab = env.associateBackend()
    ab.registerStyleSheetContent('empty-style-sheet', '')
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe('<div class="abc"><div class="def"></div></div>')
  })

  test('options styleIsolation apply-shared', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addStyleSheet('child/comp', 'empty-style-sheet', 'child-comp')
    codeSpace.addComponentStaticConfig('child/comp', {
      component: true,
      styleIsolation: StyleIsolation.ApplyShared,
    })
    codeSpace.addCompiledTemplate(
      'child/comp',
      tmpl(`
      <div class="def"></div>
    `),
    )
    codeSpace.componentEnv('child/comp', ({ Component }) => {
      Component()
        .options({
          virtualHost: true,
        })
        .register()
    })

    codeSpace.addStyleSheet('path/to/comp', 'empty-style-sheet', 'comp')
    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        child: '/child/comp',
      },
      styleIsolation: StyleIsolation.PageApplyShared,
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div class="abc">
        <child />
      </div>
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component().register()
    })

    const ab = env.associateBackend()
    ab.registerStyleSheetContent('empty-style-sheet', '')
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe(
      '<div class="abc comp--abc"><div class="def child-comp--def"></div></div>',
    )
  })

  test('options styleIsolation isolated', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addStyleSheet('child/comp', 'empty-style-sheet', 'child-comp')
    codeSpace.addComponentStaticConfig('child/comp', {
      component: true,
      styleIsolation: StyleIsolation.Isolated,
    })
    codeSpace.addCompiledTemplate(
      'child/comp',
      tmpl(`
      <div class="def"></div>
    `),
    )
    codeSpace.componentEnv('child/comp', ({ Component }) => {
      Component()
        .options({
          virtualHost: true,
        })
        .register()
    })

    codeSpace.addStyleSheet('path/to/comp', 'empty-style-sheet', 'comp')
    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        child: '/child/comp',
      },
      styleIsolation: StyleIsolation.PageIsolated,
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div class="abc">
        <child />
      </div>
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component().register()
    })

    const ab = env.associateBackend()
    ab.registerStyleSheetContent('empty-style-sheet', '')
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe(
      '<div class="comp--abc"><div class="child-comp--def"></div></div>',
    )
  })

  test('options dataDeepCopy', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('path/to/comp', {})
    codeSpace.addCompiledTemplate('path/to/comp', tmpl(''))
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component({
        options: {
          dataDeepCopy: glassEasel.DeepCopyKind.None,
        },
        data: {
          a: [1, 2, 3],
        },
      })
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    const a = [3, 2, 1]
    root.getComponent().setData({
      a,
    })
    expect(root.getComponent().data.a).toBe(a)
  })

  test('options propertyPassingDeepCopy', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)
    const callOrder = [] as number[]

    codeSpace.addComponentStaticConfig('child/comp', {
      component: true,
    })
    codeSpace.addCompiledTemplate(
      'child/comp',
      tmpl(`
      <div class="def"></div>
    `),
    )
    // eslint-disable-next-line arrow-body-style
    const childDef = codeSpace.componentEnv('child/comp', ({ Component }) => {
      return Component()
        .options({
          virtualHost: true,
          dataDeepCopy: glassEasel.DeepCopyKind.None,
          propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
        })
        .property('p', Object)
        .register()
    })

    codeSpace.addComponentStaticConfig('path/to/comp', {
      usingComponents: {
        child: '/child/comp',
      },
      styleIsolation: StyleIsolation.PageIsolated,
    })
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <child id="c" p="{{a}}" />
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component()
        .options({
          dataDeepCopy: glassEasel.DeepCopyKind.None,
          propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
        })
        .data(() => ({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          a: Object.create(Object.prototype, {
            f: { enumerable: true, value: 123 },
            __test: { enumerable: false, value: 456 },
          }),
        }))
        .lifetime('attached', function () {
          const child = this.selectComponent('#c', childDef)!
          expect(child.data.p).toBe(this.data.a)
          callOrder.push(1)
        })
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(callOrder).toStrictEqual([1])
  })

  test('definition filter', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div>{{a}}-{{b}}</div>
    `),
    )

    const beh = codeSpace
      .behavior()
      .data(() => ({
        a: 123,
      }))
      .register()

    const filterBeh = codeSpace
      .behavior()
      .behavior(beh)
      .definition({
        definitionFilter: (def: types.GeneralComponentDefinition) => {
          // eslint-disable-next-line no-param-reassign
          def.data = { b: 456 }
        },
      })
      .register()

    codeSpace
      .component('path/to/comp')
      .definition({
        behaviors: [filterBeh],
      })
      .register()

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe('<div>123-456</div>')
  })

  test('chaining behaviors', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div>{{a}}-{{b}}</div>
    `),
    )

    const beh = codeSpace
      .behavior()
      .data(() => ({
        a: 123,
      }))
      .register()

    codeSpace
      .component('path/to/comp')
      .behavior(beh)
      .data(() => ({
        b: 456,
      }))
      .register()

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe('<div>123-456</div>')
  })

  test('chaining filters', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div>{{a}}-{{b}}</div>
    `),
    )

    type TAdd = { data: <T>(this: T) => T }
    type TRemove = 'data' | 'property'
    const beh = codeSpace
      .behavior()
      .chainingFilter<TAdd, TRemove>((chain) => {
        const oldData = chain.data.bind(chain)
        const newData = function () {
          oldData(() => ({
            a: 123,
          }))
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return Object.create(chain, {
          data: { value: newData },
        })
      })
      .register()

    codeSpace
      .component('path/to/comp')
      .data(() => ({
        b: 456,
      }))
      .behavior(beh)
      .data()
      .register()

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe('<div>123-456</div>')
  })

  test('chaining external classes', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('child/comp', {
      component: true,
    })
    codeSpace.addCompiledTemplate(
      'child/comp',
      tmpl(`
      <div class="a-class"></div>
    `),
    )
    codeSpace.componentEnv('child/comp', ({ Component }) => {
      Component()
        .options({
          virtualHost: true,
        })
        .externalClasses(['a-class'])
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
      <div class="abc">
        <child a-class="def" />
      </div>
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component().register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe('<div class="abc"><div class="def"></div></div>')
  })

  test('chaining methods', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)
    const callOrder = [] as number[]

    codeSpace.addComponentStaticConfig('child/comp', {
      component: true,
    })
    // eslint-disable-next-line arrow-body-style
    const childType = codeSpace.componentEnv('child/comp', ({ Component }) => {
      return Component()
        .methods({
          childFn() {
            return 123
          },
        })
        .lifetime('attached', function () {
          // eslint-disable-next-line no-use-before-define
          expect(this.selectOwnerComponent(parentType)!.parentFn()).toBe(456)
          callOrder.push(1)
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
      <child id="c" />
    `),
    )
    // eslint-disable-next-line arrow-body-style
    const parentType = codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      return Component()
        .methods({
          parentFn() {
            return 456
          },
        })
        .lifetime('attached', function () {
          expect(this.selectComponent('#c', childType)!.childFn()).toBe(123)
          callOrder.push(2)
        })
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(callOrder).toStrictEqual([2, 1])
  })

  test('chaining observer', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('child/comp', {
      component: true,
    })
    codeSpace.addCompiledTemplate(
      'child/comp',
      tmpl(`
      <span>{{aa}}</span>
    `),
    )
    codeSpace.componentEnv('child/comp', ({ Component }) => {
      Component()
        .options({
          virtualHost: true,
        })
        .property('a', Number)
        .data(() => ({
          aa: 10,
        }))
        .observer('a', function () {
          this.setData({
            aa: this.data.a * 10,
          })
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
      <child a="{{bb}}" />
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component()
        .data(() => ({
          b: 1,
          bb: 10,
        }))
        .observer('b', function () {
          this.setData({
            bb: this.data.b * 10,
          })
        })
        .lifetime('attached', function () {
          this.setData({ b: 2 })
        })
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe('<span>100</span>')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(domHtml(root.getComponent())).toBe('<span>200</span>')
  })

  test('chaining pageLifetime', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('child/comp', {
      component: true,
    })
    codeSpace.addCompiledTemplate(
      'child/comp',
      tmpl(`
      <span>{{a}}-{{b}}</span>
    `),
    )
    codeSpace.componentEnv('child/comp', ({ Component }) => {
      Component()
        .options({
          virtualHost: true,
        })
        .property('a', Number)
        .data(() => ({
          b: 0,
        }))
        .pageLifetime('show', function () {
          this.setData({
            b: 456,
          })
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
      <child a="{{a}}" />
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component()
        .data(() => ({
          a: 0,
        }))
        .pageLifetime('show', function (a: number) {
          this.setData({ a })
        })
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    expect(domHtml(root.getComponent())).toBe('<span>0-0</span>')
    root.getComponent().triggerPageLifetime('show', [123])
    expect(domHtml(root.getComponent())).toBe('<span>123-456</span>')
  })

  test('chaining relation', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

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
    const listDef = codeSpace.componentEnv('child/list', ({ Component }) => {
      return Component()
        .data(() => ({
          count: 0,
        }))
        .relation('item', {
          type: 'child',
          linked(target) {
            // eslint-disable-next-line no-use-before-define
            expect(target.asInstanceOf(itemDef)).not.toBe(null)
            this.setData({
              count: this.getRelationNodes('item').length,
            })
          },
        })
        .register()
    })

    codeSpace.addComponentStaticConfig('child/item', {
      component: true,
    })
    // eslint-disable-next-line arrow-body-style
    const itemDef = codeSpace.componentEnv('child/item', ({ Component }) => {
      return Component()
        .data(() => ({
          count: 0,
        }))
        .init(({ relation }) => {
          relation({
            type: 'parent',
            target: listDef,
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
    expect(domHtml(root.getComponent())).toBe('<list><div>2</div><item></item><item></item></list>')
  })
})
