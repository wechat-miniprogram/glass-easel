import {
  BM,
  BackendMode,
  type BoundingClientRect,
  type GeneralBackendContext,
  type GeneralBackendElement,
  type IntersectionStatus,
  type Observer,
  type ScrollOffset,
  type backend,
  type composedBackend,
  type domlikeBackend,
} from './backend'
import { type ClassList } from './class_list'
import { type ComponentDefinition } from './component'
import {
  type ComponentInstance,
  type DataList,
  type MethodList,
  type PropertyList,
} from './component_params'
import { performanceMeasureEnd, performanceMeasureStart } from './devtool'
import {
  Event,
  EventTarget,
  FinalChanged,
  MutLevel,
  type EventListener,
  type EventListenerOptions,
  type EventOptions,
} from './event'
import { type ExternalShadowRoot } from './external_shadow_tree'
import { ENV, globalOptions } from './global_options'
import { MutationObserverTarget, type MutationObserverChildEvent } from './mutation_observer'
import { type NativeNode } from './native_node'
import { type Node, type NodeCast } from './node'
import { RelationType } from './relation'
import { ParsedSelector } from './selector'
import { SlotMode, type ShadowRoot } from './shadow_root'
import {
  ELEMENT_SYMBOL,
  isComponent,
  isElement,
  isNativeNode,
  isShadowRoot,
  isVirtualNode,
} from './type_symbol'
import { type VirtualNode } from './virtual_node'

/**
 * The "style" attribute and class list segments
 *
 * This allows different modules set the "style" attribute or the class list of an element
 * without overriding each other.
 * The final value is the concat of all segments.
 * When calling `setNodeStyle` or `setNodeClass` on an element,
 * a segment can be specified.
 */
export const enum StyleSegmentIndex {
  /** The main style segment, generally managed by the template engine (or manually set) */
  MAIN = 0,
  /** The template style segment, preserved for template engine */
  TEMPLATE_EXTRA = 1,
  /** The animation style segment, preserved for temporary transition */
  ANIMATION_EXTRA = 2,
  /** The temporary style segment, preserved for high priority styles */
  TEMP_EXTRA = 3,
}

type composedContext = composedBackend.Context | domlikeBackend.Context
type composedElement = composedBackend.Element | domlikeBackend.Element

type DestroyedBackendContext = { mode: BackendMode; destroyed: true }
const DESTROYED_SHADOW_BACKEND_CONTEXT = { mode: BackendMode.Shadow, destroyed: true } as const
const DESTROYED_COMPOSED_BACKEND_CONTEXT = { mode: BackendMode.Composed, destroyed: true } as const
const DESTROYED_DOMLIKE_BACKEND_CONTEXT = { mode: BackendMode.Domlike, destroyed: true } as const

export type DoubleLinkedList<T> = {
  value: T
  prev: DoubleLinkedList<T> | null
  next: DoubleLinkedList<T> | null
}

/**
 * A general element
 *
 * An element can be a `NativeNode` , a `Component` , or a `VirtualNode` .
 */
export class Element implements NodeCast {
  [ELEMENT_SYMBOL]: true
  /** @internal */
  _$backendElement: GeneralBackendElement | null
  /** @internal */
  _$destroyOnDetach: boolean
  /** @internal */
  _$nodeTreeContext: GeneralBackendContext | DestroyedBackendContext
  /** @internal */
  private _$nodeId: string
  /** @internal */
  private _$nodeAttributes: { [name: string]: unknown } | null
  /** @internal */
  _$nodeSlot: string
  /** @internal */
  _$slotName: string | null
  /** @internal */
  _$slotElement: Element | null
  /** @internal */
  _$slotValues: { [name: string]: unknown } | null
  /** @internal */
  _$subtreeSlotStart: DoubleLinkedList<Element> | null
  /** @internal */
  _$subtreeSlotEnd: DoubleLinkedList<Element> | null
  /** @internal */
  _$inheritSlots: boolean
  /** @internal */
  _$placeholderHandlerRemover: (() => void) | undefined
  /** @internal */
  _$virtual: boolean
  dataset: { [name: string]: unknown }
  /** @internal */
  private _$marks: { [name: string]: unknown } | null
  /** @internal */
  private _$attached: boolean
  /** The `ClassList` of the element (will never change and must not be modified!) */
  classList: ClassList | null
  /** @internal */
  private _$styleSegments: string[]
  /** The parent element (must not be modified directly!) */
  parentNode: Element | null
  /** The child nodes (must not be modified directly!) */
  childNodes: Node[]
  /** The index in parentNode.childNodes (-1 if no parentNode) (must not be modified directly!) */
  parentIndex: number
  /** The parent slot element in composed tree (must not be modified directly!) */
  containingSlot: Element | null | undefined
  /** The slot content nodes composed tree (must not be modified directly!) */
  slotNodes: Node[] | undefined
  /** The index in containingSlot.slotNodes (must not be modified directly!) */
  slotIndex: number | undefined
  /** The shadow-root which owns the element (will never change and must not be modified!) */
  ownerShadowRoot: ShadowRoot | null
  /** @internal */
  _$mutationObserverTarget: MutationObserverTarget | null
  /** @internal */
  _$eventTarget: EventTarget<{ [name: string]: unknown }>

  /* istanbul ignore next */
  constructor() {
    throw new Error('Element cannot be constructed directly')
  }

  /* @internal */
  protected _$initialize(
    virtual: boolean,
    backendElement: GeneralBackendElement | null,
    owner: ShadowRoot | null,
    nodeTreeContext: GeneralBackendContext | DestroyedBackendContext,
  ) {
    this._$backendElement = backendElement
    this._$destroyOnDetach = false
    this._$nodeTreeContext = nodeTreeContext
    this._$nodeId = ''
    this._$nodeAttributes = null
    this._$nodeSlot = ''
    this._$slotName = null
    this._$slotElement = null
    this._$slotValues = null
    this._$subtreeSlotStart = null
    this._$subtreeSlotEnd = null
    this._$inheritSlots = false
    this._$placeholderHandlerRemover = undefined
    this._$virtual = virtual
    this.dataset = {}
    this._$marks = null
    this._$attached = false
    this.classList = null
    this._$styleSegments = [] as string[]
    this.parentNode = null
    this.parentIndex = -1
    this.childNodes = []
    this.slotNodes = undefined
    this.ownerShadowRoot = owner
    this._$mutationObserverTarget = null
    this._$eventTarget = new EventTarget()
  }

  get $$(): GeneralBackendElement | null {
    return this._$backendElement
  }

  get id(): string {
    return this._$nodeId
  }

