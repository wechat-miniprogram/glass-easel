import { BM, BackendMode, type GeneralBackendContext } from './backend'
import { performanceMeasureEnd, performanceMeasureStart } from './dev_tools'
import { Element } from './element'
import { ENV } from './global_options'
import { type ShadowRoot } from './shadow_root'
import { VIRTUAL_NODE_SYMBOL, isVirtualNode } from './type_symbol'

export class VirtualNode extends Element {
  [VIRTUAL_NODE_SYMBOL]: true
  is: string

  /* @internal */
  /* istanbul ignore next */
  constructor() {
    throw new Error('Element cannot be constructed directly')
    // eslint-disable-next-line no-unreachable
    super()
  }

  /* @internal */
  protected _$initializeVirtual(
    virtualName: string,
    owner: ShadowRoot,
    nodeTreeContext: GeneralBackendContext | null,
  ) {
    this.is = String(virtualName)
    if (
      nodeTreeContext &&
      (BM.SHADOW || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Shadow))
    ) {
      const shadowRoot = owner._$backendShadowRoot!
      if (ENV.DEV) performanceMeasureStart('backend.createVirtualNode')
      const be = shadowRoot.createVirtualNode(virtualName)
      if (ENV.DEV) performanceMeasureEnd()
      this._$initialize(true, be, owner, nodeTreeContext)
      if (ENV.DEV) performanceMeasureStart('backend.associateValue')
      be.__wxElement = this
      be.associateValue(this)
      if (ENV.DEV) performanceMeasureEnd()
    } else {
      this._$initialize(true, null, owner, owner._$nodeTreeContext)
    }
  }

  static isVirtualNode = isVirtualNode

  /* @internal */
  static create(virtualName: string, owner: ShadowRoot): VirtualNode {
    const node = Object.create(VirtualNode.prototype) as VirtualNode
    node._$initializeVirtual(virtualName, owner, owner.getBackendContext())
    return node
  }
}

VirtualNode.prototype[VIRTUAL_NODE_SYMBOL] = true
