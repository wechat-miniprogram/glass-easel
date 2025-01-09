import * as glassEasel from 'glass-easel'
import {
  MessageChannelDataSide,
  ShadowDomBackendContext,
  ShadowDomElement,
} from '../../src/backend'
import { getNodeId } from '../../src/message_channel'
import { getLinearIdGenerator } from '../../src/utils'
import { MessageChannelViewSide, ViewController } from '../../src/view_controller'

export { execWithWarn, multiTmpl, tmpl } from '../../../glass-easel/tests/base/env'
;(['tagName', 'nodeType', 'textContent', 'TEXT_NODE'] as (keyof Element)[]).forEach((key) => {
  Object.defineProperty(ShadowDomElement.prototype, key, {
    get(this: ShadowDomElement) {
      return (
        (
          messageChannelViewSide.getNode(this._id) as glassEasel.Node
        ).getBackendElement() as unknown as Element
      )[key]
    },
  })
})

Object.defineProperties(ShadowDomElement.prototype, {
  getAttribute: {
    get(this: ShadowDomElement) {
      const nodeOnView = (
        messageChannelViewSide.getNode(this._id) as glassEasel.Node
      ).getBackendElement() as unknown as Element
      return nodeOnView.getAttribute.bind(nodeOnView)
    },
  },
  parentNode: {
    get(this: ShadowDomElement) {
      const parentNodeOnView = (
        (
          messageChannelViewSide.getNode(this._id) as glassEasel.Node
        ).getBackendElement() as glassEasel.domlikeBackend.Element
      ).parentNode?.__wxElement
      if (!parentNodeOnView) return undefined
      return shadowDomBackend._getElementId(getNodeId(parentNodeOnView)!)
    },
  },
  childNodes: {
    get(this: ShadowDomElement) {
      const childNodes: ShadowDomElement[] = []
      const elementOnView = messageChannelViewSide.getNode(this._id) as glassEasel.Element
      elementOnView.forEachNonVirtualComposedChild((node) => {
        childNodes.push(shadowDomBackend._getElementId(getNodeId(node)!)!)
      })
      return childNodes
    },
  },
  innerHTML: {
    get(this: ShadowDomElement) {
      const nodeOnView = (
        messageChannelViewSide.getNode(this._id) as glassEasel.Node
      ).getBackendElement() as unknown as Element
      const innerHTML = nodeOnView.innerHTML
      return innerHTML
    },
  },
})

const createContext = (
  viewComponentSpace: glassEasel.ComponentSpace,
  dataComponentSpace: glassEasel.ComponentSpace,
) => {
  const syncController = new (class extends ViewController {
    private _registeredStyleScope = new Set<number>()

    private _checkStyleScope(styleScope: number | null) {
      if (styleScope === null) return
      if (this._registeredStyleScope.has(styleScope)) return
      this._registeredStyleScope.add(styleScope)
      this.registerStyleScope(
        styleScope,
        dataComponentSpace.styleScopeManager.queryName(styleScope),
      )
    }

    override createSimpleComponent(
      tagName: string,
      external: boolean,
      ownerShadowRoot: glassEasel.ShadowRoot | undefined,
      virtualHost: boolean,
      styleScope: number,
      extraStyleScope: number | null,
      externalClasses: string[] | undefined,
      slotMode: glassEasel.SlotMode | null,
      writeIdToDOM: boolean,
      chainDefinition:
        | ((
            def: glassEasel.BehaviorBuilder<
              glassEasel.typeUtils.Empty,
              glassEasel.typeUtils.Empty,
              glassEasel.typeUtils.Empty,
              glassEasel.typeUtils.Empty,
              never,
              never
            >,
          ) => glassEasel.BehaviorBuilder<
            glassEasel.typeUtils.Empty,
            glassEasel.typeUtils.Empty,
            glassEasel.typeUtils.Empty,
            glassEasel.typeUtils.Empty,
            never,
            never
          >)
        | undefined,
      cb: (component: glassEasel.GeneralComponent) => void,
    ): void {
      this._checkStyleScope(styleScope)
      this._checkStyleScope(extraStyleScope)
      return super.createSimpleComponent(
        tagName,
        external,
        ownerShadowRoot,
        virtualHost,
        styleScope,
        extraStyleScope,
        externalClasses,
        slotMode,
        writeIdToDOM,
        chainDefinition,
        cb,
      )
    }
  })(
    glassEasel,
    document.body as unknown as glassEasel.domlikeBackend.Element,
    domBackend,
    viewComponentSpace,
  )

  const createBridge = () => {
    let _cb: ((...args: any[]) => void) | null = null
    const subscribe = (cb: (...args: any[]) => void) => {
      _cb = cb
    }
    const publish = (args: readonly any[]): void => {
      // console.log(ChannelEventType[args[0] as number], ...args.slice(1))
      _cb?.(args)
    }
    return { subscribe, publish }
  }

  const bridgeToView = createBridge()
  const bridgeToData = createBridge()

  const messageChannelDataSide = MessageChannelDataSide(
    bridgeToView.publish,
    bridgeToData.subscribe,
    getLinearIdGenerator,
  )
  const messageChannelViewSide = MessageChannelViewSide(
    bridgeToData.publish,
    bridgeToView.subscribe,
    syncController,
    getLinearIdGenerator,
  )

  const shadowDomBackend = new ShadowDomBackendContext(
    messageChannelDataSide,
    dataComponentSpace.styleScopeManager,
    getLinearIdGenerator,
  )

  return {
    messageChannelDataSide,
    messageChannelViewSide,
    syncController,
    shadowDomBackend,
  }
}

const domBackend = new glassEasel.CurrentWindowBackendContext()

domBackend.onEvent((target, type, detail, options) => {
  glassEasel.triggerEvent(target, type, detail, options)
})

export const dataComponentSpace = glassEasel.getDefaultComponentSpace()

export const viewComponentSpace = new glassEasel.ComponentSpace()
viewComponentSpace.updateComponentOptions({
  writeFieldsToNode: true,
})

export const { messageChannelViewSide, syncController, shadowDomBackend } = createContext(
  viewComponentSpace,
  dataComponentSpace,
)

shadowDomBackend.onEvent(
  (type, detail, options) => new glassEasel.Event(type, detail, options),
  (event, currentTarget, mark, target, isCapture) => {
    event.callListener(currentTarget, mark, target, isCapture)
  },
)

export function getViewNode<T extends glassEasel.Node>(elem: T): T {
  const shadowDomNode = elem.getBackendElement() as ShadowDomElement

  return messageChannelViewSide.getNode(shadowDomNode._id) as glassEasel.Node as T
}
