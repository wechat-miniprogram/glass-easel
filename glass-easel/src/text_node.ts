import {
  BM,
  BackendMode,
  type GeneralBackendContext,
  type GeneralBackendElement,
  type backend,
  type composedBackend,
  type domlikeBackend,
} from './backend'
import { type Element } from './element'
import { ENV } from './global_options'
import { performanceMeasureEnd, performanceMeasureStart } from './dev_tools'
import { MutationObserverTarget } from './mutation_observer'
import { type NodeCast } from './node'
import { type ShadowRoot } from './shadow_root'
import { TEXT_NODE_SYMBOL, isTextNode } from './type_symbol'

export class TextNode implements NodeCast {
  /* @internal */
  [TEXT_NODE_SYMBOL]!: true
  /* @internal */
  _$backendElement: GeneralBackendElement | null
  /* @internal */
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
  _$subtreeSlotStart = null
  /** @internal */
  _$subtreeSlotEnd = null
  /** @internal */
  _$inheritSlots: undefined
  /** @internal */
  _$virtual: undefined
  /** @internal */
  _$mutationObserverTarget: MutationObserverTarget | null = null

  constructor(text: string, owner: ShadowRoot) {
    this._$text = String(text)
    let backendElement: GeneralBackendElement | null = null
    const context = owner.getBackendContext()
    if (context) {
      if (ENV.DEV) performanceMeasureStart('backend.createTextNode')
      if (BM.DOMLIKE || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Domlike)) {
        backendElement = (context as domlikeBackend.Context).document.createTextNode(text)
      } else if (BM.SHADOW || (BM.DYNAMIC && owner.getBackendMode() === BackendMode.Shadow)) {
        const backend = owner._$backendShadowRoot!
        backendElement = backend.createTextNode(text)
      } else {
        const backend = context as composedBackend.Context
        backendElement = backend.createTextNode(text)
      }
    }
    if (ENV.DEV) performanceMeasureEnd()
    this._$backendElement = backendElement
    this.ownerShadowRoot = owner
    this.parentNode = null
    this.parentIndex = -1
    this.containingSlot = undefined
  }

  static isTextNode = isTextNode

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
  asGeneralComponent(): null {
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
        if (ENV.DEV) performanceMeasureStart('backend.release')
        ;(this._$backendElement as backend.Element | composedBackend.Element).release()
        if (ENV.DEV) performanceMeasureEnd()
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

  /** Get the backend context */
  getBackendContext(): GeneralBackendContext | null {
    return this.ownerShadowRoot.getBackendContext()
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
    const newText = String(text)
    if (newText === this._$text) return
    this._$text = newText
    if (this._$backendElement) {
      if (ENV.DEV) performanceMeasureStart('backend.setText')
      if (
        BM.DOMLIKE ||
        (BM.DYNAMIC && this.ownerShadowRoot.getBackendMode() === BackendMode.Domlike)
      ) {
        ;(this._$backendElement as domlikeBackend.Element).textContent = this._$text
      } else {
        ;(this._$backendElement as backend.Element | composedBackend.Element).setText(this._$text)
      }
      if (ENV.DEV) performanceMeasureEnd()
    }
    if (this._$mutationObserverTarget) {
      MutationObserverTarget.callTextObservers(this, {
        type: 'characterData',
        target: this,
      })
    }
  }
}

TextNode.prototype[TEXT_NODE_SYMBOL] = true