  set id(x: unknown) {
    const newId = String(x)
    if (this._$nodeId === newId) return
    this._$nodeId = newId
    if (this.ownerShadowRoot) {
      const host = this.ownerShadowRoot.getHostNode()
      this.ownerShadowRoot._$markIdCacheDirty()
      if (host.getComponentOptions().writeIdToDOM) {
        const idPrefix = host._$idPrefix
        const val = idPrefix ? `${idPrefix}--${newId}` : newId
        const be = this._$backendElement
        if (be) {
          if (ENV.DEV) performanceMeasureStart('backend.setId')
          if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
            ;(be as domlikeBackend.Element).id = val
          } else {
            ;(be as backend.Element | composedBackend.Element).setId(val)
          }
          if (ENV.DEV) performanceMeasureEnd()
        }
      }
    }
    if (globalOptions.writeExtraInfoToAttr) {
      this._$backendElement?.setAttribute('exparser:info-attr-id', newId)
    }
    if (this._$mutationObserverTarget) {
      MutationObserverTarget.callAttrObservers(this, {
        type: 'properties',
        target: this,
        attributeName: 'id',
      })
    }
  }

  get slot(): string {
    return this._$nodeSlot
  }

  set slot(x) {
    const newSlot = String(x)
    const oldSlot = this._$nodeSlot
    if (oldSlot === newSlot) return
    /* istanbul ignore if  */
    if (this._$inheritSlots) {
      throw new Error('slots-inherited nodes do not support "slot" attribute.')
    }
    this._$nodeSlot = newSlot
    const slotParentShadowRoot = Element._$getParentHostShadowRoot(this.parentNode)
    if (slotParentShadowRoot) {
      const slotMode = slotParentShadowRoot.getSlotMode()

      /* istanbul ignore if  */
      if (slotMode === SlotMode.Dynamic) {
        throw new Error(
          'nodes inside dynamic slots should change binding slots through Element#setSlotElement.',
        )
      }

      /* istanbul ignore if  */
      if (slotMode === SlotMode.Direct) {
        throw new Error('nodes inside direct slots should not change slot name.')
      }

      const slotUpdater = Element._$updateSubtreeSlotNodes(
        this.parentNode!,
        [this],
        slotParentShadowRoot,
        slotParentShadowRoot,
        this.parentIndex,
      )
      slotUpdater?.removeSlotNodes()

      const oldSlot = this.containingSlot as Element | null

      slotUpdater?.updateContainingSlot()

      const newSlot = this.containingSlot as Element | null

      Element.insertChildReassign(this.parentNode!, this, oldSlot, newSlot, this.parentIndex + 1)

      slotUpdater?.insertSlotNodes()
    }
    if (this._$mutationObserverTarget) {
      MutationObserverTarget.callAttrObservers(this, {
        type: 'properties',
        target: this,
        attributeName: 'slot',
      })
    }
  }

  get attributes(): { name: string; value: unknown }[] {
    const ret: { name: string; value: unknown }[] = []
    if (this._$nodeAttributes) {
      Object.entries(this._$nodeAttributes).forEach(([name, value]) => {
        ret.push({
          name,
          value,
        })
      })
    }
    return ret
  }

  get class(): string {
    if (this.classList) {
      return this.classList.getClassNames(StyleSegmentIndex.MAIN)
    }
    return ''
  }

  set class(classNames: string) {
    this.setNodeClass(classNames, StyleSegmentIndex.MAIN)
  }

  get style(): string {
    return this._$styleSegments[StyleSegmentIndex.MAIN] || ''
  }

  set style(styleText) {
    this.setNodeStyle(styleText, StyleSegmentIndex.MAIN)
  }

  // eslint-disable-next-line class-methods-use-this
  asTextNode(): null {
    return null
  }

  asElement(): Element {
    return this
  }

  asNativeNode(): NativeNode | null {
    if (isNativeNode(this)) {
      return this
    }
    return null
  }

  asVirtualNode(): VirtualNode | null {
    if (isVirtualNode(this)) {
      return this
    }
    return null
  }

  static isElement = isElement

  asInstanceOf<UData extends DataList, UProperty extends PropertyList, UMethod extends MethodList>(
    componentDefinition: ComponentDefinition<UData, UProperty, UMethod>,
  ): ComponentInstance<UData, UProperty, UMethod> | null {
    if (isComponent(this)) {
      return this.asInstanceOf(componentDefinition)
    }
    return null
  }

  /** Get the backend context */
  getBackendContext(): GeneralBackendContext | null {
    const context = this._$nodeTreeContext
    if (BM.SHADOW) {
      if (context === DESTROYED_SHADOW_BACKEND_CONTEXT) return null
    } else if (BM.COMPOSED) {
      if (context === DESTROYED_COMPOSED_BACKEND_CONTEXT) return null
    } else if (BM.DOMLIKE) {
      if (context === DESTROYED_DOMLIKE_BACKEND_CONTEXT) return null
    } else {
      if (context === DESTROYED_SHADOW_BACKEND_CONTEXT) return null
      if (context === DESTROYED_COMPOSED_BACKEND_CONTEXT) return null
      if (context === DESTROYED_DOMLIKE_BACKEND_CONTEXT) return null
    }
    return context as GeneralBackendContext
  }

  /** Get the backend mode */
  getBackendMode(): BackendMode {
    return this._$nodeTreeContext.mode
  }

  /** Get the backend element */
  getBackendElement(): GeneralBackendElement | null {
    return this._$backendElement
  }

  /** Destroy the backend element */
  destroyBackendElement() {
    if (this._$backendElement) {
      if (!(BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike))) {
        if (ENV.DEV) performanceMeasureStart('backend.release')
        ;(this._$backendElement as backend.Element | composedBackend.Element).release()
        if (ENV.DEV) performanceMeasureEnd()
      }
      this._$backendElement = null
    }
    if (BM.COMPOSED || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Composed)) {
      this._$nodeTreeContext = DESTROYED_COMPOSED_BACKEND_CONTEXT
    } else if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
      this._$nodeTreeContext = DESTROYED_DOMLIKE_BACKEND_CONTEXT
    } else {
      this._$nodeTreeContext = DESTROYED_SHADOW_BACKEND_CONTEXT
    }
  }

  /** Destroy the backend element on next detach */
  destroyBackendElementOnDetach() {
    this._$destroyOnDetach = true
  }

  /** Cancel destroying backend element on detach */
  cancelDestroyBackendElementOnDetach() {
    this._$destroyOnDetach = false
  }

  /** Get whether the node is virtual or not */
  isVirtual(): boolean {
    return this._$virtual
  }

  /** Set the node class */
  setNodeClass(classNames: string | string[], index: StyleSegmentIndex = StyleSegmentIndex.MAIN) {
    if (ENV.DEV) performanceMeasureStart('backend.setClass')
    const changed = this.classList?.setClassNames(classNames, index)
    if (ENV.DEV) performanceMeasureEnd()
    if (changed && this._$mutationObserverTarget) {
      MutationObserverTarget.callAttrObservers(this, {
        type: 'properties',
        target: this,
        attributeName: 'class',
      })
    }
  }

  /** Toggle the node class */
  toggleNodeClass(
    classNames: string,
    force?: boolean,
    index: StyleSegmentIndex = StyleSegmentIndex.MAIN,
  ) {
    if (ENV.DEV) performanceMeasureStart('backend.setClass')
    const changed = this.classList?.toggle(classNames, force, index)
    if (ENV.DEV) performanceMeasureEnd()
    if (changed && this._$mutationObserverTarget) {
      MutationObserverTarget.callAttrObservers(this, {
        type: 'properties',
        target: this,
        attributeName: 'class',
      })
    }
  }

  /** Set the node style */
  setNodeStyle(styleSegment: string, index: StyleSegmentIndex = 0) {
    if (this._$styleSegments[index] === styleSegment) return
    this._$styleSegments[index] = styleSegment
    const style = this._$styleSegments.join(';')
    if (ENV.DEV) performanceMeasureStart('backend.setStyle')
    if (this._$backendElement) {
      if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
        ;(this._$backendElement as domlikeBackend.Element).setAttribute('style', style)
      } else {
        ;(this._$backendElement as backend.Element | composedBackend.Element).setStyle(style)
      }
    }
    if (ENV.DEV) performanceMeasureEnd()
    if (this._$mutationObserverTarget) {
      MutationObserverTarget.callAttrObservers(this, {
        type: 'properties',
        target: this,
        attributeName: 'style',
      })
    }
  }

  private static checkAndCallAttached(node: Node) {
    const callFunc = function callFunc(node: Node) {
      if (isElement(node) && !node._$attached) {
        node._$attached = true
        if (isComponent(node)) {
          node.triggerLifetime('attached', [])
          if (node._$relation) {
            node._$relation.triggerLinkEvent(RelationType.ParentNonVirtualNode, false)
            node._$relation.triggerLinkEvent(RelationType.ParentComponent, false)
            node._$relation.triggerLinkEvent(RelationType.Ancestor, false)
          }
          if (node._$mutationObserverTarget) {
            MutationObserverTarget.callAttachObservers(node, {
              type: 'attachStatus',
              target: node,
              status: 'attached',
            })
          }
          const shadowRoot = node.getShadowRoot()
          if (shadowRoot) callFunc(shadowRoot)
        }
        const childNodes = node.childNodes
        for (let i = 0; i < childNodes.length; i += 1) {
          callFunc(childNodes[i]!)
        }
      }
    }
    callFunc(node)
  }

  private static checkAndCallDetached(node: Node) {
    const destroyQueue: Node[] = []

    const callFunc = function callFunc(node: Node) {
      if (node._$destroyOnDetach) {
        // Destroy later to avoid missing backend elements
        destroyQueue.push(node)
      }
      if (isElement(node) && node._$attached) {
        if (isComponent(node)) {
          node.triggerLifetime('beforeDetach', [])
        }
        node.childNodes.forEach(callFunc)
        if (isComponent(node)) {
          const f = node._$placeholderHandlerRemover
          if (f) f()
          const shadowRoot = node.getShadowRoot()
          if (shadowRoot) callFunc(shadowRoot)
          node._$attached = false
          node.triggerLifetime('detached', [])
          if (node._$relation) {
            node._$relation.triggerLinkEvent(RelationType.ParentNonVirtualNode, true)
            node._$relation.triggerLinkEvent(RelationType.ParentComponent, true)
            node._$relation.triggerLinkEvent(RelationType.Ancestor, true)
          }
          if (node._$mutationObserverTarget) {
            MutationObserverTarget.callAttachObservers(node, {
              type: 'attachStatus',
              target: node,
              status: 'detached',
            })
          }
        } else {
          node._$attached = false
        }
      }
    }
    callFunc(node)

    for (let i = 0; i < destroyQueue.length; i += 1) {
      destroyQueue[i]!.destroyBackendElement()
    }
  }

  private static checkAndCallMoved(node: Node) {
    const callFunc = function callFunc(node: Node) {
      if (isElement(node) && node._$attached) {
        node.childNodes.forEach(callFunc)
        if (isComponent(node)) {
          const shadowRoot = node.getShadowRoot()
          if (shadowRoot) callFunc(shadowRoot)
          node.triggerLifetime('moved', [])
          if (node._$relation) {
            node._$relation.triggerLinkEvent(RelationType.ParentNonVirtualNode, false)
            node._$relation.triggerLinkEvent(RelationType.ParentComponent, false)
            node._$relation.triggerLinkEvent(RelationType.Ancestor, false)
          }
        }
      }
    }
    callFunc(node)
  }

  private static checkChildObservers(node: Element, type: 'add' | 'remove' | 'move', child: Node) {
    const observer = node._$mutationObserverTarget
    if (observer && (!observer.childObservers?.empty || observer.hasSubtreeListeners())) {
      const childList = [child]
      let childEventObj: MutationObserverChildEvent
      if (type === 'add') {
        childEventObj = {
          type: 'childList',
          target: node,
          addedNodes: childList,
        }
      } else if (type === 'remove') {
        childEventObj = {
          type: 'childList',
          target: node,
          removedNodes: childList,
        }
      } else {
        childEventObj = {
          type: 'childList',
          target: node,
          addedNodes: childList,
          removedNodes: childList,
        }
      }
      MutationObserverTarget.callChildObservers(node, childEventObj)
    }
  }

  /**
   * Get whether a node has any subtree `MutationObserver` attached to it
   *
   * If there is, then tree update may have more performance impact.
   */
  static hasSubtreeMutationObservers(node: Element): boolean {
    return node._$mutationObserverTarget?.hasSubtreeListeners() || false
  }

  /** @internal */
  static _$insertChildReassignSlot(
    shadowRoot: ShadowRoot,
    name: string | null,
    oldSlot: Element | null,
    newSlot: Element | null,
  ) {
    if (!oldSlot) {
      const slotNodes: Node[] = []

      shadowRoot.forEachNodeInSpecifiedSlot(null, (node) => {
        if (name !== null) {
          const slotName = isElement(node) ? node._$nodeSlot : ''
          if (slotName !== name) {
            return
          }
        }
        slotNodes.push(node)
      })

      for (let i = 0; i < slotNodes.length; i += 1) {
        const node = slotNodes[i]!
        Element._$spliceSlotNodes(newSlot!, -1, 0, [node])
        Element._$updateContainingSlot(node, newSlot)
        if (!node._$inheritSlots)
          Element.insertChildReassign(node.parentNode!, node, null, newSlot, node.parentIndex)
      }
    } else if (!newSlot) {
      const slotNodes = [...oldSlot.slotNodes!]

      for (let i = 0; i < slotNodes.length; i += 1) {
        const node = slotNodes[i]!
        Element._$spliceSlotNodes(oldSlot, 0, 1, undefined)
        Element._$updateContainingSlot(node, newSlot)
        if (!node._$inheritSlots)
          Element.insertChildReassign(node.parentNode!, node, oldSlot, null, node.parentIndex)
      }
    } else {
      const slotNodes = [...oldSlot.slotNodes!]

      for (let i = 0; i < slotNodes.length; i += 1) {
        const node = slotNodes[i]!
        Element._$spliceSlotNodes(oldSlot, 0, 1, undefined)
        Element._$spliceSlotNodes(newSlot, -1, 0, [node])
        Element._$updateContainingSlot(node, newSlot)
        if (!node._$inheritSlots)
          Element.insertChildReassign(node.parentNode!, node, oldSlot, newSlot, node.parentIndex)
      }
    }
  }

  static insertChildReassign(
    shadowParent: Element,
    child: Node,
    oldSlot: Element | null,
    newSlot: Element | null,
    ideaPosIndex: number,
  ) {
    if (BM.SHADOW || (BM.DYNAMIC && shadowParent.getBackendMode() === BackendMode.Shadow)) {
      if (ENV.DEV) performanceMeasureStart('backend.reassignContainingSlot')
      ;(child._$backendElement as backend.Element).reassignContainingSlot(
        oldSlot ? (oldSlot._$backendElement as backend.Element) : null,
        newSlot ? (newSlot._$backendElement as backend.Element) : null,
      )
      if (ENV.DEV) performanceMeasureEnd()
      return
    }
    if (oldSlot) {
      if (
        newSlot &&
        (BM.DOMLIKE || (BM.DYNAMIC && shadowParent.getBackendMode() === BackendMode.Domlike))
      ) {
        // removal of in-tree elements are not needed for DOM backend
        // do nothing
      } else {
        const backendParent = Element.findNearestNonVirtual(oldSlot)
        if (backendParent) {
          const d = Element.countNonVirtual(child)
          if (d) {
            const [before, removeCount] = d
            if (
              BM.DOMLIKE ||
              (BM.DYNAMIC && shadowParent.getBackendMode() === BackendMode.Domlike)
            ) {
              const rel = before._$backendElement as domlikeBackend.Element
              for (let i = 1; i < removeCount; i += 1) {
                const next = rel.nextSibling
                if (next) {
                  if (ENV.DEV) performanceMeasureStart('backend.removeChild')
                  ;(backendParent as domlikeBackend.Element).removeChild(next)
                  if (ENV.DEV) performanceMeasureEnd()
                }
              }
              if (removeCount > 0) {
                if (ENV.DEV) performanceMeasureStart('backend.removeChild')
                ;(backendParent as domlikeBackend.Element).removeChild(rel)
                if (ENV.DEV) performanceMeasureEnd()
              }
            } else {
              if (ENV.DEV) performanceMeasureStart('backend.spliceRemove')
              ;(backendParent as composedBackend.Element).spliceRemove(
                before._$backendElement as composedBackend.Element,
                removeCount,
              )
              if (ENV.DEV) performanceMeasureEnd()
            }
          }
        }
      }
    }
    if (newSlot) {
      Element.insertChildComposed(shadowParent, child, undefined, false, ideaPosIndex)
    }
  }

  // a helper for searching the nearest non-virtual ancestor
  private static findNearestNonVirtual(p: Element): composedElement | null {
    let cur: Element | null = p
    for (; cur?._$virtual; ) {
      if (isShadowRoot(cur)) {
        cur = cur.getHostNode()
        continue
      }
      if (cur.containingSlot !== undefined) {
        cur = cur.containingSlot
        continue
      }
      cur = cur.parentNode
    }
    return cur ? (cur._$backendElement as composedElement) : null
  }

  private static countNonVirtual(target: Node): [Node, number] | null {
    let firstNode = null
    let removeCount = 0

    const recNonVirtual = (c: Node) => {
      if (removeCount === 0) firstNode = c
      removeCount += 1
    }

    const rec = (c: Node) => {
      if (isElement(c) && c._$virtual) {
        c.forEachNonVirtualComposedChild(recNonVirtual)
        return
      }
      recNonVirtual(c)
    }
    rec(target)
    return firstNode ? [firstNode, removeCount] : null
  }

  /**
   * Iterate elements with their slots (slots-inherited nodes included)
   */
  static forEachNodeInSlot(
    node: Node,
    f: (node: Node, slot: Element | null | undefined) => boolean | void,
  ): boolean {
    const rec = (child: Node): boolean => {
      if (f(child, child.containingSlot) === false) return false
      if (child._$inheritSlots) {
        const childNodes = child.childNodes
        for (let i = 0; i < childNodes.length; i += 1) {
          if (!rec(childNodes[i]!)) return false
        }
        return true
      }
      return true
    }

    return rec(node)
  }

  /**
   * Iterate elements in specified slot (slots-inherited nodes included)
   */
  static forEachNodeInSpecificSlot(
    node: Node,
    slot: Element | undefined | null,
    f: (node: Node) => boolean | void,
  ): boolean {
    const rec = (child: Node): boolean => {
      if (child.containingSlot === slot) {
        if (f(child) === false) return false
      }
      if (child._$inheritSlots) {
        const childNodes = child.childNodes
        for (let i = 0; i < childNodes.length; i += 1) {
          if (!rec(childNodes[i]!)) return false
        }
        return true
      }
      return true
    }

    return rec(node)
  }

  /**
   * Iterate elements with their slots (slots-inherited nodes NOT included)
   */
  static forEachSlotContentInSlot(
    node: Node,
    f: (node: Node, slot: Element | null | undefined) => boolean | void,
  ): boolean {
    const rec = (child: Node): boolean => {
      if (child._$inheritSlots) {
        const childNodes = child.childNodes
        for (let i = 0; i < childNodes.length; i += 1) {
          if (!rec(childNodes[i]!)) return false
        }
        return true
      }
      if (f(child, child.containingSlot) === false) return false
      return true
    }

    return rec(node)
  }

  /**
   * Iterate elements in specified slot (slots-inherited nodes NOT included)
   */
  static forEachSlotContentInSpecificSlot(
    node: Node,
    slot: Element | undefined | null,
    f: (node: Node) => boolean | void,
  ): boolean {
    const rec = (child: Node): boolean => {
      if (child._$inheritSlots) {
        const childNodes = child.childNodes
        for (let i = 0; i < childNodes.length; i += 1) {
          if (!rec(childNodes[i]!)) return false
        }
        return true
      }
      if (child.containingSlot !== slot) return true
      return f(child) !== false
    }

    return rec(node)
  }

  /**
   * @internal
   * a helper for searching the first non-virtual node
   */
  private static _$findFirstNonVirtualChild(parent: Element, index: number): Node | null {
    const inSlot = parent._$slotName !== null
    const children = inSlot ? parent.slotNodes! : parent.childNodes
    if (index >= 0 && index < children.length) {
      for (let i = index; i < children.length; i += 1) {
        let ret: Node | null = null

        const recNonVirtual = (c: Node): boolean => {
          ret = c
          return false
        }

        const rec = (c: Node): boolean => {
          if (!inSlot && c._$inheritSlots) {
            const childNodes = c.childNodes
            for (let i = 0; i < childNodes.length; i += 1) {
              if (rec(childNodes[i]!) === false) return false
            }
          }
          if (c._$virtual) {
            return c.forEachNonVirtualComposedChild(recNonVirtual)
          }
          return recNonVirtual(c)
        }
        rec(children[i]!)
        if (ret) return ret
      }
    }
    const recvParent = (parent: Element): Node | null => {
      if (!parent._$virtual) return null
      const containingSlot = parent.containingSlot
      if (containingSlot === null) return null
      if (containingSlot !== undefined) {
        return Element._$findFirstNonVirtualChild(containingSlot, parent.slotIndex! + 1)
      }
      if (isShadowRoot(parent)) {
        return recvParent(parent.getHostNode())
      }
      const p = parent.parentNode
      if (p) {
        return Element._$findFirstNonVirtualChild(p, parent.parentIndex + 1)
      }
      return null
    }
    return recvParent(parent)
  }

  /**
   * @internal
   * A helper to find first non-virtual next sibling node
   * return null if no next sibling exists
   */
  private static _$findFirstNonVirtualSibling(element: Node, newPosIndex: number): Node | null {
    const containingSlot = element.containingSlot
    if (containingSlot === null) return null
    if (containingSlot !== undefined) {
      if (!containingSlot._$virtual) return null
      if (element.slotIndex !== undefined) {
        return Element._$findFirstNonVirtualChild(containingSlot, element.slotIndex + 1)
      }
      const insertPos = Element._$findSlotNodeInsertPosition(containingSlot, element, newPosIndex)
      return Element._$findFirstNonVirtualChild(containingSlot, insertPos)
    }
    let cur: Node = element
    if (isShadowRoot(element)) {
      cur = element.getHostNode()
      if (!cur._$virtual) return null
      return Element._$findFirstNonVirtualChild(cur, cur.parentIndex + 1)
    }
    const p = cur.parentNode
    if (p) {
      return Element._$findFirstNonVirtualChild(p, newPosIndex)
    }
    return null
  }

  private static insertChildComposed(
    shadowParent: Element,
    newChild: Node | null,
    relChild: Node | undefined,
    removal: boolean,
    newPosIndex: number, // only valid when newChild is provided (for searching position)
  ) {
    let parentConverted = false
    let cur: Element | null = shadowParent
    while (cur?._$inheritSlots) {
      parentConverted = true
      cur = cur.parentNode
    }
    if (!cur) return
    const slotParent = cur
    const context = slotParent._$nodeTreeContext as composedContext | null
    if (!context) return

    // detect whether it is in single-slot mode
    let sharedNonVirtualParent: composedElement | null | undefined
    if (isComponent(slotParent)) {
      if (slotParent._$external) {
        sharedNonVirtualParent = (slotParent.shadowRoot as ExternalShadowRoot)
          .slot as composedElement
      } else {
        parentConverted = true
      }
    } else {
      if (slotParent._$virtual) parentConverted = true
      sharedNonVirtualParent = Element.findNearestNonVirtual(slotParent)
    }

    // a helper for grouping and slicing update
    let sharedFrag: composedElement | null = null
    const groupUpdate = (
      sharedBackendParent: composedElement | null,
      slot: Element | null | undefined,
    ) => {
      const backendParent =
        sharedBackendParent || (slot ? Element.findNearestNonVirtual(slot) : null)

      if (!(BM.DOMLIKE || (BM.DYNAMIC && shadowParent.getBackendMode() === BackendMode.Domlike))) {
        if (!backendParent) {
          return
        }
      }
      let removeCount = 0
      let before: Node | null = null

      // get the new child nodes of the backend
      let frag: composedElement | null = null
      let firstSlotNode: Node | null = null
      if (newChild) {
        const f =
          sharedFrag ||
          (BM.DOMLIKE || (BM.DYNAMIC && context.mode === BackendMode.Domlike)
            ? (context as domlikeBackend.Context).document.createDocumentFragment()
            : (context as composedBackend.Context).createFragment())
        sharedFrag = f

        const recNonVirtual = (c: Node) => {
          if (ENV.DEV) performanceMeasureStart('backend.appendChild')
          ;(f as composedBackend.Element).appendChild(c._$backendElement as composedBackend.Element)
          if (ENV.DEV) performanceMeasureEnd()
          frag = f
        }

        Element.forEachNodeInSpecificSlot(newChild, slot, (node) => {
          if (!firstSlotNode) firstSlotNode = node
          if (!node._$virtual) {
            recNonVirtual(node)
            return
          }
          node.forEachNonVirtualComposedChild(recNonVirtual)
        })
      }
      if (BM.DOMLIKE || (BM.DYNAMIC && shadowParent.getBackendMode() === BackendMode.Domlike)) {
        if (!backendParent) {
          sharedFrag = null
          return
        }
      }

      // get the proper relative node of the backend
      if (relChild || parentConverted) {
        if (removal && relChild) {
          Element.forEachSlotContentInSpecificSlot(relChild, slot, (c) => {
            if (isElement(c)) {
              const d = Element.countNonVirtual(c)
              if (d) {
                if (!before) before = d[0]
                removeCount += d[1]
              }
            } else {
              if (!before) before = c
              removeCount += 1
            }
            return true
          })
          if (removeCount === 0 && frag && firstSlotNode) {
            before = Element._$findFirstNonVirtualSibling(
              slot === undefined ? newChild! : firstSlotNode,
              newPosIndex + 1,
            )
          }
        } else if (frag && firstSlotNode) {
          before = Element._$findFirstNonVirtualSibling(
            slot === undefined ? newChild! : firstSlotNode,
            newPosIndex,
          )
        }
      }

      // actually do the backend operation
      if (frag) {
        if (before) {
          if (BM.DOMLIKE || (BM.DYNAMIC && context.mode === BackendMode.Domlike)) {
            const rel = before._$backendElement as domlikeBackend.Element
            if (ENV.DEV) performanceMeasureStart('backend.insertBefore')
            ;(backendParent as domlikeBackend.Element).insertBefore(
              frag as domlikeBackend.Element,
              rel,
            )
            if (ENV.DEV) performanceMeasureEnd()
            for (let i = 1; i < removeCount; i += 1) {
              const next = rel.nextSibling
              if (next) {
                if (ENV.DEV) performanceMeasureStart('backend.removeChild')
                ;(backendParent as domlikeBackend.Element).removeChild(next)
                if (ENV.DEV) performanceMeasureEnd()
              }
            }
            if (removeCount > 0) {
              if (ENV.DEV) performanceMeasureStart('backend.removeChild')
              ;(backendParent as domlikeBackend.Element).removeChild(rel)
              if (ENV.DEV) performanceMeasureEnd()
            }
          } else {
            if (ENV.DEV) performanceMeasureStart('backend.spliceBefore')
            ;(backendParent as composedBackend.Element).spliceBefore(
              before._$backendElement as composedBackend.Element,
              removeCount,
              frag as composedBackend.Element,
            )
            if (ENV.DEV) performanceMeasureEnd()
          }
        } else {
          if (BM.DOMLIKE || (BM.DYNAMIC && context.mode === BackendMode.Domlike)) {
            if (ENV.DEV) performanceMeasureStart('backend.appendChild')
            ;(backendParent as domlikeBackend.Element).appendChild(frag as domlikeBackend.Element)
            if (ENV.DEV) performanceMeasureEnd()
          } else {
            if (ENV.DEV) performanceMeasureStart('backend.spliceAppend')
            ;(backendParent as composedBackend.Element).spliceAppend(
              frag as composedBackend.Element,
            )
            if (ENV.DEV) performanceMeasureEnd()
          }
        }
      } else if (removeCount > 0) {
        if (BM.DOMLIKE || (BM.DYNAMIC && context.mode === BackendMode.Domlike)) {
          const rel = before!._$backendElement as domlikeBackend.Element
          for (let i = 1; i < removeCount; i += 1) {
            const next = rel.nextSibling
            if (next) {
              if (ENV.DEV) performanceMeasureStart('backend.removeChild')
              ;(backendParent as domlikeBackend.Element).removeChild(next)
              if (ENV.DEV) performanceMeasureEnd()
            }
          }
          if (removeCount > 0) {
            if (ENV.DEV) performanceMeasureStart('backend.removeChild')
            ;(backendParent as domlikeBackend.Element).removeChild(rel)
            if (ENV.DEV) performanceMeasureEnd()
          }
        } else {
          if (ENV.DEV) performanceMeasureStart('backend.spliceRemove')
          ;(backendParent as composedBackend.Element).spliceRemove(
            before!._$backendElement as composedBackend.Element,
            removeCount,
          )
          if (ENV.DEV) performanceMeasureEnd()
        }
      }
    }

    // in single-slot mode, use a simpler update logic; otherwise use a slower one
    if (sharedNonVirtualParent !== undefined) {
      if (sharedNonVirtualParent === null) {
        // for nodes with no valid non-virtual parent, do nothing
      } else if (
        !parentConverted &&
        (!isElement(newChild) || !newChild._$virtual) &&
        (!isElement(relChild) || !relChild._$virtual)
      ) {
        // for non-virtual children, use single child operation
        if (removal) {
          if (newChild) {
            if (ENV.DEV) performanceMeasureStart('backend.replaceChild')
            ;(sharedNonVirtualParent as composedBackend.Element).replaceChild(
              newChild._$backendElement as composedBackend.Element,
              relChild!._$backendElement as composedBackend.Element,
            )
            if (ENV.DEV) performanceMeasureEnd()
          } else {
            if (ENV.DEV) performanceMeasureStart('backend.removeChild')
            ;(sharedNonVirtualParent as composedBackend.Element).removeChild(
              relChild!._$backendElement as composedBackend.Element,
            )
            if (ENV.DEV) performanceMeasureEnd()
          }
        } else if (relChild) {
          if (ENV.DEV) performanceMeasureStart('backend.insertBefore')
          ;(sharedNonVirtualParent as composedBackend.Element).insertBefore(
            newChild!._$backendElement as composedBackend.Element,
            relChild._$backendElement as composedBackend.Element,
          )
          if (ENV.DEV) performanceMeasureEnd()
        } else {
          if (ENV.DEV) performanceMeasureStart('backend.appendChild')
          ;(sharedNonVirtualParent as composedBackend.Element).appendChild(
            newChild!._$backendElement as composedBackend.Element,
          )
          if (ENV.DEV) performanceMeasureEnd()
        }
      } else {
        // for node isn't a slot content, simply update
        groupUpdate(sharedNonVirtualParent, undefined)
      }
    } else if (
      !((newChild && newChild._$inheritSlots) || (removal && relChild && relChild._$inheritSlots))
    ) {
      // faster update if none inherited slots
      if (newChild) groupUpdate(null, newChild.containingSlot)
      if (
        removal &&
        relChild &&
        (!newChild || relChild.containingSlot !== newChild.containingSlot)
      ) {
        groupUpdate(null, relChild.containingSlot)
      }
    } else {
      // for multi-slots, find out each slot that needs update, and update them one by one
      const slotNodesSet = new Set<Element | null>()
      if (removal && relChild) {
        Element.forEachSlotContentInSlot(relChild, (node, slot) => {
          slotNodesSet.add(slot!)
        })
      }
      if (newChild) {
        Element.forEachSlotContentInSlot(newChild, (node, slot) => {
          slotNodesSet.add(slot!)
        })
      }
      slotNodesSet.forEach((slot) => groupUpdate(null, slot))
    }
    if (!(BM.DOMLIKE || (BM.DYNAMIC && context.mode === BackendMode.Domlike))) {
      if (sharedFrag) {
        if (ENV.DEV) performanceMeasureStart('backend.release')
        ;(sharedFrag as composedBackend.Element).release()
        if (ENV.DEV) performanceMeasureEnd()
      }
    }

    // write extra info if needed
    if (globalOptions.writeExtraInfoToAttr) {
      if (removal && isElement(relChild)) {
        relChild._$backendElement?.removeAttribute('exparser:info-in-slot-of')
      }
      if (isElement(newChild)) {
        if (isComponent(shadowParent)) {
          newChild._$backendElement?.setAttribute(
            'exparser:info-in-slot-of',
            shadowParent._$componentInstanceId,
          )
        } else {
          newChild._$backendElement?.removeAttribute('exparser:info-in-slot-of')
        }
      }
    }
  }

  /**
   * @internal
   * @param move whether this insertion is a slot movement
   */
  private static _$updateSubtreeSlotsInsertion(
    node: Node,
    slotStart: DoubleLinkedList<Element> | null,
    slotEnd: DoubleLinkedList<Element> | null,
    posIndex: number,
    move: boolean,
  ): void {
    if (!slotStart || !slotEnd) return
    let parent = node

    // find a correct position to insert slot into double-linked slot list
    let insertSlotPrev = null as DoubleLinkedList<Element> | null
    let insertSlotNext = null as DoubleLinkedList<Element> | null

    const findFirstSlot = (parent: Node, posIndex: number): void => {
      if (parent._$subtreeSlotStart) {
        const childNodes = parent.childNodes
        let index = posIndex + 1
        let nextSiblingWithSlot = childNodes[index]
        while (nextSiblingWithSlot && !nextSiblingWithSlot._$subtreeSlotStart) {
          index += 1
          nextSiblingWithSlot = childNodes[index]
        }

        if (nextSiblingWithSlot) {
          insertSlotNext = nextSiblingWithSlot._$subtreeSlotStart!
          insertSlotPrev = insertSlotNext.prev
        } else {
          insertSlotPrev = parent._$subtreeSlotEnd
          if (insertSlotPrev) insertSlotNext = insertSlotPrev.next
        }
        return
      }
      let cur = parent
      let parentWithSubtreeSlot = parent.parentNode
      while (parentWithSubtreeSlot && !parentWithSubtreeSlot._$subtreeSlotStart) {
        cur = parentWithSubtreeSlot
        parentWithSubtreeSlot = parentWithSubtreeSlot.parentNode
      }
      if (parentWithSubtreeSlot) {
        findFirstSlot(parentWithSubtreeSlot, cur.parentIndex)
      }
    }

    findFirstSlot(parent, posIndex)

    // insert into double linked list
    if (insertSlotPrev) {
      insertSlotPrev.next = slotStart
      slotStart.prev = insertSlotPrev
    }
    if (insertSlotNext) {
      insertSlotNext.prev = slotEnd
      slotEnd.next = insertSlotNext
    }

    // update ancestor's subtree slot start/end
    while (parent) {
      let changed = false

      if (!parent._$subtreeSlotStart) {
        parent._$subtreeSlotStart = slotStart
        parent._$subtreeSlotEnd = slotEnd
        changed = true
      } else if (parent._$subtreeSlotStart === insertSlotNext) {
        parent._$subtreeSlotStart = slotStart
        changed = true
      } else if (parent._$subtreeSlotEnd === insertSlotPrev) {
        parent._$subtreeSlotEnd = slotEnd
        changed = true
      }

      if (!changed || !parent.parentNode) break

      parent = parent.parentNode
    }

    const ownerShadowRoot = parent.ownerShadowRoot
    if (ownerShadowRoot?.isConnected(parent)) {
      ownerShadowRoot._$applySlotsInsertion(slotStart, slotEnd, move)
    }
  }

  /**
   * @internal
   * @param move whether this removal is a slot movement, will fire an insertion (with move=true) after
   */
  private static _$updateSubtreeSlotsRemoval(
    node: Node,
    slotStart: DoubleLinkedList<Element> | null,
    slotEnd: DoubleLinkedList<Element> | null,
    move: boolean,
  ): void {
    if (!slotStart || !slotEnd) return
    let parent = node
    const removeSlotBefore = slotStart.prev
    const removeSlotAfter = slotEnd.next

    // remove from double linked list
    if (removeSlotBefore) {
      removeSlotBefore.next = removeSlotAfter
      slotStart.prev = null
    }
    if (removeSlotAfter) {
      removeSlotAfter.prev = removeSlotBefore
      slotEnd.next = null
    }

    // update parent subtree start/end
    while (parent) {
      let changed = false

      if (parent._$subtreeSlotStart === slotStart && parent._$subtreeSlotEnd === slotEnd) {
        parent._$subtreeSlotStart = parent._$subtreeSlotEnd = null
        changed = true
      }
      if (parent._$subtreeSlotStart === slotStart) {
        parent._$subtreeSlotStart = removeSlotAfter
        changed = true
      } else if (parent._$subtreeSlotEnd === slotEnd) {
        parent._$subtreeSlotEnd = removeSlotBefore
        changed = true
      }

      if (!changed || !parent.parentNode) break

      parent = parent.parentNode
    }

    const ownerShadowRoot = parent.ownerShadowRoot
    if (ownerShadowRoot?.isConnected(parent)) {
      ownerShadowRoot._$applySlotsRemoval(slotStart, slotEnd, move)
    }
  }

  /**
   * @internal
   * @param move whether this removal is a slot movement, will fire an insertion (with move=true) after
   */
  private static _$updateSubtreeSlotsReplacement(
    node: Node,
    slotStart: DoubleLinkedList<Element> | null,
    slotEnd: DoubleLinkedList<Element> | null,
    oldSlotStart: DoubleLinkedList<Element> | null,
    oldSlotEnd: DoubleLinkedList<Element> | null,
    posIndex: number,
    move: boolean,
  ): void {
    if (!slotStart || !slotEnd) {
      Element._$updateSubtreeSlotsRemoval(node, oldSlotStart, oldSlotEnd, move)
      return
    }
    if (!oldSlotStart || !oldSlotEnd) {
      Element._$updateSubtreeSlotsInsertion(node, slotStart, slotEnd, posIndex, move)
      return
    }
    let parent = node

    const removeSlotBefore = oldSlotStart.prev
    const removeSlotAfter = oldSlotEnd.next

    // replace in double linked list
    if (removeSlotBefore) {
      removeSlotBefore.next = slotStart
      slotStart.prev = removeSlotBefore
      oldSlotStart.prev = null
    }
    if (removeSlotAfter) {
      removeSlotAfter.prev = slotEnd
      slotEnd.next = removeSlotAfter
      oldSlotEnd.next = null
    }

    // update parent subtree start/end
    while (parent) {
      let changed = false

      if (parent._$subtreeSlotStart === oldSlotStart) {
        parent._$subtreeSlotStart = slotStart
        changed = true
      }
      if (parent._$subtreeSlotEnd === oldSlotEnd) {
        parent._$subtreeSlotEnd = slotEnd
        changed = true
      }

      if (!changed || !parent.parentNode) break

      parent = parent.parentNode
    }

    const ownerShadowRoot = parent.ownerShadowRoot
    if (ownerShadowRoot?.isConnected(parent)) {
      ownerShadowRoot._$applySlotsRemoval(oldSlotStart, oldSlotEnd, false)
      ownerShadowRoot._$applySlotsInsertion(slotStart, slotEnd, move)
    }
  }

  /** @internal */
  private static _$getParentHostShadowRoot = (parent: Element | null): ShadowRoot | null => {
    let parentSlotHost: Element | null = parent
    while (parentSlotHost?._$inheritSlots) parentSlotHost = parentSlotHost.parentNode
    return isComponent(parentSlotHost) && !parentSlotHost._$external
      ? (parentSlotHost.shadowRoot as ShadowRoot)
      : null
  }

  /** @internal */
  private static _$updateSubtreeSlotNodes(
    parentNode: Element,
    elements: Node[],
    shadowRoot: ShadowRoot | null,
    oldShadowRoot: ShadowRoot | null,
    posIndex: number,
  ):
    | { updateContainingSlot: () => void; removeSlotNodes: () => void; insertSlotNodes: () => void }
    | undefined {
    if (!shadowRoot && !oldShadowRoot) return undefined

    const slotMode = shadowRoot?.getSlotMode()
    const oldSlotMode = oldShadowRoot?.getSlotMode()

    if (
      (slotMode === undefined || slotMode === SlotMode.Direct) &&
      (oldSlotMode === undefined || oldSlotMode === SlotMode.Direct)
    ) {
      return undefined
    }

    if (
      (slotMode === undefined || slotMode === SlotMode.Single) &&
      (oldSlotMode === undefined || oldSlotMode === SlotMode.Single)
    ) {
      let removeStart = -1
      let removeCount = 0
      let insertPos = -1
      const slotNodesToUpdate: Node[] = []
      const oldContainingSlot = elements[0]!.containingSlot
      const containingSlot = shadowRoot?.getContainingSlot(elements[0]!)

      for (let i = 0; i < elements.length; i += 1) {
        const elem = elements[i]!
        // eslint-disable-next-line no-loop-func
        Element.forEachNodeInSlot(elem, (node) => {
          if (oldContainingSlot) {
            if (removeCount) {
              removeCount += 1
            } else {
              removeStart = node.slotIndex!
              removeCount = 1
            }
          }

          slotNodesToUpdate.push(node)
        })
      }

      if (containingSlot && slotNodesToUpdate.length) {
        const firstSlotNode = slotNodesToUpdate[0]!
        insertPos = Element._$findSlotNodeInsertPosition(containingSlot, firstSlotNode, posIndex)
      }

      return {
        updateContainingSlot: () => {
          for (let i = slotNodesToUpdate.length - 1; i >= 0; i -= 1) {
            const node = slotNodesToUpdate[i]!
            Element._$updateContainingSlot(node, containingSlot)
          }
        },
        removeSlotNodes: () => {
          if (oldShadowRoot && oldContainingSlot && removeCount) {
            Element._$spliceSlotNodes(oldContainingSlot, removeStart, removeCount, undefined)
          }
        },
        insertSlotNodes: () => {
          if (shadowRoot && containingSlot && slotNodesToUpdate.length) {
            Element._$spliceSlotNodes(containingSlot, insertPos, 0, slotNodesToUpdate)
          }
        },
      }
    }
    const slotNodesToInsertMap = new Map<Element, { nodes: Node[]; insertPos: number }>()
    const slotNodesToRemoveMap = new Map<Element, { start: number; count: number }>()

    const slotNodesWithContainingSlot: [Node, Element | undefined | null][] = []

    for (let i = 0; i < elements.length; i += 1) {
      const elem = elements[i]!
      Element.forEachNodeInSlot(elem, (node, oldContainingSlot) => {
        const containingSlot =
          slotMode !== SlotMode.Direct ? shadowRoot?.getContainingSlot(node) : undefined

        if (oldContainingSlot) {
          const slotNodesToRemove = slotNodesToRemoveMap.get(oldContainingSlot)
          if (slotNodesToRemove) {
            slotNodesToRemove.count += 1
          } else {
            slotNodesToRemoveMap.set(oldContainingSlot, { start: node.slotIndex!, count: 1 })
          }
        }

        if (containingSlot) {
          const slotNodesToInsert = slotNodesToInsertMap.get(containingSlot)
          if (slotNodesToInsert) {
            slotNodesToInsert.nodes.push(node)
          } else {
            slotNodesToInsertMap.set(containingSlot, { nodes: [node], insertPos: -1 })
          }
        }

        slotNodesWithContainingSlot.push([node, containingSlot])
      })
    }

    if (shadowRoot && slotNodesToInsertMap.size) {
      const iter = slotNodesToInsertMap.entries()

      for (let it = iter.next(); !it.done; it = iter.next()) {
        const [slot, { nodes: slotNodesToInsert }] = it.value
        const firstSlotNodeToInsert = slotNodesToInsert[0]!
        it.value[1].insertPos = Element._$findSlotNodeInsertPosition(
          slot,
          firstSlotNodeToInsert,
          posIndex,
        )
      }
    }

    return {
      updateContainingSlot: () => {
        for (let i = slotNodesWithContainingSlot.length - 1; i >= 0; i -= 1) {
          const [node, containingSlot] = slotNodesWithContainingSlot[i]!
          Element._$updateContainingSlot(node, containingSlot)
        }
      },
      removeSlotNodes: () => {
        if (oldShadowRoot && slotNodesToRemoveMap.size) {
          const iter = slotNodesToRemoveMap.entries()
          for (let it = iter.next(); !it.done; it = iter.next()) {
            const [slot, { start, count }] = it.value
            Element._$spliceSlotNodes(slot, start, count, undefined)
          }
        }
      },
      insertSlotNodes: () => {
        if (shadowRoot && slotNodesToInsertMap.size) {
          const iter = slotNodesToInsertMap.entries()

          for (let it = iter.next(); !it.done; it = iter.next()) {
            const [slot, { nodes: slotNodesToInsert, insertPos }] = it.value
            Element._$spliceSlotNodes(slot, insertPos, 0, slotNodesToInsert)
          }
        }
      },
    }
  }

  private static insertChildSingleOperation(
    parent: Element,
    newChild: Node | null,
    oriPosIndex: number,
    replace: boolean,
  ) {
    /* istanbul ignore if  */
    if (newChild && parent.ownerShadowRoot !== newChild.ownerShadowRoot) {
      throw new Error('Cannot move the node from one shadow tree to another shadow tree.')
    }
    let posIndex = oriPosIndex
    const relChild: Node | undefined = posIndex >= 0 ? parent.childNodes[posIndex] : undefined
    let removal: boolean
    if (replace) {
      if (!relChild) {
        removal = false
      } else if (newChild === relChild) {
        removal = false
      } else {
        removal = true
      }
    } else {
      removal = false
    }
    if (!removal && !newChild) return

    // change the parent of newChild
    let oldParent: Element | null
    if (newChild) {
      oldParent = newChild.parentNode
      if (oldParent) {
        const childNodes = oldParent.childNodes
        const oldPosIndex = newChild.parentIndex
        childNodes.splice(oldPosIndex, 1)
        for (let i = oldPosIndex; i < childNodes.length; i += 1) {
          childNodes[i]!.parentIndex = i
        }
        newChild.parentIndex = -1
        if (oldParent === parent && oldPosIndex < posIndex) posIndex -= 1

        const containingSlotUpdater = Element._$updateSubtreeSlotNodes(
          parent,
          [newChild],
          null,
          Element._$getParentHostShadowRoot(oldParent),
          posIndex,
        )

        containingSlotUpdater?.removeSlotNodes()

        if (BM.DOMLIKE || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Domlike)) {
          // removal of in-tree elements are not needed for DOM backend
          // do nothing
        } else if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
          if (ENV.DEV) performanceMeasureStart('backend.removeChild')
          ;(oldParent._$backendElement as backend.Element | null)?.removeChild(
            newChild._$backendElement as backend.Element,
            oldPosIndex,
          )
          if (ENV.DEV) performanceMeasureEnd()
        } else {
          Element.insertChildComposed(oldParent, null, newChild, true, oldPosIndex)
        }

        containingSlotUpdater?.updateContainingSlot()
      }
      newChild.parentNode = parent
      if (isElement(newChild) && oldParent !== parent) {
        if (oldParent) oldParent._$mutationObserverTarget?.detachChild(newChild)
        parent._$mutationObserverTarget?.attachChild(newChild)
      }
    } else {
      oldParent = null
    }

    // update containingSlot
    const parentComponentShadowRoot = Element._$getParentHostShadowRoot(parent)
    const newChildContainingSlotUpdater = newChild
      ? Element._$updateSubtreeSlotNodes(
          parent,
          [newChild],
          parentComponentShadowRoot,
          null,
          posIndex,
        )
      : null
    const relChildContainingSlotUpdater =
      relChild && removal
        ? Element._$updateSubtreeSlotNodes(
            parent,
            [relChild],
            null,
            parentComponentShadowRoot,
            posIndex,
          )
        : null

    newChildContainingSlotUpdater?.updateContainingSlot()
    relChildContainingSlotUpdater?.removeSlotNodes()

    // spread in composed tree
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      if (parent._$backendElement) {
        if (removal) {
          if (newChild) {
            if (ENV.DEV) performanceMeasureStart('backend.replaceChild')
            ;(parent._$backendElement as backend.Element).replaceChild(
              newChild._$backendElement as backend.Element,
              relChild!._$backendElement as backend.Element,
              posIndex,
            )
            if (ENV.DEV) performanceMeasureEnd()
          } else {
            if (ENV.DEV) performanceMeasureStart('backend.removeChild')
            ;(parent._$backendElement as backend.Element).removeChild(
              relChild!._$backendElement as backend.Element,
              posIndex,
            )
            if (ENV.DEV) performanceMeasureEnd()
          }
        } else {
          // relChild could equal to newChild and have been removed above
          const before = parent.childNodes[posIndex]
          if (before) {
            if (ENV.DEV) performanceMeasureStart('backend.insertBefore')
            ;(parent._$backendElement as backend.Element).insertBefore(
              newChild!._$backendElement as backend.Element,
              before._$backendElement as backend.Element,
              posIndex,
            )
            if (ENV.DEV) performanceMeasureEnd()
          } else {
            if (ENV.DEV) performanceMeasureStart('backend.appendChild')
            ;(parent._$backendElement as backend.Element).appendChild(
              newChild!._$backendElement as backend.Element,
            )
            if (ENV.DEV) performanceMeasureEnd()
          }
        }
      }
    } else {
      Element.insertChildComposed(parent, newChild, relChild, removal, posIndex)
    }

    newChildContainingSlotUpdater?.insertSlotNodes()
    relChildContainingSlotUpdater?.updateContainingSlot()

    // remove parent of relChild if needed
    if (removal && relChild) {
      if (isElement(relChild)) {
        parent._$mutationObserverTarget?.detachChild(relChild)
      }
      relChild.parentNode = null
      relChild.parentIndex = -1
    }

    // handling child nodes list
    const childNodes = parent.childNodes
    if (newChild) {
      if (posIndex < 0) {
        childNodes.push(newChild)
        newChild.parentIndex = childNodes.length - 1
      } else if (removal) {
        childNodes[posIndex] = newChild
        newChild.parentIndex = posIndex
      } else {
        childNodes.splice(posIndex, 0, newChild)
        for (let i = posIndex; i < childNodes.length; i += 1) {
          childNodes[i]!.parentIndex = i
        }
      }
    } else if (removal) {
      childNodes.splice(posIndex, 1)
      for (let i = posIndex; i < childNodes.length; i += 1) {
        childNodes[i]!.parentIndex = i
      }
    }

    // update subtree slots
    const newChildSubtreeSlotStart = newChild ? newChild._$subtreeSlotStart : null
    const newChildSubtreeSlotEnd = newChild ? newChild._$subtreeSlotEnd : null
    const relChildSubtreeSlotStart = relChild ? relChild._$subtreeSlotStart : null
    const relChildSubtreeSlotEnd = relChild ? relChild._$subtreeSlotEnd : null
    if (newChild) {
      if (oldParent) {
        Element._$updateSubtreeSlotsRemoval(
          oldParent,
          newChildSubtreeSlotStart,
          newChildSubtreeSlotEnd,
          true,
        )
      }
      if (removal) {
        Element._$updateSubtreeSlotsReplacement(
          parent,
          newChildSubtreeSlotStart,
          newChildSubtreeSlotEnd,
          relChildSubtreeSlotStart,
          relChildSubtreeSlotEnd,
          posIndex,
          !!oldParent,
        )
      } else {
        Element._$updateSubtreeSlotsInsertion(
          parent,
          newChildSubtreeSlotStart,
          newChildSubtreeSlotEnd,
          posIndex,
          !!oldParent,
        )
      }
    } else if (removal && relChild) {
      Element._$updateSubtreeSlotsRemoval(
        parent,
        relChildSubtreeSlotStart,
        relChildSubtreeSlotEnd,
        false,
      )
    }

    // update id and slot cache if needed
    parent.ownerShadowRoot?._$markIdCacheDirty()

    // call life-times
    if (removal) {
      Element.checkAndCallDetached(relChild as Node)
      Element.checkChildObservers(parent, 'remove', relChild as Node)
    }
    if (newChild) {
      if (oldParent?._$attached) {
        if (parent._$attached) {
          Element.checkAndCallMoved(newChild)
        } else {
          Element.checkAndCallDetached(newChild)
        }
      } else if (parent._$attached) {
        Element.checkAndCallAttached(newChild)
      }
      if (oldParent === parent) {
        Element.checkChildObservers(parent, 'move', newChild)
      } else {
        if (oldParent) {
          Element.checkChildObservers(oldParent, 'remove', newChild)
        }
        Element.checkChildObservers(parent, 'add', newChild)
      }
    }
  }

  private static insertChildBatchRemoval(parent: Element, posIndex: number, count: number) {
    const relChild = parent.childNodes[posIndex]

    let parentComponent: Element | null = parent
    while (parentComponent?._$inheritSlots) parentComponent = parentComponent.parentNode
    const parentComponentShadowRoot =
      isComponent(parentComponent) && !parentComponent._$external
        ? (parentComponent.shadowRoot as ShadowRoot)
        : null

    // handling child nodes list
    const childNodes = parent.childNodes
    const relChildren = childNodes.splice(posIndex, count)
    for (let i = posIndex; i < childNodes.length; i += 1) {
      childNodes[i]!.parentIndex = i
    }

    const containingSlotUpdater = Element._$updateSubtreeSlotNodes(
      parent,
      relChildren,
      null,
      parentComponentShadowRoot,
      posIndex,
    )

    containingSlotUpdater?.removeSlotNodes()

    // spread in composed tree
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      if (parent._$backendElement) {
        if (ENV.DEV) performanceMeasureStart('backend.spliceRemove')
        ;(parent._$backendElement as backend.Element).spliceRemove(
          relChild!._$backendElement as backend.Element,
          count,
        )
        if (ENV.DEV) performanceMeasureEnd()
      }
    } else {
      for (let i = count - 1; i >= 0; i -= 1) {
        Element.insertChildComposed(parent, null, relChildren[i], true, i)
      }
    }

    // remove parent
    for (let i = 0; i < count; i += 1) {
      const relChild = relChildren[i]!
      relChild.parentNode = null
      relChild.parentIndex = -1
      if (isElement(relChild)) {
        parent._$mutationObserverTarget?.detachChild(relChild)
      }
    }
    containingSlotUpdater?.updateContainingSlot()

    // update subtree slot
    let subtreeSlotStart: DoubleLinkedList<Element> | null = null
    let subtreeSlotEnd: DoubleLinkedList<Element> | null = null
    for (let i = 0; i < count; i += 1) {
      const relChild = relChildren[i]!
      if (!subtreeSlotStart) subtreeSlotStart = relChild._$subtreeSlotStart
      if (relChild._$subtreeSlotEnd) subtreeSlotEnd = relChild._$subtreeSlotEnd
    }
    Element._$updateSubtreeSlotsRemoval(parent, subtreeSlotStart, subtreeSlotEnd, false)

    // update id and slot cache if needed
    parent.ownerShadowRoot?._$markIdCacheDirty()

    // call life-times
    for (let i = 0; i < count; i += 1) {
      const relChild = relChildren[i]!
      Element.checkAndCallDetached(relChild)
      Element.checkChildObservers(parent, 'remove', relChild)
    }
  }

  private static insertChildBatchInsertion(
    parent: Element,
    newChildList: Node[],
    posIndex: number,
  ) {
    const relChild: Node | undefined = posIndex >= 0 ? parent.childNodes[posIndex] : undefined

    // update containingSlot
    let parentComponent: Element | null = parent
    while (parentComponent?._$inheritSlots) parentComponent = parentComponent.parentNode
    const parentComponentShadowRoot =
      isComponent(parentComponent) && !parentComponent._$external
        ? (parentComponent.shadowRoot as ShadowRoot)
        : null

    // change the parent of newChild
    let frag: backend.Element | null
    if (
      (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) &&
      newChildList.length >= 5
    ) {
      const backendContext = parent.getBackendContext() as backend.Context
      frag = backendContext.createFragment()
    } else {
      frag = null
    }
    for (let i = 0; i < newChildList.length; i += 1) {
      const newChild = newChildList[i]!
      /* istanbul ignore if  */
      if (parent.ownerShadowRoot !== newChild.ownerShadowRoot) {
        throw new Error('Cannot move the node from one shadow tree to another shadow tree.')
      }
      const oldParent = newChild.parentNode
      /* istanbul ignore if  */
      if (oldParent) {
        throw new Error('Cannot batch-insert the node which already has a parent.')
      }
      newChild.parentNode = parent
      if (isElement(newChild)) {
        parent._$mutationObserverTarget?.attachChild(newChild)
      }
      if ((BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) && frag) {
        const be = newChild._$backendElement as backend.Element
        if (ENV.DEV) performanceMeasureStart('backend.appendChild')
        frag.appendChild(be)
        if (ENV.DEV) performanceMeasureEnd()
      }
    }

    // update containingSlot
    const containingSlotUpdater = Element._$updateSubtreeSlotNodes(
      parent,
      newChildList,
      parentComponentShadowRoot,
      null,
      posIndex,
    )

    containingSlotUpdater?.updateContainingSlot()

    // spread in composed tree
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      if (parent._$backendElement) {
        if (frag) {
          if (relChild) {
            if (ENV.DEV) performanceMeasureStart('backend.spliceBefore')
            ;(parent._$backendElement as backend.Element).spliceBefore(
              relChild._$backendElement as backend.Element,
              0,
              frag,
            )
            if (ENV.DEV) performanceMeasureEnd()
          } else {
            if (ENV.DEV) performanceMeasureStart('backend.spliceAppend')
            ;(parent._$backendElement as backend.Element).spliceAppend(frag)
            if (ENV.DEV) performanceMeasureEnd()
          }
          frag.release()
        } else {
          if (relChild) {
            for (let i = 0; i < newChildList.length; i += 1) {
              const newChild = newChildList[i]!
              if (ENV.DEV) performanceMeasureStart('backend.insertBefore')
              ;(parent._$backendElement as backend.Element).insertBefore(
                newChild._$backendElement as backend.Element,
                relChild._$backendElement as backend.Element,
              )
              if (ENV.DEV) performanceMeasureEnd()
            }
          } else {
            for (let i = 0; i < newChildList.length; i += 1) {
              const newChild = newChildList[i]!
              if (ENV.DEV) performanceMeasureStart('backend.appendChild')
              ;(parent._$backendElement as backend.Element).appendChild(
                newChild._$backendElement as backend.Element,
              )
              if (ENV.DEV) performanceMeasureEnd()
            }
          }
        }
      }
    } else {
      const pos = posIndex >= 0 ? posIndex : parent.childNodes.length
      for (let i = 0; i < newChildList.length; i += 1) {
        const newChild = newChildList[i]!
        Element.insertChildComposed(parent, newChild, relChild, false, pos)
      }
    }

    containingSlotUpdater?.insertSlotNodes()

    // handling child nodes list
    const childNodes = parent.childNodes
    if (relChild) {
      childNodes.splice(posIndex, 0, ...newChildList)
      for (let i = posIndex; i < childNodes.length; i += 1) {
        childNodes[i]!.parentIndex = i
      }
    } else {
      childNodes.push(...newChildList)
      for (let i = childNodes.length - newChildList.length; i < childNodes.length; i += 1) {
        childNodes[i]!.parentIndex = i
      }
    }

    // update subtree slot
    let subtreeSlotStart: DoubleLinkedList<Element> | null = null
    let subtreeSlotEnd: DoubleLinkedList<Element> | null = null
    for (let i = 0; i < newChildList.length; i += 1) {
      const newChild = newChildList[i]!
      const newChildSubtreeSlotStart = newChild._$subtreeSlotStart
      const newChildSubtreeSlotEnd = newChild._$subtreeSlotEnd
      if (newChildSubtreeSlotStart) {
        if (subtreeSlotEnd) {
          newChildSubtreeSlotStart.prev = subtreeSlotEnd
          subtreeSlotEnd.next = newChildSubtreeSlotStart
          subtreeSlotEnd = newChildSubtreeSlotEnd
        } else {
          subtreeSlotStart = newChildSubtreeSlotStart
          subtreeSlotEnd = newChildSubtreeSlotEnd
        }
      }
    }
    Element._$updateSubtreeSlotsInsertion(
      parent,
      subtreeSlotStart,
      subtreeSlotEnd,
      posIndex + newChildList.length - 1,
      false,
    )

    // update id and slot cache if needed
    parent.ownerShadowRoot?._$markIdCacheDirty()

    // call life-times
    for (let i = 0; i < newChildList.length; i += 1) {
      const newChild = newChildList[i]!
      if (parent._$attached) {
        Element.checkAndCallAttached(newChild)
      }
      Element.checkChildObservers(parent, 'add', newChild)
    }
  }

  private static insertChildPlaceholderReplace(
    parent: Element,
    posIndex: number,
    replacer: Element,
  ) {
    /* istanbul ignore if  */
    if (replacer && parent.ownerShadowRoot !== replacer.ownerShadowRoot) {
      throw new Error('Cannot move the node from one shadow tree to another shadow tree.')
    }
    /* istanbul ignore if  */
    if (replacer.parentNode) {
      throw new Error('Cannot replace with the node which already has a parent.')
    }
    const placeholder = parent.childNodes[posIndex]
    /* istanbul ignore if  */
    if (!isElement(placeholder)) {
      throw new Error('Cannot replace on text nodes.')
    }
    /* istanbul ignore if  */
    if (placeholder._$slotName !== null || replacer._$slotName !== null) {
      throw new Error('Cannot replace on slot nodes.')
    }
    if (placeholder === replacer) return

    // change the parent of replacer's children
    let frag: backend.Element | null
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      const backendContext = parent.getBackendContext() as backend.Context
      if (ENV.DEV) performanceMeasureStart('backend.createFragment')
      frag = backendContext.createFragment()
      if (ENV.DEV) performanceMeasureEnd()
    } else {
      frag = null
    }
    const replacedChildren = placeholder.childNodes
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      if (replacedChildren.length > 0) {
        const be = placeholder._$backendElement as backend.Element | null
        if (be) {
          if (ENV.DEV) performanceMeasureStart('backend.spliceRemove')
          be.spliceRemove(
            replacedChildren[0]!._$backendElement as backend.Element,
            replacedChildren.length,
          )
          if (ENV.DEV) performanceMeasureEnd()
        }
      }
    }
    for (let i = 0; i < replacedChildren.length; i += 1) {
      const child = replacedChildren[i]!
      if (BM.DOMLIKE || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Domlike)) {
        // removal of in-tree elements are not needed for DOM backend
        // do nothing
      } else if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
        const be = child._$backendElement as backend.Element
        if (ENV.DEV) performanceMeasureStart('backend.appendChild')
        ;(frag as backend.Element).appendChild(be)
        if (ENV.DEV) performanceMeasureEnd()
      } else {
        Element.insertChildComposed(placeholder, null, child, true, i)
      }
      child.parentNode = replacer
      if (isElement(child)) {
        placeholder._$mutationObserverTarget?.detachChild(child)
        parent._$mutationObserverTarget?.attachChild(child)
      }
    }

    // handling child nodes list for placeholder
    placeholder.childNodes = []

    // change the parent
    placeholder.parentNode = null
    placeholder.parentIndex = -1
    replacer.parentNode = parent

    // update containingSlot
    const placeholderContainingSlot = placeholder.containingSlot
    const placeholderSlotIndex = placeholder.slotIndex
    if (placeholderContainingSlot !== undefined) {
      Element._$updateContainingSlot(replacer, placeholderContainingSlot)
      if (placeholderContainingSlot) {
        Element._$spliceSlotNodes(placeholderContainingSlot, placeholderSlotIndex!, 1, undefined)
      }
    }
    const containingSlotUpdater = replacedChildren.length
      ? Element._$updateSubtreeSlotNodes(
          replacer,
          replacedChildren,
          Element._$getParentHostShadowRoot(replacer),
          Element._$getParentHostShadowRoot(placeholder),
          0,
        )
      : null

    containingSlotUpdater?.updateContainingSlot()
    containingSlotUpdater?.removeSlotNodes()

    // handling child nodes list for parent
    parent.childNodes[posIndex] = replacer
    replacer.parentIndex = posIndex

    // spread in composed tree
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      if (parent._$backendElement) {
        if (ENV.DEV) performanceMeasureStart('backend.replaceChild')
        ;(parent._$backendElement as backend.Element).replaceChild(
          replacer._$backendElement as backend.Element,
          placeholder._$backendElement as backend.Element,
          posIndex,
        )
        if (ENV.DEV) performanceMeasureEnd()
        if (ENV.DEV) performanceMeasureStart('backend.spliceAppend')
        ;(replacer._$backendElement as backend.Element | null)?.spliceAppend(
          frag as backend.Element,
        )
        if (ENV.DEV) performanceMeasureEnd()
      }
      if (ENV.DEV) performanceMeasureStart('backend.release')
      ;(frag as backend.Element).release()
      if (ENV.DEV) performanceMeasureEnd()
    } else {
      Element.insertChildComposed(parent, replacer, placeholder, true, posIndex)
      for (let i = 0; i < replacedChildren.length; i += 1) {
        const child = replacedChildren[i]!
        Element.insertChildComposed(replacer, child, undefined, false, i)
      }
    }

    containingSlotUpdater?.insertSlotNodes()

    if (placeholderContainingSlot !== undefined) {
      Element._$updateContainingSlot(placeholder, undefined)
      if (placeholderContainingSlot) {
        Element._$spliceSlotNodes(placeholderContainingSlot, placeholderSlotIndex!, 0, [replacer])
      }
    }

    // update subtree slots
    // (assume that placeholder and replacer will never be slot node)
    replacer._$subtreeSlotStart = placeholder._$subtreeSlotStart
    replacer._$subtreeSlotEnd = placeholder._$subtreeSlotEnd

    parent._$mutationObserverTarget?.detachChild(placeholder)
    parent._$mutationObserverTarget?.attachChild(replacer)

    // handling child nodes list for replacer
    replacer.childNodes.push(...replacedChildren)
    for (
      let i = replacer.childNodes.length - replacedChildren.length;
      i < replacer.childNodes.length;
      i += 1
    ) {
      replacer.childNodes[i]!.parentIndex = i
    }

    // update id and slot cache if needed
    parent.ownerShadowRoot?._$markIdCacheDirty()

    // call life-times
    if (parent._$attached) {
      Element.checkAndCallDetached(placeholder as Node)
      Element.checkChildObservers(parent, 'remove', placeholder as Node)
      Element.checkAndCallAttached(replacer)
      Element.checkChildObservers(parent, 'add', replacer as Node)
      for (let i = 0; i < replacedChildren.length; i += 1) {
        const child = replacedChildren[i]!
        Element.checkAndCallMoved(child)
        Element.checkChildObservers(parent, 'move', child)
      }
    }
  }

  appendChild(child: Node) {
    Element.insertChildSingleOperation(this, child, this.childNodes.length, false)
  }

  insertChildAt(child: Node, index: number) {
    Element.insertChildSingleOperation(this, child, index, false)
  }

  insertBefore(child: Node, before?: Node) {
    const index = before ? before.parentIndex : -1
    Element.insertChildSingleOperation(this, child, index, false)
  }

  removeChildAt(index: number) {
    Element.insertChildSingleOperation(this, null, index, true)
  }

  removeChild(child: Node) {
    const index = child.parentIndex
    Element.insertChildSingleOperation(this, null, index, true)
  }

  replaceChildAt(child: Node, index: number) {
    Element.insertChildSingleOperation(this, child, index, true)
  }

  replaceChild(child: Node, relChild: Node) {
    const index = relChild.parentIndex
    Element.insertChildSingleOperation(this, child, index, true)
  }

  insertChildren(children: Node[], index: number) {
    Element.insertChildBatchInsertion(this, children, index)
  }

  removeChildren(index: number, count: number) {
    Element.insertChildBatchRemoval(this, index, count)
  }

  selfReplaceWith(replaceWith: Element) {
    const parent = this.parentNode
    if (parent) {
      Element.insertChildPlaceholderReplace(parent, this.parentIndex, replaceWith)
    }
  }

  /** @internal */
  protected static _$generateIdMap(node: ShadowRoot): { [id: string]: Element } {
    const idMap = Object.create(null) as { [id: string]: Element }
    const dfs = function dfs(node: Node) {
      if (isElement(node)) {
        const nodeId = node._$nodeId
        if (nodeId) {
          if (!idMap[nodeId]) idMap[nodeId] = node
        }
        node.childNodes.forEach(dfs)
      }
    }
    dfs(node)
    return idMap
  }

  /** Trigger an event on the element */
  triggerEvent(name: string, detail?: unknown, options?: EventOptions) {
    Event.triggerEvent(this, name, detail, options)
  }

  /** Trigger an event with specified event object on the element */
  dispatchEvent(ev: Event<unknown>) {
    Event.dispatchEvent(this, ev)
  }

  /* @internal */
  private _$setListenerStats(
    name: string,
    finalChanged: FinalChanged,
    options: EventListenerOptions = {},
  ) {
    if (!this._$backendElement) return
    const capture = !!options.capture || !!options.useCapture
    let mutLevel: MutLevel
    switch (finalChanged) {
      case FinalChanged.None:
        mutLevel = MutLevel.None
        break
      case FinalChanged.Mut:
        mutLevel = MutLevel.Mut
        break
      case FinalChanged.Final:
        mutLevel = MutLevel.Final
        break
      default:
        return
    }
    if (this._$nodeTreeContext) {
      if (ENV.DEV) performanceMeasureStart('backend.setListenerStats')
      if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
        ;(this._$nodeTreeContext as domlikeBackend.Context).setListenerStats(
          this._$backendElement as domlikeBackend.Element,
          name,
          capture,
          mutLevel,
        )
      } else if (BM.COMPOSED || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Composed)) {
        const defaultPrevented = mutLevel === MutLevel.Final
        ;(this._$backendElement as composedBackend.Element).setEventDefaultPrevented(
          name,
          defaultPrevented,
        )
      } else {
        ;(this._$backendElement as backend.Element).setListenerStats(name, capture, mutLevel)
      }
      if (ENV.DEV) performanceMeasureEnd()
    }
  }

  /** Add an event listener on the element */
  addListener(name: string, func: EventListener<unknown>, options?: EventListenerOptions) {
    const finalChanged = this._$eventTarget.addListener(name, func, options)
    this._$setListenerStats(name, finalChanged, options)
    if (isComponent(this) && this._$definition._$options.listenerChangeLifetimes) {
      this.triggerLifetime('listenerChange', [true, name, func, options])
    } else if (isNativeNode(this) && typeof this._$listenerChangeCb === 'function') {
      this._$listenerChangeCb.apply(this, [true, name, func, options])
    }
  }

  /** Remove an event listener on the element */
  removeListener(name: string, func: EventListener<unknown>, options?: EventListenerOptions) {
    const finalChanged = this._$eventTarget.removeListener(name, func, options)
    if (finalChanged === FinalChanged.Failed) return
    this._$setListenerStats(name, finalChanged, options)
    if (isComponent(this) && this._$definition._$options.listenerChangeLifetimes) {
      this.triggerLifetime('listenerChange', [false, name, func, options])
    } else if (isNativeNode(this) && typeof this._$listenerChangeCb === 'function') {
      this._$listenerChangeCb.apply(this, [false, name, func, options])
    }
  }

  /** Get an attribute value ( `null` if not set or removed) */
  getAttribute(name: string): unknown {
    if (!this._$nodeAttributes) return null
    if (!Object.prototype.hasOwnProperty.call(this._$nodeAttributes, name)) return null
    return this._$nodeAttributes[name]
  }

  /** Update an attribute value */
  updateAttribute(name: string, value: unknown) {
    this.setAttribute(name, value)
  }

  /** Set an attribute value */
  setAttribute(name: string, value: unknown) {
    let attrs: { [name: string]: unknown }
    if (this._$nodeAttributes) {
      attrs = this._$nodeAttributes
    } else {
      attrs = Object.create(null) as { [name: string]: unknown }
      this._$nodeAttributes = attrs
    }
    attrs[name] = value
    const be = this._$backendElement
    if (be) {
      if (ENV.DEV) performanceMeasureStart('backend.setAttribute')
      if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
        if (value === false) {
          be.removeAttribute(name)
        } else {
          be.setAttribute(
            name,
            value === true || value === undefined || value === null ? '' : String(value),
          )
        }
      } else {
        be.setAttribute(name, value)
      }
      if (ENV.DEV) performanceMeasureEnd()
    }
  }

  /** Remove an attribute */
  removeAttribute(name: string) {
    if (this._$nodeAttributes) {
      delete this._$nodeAttributes[name]
    }
    const be = this._$backendElement
    if (be) {
      if (ENV.DEV) performanceMeasureStart('backend.removeAttribute')
      be.removeAttribute(name)
      if (ENV.DEV) performanceMeasureEnd()
    }
  }

  /** Set a dataset on the element */
  setDataset(name: string, value: unknown) {
    this.dataset[name] = value

    if (BM.SHADOW || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Shadow)) {
      if (ENV.DEV) performanceMeasureStart('backend.setDataset')
      ;(this._$backendElement as backend.Element).setDataset(name, value)
      if (ENV.DEV) performanceMeasureEnd()
    }
  }

  /** Set a mark on the element */
  setMark(name: string, value: unknown) {
    if (!this._$marks) {
      const marks: { [name: string]: unknown } = {}
      marks[name] = value
      this._$marks = marks
    } else {
      this._$marks[name] = value
    }
  }

  /**
   * Collect the marks on the element
   *
   * The marks includes the marks on ancestors (in shadow tree) of the element.
   * If multiple marks on different elements shares the same name,
   * the mark value on the child-most element is accepted.
   */
  collectMarks(): { [name: string]: unknown } {
    const ret = {} as { [name: string]: unknown }
    let cur: Element | null
    for (cur = this; cur; cur = cur.parentNode) {
      const marks = cur._$marks
      if (marks) {
        Object.keys(marks).forEach((name) => {
          if (!Object.prototype.hasOwnProperty.call(ret, name)) {
            ret[name] = marks[name]
          }
        })
      }
    }
    return ret
  }

  /**
   * Attach the element into the backend, swapping out a placeholder element in the backend.
   *
   * The `element` must not be a child node of another element,
   * must not be attached before,
   * and must not have a `ownerShadowRoot` .
   * The `element` `targetParent` and `targetNode` must be in the same backend context.
   * The `element` replaces the `targetNode` in the `targetParent` .
   */
  static replaceDocumentElement(
    element: Element,
    targetParent: GeneralBackendElement,
    targetNode: GeneralBackendElement,
  ) {
    /* istanbul ignore if  */
    if (element._$attached) {
      throw new Error('An attached element cannot be attached again')
    }
    if (element._$backendElement) {
      if (ENV.DEV) performanceMeasureStart('backend.replaceChild')
      ;(targetParent as backend.Element).replaceChild(
        element._$backendElement as backend.Element,
        targetNode as backend.Element,
      )
      if (ENV.DEV) performanceMeasureEnd()
    }
    Element.checkAndCallAttached(element)
  }

  /**
   * Make the element looks like attached.
   *
   * If the element will never be attached to backend or it has no backend element at all,
   * this can be used to trigger `attached` life-time.
   */
  static pretendAttached(element: Element) {
    if (!element._$attached) {
      Element.checkAndCallAttached(element)
    }
  }

  /**
   * Make the element looks like detached.
   *
   * This can be used to trigger `detached` life-time without remove the element in the backend.
   */
  static pretendDetached(element: Element) {
    if (element._$attached) {
      Element.checkAndCallDetached(element)
    }
  }

  /** Check the element is attached or not */
  static isAttached(element: Element): boolean {
    return element._$attached
  }

  /**
   * Set the slot name of the element
   *
   * Once this method is called for an `element` ,
   * it will be treated as a slot which can contain child nodes in composed tree.
   * This method should not be used in components,
   * otherwise the slot content will always be dangled.
   */
  static setSlotName(element: Element, name?: string) {
    /* istanbul ignore if  */
    if (element._$inheritSlots) {
      throw new Error('Slot-inherit mode is not usable in slot element')
    }
    const slotName = name ? String(name) : ''
    const oldSlotName = element._$slotName
    if (oldSlotName === slotName) return
    const needInsertSlot = oldSlotName === null
    element._$slotName = slotName
    if (needInsertSlot) {
      element._$subtreeSlotStart = element._$subtreeSlotEnd = {
        value: element,
        prev: null,
        next: null,
      }
    }
    if (BM.SHADOW || (BM.DYNAMIC && element.getBackendMode() === BackendMode.Shadow)) {
      if (ENV.DEV) performanceMeasureStart('backend.setSlotName')
      ;(element._$backendElement as backend.Element | null)?.setSlotName(slotName)
      if (ENV.DEV) performanceMeasureEnd()
    }
    const owner = element.ownerShadowRoot
    if (owner) {
      if (needInsertSlot) {
        if (owner.getSlotMode() === SlotMode.Dynamic)
          element._$slotValues = Object.create(null) as DataList
        element.slotNodes = []
        const parent = element.parentNode
        if (parent) {
          Element._$updateSubtreeSlotsInsertion(
            parent,
            element._$subtreeSlotStart,
            element._$subtreeSlotEnd,
            element.parentIndex,
            false,
          )
        }
      } else {
        if (owner.isConnected(element)) owner._$applySlotRename(element, slotName, oldSlotName)
      }
    }
  }

  /**
   * Get the slot name of the element
   */
  static getSlotName(element: Element): string | undefined {
    const sn = element._$slotName
    return sn === null ? undefined : sn
  }

  /**
   * Set the virtual node to slot-inherit mode
   *
   * In slot-inherit mode of an element,
   * the child nodes of the element will be treated as siblings and can have different target slot.
   */
  static setInheritSlots(element: Element) {
    /* istanbul ignore if  */
    if (!element._$virtual) {
      throw new Error('Cannot set slot-inherit on non-virtual node')
    }
    /* istanbul ignore if  */
    if (element._$slotName !== null || element.childNodes.length !== 0) {
      throw new Error('Slot-inherit mode cannot be set when the element has any child node')
    }
    if (BM.SHADOW || (BM.DYNAMIC && element.getBackendMode() === BackendMode.Shadow)) {
      const be = element._$backendElement as backend.Element | null
      if (be) {
        if (ENV.DEV) performanceMeasureStart('backend.setInheritSlots')
        be.setInheritSlots()
        if (ENV.DEV) performanceMeasureEnd()
      }
    }
    element._$inheritSlots = true
  }

  /** Get whether the slot-inherit mode is set or not */
  static getInheritSlots(element: Element) {
    return element._$inheritSlots
  }

  /** Get whether the slot-inherit mode is set or not */
  isInheritSlots() {
    return this._$inheritSlots
  }

  /**
   * Set the binding slot of specific node
   *
   * Necessary if node belongs to a dynamic slot, which cannot be identified by slot name.
   */
  static setSlotElement(node: Node, slot: Element | null) {
    const oldSlotElement = node._$slotElement
    if (oldSlotElement === slot) return
    node._$slotElement = slot

    const slotParentShadowRoot = Element._$getParentHostShadowRoot(node.parentNode)

    if (slotParentShadowRoot) {
      const containingSlotUpdater = Element._$updateSubtreeSlotNodes(
        node.parentNode!,
        [node],
        slotParentShadowRoot,
        slotParentShadowRoot,
        node.parentIndex,
      )

      const oldSlot = node.containingSlot as Element | null

      containingSlotUpdater?.updateContainingSlot()
      containingSlotUpdater?.removeSlotNodes()

      const newSlot = node.containingSlot as Element | null

      const recv = (node: Node) => {
        if (isElement(node) && node._$inheritSlots) {
          for (let i = 0; i < node.childNodes.length; i += 1) {
            recv(node.childNodes[i]!)
          }
        } else {
          Element.insertChildReassign(node.parentNode!, node, oldSlot, newSlot, node.parentIndex)
        }
      }
      recv(node)

      containingSlotUpdater?.insertSlotNodes()
    }
  }

  static _$updateContainingSlot(node: Node, containingSlot: Element | null | undefined): void {
    node.containingSlot = containingSlot

    if (
      BM.SHADOW ||
      (BM.DYNAMIC && node.ownerShadowRoot?.getBackendMode() === BackendMode.Shadow)
    ) {
      if (ENV.DEV) performanceMeasureStart('backend.setContainingSlot')
      ;(node._$backendElement as backend.Element).setContainingSlot(
        containingSlot ? (containingSlot._$backendElement as backend.Element) : containingSlot,
      )
      if (ENV.DEV) performanceMeasureEnd()
    }
  }

  static _$spliceSlotNodes(
    slot: Element,
    before: number,
    deleteCount: number,
    insertion: Node[] | undefined,
  ): void {
    const slotNodes = (slot.slotNodes = slot.slotNodes || [])
    const spliceBefore = before >= 0 && before < slotNodes.length
    if (insertion?.length) {
      if (spliceBefore) {
        for (let i = before; i < before + deleteCount; i += 1) {
          slotNodes[i]!.slotIndex = undefined
        }
        slotNodes.splice(before, deleteCount, ...insertion)
        for (let i = before; i < slotNodes.length; i += 1) {
          slotNodes[i]!.slotIndex = i
        }
      } else {
        const start = slotNodes.length
        slotNodes.push(...insertion)
        for (let i = start; i < slotNodes.length; i += 1) {
          slotNodes[i]!.slotIndex = i
        }
      }
    } else if (deleteCount) {
      for (let i = before; i < before + deleteCount; i += 1) {
        slotNodes[i]!.slotIndex = undefined
      }
      slotNodes.splice(before, deleteCount)
      for (let i = before; i < slotNodes.length; i += 1) {
        slotNodes[i]!.slotIndex = i
      }
    }

    if (BM.SHADOW || (BM.DYNAMIC && slot.getBackendMode() === BackendMode.Shadow)) {
      if (insertion?.length) {
        if (ENV.DEV) performanceMeasureStart('backend.createFragment')
        const frag = (slot._$nodeTreeContext as backend.Context).createFragment()
        if (ENV.DEV) performanceMeasureEnd()
        for (let i = 0; i < insertion.length; i += 1) {
          if (ENV.DEV) performanceMeasureStart('backend.appendChild')
          frag.appendChild(insertion[i]!._$backendElement as backend.Element)
          if (ENV.DEV) performanceMeasureEnd()
        }
        if (spliceBefore) {
          if (ENV.DEV) performanceMeasureStart('backend.spliceBeforeSlotNodes')
          ;(slot._$backendElement as backend.Element).spliceBeforeSlotNodes(
            before,
            deleteCount,
            frag,
          )
          if (ENV.DEV) performanceMeasureEnd()
        } else {
          if (ENV.DEV) performanceMeasureStart('backend.spliceAppendSlotNodes')
          ;(slot._$backendElement as backend.Element).spliceAppendSlotNodes(frag)
          if (ENV.DEV) performanceMeasureEnd()
        }
        frag.release()
      } else if (deleteCount) {
        if (ENV.DEV) performanceMeasureStart('backend.spliceRemoveSlotNodes')
        ;(slot._$backendElement as backend.Element).spliceRemoveSlotNodes(before, deleteCount)
        if (ENV.DEV) performanceMeasureEnd()
      }
    }
  }

  /** @internal */
  static _$findSlotNodeInsertPosition(slot: Element, target: Node, newPosIndex: number): number {
    const host = slot.ownerShadowRoot!.getHostNode()
    const getNodeDepth = (node: Node): number => {
      let depth = 0
      let cur: Node | null = node
      while (cur && cur !== host) {
        depth += 1
        cur = cur.parentNode
      }
      return depth
    }

    const targetDepth = getNodeDepth(target)

    const comparePos = (
      slotNode1: Node,
      parentIndex1: number,
      slotDepth1: number,
      slotNode2: Node,
      parentIndex2: number,
      slotDepth2: number,
      posIndex: number,
    ): number => {
      if (slotNode1 === slotNode2) return 0
      if (slotNode1.parentNode === slotNode2.parentNode) {
        return parentIndex1 - (parentIndex2 === -1 ? posIndex : parentIndex2)
      }
      if (slotDepth2 < slotDepth1) {
        const nextSlotNode1 = slotNode1.parentNode!
        return comparePos(
          nextSlotNode1,
          nextSlotNode1.parentIndex,
          slotDepth1 - 1,
          slotNode2,
          parentIndex2,
          slotDepth2,
          posIndex,
        )
      }
      const left = slotDepth1 < slotDepth2 ? slotNode1 : slotNode1.parentNode!
      const leftDepth = slotDepth1 < slotDepth2 ? slotDepth1 : slotDepth1 - 1
      const right = slotNode2.parentNode!
      const rightDepth = slotDepth2 - 1
      const rst = comparePos(
        left,
        left.parentIndex,
        leftDepth,
        right,
        right.parentIndex,
        rightDepth,
        posIndex,
      )
      if (rst === 0) return -1
      return rst
    }

    const slotNodes = slot.slotNodes!

    let i = slotNodes.length - 1
    for (; i >= 0; i -= 1) {
      const slotNode = slotNodes[i]!
      if (
        comparePos(
          slotNode,
          slotNode.parentIndex,
          getNodeDepth(slotNode),
          target,
          target.parentIndex,
          targetDepth,
          newPosIndex >= 0
            ? newPosIndex - 0.5
            : // negative posIndex (such as -1) means to insert at the tail
              slotNodes.length,
        ) < 0
      )
        break
    }
    const insertPos = i + 1
    return insertPos
  }

  /** Get composed parent (including virtual nodes) */
  getComposedParent(): Element | null {
    if (isShadowRoot(this)) return this.getHostNode()
    if (this.containingSlot !== undefined) return this.containingSlot
    let parent = this.parentNode
    while (parent?._$inheritSlots) {
      parent = parent.parentNode
    }
    return parent
  }

  /**
   * Get the composed children
   *
   * This method always returns a new array.
   * It is convenient but less performant.
   * For better performance, consider using `forEachComposedChild` .
   */
  getComposedChildren(): Node[] {
    const ret: Node[] = []
    this.forEachComposedChild((child) => {
      ret.push(child)
    })
    return ret
  }

  /**
   * Iterate composed child nodes (including virtual nodes)
   *
   * if `f` returns `false` then the iteration is interrupted.
   * Returns `true` if that happens.
   */
  forEachComposedChild(f: (node: Node) => boolean | void): boolean {
    if (this._$inheritSlots) return true
    if (isComponent(this) && !this._$external) {
      return f(this.shadowRoot as ShadowRoot) !== false
    }
    if (this._$slotName !== null) {
      const ownerShadowRoot = this.ownerShadowRoot
      if (!ownerShadowRoot) return true
      return ownerShadowRoot.forEachNodeInSpecifiedSlot(this, f)
    }
    const recInheritSlots = (children: Node[]): boolean => {
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i]!
        if (f(child) === false) return false
        if (child._$inheritSlots) {
          if (!recInheritSlots(child.childNodes)) return false
        }
      }
      return true
    }
    return recInheritSlots(this.childNodes)
  }

  /**
   * Iterate non-virtual composed child nodes
   *
   * if `f` returns `false` then the iteration is interrupted.
   * Returns `true` if that happens.
   */
  forEachNonVirtualComposedChild(f: (node: Node) => boolean | void): boolean {
    if (this._$inheritSlots) return true
    const recNonVirtual = (child: Node): boolean => {
      if (child._$virtual) {
        return child.forEachNonVirtualComposedChild(f)
      }
      return f(child) !== false
    }
    if (isComponent(this) && !this._$external) {
      return recNonVirtual(this.shadowRoot as ShadowRoot)
    }
    if (this._$slotName !== null) {
      const ownerShadowRoot = this.ownerShadowRoot
      if (!ownerShadowRoot) return true
      return ownerShadowRoot.forEachSlotContentInSpecifiedSlot(this, recNonVirtual)
    }
    const recInheritSlots = (children: Node[]) => {
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i]!
        if (!recNonVirtual(child)) return false
        if (child._$inheritSlots) {
          if (!recInheritSlots(child.childNodes)) return false
        }
      }
      return true
    }
    return recInheritSlots(this.childNodes)
  }

  /** Parse a selector string so that it can be used multiple queries */
  static parseSelector(str: string): ParsedSelector {
    return new ParsedSelector(str)
  }

  /** Select the first descendant which matches the selector */
  querySelector(selectorStr: string | ParsedSelector): Element | null {
    const parsedSelector =
      selectorStr instanceof ParsedSelector ? selectorStr : new ParsedSelector(selectorStr)
    const ret = parsedSelector.query(this, true) as Element | null
    return ret
  }

  /** Select all descendants which matches the selector */
  querySelectorAll(selectorStr: string | ParsedSelector): Element[] {
    const parsedSelector =
      selectorStr instanceof ParsedSelector ? selectorStr : new ParsedSelector(selectorStr)
    const ret = parsedSelector.query(this, false) as Element[]
    return ret
  }

  /** Test whether the target matches the selector */
  static matchSelector(selectorStr: string | ParsedSelector, target: Element): boolean {
    const parsedSelector =
      selectorStr instanceof ParsedSelector ? selectorStr : new ParsedSelector(selectorStr)
    return parsedSelector.testSelector(null, target)
  }

  /** Test whether the target in this subtree matches the selector */
  matchSelector(selectorStr: string | ParsedSelector, target: Element): boolean {
    const parsedSelector =
      selectorStr instanceof ParsedSelector ? selectorStr : new ParsedSelector(selectorStr)
    return parsedSelector.testSelector(this, target)
  }

  /**
   * Get the bounding client rect
   *
   * Return zero values when the backend element is invalid or it does not have layout information.
   */
  getBoundingClientRect(cb: (res: BoundingClientRect) => void): void {
    const backendElement = this._$backendElement
    if (!backendElement) {
      setTimeout(() => {
        cb({
          left: 0,
          top: 0,
          width: 0,
          height: 0,
        })
      }, 0)
      return
    }
    if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
      const e = backendElement as domlikeBackend.Element
      const res = e.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 }
      setTimeout(() => {
        cb(res)
      }, 0)
    } else {
      const be = backendElement as backend.Element | composedBackend.Element
      if (be.getBoundingClientRect) {
        be.getBoundingClientRect(cb)
      } else {
        setTimeout(() => {
          cb({
            left: 0,
            top: 0,
            width: 0,
            height: 0,
          })
        }, 0)
      }
    }
  }

  /**
   * Get the bounding client rect
   *
   * Return zero values when the backend element is invalid or it does not have layout information.
   */
  getScrollOffset(cb: (res: ScrollOffset) => void): void {
    const backendElement = this._$backendElement
    if (!backendElement) {
      setTimeout(() => {
        cb({
          scrollLeft: 0,
          scrollTop: 0,
          scrollWidth: 0,
          scrollHeight: 0,
        })
      }, 0)
      return
    }
    if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
      const e = backendElement as domlikeBackend.Element
      const res = {
        scrollLeft: e.scrollLeft || 0,
        scrollTop: e.scrollTop || 0,
        scrollWidth: e.scrollWidth || 0,
        scrollHeight: e.scrollHeight || 0,
      }
      setTimeout(() => {
        cb(res)
      }, 0)
    } else {
      const be = backendElement as backend.Element | composedBackend.Element
      if (be.getScrollOffset) {
        be.getScrollOffset(cb)
      } else {
        setTimeout(() => {
          cb({
            scrollLeft: 0,
            scrollTop: 0,
            scrollWidth: 0,
            scrollHeight: 0,
          })
        }, 0)
      }
    }
  }

  /**
   * Create an intersection observer
   *
   * The `relativeElement` is the element to calculate intersection with ( `null` for the viewport).
   * The `relativeElementMargin` is the margins of the `relativeElement` .
   * The `thresholds` is a list of intersection ratios to trigger the `listener` .
   * The listener always triggers once immediately after this call.
   */
  createIntersectionObserver(
    relativeElement: Element | null,
    relativeElementMargin: string,
    thresholds: number[],
    listener: ((res: IntersectionStatus) => void) | null,
  ): Observer | null {
    const backendElement = this._$backendElement
    if (backendElement) {
      if (relativeElement && !relativeElement._$backendElement) {
        return null
      }
      if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
        const context = this._$nodeTreeContext as domlikeBackend.Context | null
        if (!context || !context.createIntersectionObserver) return null
        return context.createIntersectionObserver(
          backendElement as domlikeBackend.Element,
          (relativeElement?._$backendElement as domlikeBackend.Element | undefined) || null,
          relativeElementMargin,
          thresholds,
          listener!,
        )
      }
      const be = backendElement as backend.Element | composedBackend.Element
      if (!be.createIntersectionObserver) return null
      return be.createIntersectionObserver(
        (relativeElement?._$backendElement as any) || null,
        relativeElementMargin,
        thresholds,
        listener as any,
      )
    }
    return null
  }

  /**
   * Get an interactive context
   */
  getContext(cb: (res: unknown) => void): void {
    const backendElement = this._$backendElement
    if (!backendElement) return
    if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
      const context = this._$nodeTreeContext as domlikeBackend.Context | null
      if (context?.getContext) {
        context.getContext(backendElement as domlikeBackend.Element, cb)
      } else {
        cb(null)
      }
    } else {
      const be = backendElement as backend.Element | composedBackend.Element
      if (be.getContext) {
        be.getContext(cb)
      } else {
        cb(null)
      }
    }
  }
}

Element.prototype[ELEMENT_SYMBOL] = true
