import * as glassEasel from 'glass-easel'
import { virtual as matchElementWithDom } from '../../../glass-easel/tests/base/match'
import {
  hookBuilderToSyncData,
  type ShadowSyncElement,
  ReflectTemplateEngine,
} from '../../src/backend'
import { getNodeId } from '../../src/message_channel'
import {
  getViewNode,
  shadowSyncBackend,
  syncController,
  tmpl,
  viewComponentSpace,
} from '../base/env'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
  writeIdToDOM: true,
})

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

describe('backend', () => {
  test('basic backend', () => {
    const child = componentSpace.defineComponent({
      properties: {
        text: String,
      },
      template: tmpl(`
        <span id="a">{{text}}<slot /></span>
      `),
    })
    const rootDef = componentSpace.defineComponent({
      using: { child },
      template: tmpl(`
        <child wx:if="{{text}}" text="{{text}}">!{{text}}!</child>
      `),
      data: {
        text: '',
      },
    })
    const elem = glassEasel.Component.createWithContext('root', rootDef, shadowSyncBackend)
    elem.destroyBackendElementOnDetach()

    expect(domHtml(elem)).toEqual('')
    elem.setData({
      text: '123',
    })
    expect(domHtml(elem)).toEqual('<child><span id="a">123!123!</span></child>')
    elem.setData({
      text: '233',
    })
    expect(domHtml(elem)).toEqual('<child><span id="a">233!233!</span></child>')
    elem.setData({
      text: '',
    })
    expect(domHtml(elem)).toEqual('')
  })
  describe('external component', () => {
    // jsdom does not implement layout-based hit testing;
    // `document.elementFromPoint` is mocked to return the designated hit element.
    let hitElement: Element | null = null
    const elementFromPointMock = jest.fn((_left: number, _top: number) => hitElement)

    beforeAll(() => {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        writable: true,
        value: elementFromPointMock,
      })
    })

    afterAll(() => {
      delete (document as { elementFromPoint?: unknown }).elementFromPoint
    })

    test('external component', () => {
      viewComponentSpace.setGlobalUsingComponent(
        'wx-button',
        viewComponentSpace.defineComponent({
          is: 'wx-button',
          options: {
            externalComponent: true,
          },
          properties: {
            disabled: Boolean,
          },
          template: tmpl('<button disabled="{{disabled}}"><slot /></button>'),
        }) as glassEasel.GeneralComponentDefinition,
      )

      const ops: any[] = []
      const rootDef = componentSpace.defineComponent({
        template: tmpl(`
          <wx-button disabled="{{disabled}}" bind:tap="handleTap">{{text}}</wx-button>
        `),
        data: {
          text: '123',
          disabled: true,
        },
        methods: {
          handleTap(e: glassEasel.Event<any>) {
            ops.push(e.detail)
          },
        },
      })
      const root = glassEasel.Component.createWithContext('root', rootDef, shadowSyncBackend)
      root.destroyBackendElementOnDetach()

      expect(domHtml(root)).toEqual('<wx-button><button disabled="">123</button></wx-button>')

      root.setData({ disabled: false })
      expect(domHtml(root)).toEqual('<wx-button><button>123</button></wx-button>')

      root.setData({ text: '23333' })
      expect(domHtml(root)).toEqual('<wx-button><button>23333</button></wx-button>')

      const button = root.getShadowRoot()!.childNodes[0]!

      const viewButton = getViewNode(button) as glassEasel.GeneralComponent
      viewButton.triggerEvent('tap', { foo: 'foo' })
      expect(ops).toEqual([{ foo: 'foo' }])
    })

    // The view side renders `<wx-button>` as a full built-in component.
    // Its internal nodes are created by the view-side template engine directly,
    // so they are not known to the message channel (i.e. they have no channel id).
    // Note that it must not be an `externalComponent` in this case: the internals of
    // an `externalComponent` are plain DOM nodes, which the backend `elementFromPoint`
    // already resolves to the component by itself.
    const registerViewButton = (templateSrc: string) => {
      viewComponentSpace.setGlobalUsingComponent(
        'wx-button',
        viewComponentSpace.defineComponent({
          is: 'wx-button',
          template: tmpl(templateSrc),
        }) as glassEasel.GeneralComponentDefinition,
      )
    }

    const renderRoot = (templateSrc: string) => {
      const rootDef = componentSpace.defineComponent({
        template: tmpl(templateSrc),
      })
      const root = glassEasel.Component.createWithContext('root', rootDef, shadowSyncBackend)
      root.destroyBackendElementOnDetach()
      shadowSyncBackend.getRootNode().appendChild(root.getBackendElement() as ShadowSyncElement)
      glassEasel.Component.pretendAttached(root)
      return root
    }

    // collect the internal nodes of the built-in component on the view side,
    // from outside to inside: `<button>`, `<div>`, `<span>`
    const getInternalNodes = (button: glassEasel.Element): glassEasel.Element[] => {
      const internalButton = (getViewNode(button) as glassEasel.GeneralComponent).getShadowRoot()!
        .childNodes[0] as glassEasel.Element
      const internalDiv = internalButton.childNodes[0] as glassEasel.Element
      const internalSpan = internalDiv.childNodes[0] as glassEasel.Element
      return [internalButton, internalDiv, internalSpan]
    }

    test('elementFromPoint on external component internals', () => {
      viewComponentSpace.setGlobalUsingComponent(
        'wx-button',
        viewComponentSpace.defineComponent({
          is: 'wx-button',
          options: {
            externalComponent: true,
          },
          template: tmpl('<button><div><span>label</span></div></button>'),
        }) as glassEasel.GeneralComponentDefinition,
      )

      const root = renderRoot(`
        <wx-button></wx-button>
      `)
      const button = root.getShadowRoot()!.childNodes[0] as glassEasel.Element

      expect(domHtml(root)).toEqual(
        '<wx-button><button><div><span>label</span></div></button><virtual></virtual></wx-button>',
      )

      // internals of an `externalComponent` are plain DOM nodes created by the view side
      const viewButton = getViewNode(button) as glassEasel.GeneralComponent
      const internalSpanDom = (viewButton.getBackendElement() as unknown as Element).querySelector(
        'span',
      )!

      hitElement = internalSpanDom
      const results: (glassEasel.Element | null)[] = []
      shadowSyncBackend.elementFromPoint(1, 1, (elem) => {
        results.push(elem)
      })
      expect(results).toEqual([button])
    })

    test('elementFromPoint on built-in component internals', () => {
      registerViewButton('<button><div><span>label</span></div></button>')
      const root = renderRoot(`
        <wx-button></wx-button>
      `)
      const button = root.getShadowRoot()!.childNodes[0] as glassEasel.Element

      const internalNodes = getInternalNodes(button)
      // the internal nodes are created by the view side only, so they have no channel id
      expect(internalNodes.map((node) => getNodeId(node))).toEqual([
        undefined,
        undefined,
        undefined,
      ])

      internalNodes.forEach((node) => {
        hitElement = node.getBackendElement() as unknown as Element
        elementFromPointMock.mockClear()
        const results: (glassEasel.Element | null)[] = []
        shadowSyncBackend.elementFromPoint(1, 1, (elem) => {
          results.push(elem)
        })
        expect(elementFromPointMock).toHaveBeenCalledWith(1, 1)
        expect(results).toEqual([button])
      })
    })

    test('elementFromPoint on channel-created element', () => {
      registerViewButton('<button><div><span>label</span></div></button>')
      const root = renderRoot(`
        <view id="a"></view>
        <wx-button></wx-button>
      `)
      const view = root.getShadowRoot()!.childNodes[0] as glassEasel.Element

      hitElement = getViewNode(view).getBackendElement() as unknown as Element
      const results: (glassEasel.Element | null)[] = []
      shadowSyncBackend.elementFromPoint(1, 1, (elem) => {
        results.push(elem)
      })
      expect(results).toEqual([view])
    })

    test('elementFromPoint on slotted content of a built-in component', () => {
      registerViewButton('<button><div><slot /></div></button>')
      const root = renderRoot(`
        <wx-button><view id="inner">label</view></wx-button>
      `)
      const button = root.getShadowRoot()!.childNodes[0] as glassEasel.Element
      const inner = button.childNodes[0] as glassEasel.Element

      hitElement = getViewNode(inner).getBackendElement() as unknown as Element
      const results: (glassEasel.Element | null)[] = []
      shadowSyncBackend.elementFromPoint(1, 1, (elem) => {
        results.push(elem)
      })
      expect(results).toEqual([inner])
    })

    test('getActiveElement on built-in component internals', () => {
      registerViewButton('<button><div><span>label</span></div></button>')
      const root = renderRoot(`
        <wx-button></wx-button>
      `)
      const button = root.getShadowRoot()!.childNodes[0] as glassEasel.Element

      // attach the view tree to the document so that jsdom accepts focusing
      const viewRootDom = getViewNode(root).getBackendElement() as unknown as Element
      const container = viewRootDom.parentNode as Element
      document.body.appendChild(container)

      const internalButton = getInternalNodes(button)[0]!
      const internalButtonDom = internalButton.getBackendElement() as unknown as HTMLElement
      internalButtonDom.focus()
      expect(document.activeElement).toBe(internalButtonDom)

      const results: (glassEasel.Element | null)[] = []
      shadowSyncBackend.getActiveElement((elem) => {
        results.push(elem)
      })
      expect(results).toEqual([button])

      container.remove()
    })

    test('overlay inspect on built-in component internals', () => {
      registerViewButton('<button><div><span>label</span></div></button>')
      const root = renderRoot(`
        <wx-button></wx-button>
      `)
      const button = root.getShadowRoot()!.childNodes[0] as glassEasel.Element
      const internalSpan = getInternalNodes(button)[2]!

      const ops: [string, glassEasel.Element | null][] = []
      shadowSyncBackend.startOverlayInspect((event, elem) => {
        ops.push([event, elem])
      })
      hitElement = internalSpan.getBackendElement() as unknown as Element
      window.dispatchEvent(new window.MouseEvent('click', { clientX: 1, clientY: 1 }))
      expect(ops).toEqual([['tap', button]])
      shadowSyncBackend.stopOverlayInspect()
    })
  })

  test('hook to sync behavior builder', async () => {
    const beh = hookBuilderToSyncData(componentSpace.define())
      .property('name', String)
      .property('value', String)
      .registerBehavior()

    const compDef = componentSpace.defineComponent({
      behaviors: [beh],
      template: tmpl(`
        <view>{{name}}-{{value}}</view>
      `),
    })

    const root = glassEasel.Component.createWithContext('root', compDef, shadowSyncBackend)
    root.destroyBackendElementOnDetach()

    const viewRoot = getViewNode(root) as glassEasel.GeneralComponent

    expect(domHtml(root)).toEqual('<view>-</view>')
    expect(viewRoot.data.name).toEqual('')
    expect(viewRoot.data.value).toEqual('')

    root.setData({ name: 'a', value: 'b' })
    await Promise.resolve()
    expect(domHtml(root)).toEqual('<view>a-b</view>')
    expect(viewRoot.data.name).toEqual('a')
    expect(viewRoot.data.value).toEqual('b')
  })
  test('hook to sync behavior builder with method caller', async () => {
    const methodCallerMap = new WeakMap<any, glassEasel.GeneralComponent>()

    const beh = hookBuilderToSyncData(componentSpace.define(), (methodCaller) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      methodCallerMap.get(methodCaller),
    )
      .property('name', String)
      .property('value', String)
      .registerBehavior()

    const compDef = componentSpace
      .define()
      .behavior(beh)
      .template(
        tmpl(`
        <view>{{name}}-{{value}}</view>
      `),
      )
      .methodCallerInit(function () {
        const methodCaller = {}
        methodCallerMap.set(methodCaller, this)
        return methodCaller
      })
      .registerComponent()

    const root = glassEasel.Component.createWithContext('root', compDef, shadowSyncBackend)

    root.destroyBackendElementOnDetach()

    const viewRoot = getViewNode(root) as glassEasel.GeneralComponent

    expect(domHtml(root)).toEqual('<view>-</view>')
    expect(viewRoot.data.name).toEqual('')
    expect(viewRoot.data.value).toEqual('')

    root.setData({ name: 'a', value: 'b' })
    await Promise.resolve()
    expect(domHtml(root)).toEqual('<view>a-b</view>')
    expect(viewRoot.data.name).toEqual('a')
    expect(viewRoot.data.value).toEqual('b')
  })
  test('hook template engine to sync', () => {
    viewComponentSpace.setGlobalUsingComponent(
      'wx-textarea',
      viewComponentSpace.defineComponent({
        is: 'wx-textarea',
        externalClasses: ['placeholder-class'],
        properties: {
          disabled: Boolean,
          maxlength: {
            type: Number,
            value: 140,
          },
        },
        template: tmpl(
          '<textarea disabled="{{disabled}}" maxlength="{{maxlength}}"></textarea><span class="placeholder-class"><slot /></span>',
        ),
      }) as glassEasel.GeneralComponentDefinition,
    )

    componentSpace.setGlobalUsingComponent(
      'wx-textarea',
      componentSpace.defineComponent({
        is: 'wx-textarea',
        options: {
          externalComponent: true,
          templateEngine: ReflectTemplateEngine,
        },
        properties: {
          disabled: Boolean,
          maxlength: {
            type: Number,
            value: 140,
          },
          placeholderClass: {
            type: String,
            value: '',
          },
        },
      }) as glassEasel.GeneralComponentDefinition,
    )

    const ops: any[] = []
    const rootDef = componentSpace.defineComponent({
      template: tmpl(`
        <wx-textarea disabled="{{disabled}}" bind:tap="handleTap" placeholder-class="{{placeholderClass}}">{{text}}</wx-textarea>
      `),
      data: {
        text: '123',
        disabled: true,
        placeholderClass: '',
      },
      methods: {
        handleTap(e: glassEasel.Event<any>) {
          ops.push(e.detail)
        },
      },
    })
    const root = glassEasel.Component.createWithContext('root', rootDef, shadowSyncBackend)
    root.destroyBackendElementOnDetach()

    expect(domHtml(root)).toEqual(
      '<wx-textarea><textarea maxlength="140" disabled=""></textarea><span>123</span></wx-textarea>',
    )

    root.setData({ disabled: false })
    expect(domHtml(root)).toEqual(
      '<wx-textarea><textarea maxlength="140"></textarea><span>123</span></wx-textarea>',
    )

    root.setData({ text: '23333' })
    expect(domHtml(root)).toEqual(
      '<wx-textarea><textarea maxlength="140"></textarea><span>23333</span></wx-textarea>',
    )

    root.setData({ placeholderClass: 'a' })
    expect(domHtml(root)).toEqual(
      '<wx-textarea><textarea maxlength="140"></textarea><span class="a">23333</span></wx-textarea>',
    )

    const textarea = root.getShadowRoot()!.childNodes[0]!

    const viewButton = getViewNode(textarea) as glassEasel.GeneralComponent
    viewButton.triggerEvent('tap', { foo: 'foo' })
    expect(ops).toEqual([{ foo: 'foo' }])
  })
  test('sync setModelListener', () => {
    viewComponentSpace.setGlobalUsingComponent(
      'wx-input',
      viewComponentSpace.defineComponent({
        is: 'wx-input',
        properties: {
          value: {
            type: String,
            value: '',
          },
        },
      }) as glassEasel.GeneralComponentDefinition,
    )

    const rootDef = componentSpace.defineComponent({
      template: tmpl(`
        <wx-input model:value="{{value}}"></wx-input>
      `),
      data: {
        value: '123',
      },
    })
    const root = glassEasel.Component.createWithContext('root', rootDef, shadowSyncBackend)
    root.destroyBackendElementOnDetach()
    const input = root.getShadowRoot()!.childNodes[0]!
    const inputOnView = getViewNode(input) as glassEasel.GeneralComponent

    expect(domHtml(root)).toEqual('<wx-input></wx-input>')
    matchElementWithDom(root)

    expect(inputOnView.data.value).toEqual('123')

    inputOnView.setData({ value: '456' })
    expect(inputOnView.data.value).toEqual('456')
    expect(root.data.value).toEqual('456')
  })
  test('external structure on lifetimes', () => {
    viewComponentSpace.setGlobalUsingComponent(
      'wx-button',
      viewComponentSpace.defineComponent({
        is: 'wx-button',
        options: {
          externalComponent: true,
        },
        template: tmpl('<button><slot /></button>'),
        attached() {
          matchElementWithDom(getViewNode(root))
        },
        detached() {
          matchElementWithDom(getViewNode(root))
        },
      }) as glassEasel.GeneralComponentDefinition,
    )

    const subComp = componentSpace.defineComponent({
      template: tmpl(`
        <div>
          <slot />
        </div>
      `),
    })

    const rootDef = componentSpace.defineComponent({
      using: {
        'sub-comp': subComp,
      },
      template: tmpl(`
        <sub-comp>
          <sub-comp>
            <wx-button wx:if="{{show}}">123</wx-button>
          </sub-comp>
        </sub-comp>
      `),
      data: {
        show: false,
      },
    })
    const root = glassEasel.Component.createWithContext('root', rootDef, shadowSyncBackend)
    shadowSyncBackend.getRootNode().appendChild(root.getBackendElement() as ShadowSyncElement)
    glassEasel.Component.pretendAttached(root)
    root.destroyBackendElementOnDetach()

    expect(domHtml(root)).toEqual(
      '<sub-comp><div><sub-comp><div></div></sub-comp></div></sub-comp>',
    )
    matchElementWithDom(root)
    matchElementWithDom(getViewNode(root))
    root.setData({ show: true })

    expect(domHtml(root)).toEqual(
      '<sub-comp><div><sub-comp><div><wx-button><button>123</button></wx-button></div></sub-comp></div></sub-comp>',
    )
    matchElementWithDom(root)
    matchElementWithDom(getViewNode(root))
  })
  test('syncing dynamic slots', () => {
    viewComponentSpace.setGlobalUsingComponent(
      'list',
      viewComponentSpace.defineComponent({
        is: 'list',
        options: {
          dynamicSlots: true,
        },
        properties: {
          list: {
            type: Array,
            value: [],
          },
        },
        data: {
          displayList: [] as number[],
        },
        template: tmpl('<slot wx:for="{{displayList}}" item="{{list[item]}}" />'),
      }) as glassEasel.GeneralComponentDefinition,
    )
    componentSpace.setGlobalUsingComponent(
      'list',
      componentSpace.defineComponent({
        is: 'list',
        options: {
          dynamicSlots: true,
          templateEngine: ReflectTemplateEngine,
        },
        properties: {
          list: {
            type: Array,
            value: [],
          },
        },
      }) as glassEasel.GeneralComponentDefinition,
    )

    const listArray = new Array(100).fill(0).map((_, i) => i)

    const rootDef = componentSpace.defineComponent({
      template: tmpl(`
        <list list="{{listArray}}">
          <li slot:item>{{item}}</li>
        </list>
      `),
      data: {
        listArray,
      },
    })
    const root = glassEasel.Component.createWithContext('root', rootDef, shadowSyncBackend)
    shadowSyncBackend.getRootNode().appendChild(root.getBackendElement() as ShadowSyncElement)
    glassEasel.Component.pretendAttached(root)
    root.destroyBackendElementOnDetach()

    const list = root.getShadowRoot()!.childNodes[0] as glassEasel.GeneralComponent
    const listOnView = getViewNode(list)

    expect(domHtml(root)).toEqual('<list></list>')
    matchElementWithDom(root)
    matchElementWithDom(getViewNode(root))
    expect(list.data.list).toEqual(listArray)
    expect(listOnView.data.list).toEqual(listArray)

    listOnView.setData({
      displayList: [0, 1, 2],
    })
    expect(listOnView.data.displayList).toEqual([0, 1, 2])
    expect(domHtml(root)).toEqual('<list><li>0</li><li>1</li><li>2</li></list>')
    matchElementWithDom(root)
    matchElementWithDom(getViewNode(root))

    listOnView.spliceArrayDataOnPath(['displayList'], undefined, undefined, [3, 4])
    listOnView.applyDataUpdates()
    expect(listOnView.data.displayList).toEqual([0, 1, 2, 3, 4])
    expect(domHtml(root)).toEqual('<list><li>0</li><li>1</li><li>2</li><li>3</li><li>4</li></list>')
    matchElementWithDom(root)
    matchElementWithDom(getViewNode(root))

    listOnView.spliceArrayDataOnPath(['displayList'], 0, 2, [])
    listOnView.applyDataUpdates()
    expect(listOnView.data.displayList).toEqual([2, 3, 4])
    expect(domHtml(root)).toEqual('<list><li>2</li><li>3</li><li>4</li></list>')
    matchElementWithDom(root)
    matchElementWithDom(getViewNode(root))
  })

  test('wxs', () => {
    const customHandler = jest.fn().mockReturnThis()

    shadowSyncBackend.onCustomMethodFromView((element, options) => {
      const component = element as glassEasel.GeneralComponent
      const { method, args } = options as { method: string; args: any[] }
      component.callMethod(method, args)
    })

    syncController.handleCustomMethod = (
      element: glassEasel.Element,
      {
        evName: eventName,
        final,
        mutated,
        capture,
        generalLvaluePath: lvaluePath,
      }: {
        evName: string
        final: boolean
        mutated: boolean
        capture: boolean
        generalLvaluePath: (string | number)[]
      },
    ) => {
      const isWXS =
        lvaluePath?.[0] === glassEasel.template.GeneralLvaluePathPrefix.InlineScript ||
        lvaluePath?.[0] === glassEasel.template.GeneralLvaluePathPrefix.Script
      expect(isWXS).toBe(true)

      if (lvaluePath[0] === glassEasel.template.GeneralLvaluePathPrefix.Script) {
        // const path = lvaluePath[1] as string
        // const key = lvaluePath[2] as string
        // return
        throw new Error('not implemented')
      } else if (lvaluePath[0] === glassEasel.template.GeneralLvaluePathPrefix.InlineScript) {
        const wxmlFile = lvaluePath[1] as string
        const module = lvaluePath[2] as string
        const key = lvaluePath[3] as string
        expect(wxmlFile).toBe('')
        expect(module).toBe('w')
        expect(key).toBe('customHandler')
        syncController.setListenerStats(
          element,
          eventName,
          capture,
          // eslint-disable-next-line no-nested-ternary
          final
            ? glassEasel.EventMutLevel.Final
            : mutated
            ? glassEasel.EventMutLevel.Mut
            : glassEasel.EventMutLevel.None,
          function (this: glassEasel.GeneralComponent, _ev: glassEasel.ShadowedEvent<unknown>) {
            syncController.sendCustomMethod(this.ownerShadowRoot!.getHostNode(), {
              method: 'customHandler',
              args: [true],
            })
          },
        )
      } else {
        throw new Error('unexpected lvalue path')
      }
    }

    const def = glassEasel.registerElement({
      template: tmpl(
        `
        <wxs module="w">module.exports = { customHandler: function () { throw new Error("should not call") } }</wxs>
        <div
          id="a"
          bind:customEv="{{ w.customHandler }}"
        ></div>
      `,
        {},
        {
          C: (elem, evName, listener, final, mutated, capture, generalLvaluePath) => {
            const prefix = generalLvaluePath?.[0] as number | null | undefined
            const isWxsHandler =
              prefix === glassEasel.template.GeneralLvaluePathPrefix.Script ||
              prefix === glassEasel.template.GeneralLvaluePathPrefix.InlineScript
            if (isWxsHandler) {
              ;(elem.getBackendElement() as ShadowSyncElement).sendCustomMethod({
                evName,
                final,
                mutated,
                capture,
                generalLvaluePath,
              })
              return null
            }

            return (e) => listener.call(elem.ownerShadowRoot?.getHostNode().getMethodCaller(), e)
          },
        },
      ),
      methods: {
        customHandler,
      },
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), shadowSyncBackend)
    const div = elem.getShadowRoot()!.getElementById('a')!

    getViewNode(div).triggerEvent('customEv')
    expect(customHandler).toHaveBeenCalledTimes(1)
    expect(customHandler).toHaveBeenCalledWith([true])
    expect(customHandler).toHaveReturnedWith(elem)
  })
})
