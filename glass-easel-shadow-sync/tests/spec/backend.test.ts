import * as glassEasel from 'glass-easel'
import { virtual as matchElementWithDom } from '../../../glass-easel/tests/base/match'
import {
  ShadowSyncBackendContext,
  hookBuilderToSyncData,
  type ShadowSyncElement,
} from '../../src/backend'
import { getViewNode, shadowSyncBackend, tmpl, viewComponentSpace } from '../base/env'

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
  test('hook to sync behavior builder', async () => {
    const beh = hookBuilderToSyncData(glassEasel, componentSpace.define())
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
          templateEngine: ShadowSyncBackendContext.hookReflectTemplateEngine(),
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
    expect(domHtml(root)).toEqual('<wx-textarea><textarea maxlength="140"></textarea><span>123</span></wx-textarea>')

    root.setData({ text: '23333' })
    expect(domHtml(root)).toEqual('<wx-textarea><textarea maxlength="140"></textarea><span>23333</span></wx-textarea>')

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
      }) as glassEasel.GeneralComponentDefinition,
    )
    componentSpace.setGlobalUsingComponent(
      'list',
      componentSpace.defineComponent({
        is: 'list',
        options: {
          dynamicSlots: true,
          templateEngine: ShadowSyncBackendContext.hookReflectTemplateEngine(
            glassEasel.template.getDefaultTemplateEngine(),
          ),
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
        listeners: {
          setData(e: glassEasel.ShadowedEvent<number[]>) {
            this.setData({
              displayList: e.detail,
            })
          },
          spliceUpdate(e: glassEasel.ShadowedEvent<[number, number, number[]]>) {
            this.spliceArrayDataOnPath(['displayList'], ...e.detail)
            this.applyDataUpdates()
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

    listOnView.getShadowRoot()!.triggerEvent('setData', [0, 1, 2])
    expect(listOnView.data.displayList).toEqual([0, 1, 2])
    expect(list.data.displayList).toEqual([0, 1, 2])
    expect(domHtml(root)).toEqual('<list><li>0</li><li>1</li><li>2</li></list>')
    matchElementWithDom(root)
    matchElementWithDom(getViewNode(root))

    listOnView.getShadowRoot()!.triggerEvent('spliceUpdate', [undefined, undefined, [3, 4]])
    expect(listOnView.data.displayList).toEqual([0, 1, 2, 3, 4])
    expect(list.data.displayList).toEqual([0, 1, 2, 3, 4])
    expect(domHtml(root)).toEqual('<list><li>0</li><li>1</li><li>2</li><li>3</li><li>4</li></list>')
    matchElementWithDom(root)
    matchElementWithDom(getViewNode(root))

    listOnView.getShadowRoot()!.triggerEvent('spliceUpdate', [0, 2, []])
    expect(listOnView.data.displayList).toEqual([2, 3, 4])
    expect(list.data.displayList).toEqual([2, 3, 4])
    expect(domHtml(root)).toEqual('<list><li>2</li><li>3</li><li>4</li></list>')
    matchElementWithDom(root)
    matchElementWithDom(getViewNode(root))
  })
})
