import * as backend from './backend/backend_protocol'
import * as composedBackend from './backend/composed_backend_protocol'
import * as domlikeBackend from './backend/domlike_backend_protocol'
import { globalOptions } from './global_options'
import { ClassList } from './class_list'
import { Element } from './element'
import { ShadowRoot } from './shadow_root'
import { GeneralBackendElement } from '.'
import { BM, BackendMode } from './backend/mode'

export class NativeNode extends Element {
  is: string

  constructor() {
    throw new Error('Element cannot be constructed directly')
    // eslint-disable-next-line no-unreachable
    super()
  }

  static create(tagName: string, owner: ShadowRoot, stylingName?: string): NativeNode {
    const node = Object.create(NativeNode.prototype) as NativeNode
    node.is = tagName
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
        ;(backendElement as backend.Element | composedBackend.Element).associateValue(node)
      }
    }
    return node
  }
}
