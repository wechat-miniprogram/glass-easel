import {
  BM,
  BackendMode,
  type GeneralBackendElement,
  type backend,
  type composedBackend,
  type domlikeBackend,
} from './backend'
import { ClassList, StyleScopeManager } from './class_list'
import { type DataValue, type ModelBindingListener } from './data_proxy'
import { performanceMeasureEnd, performanceMeasureStart } from './dev_tools'
import { Element } from './element'
import { type EventListener } from './event'
import { ENV, globalOptions } from './global_options'
import { type ShadowRoot } from './shadow_root'
import { NATIVE_NODE_SYMBOL, isNativeNode } from './type_symbol'

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
  [NATIVE_NODE_SYMBOL]: true
  is: string
  public stylingName: string
  public _$listenerChangeCb?: (
    isAdd: boolean,
    name: string,
    func: EventListener<unknown>,
    options: EventListenerOptions | undefined,
  ) => void
  private _$attributeFilters: Record<string, NativeNodeAttributeFilter>
  /* @internal */
  private _$modelBindingListeners?: { [name: string]: ModelBindingListener }

  /* istanbul ignore next */
  constructor() {
    throw new Error('Element cannot be constructed directly')
    // eslint-disable-next-line no-unreachable
    super()
  }

  static isNativeNode = isNativeNode

  static create(
    tagName: string,
    owner: ShadowRoot,
    stylingName?: string,
    extendedDefinition?: ExtendedNativeNodeDefinition,
    placeholderHandlerRemover?: () => void,
  ): NativeNode {
    const node = Object.create(NativeNode.prototype) as NativeNode
    node.is = tagName
    node.stylingName = stylingName ?? tagName
    node._$placeholderHandlerRemover = placeholderHandlerRemover
    node._$attributeFilters = {}
    const nodeTreeContext = owner.getBackendContext()
    let backendElement: GeneralBackendElement | null = null
    if (nodeTreeContext) {
      if (ENV.DEV) performanceMeasureStart('backend.createElement')
      if (BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike)) {
        backendElement = (nodeTreeContext as domlikeBackend.Context).document.createElement(tagName)
      } else if (BM.SHADOW || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Shadow)) {
        backendElement = owner._$backendShadowRoot!.createElement(tagName, node.stylingName)
      } else {
        const backend = nodeTreeContext as composedBackend.Context
        backendElement = backend.createElement(tagName, node.stylingName)
      }
      if (ENV.DEV) performanceMeasureEnd()
    }
    node._$initialize(false, backendElement, owner, owner._$nodeTreeContext)
    const ownerHost = owner.getHostNode()
    const ownerComponentOptions = ownerHost.getComponentOptions()
    const styleScope = ownerComponentOptions.styleScope ?? StyleScopeManager.globalScope()
    const extraStyleScope = ownerComponentOptions.extraStyleScope ?? undefined
    const styleScopeManager = ownerHost._$behavior.ownerSpace.styleScopeManager
    node.classList = new ClassList(
      node,
      undefined,
      ownerHost.classList,
      styleScope,
      extraStyleScope,
      styleScopeManager,
    )
    if (backendElement) {
      if (BM.COMPOSED || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Composed)) {
        if (ENV.DEV) performanceMeasureStart('backend.setStyleScope')
        ;(backendElement as composedBackend.Element).setStyleScope(styleScope, extraStyleScope)
        if (ENV.DEV) performanceMeasureEnd()
      }
      if (globalOptions.writeExtraInfoToAttr) {
        const prefix = styleScopeManager.queryName(styleScope)
        if (prefix) {
          backendElement.setAttribute('exparser:info-class-prefix', `${prefix}--`)
        }
      }
      if (ENV.DEV) performanceMeasureStart('backend.associateValue')
      backendElement.__wxElement = node
      if (BM.SHADOW || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Shadow)) {
        ;(backendElement as backend.Element).associateValue(node)
      } else if (BM.COMPOSED || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Composed)) {
        // FIXME temp for skyline
        ;(backendElement as backend.Element | composedBackend.Element).associateValue?.(node)
      } else {
        ;(owner.getBackendContext() as domlikeBackend.Context).associateValue(
          backendElement as domlikeBackend.Element,
          node,
        )
      }
      if (ENV.DEV) performanceMeasureEnd()
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

  callAttributeFilter(
    propName: string,
    propValue: any,
    callback: (newName: any, newPropValue: any) => void,
  ) {
    const dashToCamelCase = (dash: string): string =>
      dash.replace(/-(.|$)/g, (s) => (s[1] ? s[1].toUpperCase() : ''))
    const camelCase = dashToCamelCase(propName)
    if (typeof this._$attributeFilters[camelCase] !== 'function') {
      callback(propName, propValue)
      return
    }
    this._$attributeFilters[camelCase]!(this, camelCase, propValue, (newPropValue) =>
      callback(camelCase, newPropValue),
    )
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
        if (ENV.DEV) performanceMeasureStart('backend.setModelBindingStat')
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
        if (ENV.DEV) performanceMeasureEnd()
      }
    }
    this._$modelBindingListeners[propName] = listener
  }

  getModelBindingListeners() {
    const listeners = Object.create(null) as { [name: string]: ModelBindingListener }
    if (this._$modelBindingListeners) {
      Object.keys(this._$modelBindingListeners).forEach((propName) => {
        const listener = (value: DataValue) => {
          const listener = this._$modelBindingListeners?.[propName]
          if (listener) {
            listener.call(this, value)
          }
        }
        listeners[propName] = listener
      })
    }
    return listeners
  }
}

NativeNode.prototype[NATIVE_NODE_SYMBOL] = true
