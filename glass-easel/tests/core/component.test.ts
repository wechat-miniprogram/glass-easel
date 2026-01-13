import { tmpl, composedBackend, domBackend, shadowBackend } from '../base/env'
import * as glassEasel from '../../src'

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

const testCases = (testBackend: glassEasel.GeneralBackendContext) => {
  const componentSpace = new glassEasel.ComponentSpace()
  componentSpace.updateComponentOptions({
    writeFieldsToNode: true,
    writeIdToDOM: true,
  })
  componentSpace.defineComponent({
    is: '',
  })

  it('dynamic add lifetime listener', () => {
    let actionOrder: number[] = []

    const Comp = componentSpace.defineComponent({
      options: {
        listenerChangeLifetimes: true,
      },
      lifetimes: {
        listenerChange() {
          actionOrder.push(1)
        },
      },
    })

    const elem = glassEasel.Component.createWithContext('root', Comp, domBackend).general()
    const elem2 = glassEasel.Component.createWithContext('root', Comp, domBackend).general()

    elem.addListener('custom', () => {})
    expect(actionOrder).toStrictEqual([1])
    actionOrder = []

    const onListenerChange = () => {
      actionOrder.push(2)
    }
    elem.addLifetimeListener('listenerChange', onListenerChange)
    elem.addListener('custom1', () => {})
    expect(actionOrder).toStrictEqual([1, 2])
    actionOrder = []

    elem2.addListener('custom', () => {})
    expect(actionOrder).toStrictEqual([1])
    actionOrder = []

    elem.removeLifetimeListener('listenerChange', onListenerChange)
    elem.addListener('custom2', () => {})
    expect(actionOrder).toStrictEqual([1])
    actionOrder = []

    elem.addLifetimeListener('attached', () => {
      actionOrder.push(3)
    })
    glassEasel.Component.pretendAttached(elem)
    expect(actionOrder).toStrictEqual([3])
    actionOrder = []
  })

  it('dynamic add page lifetime listener', () => {
    let showCallResArr: [string, unknown][] = []
    let hideCallResArr: [string, unknown][] = []

    const A = componentSpace.defineComponent({
      template: tmpl('<div><slot></div>'),
      pageLifetimes: {
        show(args) {
          showCallResArr.push(['pa', args])
        },
      },
    })
    const D = componentSpace.defineComponent({
      template: tmpl('<div></div>'),
      pageLifetimes: {
        show(args) {
          showCallResArr.push(['pd', args])
        },
      },
    })
    const B = componentSpace.defineComponent({
      using: { A, D },
      template: tmpl('<div><A id="a"><D id="d"></D></A></div>'),
      pageLifetimes: {
        show(args) {
          showCallResArr.push(['pb', args])
        },
        hide(args) {
          hideCallResArr.push(['pb', args])
        },
      },
    })
    const C = componentSpace.defineComponent({
      using: { A, B },
      template: tmpl('<div><A id="a"></A><B id="b"></B></div>'),
      pageLifetimes: {
        show(args) {
          showCallResArr.push(['pc', args])
        },
        hide(args) {
          hideCallResArr.push(['pc', args])
        },
      },
    })
    const elemC = glassEasel.Component.createWithContext('root', C, testBackend)
    const elemB = elemC.$.b as glassEasel.GeneralComponent
    const elemA1 = elemC.$.a as glassEasel.GeneralComponent
    const elemA2 = elemB.$.a as glassEasel.GeneralComponent
    const elemD = elemB.$.d as glassEasel.GeneralComponent

    elemC.triggerPageLifetime('show', [{ showProp: 'showValue' }])
    expect(showCallResArr.length).toBe(5)
    expect(showCallResArr).toStrictEqual([
      ['pc', { showProp: 'showValue' }],
      ['pa', { showProp: 'showValue' }],
      ['pb', { showProp: 'showValue' }],
      ['pa', { showProp: 'showValue' }],
      ['pd', { showProp: 'showValue' }],
    ])
    showCallResArr = []

    elemC.addPageLifetimeListener('show', (args) => {
      showCallResArr.push(['dpc', args])
    })
    const onShowA1 = (args: unknown) => {
      showCallResArr.push(['dpa1', args])
    }
    elemA1.addPageLifetimeListener('show', onShowA1)

    elemC.triggerPageLifetime('show', [{ showProp: 'showValue' }])
    expect(showCallResArr.length).toBe(7)
    expect(showCallResArr).toStrictEqual([
      ['pc', { showProp: 'showValue' }],
      ['dpc', { showProp: 'showValue' }],
      ['pa', { showProp: 'showValue' }],
      ['dpa1', { showProp: 'showValue' }],
      ['pb', { showProp: 'showValue' }],
      ['pa', { showProp: 'showValue' }],
      ['pd', { showProp: 'showValue' }],
    ])
    showCallResArr = []

    elemA1.removePageLifetimeListener('show', onShowA1)
    elemC.triggerPageLifetime('show', [{ showProp: 'showValue' }])
    expect(showCallResArr.length).toBe(6)
    expect(showCallResArr).toStrictEqual([
      ['pc', { showProp: 'showValue' }],
      ['dpc', { showProp: 'showValue' }],
      ['pa', { showProp: 'showValue' }],
      ['pb', { showProp: 'showValue' }],
      ['pa', { showProp: 'showValue' }],
      ['pd', { showProp: 'showValue' }],
    ])
    showCallResArr = []

    elemB.triggerPageLifetime('hide', [{ hideProp: 'hideValue' }])
    expect(hideCallResArr.length).toBe(1)
    expect(hideCallResArr).toStrictEqual([['pb', { hideProp: 'hideValue' }]])
    hideCallResArr = []

    elemA2.addPageLifetimeListener('hide', (args) => {
      hideCallResArr.push(['dpa2', args])
    })
    elemD.addPageLifetimeListener('hide', (args) => {
      hideCallResArr.push(['dpd', args])
    })
    elemB.triggerPageLifetime('hide', [{ hideProp: 'hideValue' }])
    expect(hideCallResArr.length).toBe(3)
    expect(hideCallResArr).toStrictEqual([
      ['pb', { hideProp: 'hideValue' }],
      ['dpa2', { hideProp: 'hideValue' }],
      ['dpd', { hideProp: 'hideValue' }],
    ])
    hideCallResArr = []
  })
  it('inherit style scope', () => {
    const A = componentSpace.defineComponent({
      options: {
        inheritStyleScope: true,
      },
      template: tmpl('<div class="a"></div>'),
    })
    const styleScope = componentSpace.styleScopeManager.register('root')
    const extraStyleScope = glassEasel.StyleScopeManager.globalScope()
    const Root = componentSpace.defineComponent({
      options: {
        styleScope,
        extraStyleScope,
      },
    })
    const root = glassEasel.Component.createWithContext('root', Root, testBackend)
    const a0 = glassEasel.Component.createWithContext('a', A, testBackend)
    const a1 = root.getShadowRoot()!.createComponentByDef('a', A)
    root.getShadowRoot()!.appendChild(a1)
    expect(root.getStyleScopes()).toEqual([
      styleScope,
      extraStyleScope,
      componentSpace.styleScopeManager,
    ])
    expect(a0.getStyleScopes()).toEqual([null, null, componentSpace.styleScopeManager])
    expect(a1.getStyleScopes()).toEqual([
      styleScope,
      extraStyleScope,
      componentSpace.styleScopeManager,
    ])
    expect(domHtml(root)).toBe('<a wx-host="root"><div class="a root--a"></div></a>')
    expect(domHtml(a0)).toBe('<div class="a"></div>')

    const a2 = a1.getShadowRoot()!.createComponentByDef('a', A)
    a1.getShadowRoot()!.appendChild(a2)
    expect(a2.getStyleScopes()).toEqual([
      styleScope,
      extraStyleScope,
      componentSpace.styleScopeManager,
    ])
    expect(domHtml(root)).toBe(
      '<a wx-host="root"><div class="a root--a"></div><a wx-host="root"><div class="a root--a"></div></a></a>',
    )
  })
}

describe('placeholder (DOM backend)', () => testCases(domBackend))
describe('placeholder (shadow backend)', () => testCases(shadowBackend))
describe('placeholder (composed backend)', () => testCases(composedBackend))
