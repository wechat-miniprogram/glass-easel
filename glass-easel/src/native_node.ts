import * as backend from './backend/backend_protocol'
import * as composedBackend from './backend/composed_backend_protocol'
import * as domlikeBackend from './backend/domlike_backend_protocol'
import { globalOptions } from './global_options'
import { ClassList } from './class_list'
import { Element } from './element'
import { ShadowRoot } from './shadow_root'
import type { EventListener, GeneralBackendElement } from '.'
import { BM, BackendMode } from './backend/mode'
import { DataValue, ModelBindingListener } from './data_proxy'

export type NativeNodeAttributeFilter = (
  // eslint-disable-next-line no-use-before-define
  elem: NativeNode,
  propName: string,
  propValue: any,
  callback: (res: any) => void,
) => void

export interface ExtendedNativeNodeDefinition {
  lifetimes?: {
    // eslint-disable-next-line no-use-before-define
    created?: (elem: NativeNode) => void
    listenerChange?: (
      isAdd: boolean,
      name: string,
      func: EventListener<unknown>,
      options: EventListenerOptions | undefined,
    ) => void
  }
  attributeFilters?: Record<string, NativeNodeAttributeFilter>
  eventListeners?: Record<
    string,
    {
      capture?: boolean
      // eslint-disable-next-line no-use-before-define
      handler?: (elem: NativeNode, event: any) => boolean | void
    }
  >
}

export class NativeNode extends Element {
  is: string
  public _$listenerChangeCb?: (
    isAdd: boolean,
    name: string,
    func: EventListener<unknown>,
    options: EventListenerOptions | undefined,
  ) => void
  private _$attributeFilters: Record<string, NativeNodeAttributeFilter>
  private _$modelBindingListeners?: { [name: string]: ModelBindingListener }

  constructor() {
    throw new Error('Element cannot be constructed directly')
    // eslint-disable-next-line no-unreachable
    super()
  }

  static create(
    tagName: string,
    owner: ShadowRoot,
    stylingName?: string,
    extendedDefinition?: ExtendedNativeNodeDefinition,
    placeholderHandler?: () => void,
  ): NativeNode {
    const node = Object.create(NativeNode.prototype) as NativeNode
    node.is = tagName
    node._$placeholderHandler = placeholderHandler
    node._$attributeFilters = {}
    let backendElement: GeneralBackendElement | null
    if (BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike)) {
      backendElement = (owner._$nodeTreeContext as domlikeBackend.Context).document.createElement(
        tagName,
      )
    } else if (BM.SHADOW || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Shadow)) {
      const backend = owner._$backendShadowRoot
      backendElement = backend?.createElement(tagName, stylingName ?? tagName) || null
    } else {
      const backend = owner._$nodeTreeContext as composedBackend.Context
      backendElement = backend.createElement(tagName, stylingName ?? tagName)
    }
    node._$initialize(false, backendElement, owner)
    node.classList = new ClassList(node, null)
    if (owner && backendElement) {
      const styleScope = owner.getHostNode()._$definition._$options.styleScope
      if (styleScope) {
        if (!(BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike))) {
          ;(backendElement as backend.Element | composedBackend.Element).setStyleScope(styleScope)
        }
      }
      if (globalOptions.writeExtraInfoToAttr) {
        const prefix = owner
          .getHostNode()
          ._$behavior.ownerSpace?.styleScopeManager.queryName(styleScope)
        if (prefix) {
          backendElement.setAttribute('exparser:info-class-prefix', `${prefix}--`)
        }
      }
    }
    if (!(BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike))) {
      if (backendElement) {
        ;(backendElement as backend.Element | composedBackend.Element).associateValue?.(node)
      }
    }

    if (extendedDefinition !== undefined) {
      if (extendedDefinition.attributeFilters !== undefined) {
        node._$attributeFilters = extendedDefinition.attributeFilters
      }
      const lifetimes = extendedDefinition.lifetimes || {}
      if (typeof lifetimes.listenerChange === 'function') {
        node._$listenerChangeCb = lifetimes.listenerChange
      }
      if (extendedDefinition.eventListeners !== undefined) {
        Object.keys(extendedDefinition.eventListeners).forEach((event) => {
          if (typeof extendedDefinition.eventListeners![event]!.handler === 'function') {
            const func = extendedDefinition.eventListeners![event]!.handler!
            node.addListener(event, (event) => func(node, event), {
              capture: extendedDefinition.eventListeners![event]!.capture,
            })
          }
        })
      }
      if (typeof lifetimes.created === 'function') {
        lifetimes.created.call(node, node)
      }
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

  setModelBindingListener(propName: string, listener: ModelBindingListener) {
    if (!this._$modelBindingListeners) {
      this._$modelBindingListeners = Object.create(null) as { [name: string]: ModelBindingListener }
    }
    if (!this._$modelBindingListeners[propName]) {
      const backendElement = this.getBackendElement()
      if (backendElement) {
        const listener = (value: DataValue) => {
          const listener = this._$modelBindingListeners?.[propName]
          if (listener) {
            listener.call(this, value)
          }
        }
        if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
          ;(this.getBackendContext() as domlikeBackend.Context).setModelBindingStat(
            backendElement as domlikeBackend.Element,
            propName,
            listener,
          )
        } else {
          ;(backendElement as backend.Element | composedBackend.Element).setModelBindingStat?.(
            propName,
            listener,
          )
        }
      }
    }
    this._$modelBindingListeners[propName] = listener
  }
}
