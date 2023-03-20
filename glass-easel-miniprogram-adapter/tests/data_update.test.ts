import * as glassEasel from 'glass-easel'
import { tmpl } from './base/env'
import { MiniProgramEnv } from '../src'

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

describe('data update', () => {
  test('various data update', () => {
    const env = new MiniProgramEnv()
    const codeSpace = env.createCodeSpace('', true)

    codeSpace.addComponentStaticConfig('path/to/comp', {})
    codeSpace.addCompiledTemplate(
      'path/to/comp',
      tmpl(`
      <div wx:for="{{arr}}">{{item}}</div>
      <span>{{obj.sub}}</span>
    `),
    )
    codeSpace.componentEnv('path/to/comp', ({ Component }) => {
      Component()
        .data(() => ({
          arr: [1, 2, 3],
          obj: {
            sub: false,
          },
        }))
        .lifetime('attached', function () {
          this.groupUpdates(() => {
            this.spliceArrayDataOnPath(['arr'], 1, 1, [4, 5])
            this.replaceDataOnPath(['obj', 'sub'], true)
          })
          // eslint-disable-next-line no-use-before-define
          expect(domHtml(root.getComponent())).toBe(
            '<div>1</div><div>4</div><div>5</div><div>3</div><span>true</span>',
          )
          this.groupSetData(() => {
            this.updateData({
              arr: [123],
            })
          })
          // eslint-disable-next-line no-use-before-define
          expect(domHtml(root.getComponent())).toBe(
            '<div>1</div><div>4</div><div>5</div><div>3</div><span>true</span>',
          )
          this.applyDataUpdates()
          // eslint-disable-next-line no-use-before-define
          expect(domHtml(root.getComponent())).toBe('<div>123</div><span>true</span>')
        })
        .register()
    })

    const ab = env.associateBackend()
    const root = ab.createRoot('body', codeSpace, 'path/to/comp')
    glassEasel.Element.pretendAttached(root.getComponent())
    expect(domHtml(root.getComponent())).toBe('<div>123</div><span>true</span>')
  })

  test('setData callback', () =>
    new Promise((resolve) => {
      const env = new MiniProgramEnv()
      const codeSpace = env.createCodeSpace('', true)

      codeSpace.addComponentStaticConfig('path/to/comp', {})
      codeSpace.addCompiledTemplate(
        'path/to/comp',
        tmpl(`
      <span>{{a}}</span>
    `),
      )
      codeSpace.componentEnv('path/to/comp', ({ Component }) => {
        Component()
          .data(() => ({
            a: 123,
          }))
          .init(function ({ setData, lifetime }) {
            lifetime('attached', () => {
              setData({ a: 789 }, () => {
                this.setData({ a: 456 }, () => {
                  // eslint-disable-next-line no-use-before-define
                  expect(domHtml(root.getComponent())).toBe('<span>456</span>')
                  resolve(undefined)
                })
              })
            })
          })
          .register()
      })

      const ab = env.associateBackend()
      const root = ab.createRoot('body', codeSpace, 'path/to/comp')
      glassEasel.Element.pretendAttached(root.getComponent())
      expect(domHtml(root.getComponent())).toBe('<span>789</span>')
    }))
})
