import * as backend from './backend/backend_protocol'
import * as composedBackend from './backend/composed_backend_protocol'
import * as domlikeBackend from './backend/domlike_backend_protocol'
import {
  globalOptions,
} from './global_options'
import {
  ClassList,
} from './class_list'
import {
  Element,
} from './element'
import {
  ShadowRoot,
} from './shadow_root'
import {
  GeneralBackendElement,
} from '.'
import {
  BM,
  BackendMode,
} from './backend/mode'

export type NativeNodeAttributeFilter = (
  // eslint-disable-next-line no-use-before-define
  elem: NativeNode, propName: string, propValue: any, callback: (res: any) => void
) => void

export interface ExtendedNativeNodeDefinition {
  lifetimes?: {
    // eslint-disable-next-line no-use-before-define
    created: (elem: NativeNode) => void,
  },
  attributeFilters?: Record<string, NativeNodeAttributeFilter>,
  eventListeners?: Record<
    string,
    {
      capture?: boolean,
      // eslint-disable-next-line no-use-before-define
      handler?: (elem: NativeNode, event: any) => boolean | void
    }
  >
}

export class NativeNode extends Element {
  is: string
  private _$attributeFilters: Record<string, NativeNodeAttributeFilter>

  constructor() {
    throw new Error('Element cannot be constructed directly')
    // eslint-disable-next-line no-unreachable
    super()
  }

  static create(
    tagName: string,
    owner: ShadowRoot,
    extendedDefinition?: ExtendedNativeNodeDefinition,
  ): NativeNode {
    const node = Object.create(NativeNode.prototype) as NativeNode
    node.is = tagName
    node._$attributeFilters = {}
    let backendElement: GeneralBackendElement | null
    if (BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike)) {
      backendElement = (owner._$nodeTreeContext as domlikeBackend.Context)
        .document.createElement(tagName)
    } else if (BM.SHADOW || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Shadow)) {
      const backend = owner._$backendShadowRoot
      backendElement = backend?.createElement(tagName) || null
    } else {
      const backend = owner._$nodeTreeContext as composedBackend.Context
      backendElement = backend.createElement(tagName)
    }
    node._$initialize(false, backendElement, owner)
    node.classList = new ClassList(node, null)
    if (owner && backendElement) {
      const styleScope = owner.getHostNode()._$definition._$options.styleScope
      if (styleScope) {
        if (!(BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike))) {
          (backendElement as backend.Element | composedBackend.Element).setStyleScope(styleScope)
        }
      }
      if (globalOptions.writeExtraInfoToAttr) {
        const prefix = owner.getHostNode()
          ._$behavior.ownerSpace?.styleScopeManager.queryName(styleScope)
        if (prefix) {
          backendElement.setAttribute('exparser:info-class-prefix', `${prefix}--`)
        }
      }
    }
    if (!(BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike))) {
      if (backendElement) {
        (backendElement as backend.Element | composedBackend.Element).associateValue(node)
      }
    }

    if (extendedDefinition !== undefined) {
      if (extendedDefinition.attributeFilters !== undefined) {
        node._$attributeFilters = extendedDefinition.attributeFilters
      }
      if (extendedDefinition.eventListeners !== undefined) {
        Object.keys(extendedDefinition.eventListeners).forEach((event) => {
          if (typeof extendedDefinition.eventListeners![event]!.handler === 'function') {
            const func = extendedDefinition.eventListeners![event]!.handler!
            node.addListener(
              event,
              (event) => func(node, event),
              { capture: extendedDefinition.eventListeners![event]!.capture },
            )
          }
        })
      }
    }
    if (typeof extendedDefinition?.lifetimes === 'object' && typeof extendedDefinition?.lifetimes.created === 'function') {
      extendedDefinition?.lifetimes.created.call(node, node)
    }
    return node
  }

  callAttributeFilter(propName: string, propValue: any, callback: (newPropValue: any) => void) {
    if (typeof this._$attributeFilters[propName] !== 'function') {
      callback(propValue)
      return
    }
    this._$attributeFilters[propName]!(this, propName, propValue, callback)
  }
}
