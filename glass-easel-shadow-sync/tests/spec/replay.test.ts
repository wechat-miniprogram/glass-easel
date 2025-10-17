import * as glassEasel from 'glass-easel'
import { type ShadowSyncElement } from '../../src/backend'
import {
  bridgeOnData,
  bridgeOnView,
  createViewContext,
  domBackend,
  shadowSyncBackend,
  tmpl,
  viewComponentSpace,
} from '../base/env'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
  writeIdToDOM: true,
})

const replayedDomHtml = (elem: glassEasel.Element): string => {
  bridgeOnData.disconnect()
  bridgeOnView.disconnect()

  const rootNode = document.createElement('div')
  const newViewContext = createViewContext(
    rootNode as unknown as glassEasel.domlikeBackend.Element,
    domBackend,
    viewComponentSpace,
  )

  bridgeOnData.connect(newViewContext.bridgeOnView)
  shadowSyncBackend.replay(
    glassEasel,
    [elem],
    (elem) => elem.getBackendElement() as ShadowSyncElement,
  )
  const innerHTML = (rootNode.firstChild! as Element).innerHTML

  bridgeOnData.connect(bridgeOnView)
  return innerHTML
}

describe('replay', () => {
  test('basic replay', () => {
    const child = componentSpace.defineComponent({
      properties: {
        text: String,
      },
      template: tmpl(`
        <span id="a" class="aa" style="color: red;">{{text}}<slot /></span>
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

    expect(replayedDomHtml(elem)).toEqual('')
    elem.setData({
      text: '123',
    })
    expect(replayedDomHtml(elem)).toEqual(
      '<child><span id="a" class="aa" style="color: red;">123!123!</span></child>',
    )
    elem.setData({
      text: '233',
    })
    expect(replayedDomHtml(elem)).toEqual(
      '<child><span id="a" class="aa" style="color: red;">233!233!</span></child>',
    )
    elem.setData({
      text: '',
    })
    expect(replayedDomHtml(elem)).toEqual('')
  })
})
