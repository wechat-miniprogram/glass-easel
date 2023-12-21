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
import { Element } from './element'
import { ENV, globalOptions } from './global_options'
import { performanceMeasureEnd, performanceMeasureStart } from './devtool'
import { type ShadowRoot } from './shadow_root'
import { NATIVE_NODE_SYMBOL, isNativeNode } from './type_symbol'

export class NativeNode extends Element {
  [NATIVE_NODE_SYMBOL]: true
  is: string
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
    placeholderHandlerRemover?: () => void,
  ): NativeNode {
    const node = Object.create(NativeNode.prototype) as NativeNode
    node.is = tagName
    node._$placeholderHandlerRemover = placeholderHandlerRemover
    const nodeTreeContext = owner._$nodeTreeContext
    let backendElement: GeneralBackendElement
    if (ENV.DEV) performanceMeasureStart('backend.createElement')
    if (BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike)) {
      backendElement = (nodeTreeContext as domlikeBackend.Context).document.createElement(tagName)
    } else if (BM.SHADOW || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Shadow)) {
      backendElement = owner._$backendShadowRoot!.createElement(tagName, stylingName ?? tagName)
    } else {
      const backend = nodeTreeContext as composedBackend.Context
      backendElement = backend.createElement(tagName, stylingName ?? tagName)
    }
    if (ENV.DEV) performanceMeasureEnd()
    node._$initialize(false, backendElement, owner, nodeTreeContext)
    const ownerHost = owner.getHostNode()
    const ownerComponentOptions = ownerHost.getComponentOptions()
    const styleScope = ownerComponentOptions.styleScope ?? StyleScopeManager.globalScope()
    const extraStyleScope = ownerComponentOptions.extraStyleScope ?? undefined
    const styleScopeManager = ownerHost._$behavior.ownerSpace.styleScopeManager
    node.classList = new ClassList(
      node,
      owner.getBackendMode(),
      null,
      ownerHost.classList,
      styleScope,
      extraStyleScope,
      styleScopeManager,
    )
    if (styleScope) {
      if (!(BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike))) {
        if (ENV.DEV) performanceMeasureStart('backend.setStyleScope')
        ;(backendElement as backend.Element | composedBackend.Element).setStyleScope(styleScope)
        if (ENV.DEV) performanceMeasureEnd()
      }
    }
    if (globalOptions.writeExtraInfoToAttr) {
      const prefix = styleScopeManager.queryName(styleScope)
      if (prefix) {
        backendElement.setAttribute('exparser:info-class-prefix', `${prefix}--`)
      }
    }
    if (ENV.DEV) performanceMeasureStart('backend.associateValue')
    if (!(BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike))) {
      ;(backendElement as backend.Element | composedBackend.Element).associateValue(node)
    } else {
      ;(owner._$nodeTreeContext as domlikeBackend.Context).associateValue(
        backendElement as domlikeBackend.Element,
        node,
      )
    }
    if (ENV.DEV) performanceMeasureEnd()
    return node
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
          ;(backendElement as backend.Element | composedBackend.Element).setModelBindingStat(
            propName,
            listener,
          )
        }
        if (ENV.DEV) performanceMeasureEnd()
      }
    }
    this._$modelBindingListeners[propName] = listener
  }
}

NativeNode.prototype[NATIVE_NODE_SYMBOL] = true
