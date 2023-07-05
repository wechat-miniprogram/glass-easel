import * as backend from './backend/backend_protocol'
import * as composedBackend from './backend/composed_backend_protocol'
import * as domlikeBackend from './backend/domlike_backend_protocol'
import { ShadowRoot } from './shadow_root'
import { Element } from './element'
import { MutationObserverTarget } from './mutation_observer'
import { GeneralBackendElement, NodeCast } from './node'
import { BM, BackendMode } from './backend/mode'

export class TextNode implements NodeCast {
  _$backendElement: GeneralBackendElement | null
  private _$text: string
  ownerShadowRoot: ShadowRoot
  parentNode: Element | null
  parentIndex: number
  containingSlot: Element | null | undefined
  slotNodes: Node[] | undefined
  slotIndex: number | undefined
  /** @internal */
  _$slotElement: Element | null = null
  /** @internal */
  _$destroyOnDetach = false
  /** @internal */
  _$subtreeSlotStart: undefined
  /** @internal */
  _$subtreeSlotEnd: undefined
  /** @internal */
  _$inheritSlots: undefined
  /** @internal */
  _$virtual: undefined

  constructor(text: string, owner: ShadowRoot) {
    this._$text = String(text)
    let backendElement: GeneralBackendElement | null
    if (BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike)) {
      backendElement = (owner._$nodeTreeContext as domlikeBackend.Context).document.createTextNode(
        text,
      )
    } else if (BM.SHADOW || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Shadow)) {
      const backend = owner._$backendShadowRoot
      backendElement = backend?.createTextNode(text) || null
    } else {
      const backend = owner._$nodeTreeContext as composedBackend.Context
      backendElement = backend.createTextNode(text)
    }
    this._$backendElement = backendElement
    this.ownerShadowRoot = owner
    this.parentNode = null
    this.parentIndex = -1
    this.containingSlot = undefined
  }

  static create(text: string, ownerShadowRoot: ShadowRoot): TextNode {
    return new TextNode(text, ownerShadowRoot)
  }

  asTextNode(): TextNode {
    return this
  }

  // eslint-disable-next-line class-methods-use-this
  asElement(): null {
    return null
  }

  // eslint-disable-next-line class-methods-use-this
  asNativeNode(): null {
    return null
  }

  // eslint-disable-next-line class-methods-use-this
  asVirtualNode(): null {
    return null
  }

  // eslint-disable-next-line class-methods-use-this
  asInstanceOf(): null {
    return null
  }

  /** Destroy the backend element */
  destroyBackendElement() {
    if (this._$backendElement) {
      if (
        !(
          BM.DOMLIKE ||
          (BM.DYNAMIC && this.ownerShadowRoot.getBackendMode() === BackendMode.Domlike)
        )
      ) {
        ;(this._$backendElement as backend.Element | composedBackend.Element).release()
      }
      this._$backendElement = null
    }
  }

  /** Destroy the backend element on next detach */
  destroyBackendElementOnDetach() {
    this._$destroyOnDetach = true
  }

  /** Get the backend element */
  getBackendElement(): GeneralBackendElement | null {
    return this._$backendElement
  }

  /** Get composed parent (including virtual nodes) */
  getComposedParent(): Element | null {
    if (this.containingSlot !== undefined) return this.containingSlot
    let parent = this.parentNode
    while (parent?._$inheritSlots) {
      parent = parent.parentNode
    }
    return parent
  }

  get $$() {
    return this._$backendElement
  }

  get textContent() {
    return this._$text
  }

  set textContent(text: string) {
    this._$text = String(text)
    if (this._$backendElement) {
      if (
        BM.DOMLIKE ||
        (BM.DYNAMIC && this.ownerShadowRoot.getBackendMode() === BackendMode.Domlike)
      ) {
        ;(this._$backendElement as domlikeBackend.Element).textContent = this._$text
      } else {
        ;(this._$backendElement as backend.Element | composedBackend.Element).setText(this._$text)
      }
    }
    MutationObserverTarget.callTextObservers(this, {
      type: 'characterData',
      target: this,
    })
  }
}
