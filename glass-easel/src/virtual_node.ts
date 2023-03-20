import { Element } from './element'
import { ShadowRoot } from './shadow_root'
import { BM, BackendMode } from './backend/mode'
import { GeneralBackendContext, GeneralBackendElement } from '.'

export class VirtualNode extends Element {
  is: string

  constructor() {
    throw new Error('Element cannot be constructed directly')
    // eslint-disable-next-line no-unreachable
    super()
  }

  protected _$initializeVirtual(
    virtualName: string,
    owner: ShadowRoot | null,
    nodeTreeContext: GeneralBackendContext,
  ) {
    this.is = String(virtualName)
    let backendElement: GeneralBackendElement | null = null
    if (owner) {
      if (BM.SHADOW || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Shadow)) {
        const shadowRoot = owner._$backendShadowRoot
        backendElement = shadowRoot?.createVirtualNode() || null
        this._$initialize(true, backendElement, owner)
        backendElement?.associateValue?.(this)
      } else {
        this._$initialize(true, null, owner)
      }
    }
  }

  static create(virtualName: string, owner: ShadowRoot): VirtualNode {
    const node = Object.create(VirtualNode.prototype) as VirtualNode
    node._$initializeVirtual(virtualName, owner, owner._$nodeTreeContext)
    return node
  }
}
