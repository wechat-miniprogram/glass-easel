import * as glassEasel from 'glass-easel'
import {
  MessageChannelDataSide,
  ShadowSyncBackendContext,
  ShadowSyncElement,
} from '../../src/backend'
import { getNodeId } from '../../src/message_channel'
import { getLinearIdGenerator } from '../../src/utils'
import { MessageChannelViewSide, ViewController } from '../../src/view_controller'

export { execWithWarn, multiTmpl, tmpl } from '../../../glass-easel/tests/base/env'
;(['tagName', 'nodeType', 'textContent', 'TEXT_NODE'] as (keyof Element)[]).forEach((key) => {
  Object.defineProperty(ShadowSyncElement.prototype, key, {
    get(this: ShadowSyncElement) {
      return (
        (
          messageChannelViewSide.getNode(this._id) as glassEasel.Node
        ).getBackendElement() as unknown as Element
      )[key]
    },
  })
})

Object.defineProperties(ShadowSyncElement.prototype, {
  getAttribute: {
    get(this: ShadowSyncElement) {
      const nodeOnView = (
        messageChannelViewSide.getNode(this._id) as glassEasel.Node
      ).getBackendElement() as unknown as Element
      return nodeOnView.getAttribute.bind(nodeOnView)
    },
  },
  parentNode: {
    get(this: ShadowSyncElement) {
      const parentNodeOnView = (
        (
          messageChannelViewSide.getNode(this._id) as glassEasel.Node
        ).getBackendElement() as glassEasel.domlikeBackend.Element
      ).parentNode?.__wxElement
      if (!parentNodeOnView) return undefined
      return shadowSyncBackend._getElementId(getNodeId(parentNodeOnView)!)
    },
  },
  childNodes: {
    get(this: ShadowSyncElement) {
      const childNodes: ShadowSyncElement[] = []
      const elementOnView = messageChannelViewSide.getNode(this._id) as glassEasel.Element
      elementOnView.forEachNonVirtualComposedChild((node) => {
        childNodes.push(shadowSyncBackend._getElementId(getNodeId(node)!)!)
      })
      return childNodes
    },
  },
  innerHTML: {
    get(this: ShadowSyncElement) {
      const nodeOnView = (
        messageChannelViewSide.getNode(this._id) as glassEasel.Node
      ).getBackendElement() as unknown as Element
      const innerHTML = nodeOnView.innerHTML
      return innerHTML
    },
  },
})

class Bridge {
  private _subscribe: ((...args: any[]) => void) | null = null
  public subscribe = (cb: (...args: any[]) => void): void => {
    this._subscribe = cb
  }
  private _publish: ((args: readonly any[]) => void) | null = null
  public publish = (args: readonly any[]): void => {
    this._publish?.(args)
  }
  public connect(bridge: Bridge): void {
    this._publish = bridge._subscribe
    bridge._publish = this._subscribe
  }
  public disconnect(): void {
    this._publish = null
  }
}

const createDataContext = (dataComponentSpace: glassEasel.ComponentSpace) => {
  const bridgeOnData = new Bridge()

  const messageChannelDataSide = MessageChannelDataSide(
    bridgeOnData.publish,
    bridgeOnData.subscribe,
    getLinearIdGenerator,
  )

  const shadowSyncBackend = new ShadowSyncBackendContext(
    glassEasel,
    messageChannelDataSide,
    dataComponentSpace.styleScopeManager,
    getLinearIdGenerator,
  )

  return {
    bridgeOnData,
    messageChannelDataSide,
    shadowSyncBackend,
  }
}

export const createViewContext = (
  rootNode: glassEasel.GeneralBackendElement,
  backendContext: glassEasel.GeneralBackendContext,
  viewComponentSpace: glassEasel.ComponentSpace,
) => {
  const syncController = new ViewController(
    glassEasel,
    rootNode,
    backendContext,
    viewComponentSpace,
  )

  const bridgeOnView = new Bridge()

  const messageChannelViewSide = MessageChannelViewSide(
    bridgeOnView.publish,
    bridgeOnView.subscribe,
    syncController,
    getLinearIdGenerator,
  )

  return {
    bridgeOnView,
    messageChannelViewSide,
    syncController,
  }
}

export const domBackend = new glassEasel.CurrentWindowBackendContext()

domBackend.onEvent((target, type, detail, options) => {
  glassEasel.triggerEvent(target, type, detail, options)
})

export const dataComponentSpace = glassEasel.getDefaultComponentSpace()

export const viewComponentSpace = new glassEasel.ComponentSpace()
viewComponentSpace.updateComponentOptions({
  writeFieldsToNode: true,
})

export const { bridgeOnData, messageChannelDataSide, shadowSyncBackend } =
  createDataContext(dataComponentSpace)
export const { bridgeOnView, messageChannelViewSide, syncController } = createViewContext(
  document.createElement('div') as unknown as glassEasel.domlikeBackend.Element,
  domBackend,
  viewComponentSpace,
)

bridgeOnData.connect(bridgeOnView)

shadowSyncBackend.onEvent(
  (type, detail, options) => new glassEasel.Event(type, detail, options),
  (event, currentTarget, mark, target, isCapture) => {
    event.callListener(currentTarget, mark, target, isCapture)
  },
)

export function getViewNode<T extends glassEasel.Node>(elem: T): T {
  const shadowDomNode = elem.getBackendElement() as ShadowSyncElement

  return messageChannelViewSide.getNode(shadowDomNode._id) as glassEasel.Node as T
}
