import * as glassEasel from 'glass-easel'
import { type ShadowDomElement, SyncTemplateEngine } from '../../src/backend'
import { shadowDomBackend, viewComponentSpace, tmpl, getViewNode } from '../base/env'
import { virtual as matchElementWithDom } from '../../../glass-easel/tests/base/match'

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
    const elem = glassEasel.Component.createWithContext('root', rootDef, shadowDomBackend)
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
    const root = glassEasel.Component.createWithContext('root', rootDef, shadowDomBackend)
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
  test('external input component', () => {
    viewComponentSpace.setGlobalUsingComponent(
      'wx-input',
      viewComponentSpace.defineComponent({
        is: 'wx-input',
        externalClasses: ['placeholder-class'],
        properties: {
          disabled: Boolean,
          maxlength: {
            type: Number,
            value: 140,
          },
        },
        template: tmpl(
          '<input disabled="{{disabled}}" maxlength="{{maxlength}}"></input><span class="placeholder-class"><slot /></span>',
        ),
      }) as glassEasel.GeneralComponentDefinition,
    )

    componentSpace.setGlobalUsingComponent(
      'wx-input',
      componentSpace.defineComponent({
        is: 'wx-input',
        options: {
          externalComponent: true,
          templateEngine: SyncTemplateEngine,
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
        <wx-input disabled="{{disabled}}" bind:tap="handleTap" placeholder-class="{{placeholderClass}}">{{text}}</wx-input>
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
    const root = glassEasel.Component.createWithContext('root', rootDef, shadowDomBackend)
    root.destroyBackendElementOnDetach()

    expect(domHtml(root)).toEqual(
      '<wx-input><input maxlength="140" disabled=""><span>123</span></wx-input>',
    )

    root.setData({ disabled: false })
    expect(domHtml(root)).toEqual('<wx-input><input maxlength="140"><span>123</span></wx-input>')

    root.setData({ text: '23333' })
    expect(domHtml(root)).toEqual('<wx-input><input maxlength="140"><span>23333</span></wx-input>')

    root.setData({ placeholderClass: 'a' })
    expect(domHtml(root)).toEqual(
      '<wx-input><input maxlength="140"><span class="a">23333</span></wx-input>',
    )

    const input = root.getShadowRoot()!.childNodes[0]!

    const viewButton = getViewNode(input) as glassEasel.GeneralComponent
    viewButton.triggerEvent('tap', { foo: 'foo' })
    expect(ops).toEqual([{ foo: 'foo' }])
  })
  test('external structure on lifetimes', () => {
    viewComponentSpace.setGlobalUsingComponent(
      'wx-button',
      viewComponentSpace.defineComponent({
        is: 'wx-button',
        options: {
          externalComponent: true,
        },
        template: tmpl('<button"><slot /></button>'),
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
    const root = glassEasel.Component.createWithContext('root', rootDef, shadowDomBackend)
    shadowDomBackend.getRootNode().appendChild(root.getBackendElement() as ShadowDomElement)
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
})
