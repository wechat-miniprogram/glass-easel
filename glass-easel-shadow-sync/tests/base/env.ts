import * as glassEasel from 'glass-easel'
import {
  MessageChannelDataSide,
  ShadowSyncBackendContext,
  ShadowSyncElement,
} from '../../src/backend'
import { getNodeId } from '../../src/message_channel'
import { getLinearIdGenerator } from '../../src/utils'
import { MessageChannelViewSide, ViewController } from '../../src/view_controller'
import { MicroTaskScheduler, StreamTransportBridge } from '../../src/transport_bridge'

export { execWithWarn, multiTmpl, tmpl } from '../../../glass-easel/tests/base/env'
;(['tagName', 'nodeType', 'textContent', 'TEXT_NODE'] as (keyof Element)[]).forEach((key) => {
  Object.defineProperty(ShadowSyncElement.prototype, key, {
    get(this: ShadowSyncElement) {
      flushDataSide()
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
      flushDataSide()
      const nodeOnView = (
        messageChannelViewSide.getNode(this._id) as glassEasel.Node
      ).getBackendElement() as unknown as Element
      return nodeOnView.getAttribute.bind(nodeOnView)
    },
  },
  parentNode: {
    get(this: ShadowSyncElement) {
      flushDataSide()
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
      flushDataSide()
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
      flushDataSide()
      const nodeOnView = (
        messageChannelViewSide.getNode(this._id) as glassEasel.Node
      ).getBackendElement() as unknown as Element
      const innerHTML = nodeOnView.innerHTML
      return innerHTML
    },
  },
})

class Bridge {
  /**
   * A synchronous stand-in for a real transport.
   *
   * The data side is flushed explicitly (see `flushDataSide`) instead of at the
   * end of the microtask, so a test can read the view right after mutating the
   * logic side. The view side is left on the microtask scheduler: tests that
   * assert on callbacks coming back wait a macrotask first.
   */
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
    // deliver the pending stream to the currently connected view first, so that
    // no messages leak into a later connection
    flushDataSide()
    this._publish = null
  }
}

// the tests flush the data-side stream explicitly instead of waiting for the
// microtask (see `flushDataSide`)

const createDataContext = (dataComponentSpace: glassEasel.ComponentSpace) => {
  const bridgeOnData = new Bridge()
  const schedulerOnData = new MicroTaskScheduler()

  const transportBridgeOnData = new StreamTransportBridge(
    bridgeOnData.publish,
    bridgeOnData.subscribe,
    schedulerOnData,
  )

  const messageChannelDataSide = MessageChannelDataSide(transportBridgeOnData, getLinearIdGenerator)

  const shadowSyncBackend = new ShadowSyncBackendContext(
    glassEasel,
    messageChannelDataSide,
    dataComponentSpace.styleScopeManager,
    getLinearIdGenerator,
  )

  return {
    schedulerOnData,
    transportBridgeOnData,
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
  const schedulerOnView = new MicroTaskScheduler()

  const transportBridgeOnView = new StreamTransportBridge(
    bridgeOnView.publish,
    bridgeOnView.subscribe,
    schedulerOnView,
  )

  const messageChannelViewSide = MessageChannelViewSide(
    transportBridgeOnView,
    syncController,
    getLinearIdGenerator,
  )

  return {
    schedulerOnView,
    transportBridgeOnView,
    bridgeOnView,
    messageChannelViewSide,
    syncController,
  }
}

export const domBackend = new glassEasel.CurrentWindowBackendContext()

domBackend.onEvent(glassEasel.Event.triggerBackendEvent)

export const dataComponentSpace = glassEasel.getDefaultComponentSpace()

export const viewComponentSpace = new glassEasel.ComponentSpace()
viewComponentSpace.updateComponentOptions({
  writeFieldsToNode: true,
})

export const {
  bridgeOnData,
  transportBridgeOnData,
  schedulerOnData,
  messageChannelDataSide,
  shadowSyncBackend,
} = createDataContext(dataComponentSpace)
export const { bridgeOnView, transportBridgeOnView, messageChannelViewSide, syncController } =
  createViewContext(
    document.createElement('div') as unknown as glassEasel.domlikeBackend.Element,
    domBackend,
    viewComponentSpace,
  )

/**
 * Flush the logic-side stream into the view side.
 *
 * The stream is normally published at the end of the microtask; the accessors
 * above read the view synchronously, so they flush the pending batch first.
 */
const flushDataSide = () => schedulerOnData.flush()

bridgeOnData.connect(bridgeOnView)

shadowSyncBackend.onEvent(
  (type, detail, options) => new glassEasel.Event(type, detail, options),
  (event, currentTarget, mark, target, isCapture) => {
    event.callListener(currentTarget, mark, target, isCapture)
  },
)

export function getViewNode<T extends glassEasel.Node>(elem: T): T {
  flushDataSide()
  const shadowDomNode = elem.getBackendElement() as ShadowSyncElement

  return messageChannelViewSide.getNode(shadowDomNode._id) as glassEasel.Node as T
}
