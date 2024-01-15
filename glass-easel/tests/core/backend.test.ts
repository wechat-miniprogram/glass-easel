import { domBackend, shadowBackend, composedBackend, tmpl } from '../base/env'
import * as ComposedBackend from '../base/composed_backend'
import * as glassEasel from '../../src'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
  writeIdToDOM: true,
})
componentSpace.defineComponent({
  is: '',
})

const forEachBackend = async (
  f: (
    context:
      | glassEasel.composedBackend.Context
      | glassEasel.backend.Context
      | glassEasel.domlikeBackend.Context,
  ) => Promise<void>,
) => {
  await Promise.all([f(domBackend), f(shadowBackend), f(composedBackend)])
}

describe('backend', () => {
  test('support render callback', async () => {
    const compDef = componentSpace.defineComponent({})
    await forEachBackend((context) => {
      const comp = glassEasel.Component.createWithContext('root', compDef.general(), context)
      const callOrder: number[] = []
      return new Promise((resolve) => {
        const done = () => {
          expect(callOrder).toStrictEqual([1, 2, 3, 4, 5])
          resolve()
        }
        callOrder.push(1)
        glassEasel.triggerRender(comp, () => {
          callOrder.push(3)
          glassEasel.triggerRender(comp, () => {
            callOrder.push(5)
            done()
          })
        })
        callOrder.push(2)
        glassEasel.triggerRender(comp, () => {
          callOrder.push(4)
        })
      })
    })
  })

  test('support basic context env methods', async () => {
    await forEachBackend((context) => {
      expect(typeof context.destroy).toBe('function')
      expect(typeof context.getWindowWidth()).toBe('number')
      expect(typeof context.getWindowHeight()).toBe('number')
      expect(typeof context.getDevicePixelRatio()).toBe('number')
      expect(typeof context.getTheme()).toBe('string')
      expect(typeof context.onEvent).toBe('function')
      return Promise.resolve()
    })
  })

  test('support basic context style-sheet methods', async () => {
    await forEachBackend((context) => {
      expect(typeof context.registerStyleSheetContent).toBe('function')
      expect(typeof context.appendStyleSheetPath).toBe('function')
      expect(typeof context.disableStyleSheet).toBe('function')
      if (context === domBackend) {
        const document = context.document as unknown as Element
        const styleText = '.a { color: red }'
        context.registerStyleSheetContent('/backend/test/a', styleText)
        const index = context.appendStyleSheetPath('/backend/test/a', 0)
        try {
          context.appendStyleSheetPath('/backend/test/a-invalid', 0)
        } catch (e) {
          /* empty */
        }
        expect(
          (document.querySelector('style[wx-style-scope]') as HTMLStyleElement).innerHTML,
        ).toBe(styleText)
        context.disableStyleSheet(index)
        expect(document.querySelector('style[wx-style-scope]')).toBe(null)
      }
      return Promise.resolve()
    })
  })

  test('prevent some node from direct construction', () => {
    let elem: glassEasel.Node | null = null
    try {
      elem = new glassEasel.Element()
    } catch (e) {
      /* empty */
    }
    try {
      elem = new glassEasel.VirtualNode()
    } catch (e) {
      /* empty */
    }
    try {
      elem = new glassEasel.ShadowRoot()
    } catch (e) {
      /* empty */
    }
    try {
      elem = new glassEasel.NativeNode()
    } catch (e) {
      /* empty */
    }
    try {
      elem = new glassEasel.Component()
    } catch (e) {
      /* empty */
    }
    expect(elem).toBe(null)
  })

  test('auto backend element destroy', () => {
    const compDef = componentSpace.defineComponent({
      template: tmpl(`
        <div wx:if="{{text}}">{{text}}</div>
      `),
    })
    const elem = glassEasel.Component.createWithContext('root', compDef.general(), composedBackend)
    elem.destroyBackendElementOnDetach()
    elem.setData({
      text: '123',
    })
    const virtualNode = elem.getShadowRoot()!.childNodes[0]! as glassEasel.VirtualNode
    const nativeNode = virtualNode.childNodes[0]! as glassEasel.NativeNode
    const textNode = nativeNode.childNodes[0]! as glassEasel.TextNode
    glassEasel.Element.pretendAttached(elem)
    expect(virtualNode.$$).toBe(null)
    expect(nativeNode.$$).toBeInstanceOf(ComposedBackend.Element)
    expect(textNode.$$).toBeInstanceOf(ComposedBackend.TextNode)
    elem.setData({
      text: '456',
    })
    expect(virtualNode.$$).toBe(null)
    expect(nativeNode.$$).toBeInstanceOf(ComposedBackend.Element)
    expect(textNode.$$).toBeInstanceOf(ComposedBackend.TextNode)
    elem.setData({
      text: '',
    })
    expect(virtualNode.$$).toBe(null)
    expect(nativeNode.$$).toBe(null)
    expect(textNode.$$).toBe(null)
    expect(elem.$$).toBeInstanceOf(ComposedBackend.Element)
    glassEasel.Element.pretendDetached(elem)
    expect(elem.$$).toBe(null)
  })

  test('avoid backend operation after element destroy', async () => {
    const childCompDef = componentSpace.defineComponent({
      template: tmpl(`
        <div wx:if="{{text}}">{{text}}</div>
      `),
      data: { text: '' },
    })
    const compDef = componentSpace.defineComponent({
      using: {
        child: childCompDef,
      },
      template: tmpl(`
        <child id="child" wx:if="{{hasChild}}" />
      `),
      data: {
        hasChild: true,
      },
    })

    await forEachBackend((context) => {
      const elem = glassEasel.Component.createWithContext('root', compDef.general(), context)
      glassEasel.Element.pretendAttached(elem)
      const child = elem.getShadowRoot()!.querySelector('#child')!.asInstanceOf(childCompDef)!
      const childShadowRoot = child.getShadowRoot()!

      expect(child.getBackendElement()).toBeTruthy()
      expect(child.getBackendContext()).toBe(context)
      expect(childShadowRoot.getBackendContext()).toBe(context)
      expect(childShadowRoot.childNodes[0]!.asVirtualNode()!.getBackendContext()).toBe(context)

      elem.setData({ hasChild: false })
      expect(child.getBackendElement()).toBeNull()
      expect(child.getBackendContext()).toBeNull()
      expect(childShadowRoot.getBackendContext()).toBeNull()
      expect(childShadowRoot.childNodes[0]!.asVirtualNode()!.getBackendContext()).toBeNull()

      child.setData({ text: 'test' })
      const ifBlock = childShadowRoot.childNodes[0]!.asVirtualNode()!
      const div = ifBlock.childNodes[0]!.asNativeNode()!
      const textNode = div.childNodes[0]!.asTextNode()!
      expect(ifBlock.getBackendContext()).toBeNull()
      expect(div.getBackendContext()).toBeNull()
      expect(div.getBackendElement()).toBeNull()
      expect(textNode.getBackendElement()).toBeNull()

      child.setData({ text: '' })
      expect(childShadowRoot.childNodes[0]!.asVirtualNode()!.getBackendContext()).toBeNull()

      return Promise.resolve()
    })
  })
})
