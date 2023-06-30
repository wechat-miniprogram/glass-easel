import * as backend from './backend/backend_protocol'
import * as composedBackend from './backend/composed_backend_protocol'
import * as domlikeBackend from './backend/domlike_backend_protocol'
import { globalOptions } from './global_options'
import { MutationObserverChildEvent, MutationObserverTarget } from './mutation_observer'
import {
  Event,
  EventListener,
  EventListenerOptions,
  EventOptions,
  EventTarget,
  FinalChanged,
} from './event'
import { triggerWarning } from './func_arr'
import { ParsedSelector } from './selector'
import {
  BM,
  BackendMode,
  BoundingClientRect,
  ScrollOffset,
  Observer,
  IntersectionStatus,
} from './backend/mode'
import {
  GeneralComponentInstance,
  DataList,
  PropertyList,
  MethodList,
  ComponentInstance,
} from './component_params'
import {
  Node,
  GeneralBackendContext,
  GeneralBackendElement,
  ClassList,
  NativeNode,
  VirtualNode,
  ShadowRoot,
  Component,
  RelationType,
  ExternalShadowRoot,
  ComponentDefinition,
  NodeCast,
} from '.'

/**
 * The "style" attributes segments
 *
 * This allows different modules set the "style" attribute of an element
 * without overriding each other.
 * The final "style" attribute value is the concat of all segments.
 * When calling `setNodeStyle` on an element,
 * a segment can be specified.
 */
export const enum StyleSegmentIndex {
  /** The main style segment, generally managed by the template engine */
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

/**
 * A general element
 *
 * An element can be a `NativeNode` , a `Component` , or a `VirtualNode` .
 */
export class Element implements NodeCast {
  /** @internal */
  private _$backendElement: GeneralBackendElement | null
  /** @internal */
  _$destroyOnDetach: boolean
  /** @internal */
  _$nodeTreeContext: GeneralBackendContext
  /** @internal */
  private _$nodeId: string
  /** @internal */
  private _$nodeAttributes: { [name: string]: unknown } | null
  /** @internal */
  _$nodeSlot: string
  /** @internal */
  _$slotName: string | null
  /** @internal */
  _$slotValues: { [name: string]: unknown } | null
  /** @internal */
  _$nodeSlotElement: Element | null
  /** @internal */
  private _$subtreeSlotCount: number
  /** @internal */
  _$inheritSlots: boolean
  /** @internal */
  _$placeholderHandler: (() => void) | undefined
  /** @internal */
  private _$virtual: boolean
  dataset: { [name: string]: unknown } | null
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
  /** The shadow-root which owns the element (will never change and must not be modified!) */
  ownerShadowRoot: ShadowRoot | null
  /** @internal */
  _$mutationObserverTarget: MutationObserverTarget | null
  /** @internal */
  _$eventTarget: EventTarget<{ [name: string]: unknown }>

  private _$originalClasses: string
  private _$extraClasses: Record<string, boolean> | null

  constructor() {
    throw new Error('Element cannot be constructed directly')
  }

  protected _$initialize(
    virtual: boolean,
    backendElement: GeneralBackendElement | null,
    owner: ShadowRoot | null,
    nodeTreeContext?: GeneralBackendContext,
  ) {
    this._$backendElement = backendElement
    if (backendElement) {
      backendElement.__wxElement = this
    }
    this._$destroyOnDetach = false
    this._$nodeTreeContext = nodeTreeContext || owner!._$nodeTreeContext
    this._$nodeId = ''
    this._$nodeAttributes = null
    this._$nodeSlot = ''
    this._$slotName = null
    this._$slotValues = null
    this._$nodeSlotElement = null
    this._$subtreeSlotCount = 0
    this._$inheritSlots = false
    this._$placeholderHandler = undefined
    this._$virtual = virtual
    this.dataset = null
    this._$marks = null
    this._$attached = false
    this.classList = null
    this._$styleSegments = [] as string[]
    this.parentNode = null
    this.childNodes = []
    this.ownerShadowRoot = owner
    this._$mutationObserverTarget = null
    this._$eventTarget = new EventTarget()
    this._$extraClasses = null
    this._$originalClasses = ''
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
      if (!this._$virtual && host.getComponentOptions().writeIdToDOM) {
        const idPrefix = host._$idPrefix
        const val = idPrefix ? `${idPrefix}--${newId}` : newId
        if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
          const e = this._$backendElement as domlikeBackend.Element | null
          if (e) e.id = val
        } else {
          ;(this._$backendElement as backend.Element | composedBackend.Element | null)?.setId(val)
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
    if (this._$inheritSlots) {
      triggerWarning('slots-inherited nodes do not support "slot" attribute.')
      return
    }
    this._$nodeSlot = newSlot
    if (BM.SHADOW || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Shadow)) {
      ;(this._$backendElement as backend.Element).setSlot(newSlot, this._$inheritSlots)
    } else {
      const parent = this.parentNode
      if (parent) {
        let slotParent: Element | null = parent
        while (slotParent?._$inheritSlots) {
          slotParent = slotParent.parentNode
        }
        if (slotParent instanceof Component && !slotParent._$external) {
          const slotParentShadowRoot = slotParent.shadowRoot as ShadowRoot
          if (slotParentShadowRoot.isDynamicSlots()) {
            triggerWarning(
              'nodes inside dynamic slots should change binding slots through Element#setSlotElement.',
            )
            return
          }
          const oldSlotElement = slotParentShadowRoot.getSlotElementFromName(
            oldSlot,
          ) as Element | null
          const newSlotElement = slotParentShadowRoot.getSlotElementFromName(
            newSlot,
          ) as Element | null
          Element.insertChildReassignComposed(
            parent,
            this,
            oldSlotElement,
            newSlotElement,
            parent.childNodes.indexOf(this) + 1,
          )
        }
      }
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
      return this.classList.getClassNames()
    }
    return ''
  }

  set class(classNames) {
    if (this.classList) {
      if (this._$extraClasses === null) {
        this.classList.setClassNames(classNames)
        return
      }
      this._$originalClasses = classNames
      const newClassNames = [this._$originalClasses]
      Object.entries(this._$extraClasses).forEach(([name, enabled]) => {
        if (enabled) newClassNames.push(name)
      })
      this.classList.setClassNames(newClassNames.join(' '))
    }
  }

  setExtraClass(className: string, value: boolean) {
    if (this._$extraClasses === null) {
      this._$extraClasses = {}
      this._$originalClasses = this.class
    }
    this._$extraClasses[className] = Boolean(value)
    this.class = this._$originalClasses
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
    if (this instanceof NativeNode) {
      return this as NativeNode
    }
    return null
  }

  asVirtualNode(): VirtualNode | null {
    if (this instanceof VirtualNode) {
      return this as VirtualNode
    }
    return null
  }

  asInstanceOf<UData extends DataList, UProperty extends PropertyList, UMethod extends MethodList>(
    componentDefinition: ComponentDefinition<UData, UProperty, UMethod>,
  ): ComponentInstance<UData, UProperty, UMethod> | null {
    if (this instanceof Component) {
      return this.asInstanceOf(componentDefinition)
    }
    return null
  }

  /** Get the backend context */
  getBackendContext(): GeneralBackendContext {
    return this._$nodeTreeContext
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
        ;(this._$backendElement as backend.Element | composedBackend.Element).release()
      }
      this._$backendElement = null
    }
  }

  /** Destroy the backend element on next detach */
  destroyBackendElementOnDetach() {
    this._$destroyOnDetach = true
  }

  /** Get whether the node is virtual or not */
  isVirtual(): boolean {
    return this._$virtual
  }

  /** Set the node style */
  setNodeStyle(styleSegment: string, index: StyleSegmentIndex = 0) {
    if (this._$styleSegments[index] === styleSegment) return
    this._$styleSegments[index] = styleSegment
    const style = this._$styleSegments.join(';')
    if (this._$backendElement) {
      if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
        ;(this._$backendElement as domlikeBackend.Element).setAttribute('style', style)
      } else {
        ;(this._$backendElement as backend.Element | composedBackend.Element).setStyle(style)
      }
    }
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
      if (node instanceof Element && !node._$attached) {
        node._$attached = true
        if (node instanceof Component) {
          node._$lifetimeFuncs.attached?.call(node.getMethodCaller(), [])
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
        node.childNodes.forEach(callFunc)
      }
    }
    callFunc(node)
  }

  private static checkAndCallDetached(node: Node) {
    const callFunc = function callFunc(node: Node) {
      if (node instanceof Element && node._$attached) {
        node.childNodes.forEach(callFunc)
        if (node instanceof Component) {
          const f = node._$placeholderHandler
          if (f) f()
          const shadowRoot = node.getShadowRoot()
          if (shadowRoot) callFunc(shadowRoot)
          node._$attached = false
          node._$lifetimeFuncs.detached?.call(node.getMethodCaller(), [])
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
      if (node._$destroyOnDetach) {
        node.destroyBackendElement()
      }
    }
    callFunc(node)
  }

  private static checkAndCallMoved(node: Node) {
    const callFunc = function callFunc(node: Node) {
      if (node instanceof Element && node._$attached) {
        node.childNodes.forEach(callFunc)
        if (node instanceof Component) {
          const shadowRoot = node.getShadowRoot()
          if (shadowRoot) callFunc(shadowRoot)
          node._$lifetimeFuncs.moved?.call(node.getMethodCaller(), [])
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

  private static updateSlotCount(element: Element, diff: number) {
    let cur = element
    for (;;) {
      cur._$subtreeSlotCount += diff
      const next = cur.parentNode
      if (next) {
        cur = next
      } else {
        if (cur instanceof ShadowRoot) {
          cur._$markSlotCacheDirty()
        }
        break
      }
    }
  }

  /** @internal */
  static _$insertChildReassignSlot(
    shadowRoot: ShadowRoot,
    name: string,
    oldSlot: Element | null,
    newSlot: Element | null,
  ) {
    const host = shadowRoot.getHostNode()
    const ideaPosIndex = host.childNodes.length
    shadowRoot.forEachNodeInSpecifiedSlot(name, (node, _posIndex) => {
      if (node instanceof Element && node._$inheritSlots) return
      // a special use of composing process:
      // the child node might not be the direct child of the host;
      // there may be slot-inherit nodes between them.
      Element.insertChildReassignComposed(host, node, oldSlot, newSlot, ideaPosIndex)
    })
  }

  private static insertChildReassignComposed(
    shadowParent: Element,
    child: Node,
    oldSlot: Element | null,
    newSlot: Element | null,
    ideaPosIndex: number,
  ) {
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
              (BM.DYNAMIC && shadowParent.getBackendContext().mode === BackendMode.Domlike)
            ) {
              const rel = (before as Element)._$backendElement as domlikeBackend.Element
              for (let i = 1; i < removeCount; i += 1) {
                const next = rel.nextSibling
                if (next) (backendParent as domlikeBackend.Element).removeChild(next)
              }
              if (removeCount > 0) (backendParent as domlikeBackend.Element).removeChild(rel)
            } else {
              ;(backendParent as composedBackend.Element).spliceRemove(
                (before as Element)._$backendElement as composedBackend.Element,
                removeCount,
              )
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
    let cur = p
    for (;;) {
      if (!cur._$virtual) return cur._$backendElement as composedElement | null
      if (cur instanceof ShadowRoot) {
        cur = cur.getHostNode()
        continue
      }
      const next = cur.parentNode
      if (!next) return null
      if (next instanceof Component && !next._$external) {
        const slot = (next.shadowRoot as ShadowRoot).getContainingSlot(cur)
        if (!slot) return null
        cur = slot
      } else {
        cur = next
      }
    }
  }

  private static countNonVirtual(target: Node): [Node, number] | null {
    let firstNode = null
    let removeCount = 0
    const recRelVirtual = (c: Node) => {
      if (c instanceof Element) {
        if (c._$virtual) {
          c.forEachComposedChild(recRelVirtual)
          return
        }
      }
      if (removeCount === 0) {
        firstNode = c
      }
      removeCount += 1
    }
    recRelVirtual(target)
    return firstNode ? [firstNode, removeCount] : null
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
    const context = slotParent._$nodeTreeContext as composedContext

    // detect whether it is in single-slot mode
    let sharedNonVirtualParent: composedElement | null | undefined
    let dynamicSlotting = false
    if (slotParent instanceof Component) {
      if (slotParent._$external) {
        const singleSlot = (slotParent.shadowRoot as ExternalShadowRoot).slot
        sharedNonVirtualParent = singleSlot
      } else {
        parentConverted = true
        const singleSlot = (slotParent.shadowRoot as ShadowRoot).getSingleSlotElement()
        if (singleSlot !== undefined) {
          sharedNonVirtualParent = singleSlot
            ? Element.findNearestNonVirtual(singleSlot)
            : undefined
        } else {
          if ((slotParent.shadowRoot as ShadowRoot).isDynamicSlots()) dynamicSlotting = true
          sharedNonVirtualParent = undefined
        }
      }
    } else {
      if (slotParent._$virtual) parentConverted = true
      sharedNonVirtualParent = Element.findNearestNonVirtual(slotParent)
    }

    // a helper for listing children in specified slot
    const forEachChildInSlot = (
      node: Node,
      slot: Element | null,
      slotName: string,
      f: (node: Node) => boolean,
    ): void => {
      const recInheritedSlot = (c: Node): boolean => {
        if (c instanceof Element && c._$inheritSlots) {
          return c.childNodes.every(recInheritedSlot)
        }
        return f(c)
      }
      const recv = (c: Node): boolean => {
        if (sharedNonVirtualParent) {
          // single slot
          if (c instanceof Element && c._$inheritSlots) {
            return c.childNodes.every(recInheritedSlot)
          }
        } else if (!dynamicSlotting) {
          // multiple slots
          if (c instanceof Element && c._$inheritSlots) {
            return c.childNodes.every(recv)
          }
          if (slotName !== (c instanceof Element ? c._$nodeSlot : '')) return true
        } else {
          // dynamic slots
          if (slot !== c._$nodeSlotElement) return true
          if (c instanceof Element && c._$inheritSlots) {
            return c.childNodes.every(recInheritedSlot)
          }
        }
        return f(c)
      }
      recv(node)
    }

    // a helper for searching the first non-virtual node
    const findFirstNonVirtual = (
      shadowParent: Element,
      index: number,
      slot: Element | null,
      slotName: string,
    ): Node | null => {
      const children = shadowParent.childNodes
      if (index >= 0) {
        for (let i = index; i < children.length; i += 1) {
          let ret: Node | null = null
          const recVirtual = (c: Node): boolean => {
            if (c instanceof Element && c._$virtual) {
              return c.forEachComposedChild(recVirtual)
            }
            ret = c
            return ret === null
          }
          forEachChildInSlot(children[i]!, slot, slotName, recVirtual)
          if (ret) return ret
        }
      }
      let cur: Element
      if (shadowParent instanceof ShadowRoot) {
        const host = shadowParent.getHostNode()
        cur = host
      } else if (shadowParent instanceof Component && !shadowParent._$external) {
        const slotElem =
          slot === null
            ? (shadowParent.shadowRoot as ShadowRoot).getSlotElementFromName(slotName)
            : slot
        if (!slotElem) return null
        cur = slotElem as Element
      } else {
        cur = shadowParent
      }
      if (!cur._$virtual) return null
      const p = cur.parentNode
      if (p) {
        const i = p.childNodes.lastIndexOf(cur)
        let nextSlot: Element | null
        let nextSlotName: string
        if (cur._$inheritSlots) {
          nextSlot = slot
          nextSlotName = slotName
        } else if (p instanceof Component && !p._$external) {
          const singleSlot = (p.shadowRoot as ShadowRoot).getSingleSlotElement()
          if (singleSlot !== undefined) {
            nextSlot = null
            nextSlotName = ''
          } else {
            nextSlot = (p.shadowRoot as ShadowRoot).getContainingSlot(cur)
            nextSlotName = cur._$slotName || ''
          }
        } else {
          nextSlot = null
          nextSlotName = ''
        }
        const ret = findFirstNonVirtual(p, i + 1, nextSlot, nextSlotName)
        if (ret) return ret
      }
      return null
    }

    // a helper for grouping and slicing update
    let sharedFrag: composedElement | null = null
    const groupUpdate = (slot: Element | null, slotName?: string) => {
      // find the proper element of the backend
      let backendParent: composedElement | null
      if (slotName === undefined) {
        // `sharedNonVirtualParent` must be valid if `null`
        backendParent = sharedNonVirtualParent as composedElement | null
      } else {
        // `slotParent` must be `Component` if slot not `null`
        const p = slotParent as GeneralComponentInstance
        if (p._$external) {
          const s = (p.shadowRoot as ExternalShadowRoot).slot
          backendParent = s as composedBackend.Element | domlikeBackend.Element
        } else {
          backendParent = slot ? Element.findNearestNonVirtual(slot) : null
        }
      }
      if (!(BM.DOMLIKE || (BM.DYNAMIC && shadowParent.getBackendMode() === BackendMode.Domlike))) {
        if (!backendParent) {
          return
        }
      }
      const slotNameLimit = slotName || ''
      let removeCount = 0
      let before: Node | null = null

      // get the new child nodes of the backend
      let frag: composedElement | null = null
      if (newChild) {
        const f =
          sharedFrag ||
          (BM.DOMLIKE || (BM.DYNAMIC && context.mode === BackendMode.Domlike)
            ? (context as domlikeBackend.Context).document.createDocumentFragment()
            : (context as backend.Context | composedBackend.Context).createFragment())
        sharedFrag = frag
        const recNewVirtual = (c: Node): boolean => {
          if (c instanceof Element && c._$virtual) {
            c.forEachComposedChild(recNewVirtual)
          } else {
            // since `TextNode` also has `backendElement` private field, just make it as `Element`
            // domlike backend also
            ;(f as composedBackend.Element).appendChild(
              (c as Element)._$backendElement as composedBackend.Element,
            )
            frag = f
          }
          return true
        }
        forEachChildInSlot(newChild, slot, slotNameLimit, recNewVirtual)
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
          forEachChildInSlot(relChild, slot, slotNameLimit, (c) => {
            if (c instanceof Element) {
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
          if (removeCount === 0 && frag) {
            before = findFirstNonVirtual(shadowParent, newPosIndex + 1, slot, slotNameLimit)
          }
        } else if (frag) {
          before = findFirstNonVirtual(shadowParent, newPosIndex, slot, slotNameLimit)
        }
      }

      // actually do the backend operation
      if (frag) {
        if (before) {
          if (BM.DOMLIKE || (BM.DYNAMIC && context.mode === BackendMode.Domlike)) {
            const rel = (before as Element)._$backendElement as domlikeBackend.Element
            ;(backendParent as domlikeBackend.Element).insertBefore(
              frag as domlikeBackend.Element,
              rel,
            )
            for (let i = 1; i < removeCount; i += 1) {
              const next = rel.nextSibling
              if (next) (backendParent as domlikeBackend.Element).removeChild(next)
            }
            if (removeCount > 0) (backendParent as domlikeBackend.Element).removeChild(rel)
          } else {
            ;(backendParent as composedBackend.Element).spliceBefore(
              // since `TextNode` also has `backendElement` private field, just make it as `Element`
              (before as Element)._$backendElement as composedBackend.Element,
              removeCount,
              frag as composedBackend.Element,
            )
          }
        } else {
          if (BM.DOMLIKE || (BM.DYNAMIC && context.mode === BackendMode.Domlike)) {
            ;(backendParent as domlikeBackend.Element).appendChild(frag as domlikeBackend.Element)
          } else {
            ;(backendParent as composedBackend.Element).spliceAppend(
              frag as composedBackend.Element,
            )
          }
        }
      } else if (removeCount > 0) {
        if (BM.DOMLIKE || (BM.DYNAMIC && context.mode === BackendMode.Domlike)) {
          const rel = (before as Element)._$backendElement as domlikeBackend.Element
          for (let i = 1; i < removeCount; i += 1) {
            const next = rel.nextSibling
            if (next) (backendParent as domlikeBackend.Element).removeChild(next)
          }
          if (removeCount > 0) (backendParent as domlikeBackend.Element).removeChild(rel)
        } else {
          ;(backendParent as composedBackend.Element).spliceRemove(
            // since `TextNode` also has `backendElement` private field, just make it as `Element`
            (before as Element)._$backendElement as composedBackend.Element,
            removeCount,
          )
        }
      }
    }

    // in single-slot mode, use a simpler update logic; otherwise use a slower one
    if (sharedNonVirtualParent !== undefined) {
      if (sharedNonVirtualParent === null) {
        // for nodes with no valid non-virtual parent, do nothing
      } else if (
        !parentConverted &&
        (!(newChild instanceof Element) || !newChild._$virtual) &&
        (!(relChild instanceof Element) || !relChild._$virtual)
      ) {
        // for non-virtual children, use single child operation
        if (removal) {
          if (newChild) {
            ;(sharedNonVirtualParent as composedBackend.Element).replaceChild(
              // since `TextNode` also has `backendElement` private field, just make it as `Element`
              // domlike backend also
              (newChild as Element)._$backendElement as composedBackend.Element,
              (relChild as Element)._$backendElement as composedBackend.Element,
            )
          } else {
            ;(sharedNonVirtualParent as composedBackend.Element).removeChild(
              // since `TextNode` also has `backendElement` private field, just make it as `Element`
              // domlike backend also
              (relChild as Element)._$backendElement as composedBackend.Element,
            )
          }
        } else if (relChild) {
          ;(sharedNonVirtualParent as composedBackend.Element).insertBefore(
            // since `TextNode` also has `backendElement` private field, just make it as `Element`
            // domlike backend also
            (newChild as Element)._$backendElement as composedBackend.Element,
            (relChild as Element)._$backendElement as composedBackend.Element,
          )
        } else {
          ;(sharedNonVirtualParent as composedBackend.Element).appendChild(
            // since `TextNode` also has `backendElement` private field, just make it as `Element`
            // domlike backend also
            (newChild as Element)._$backendElement as composedBackend.Element,
          )
        }
      } else {
        // for virtual children in a single slot, group the children and use splice
        groupUpdate(null)
      }
    } else {
      // for multi-slots, find out each slot that needs update, and update them one by one
      const slots: (Element | string)[] = []
      const recInheritedSlots = (c: Node) => {
        let slot: Element | string
        if (c._$nodeSlotElement) {
          slot = c._$nodeSlotElement
        } else if (c instanceof Element) {
          if (c._$inheritSlots) {
            c.childNodes.forEach(recInheritedSlots)
            return
          }
          slot = c._$nodeSlot
        } else {
          slot = ''
        }
        if (slots.indexOf(slot) < 0) slots.push(slot)
      }
      if (removal && relChild) recInheritedSlots(relChild)
      if (newChild) recInheritedSlots(newChild)
      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i]!
        if (typeof slot === 'string') {
          const s = (
            (slotParent as GeneralComponentInstance).shadowRoot as ShadowRoot
          ).getSlotElementFromName(slot)
          groupUpdate(s as Element | null, slot)
        } else {
          groupUpdate(slot, '')
        }
      }
    }
    if (!(BM.DOMLIKE || (BM.DYNAMIC && context.mode === BackendMode.Domlike))) {
      if (sharedFrag) (sharedFrag as composedBackend.Element).release()
    }

    // write extra info if needed
    if (globalOptions.writeExtraInfoToAttr) {
      if (removal && relChild instanceof Element) {
        relChild._$backendElement?.removeAttribute('exparser:info-in-slot-of')
      }
      if (newChild instanceof Element) {
        if (shadowParent instanceof Component) {
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

  private static insertChildSingleOperation(
    parent: Element,
    newChild: Node | null,
    oriPosIndex: number,
    replace: boolean,
  ) {
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
    let needUpdateSlotCount = false
    let slotCountDiff = 0

    // change the parent of newChild
    let oldParent: Element | null
    if (newChild) {
      oldParent = newChild.parentNode
      if (oldParent) {
        const oldPosIndex = oldParent.childNodes.indexOf(newChild)
        oldParent.childNodes.splice(oldPosIndex, 1)
        if (oldParent === parent && oldPosIndex < posIndex) posIndex -= 1
        if (BM.DOMLIKE || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Domlike)) {
          // removal of in-tree elements are not needed for DOM backend
          // do nothing
        } else if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
          ;(oldParent._$backendElement as backend.Element | null)?.removeChild(
            // since `TextNode` also has `backendElement` private field, just make it as `Element`
            (newChild as Element)._$backendElement as backend.Element,
            oldPosIndex,
          )
        } else {
          Element.insertChildComposed(parent, null, newChild, true, oldPosIndex)
        }
      }
      newChild.parentNode = parent
      if (newChild instanceof Element) {
        if (oldParent !== parent) {
          if (oldParent) {
            oldParent._$mutationObserverTarget?.detachChild(newChild)
            if (newChild._$subtreeSlotCount > 0) {
              Element.updateSlotCount(oldParent, -newChild._$subtreeSlotCount)
            }
          }
          parent._$mutationObserverTarget?.attachChild(newChild)
          if (newChild._$subtreeSlotCount > 0) {
            needUpdateSlotCount = true
            slotCountDiff += newChild._$subtreeSlotCount
          }
        } else if (newChild._$subtreeSlotCount > 0) {
          needUpdateSlotCount = true
        }
      }
    } else {
      oldParent = null
    }

    // spread in composed tree
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      if (parent._$backendElement) {
        if (removal) {
          if (newChild) {
            ;(parent._$backendElement as backend.Element).replaceChild(
              // since `TextNode` also has `backendElement` private field, just make it as `Element`
              (newChild as Element)._$backendElement as backend.Element,
              (relChild as Element)._$backendElement as backend.Element,
              posIndex,
            )
          } else {
            ;(parent._$backendElement as backend.Element).removeChild(
              // since `TextNode` also has `backendElement` private field, just make it as `Element`
              (relChild as Element)._$backendElement as backend.Element,
              posIndex,
            )
          }
        } else if (relChild) {
          ;(parent._$backendElement as backend.Element).insertBefore(
            // since `TextNode` also has `backendElement` private field, just make it as `Element`
            (newChild as Element)._$backendElement as backend.Element,
            (relChild as Element)._$backendElement as backend.Element,
            posIndex,
          )
        } else {
          ;(parent._$backendElement as backend.Element).appendChild(
            // since `TextNode` also has `backendElement` private field, just make it as `Element`
            (newChild as Element)._$backendElement as backend.Element,
          )
        }
      }
    } else {
      Element.insertChildComposed(parent, newChild, relChild, removal, posIndex)
    }

    // remove parent of relChild if needed
    if (removal && relChild instanceof Element) {
      parent._$mutationObserverTarget?.detachChild(relChild)
      relChild.parentNode = null
      if (relChild._$subtreeSlotCount > 0) {
        needUpdateSlotCount = true
        slotCountDiff -= relChild._$subtreeSlotCount
      }
    }

    // handling child nodes list
    if (newChild) {
      if (posIndex < 0) parent.childNodes.push(newChild)
      else if (removal) parent.childNodes[posIndex] = newChild
      else parent.childNodes.splice(posIndex, 0, newChild)
    } else if (removal) {
      parent.childNodes.splice(posIndex, 1)
    }

    // update id and slot cache if needed
    parent.ownerShadowRoot?._$markIdCacheDirty()
    if (needUpdateSlotCount) {
      Element.updateSlotCount(parent, slotCountDiff)
      parent.ownerShadowRoot?._$checkSlotChanges()
    }

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
    let needUpdateSlotCount = false
    let slotCountDiff = 0

    // spread in composed tree
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      if (parent._$backendElement) {
        ;(parent._$backendElement as backend.Element).spliceRemove(
          (relChild as Element)._$backendElement as backend.Element,
          count,
        )
      }
    } else {
      for (let i = 0; i < count; i += 1) {
        Element.insertChildComposed(
          parent,
          null,
          parent.childNodes[posIndex + i],
          true,
          posIndex + i,
        )
      }
    }

    // remove parent
    for (let i = 0; i < count; i += 1) {
      const relChild = parent.childNodes[posIndex + i]!
      relChild.parentNode = null
      if (relChild instanceof Element) {
        parent._$mutationObserverTarget?.detachChild(relChild)
        if (relChild._$subtreeSlotCount > 0) {
          needUpdateSlotCount = true
          slotCountDiff -= relChild._$subtreeSlotCount
        }
      }
    }

    // handling child nodes list
    const relChildren = parent.childNodes.splice(posIndex, count)

    // update id and slot cache if needed
    parent.ownerShadowRoot?._$markIdCacheDirty()
    if (needUpdateSlotCount) {
      Element.updateSlotCount(parent, slotCountDiff)
      parent.ownerShadowRoot?._$checkSlotChanges()
    }

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
    let needUpdateSlotCount = false
    let slotCountDiff = 0

    // change the parent of newChild
    let frag: backend.Element | null
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      const backendContext = parent.getBackendContext() as backend.Context
      frag = backendContext.createFragment()
    } else {
      frag = null
    }
    for (let i = 0; i < newChildList.length; i += 1) {
      const newChild = newChildList[i]!
      if (parent.ownerShadowRoot !== newChild.ownerShadowRoot) {
        throw new Error('Cannot move the node from one shadow tree to another shadow tree.')
      }
      const oldParent = newChild.parentNode
      if (oldParent) {
        throw new Error('Cannot batch-insert the node which already has a parent.')
      }
      newChild.parentNode = parent
      if (newChild instanceof Element) {
        parent._$mutationObserverTarget?.attachChild(newChild)
        if (newChild._$subtreeSlotCount > 0) {
          needUpdateSlotCount = true
          slotCountDiff += newChild._$subtreeSlotCount
        }
      }
      if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
        // since `TextNode` also has `backendElement` private field, just make it as `Element`
        const be = (newChild as Element)._$backendElement as backend.Element
        ;(frag as backend.Element).appendChild(be)
      }
    }

    // spread in composed tree
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      if (parent._$backendElement) {
        if (relChild) {
          ;(parent._$backendElement as backend.Element).spliceBefore(
            // since `TextNode` also has `backendElement` private field, just make it as `Element`
            (relChild as Element)._$backendElement as backend.Element,
            0,
            frag as backend.Element,
          )
        } else {
          ;(parent._$backendElement as backend.Element).spliceAppend(frag as backend.Element)
        }
      }
      ;(frag as backend.Element).release()
    } else {
      for (let i = 0; i < newChildList.length; i += 1) {
        const newChild = newChildList[i]!
        Element.insertChildComposed(
          parent,
          newChild,
          relChild,
          false,
          posIndex >= 0 ? posIndex : parent.childNodes.length,
        )
      }
    }

    // handling child nodes list
    if (relChild) {
      parent.childNodes.splice(posIndex, 0, ...newChildList)
    } else {
      parent.childNodes.push(...newChildList)
    }

    // update id and slot cache if needed
    parent.ownerShadowRoot?._$markIdCacheDirty()
    if (needUpdateSlotCount) {
      Element.updateSlotCount(parent, slotCountDiff)
      parent.ownerShadowRoot?._$checkSlotChanges()
    }

    // call life-times
    for (let i = 0; i < newChildList.length; i += 1) {
      const newChild = newChildList[i]!
      if (parent._$attached) {
        Element.checkAndCallAttached(newChild)
      }
      Element.checkChildObservers(parent, 'add', newChild)
    }
  }

  private static insertChildPlaceholerReplace(
    parent: Element,
    posIndex: number,
    replacer: Element,
  ) {
    if (replacer && parent.ownerShadowRoot !== replacer.ownerShadowRoot) {
      throw new Error('Cannot move the node from one shadow tree to another shadow tree.')
    }
    if (replacer.parentNode) {
      throw new Error('Cannot replace with the node which already has a parent.')
    }
    const placeholder = parent.childNodes[posIndex]
    if (!(placeholder instanceof Element)) {
      throw new Error('Cannot replace on text nodes.')
    }
    if (placeholder === replacer) return

    // change the parent of replacer's children
    let frag: backend.Element | null
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      const backendContext = parent.getBackendContext() as backend.Context
      frag = backendContext.createFragment()
    } else {
      frag = null
    }
    const replacedChildren = placeholder.childNodes
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      if (replacedChildren.length > 0) {
        ;(placeholder._$backendElement as backend.Element | null)?.spliceRemove(
          // since `TextNode` also has `backendElement` private field, just make it as `Element`
          (replacedChildren[0] as Element)._$backendElement as backend.Element,
          replacedChildren.length,
        )
      }
    }
    for (let i = 0; i < replacedChildren.length; i += 1) {
      const child = replacedChildren[i]!
      if (BM.DOMLIKE || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Domlike)) {
        // removal of in-tree elements are not needed for DOM backend
        // do nothing
      } else if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
        // since `TextNode` also has `backendElement` private field, just make it as `Element`
        const be = (child as Element)._$backendElement as backend.Element
        ;(frag as backend.Element).appendChild(be)
      } else {
        Element.insertChildComposed(placeholder, null, child, true, i)
      }
      child.parentNode = replacer
      if (child instanceof Element) {
        placeholder._$mutationObserverTarget?.detachChild(child)
        parent._$mutationObserverTarget?.attachChild(child)
      }
    }

    // spread in composed tree
    if (BM.SHADOW || (BM.DYNAMIC && parent.getBackendMode() === BackendMode.Shadow)) {
      if (parent._$backendElement) {
        ;(parent._$backendElement as backend.Element).replaceChild(
          replacer._$backendElement as backend.Element,
          placeholder._$backendElement as backend.Element,
          posIndex,
        )
        // eslint-disable-next-line arrow-body-style
        ;(replacer._$backendElement as backend.Element | null)?.spliceAppend(
          frag as backend.Element,
        )
      }
      ;(frag as backend.Element).release()
    } else {
      Element.insertChildComposed(parent, replacer, placeholder, true, posIndex)
      for (let i = 0; i < replacedChildren.length; i += 1) {
        const child = replacedChildren[i]!
        Element.insertChildComposed(replacer, child, undefined, false, i)
      }
    }

    // change the parent of placeholder
    parent._$mutationObserverTarget?.detachChild(placeholder)
    placeholder.parentNode = null

    // change the parent of replacer
    replacer.parentNode = parent
    parent._$mutationObserverTarget?.attachChild(replacer)

    // handling child nodes list for parent
    parent.childNodes[posIndex] = replacer

    // handling child nodes list for replacer
    replacer.childNodes.push(...placeholder.childNodes)

    // handling child nodes list for placeholder
    placeholder.childNodes = []

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

  insertBefore(child: Node, before: Node) {
    const index = this.childNodes.indexOf(before)
    Element.insertChildSingleOperation(this, child, index, false)
  }

  removeChildAt(index: number) {
    Element.insertChildSingleOperation(this, null, index, true)
  }

  removeChild(child: Node) {
    const index = this.childNodes.indexOf(child)
    Element.insertChildSingleOperation(this, null, index, true)
  }

  replaceChildAt(child: Node, index: number) {
    Element.insertChildSingleOperation(this, child, index, true)
  }

  replaceChild(child: Node, relChild: Node) {
    const index = this.childNodes.indexOf(relChild)
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
      Element.insertChildPlaceholerReplace(parent, parent.childNodes.indexOf(this), replaceWith)
    }
  }

  /** @internal */
  protected static _$generateIdMap(node: ShadowRoot): { [id: string]: Element } {
    const idMap = Object.create(null) as { [id: string]: Element }
    const dfs = function dfs(node: Node) {
      if (node instanceof Element) {
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

  private _$updateEventDefaultPrevented(name: string, enabled: boolean) {
    if (!this._$backendElement) return
    if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
      ;(this._$nodeTreeContext as domlikeBackend.Context).setElementEventDefaultPrevented(
        this._$backendElement as domlikeBackend.Element,
        name,
        enabled,
      )
    } else {
      ;(this._$backendElement as backend.Element).setEventDefaultPrevented(name, enabled)
    }
  }

  /** Add an event listener on the element */
  addListener(name: string, func: EventListener<unknown>, options?: EventListenerOptions) {
    const finalChanged = this._$eventTarget.addListener(name, func, options)
    if (finalChanged === FinalChanged.Init) this._$updateEventDefaultPrevented(name, false)
    else if (finalChanged === FinalChanged.Added) this._$updateEventDefaultPrevented(name, true)
    if (this instanceof Component && this._$definition._$options.listenerChangeLifetimes) {
      this.triggerLifetime('listenerChanged', [true, name, func, options])
    }
  }

  /** Remove an event listener on the element */
  removeListener(name: string, func: EventListener<unknown>, options?: EventListenerOptions) {
    const finalChanged = this._$eventTarget.removeListener(name, func, options)
    if (finalChanged === FinalChanged.Failed) return
    if (finalChanged !== FinalChanged.NotChanged) this._$updateEventDefaultPrevented(name, false)
    if (this instanceof Component && this._$definition._$options.listenerChangeLifetimes) {
      this.triggerLifetime('listenerChanged', [false, name, func, options])
    }
  }

  /** Get an attribute value ( `null` if not set or removed) */
  getAttribute(name: string): unknown {
    if (this._$nodeAttributes) return this._$nodeAttributes[name]
    return null
  }

  /** Update an attribute value */
  updateAttribute(name: string, value: unknown) {
    if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
      if (typeof value === 'boolean') {
        if (value === true) {
          this.setAttribute(name, '')
        } else {
          this.removeAttribute(name)
        }
      } else {
        this.setAttribute(name, value === undefined || value === null ? '' : String(value))
      }
    } else {
      if (value === undefined) {
        this.removeAttribute(name)
      } else {
        this.setAttribute(name, value)
      }
    }
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
    if (this._$backendElement) {
      this._$backendElement.setAttribute(name, value)
    }
  }

  /** Remove an attribute */
  removeAttribute(name: string) {
    if (this._$nodeAttributes) {
      delete this._$nodeAttributes[name]
    }
    if (this._$backendElement) this._$backendElement.removeAttribute(name)
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
    if (element._$attached) {
      throw new Error('An attached element cannot be attached again')
    }
    if (element._$backendElement) {
      if (BM.DOMLIKE || (BM.DYNAMIC && element.getBackendMode() === BackendMode.Domlike)) {
        ;(targetParent as domlikeBackend.Element).replaceChild(
          element._$backendElement as domlikeBackend.Element,
          targetNode as domlikeBackend.Element,
        )
      } else {
        ;(targetParent as backend.Element | composedBackend.Element).replaceChild(
          element._$backendElement as backend.Element,
          targetNode as backend.Element,
        )
      }
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
    if (element._$inheritSlots) {
      throw new Error('Slot-inherit mode is not usable in slot element')
    }
    if (element._$inheritSlots) {
      throw new Error('Component cannot be used as slot element')
    }
    const slotName = name ? String(name) : ''
    if (element._$slotName === slotName) return
    const needIncSlotCount = element._$slotName === null
    element._$slotName = slotName
    if (BM.SHADOW || (BM.DYNAMIC && element.getBackendMode() === BackendMode.Shadow)) {
      ;(element._$backendElement as backend.Element | null)?.setSlotName(slotName)
    }
    const owner = element.ownerShadowRoot
    if (owner) {
      if (needIncSlotCount && owner.isDynamicSlots()) {
        element._$slotValues = Object.create(null) as DataList
      }
      Element.updateSlotCount(element, needIncSlotCount ? 1 : 0)
      owner._$checkSlotChanges()
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
  static setInheritSlots(element: VirtualNode) {
    if (element._$slotName !== null || element.childNodes.length !== 0) {
      throw new Error('Slot-inherit mode cannot be set when the element has any child node')
    }
    if (BM.SHADOW || (BM.DYNAMIC && element.getBackendMode() === BackendMode.Shadow)) {
      ;(element._$backendElement as backend.Element | null)?.setSlot(
        element._$nodeSlot,
        element._$inheritSlots,
      )
    }
    element._$inheritSlots = true
  }

  /** Get whether the slot-inherit mode is set or not */
  static getInheritSlots(element: Element) {
    return element._$inheritSlots
  }

  /**
   * Set the binding slot of specific node
   *
   * Necessary if node belongs to a dynamic slot, which cannot be identified by slot name.
   */
  static setSlotElement(node: Node, slot: Element) {
    const oldSlotElement = node._$nodeSlotElement
    if (oldSlotElement === slot) return
    node._$nodeSlotElement = slot
    if (node instanceof Element) {
      node._$nodeSlot = slot._$slotName || ''
    }

    // TODO shadow mode
    const parent = node.parentNode
    let slotParent = parent
    while (slotParent?._$inheritSlots) {
      slotParent = slotParent.parentNode
    }
    if (slotParent instanceof Component && !slotParent._$external) {
      Element.insertChildReassignComposed(
        parent!,
        node,
        oldSlotElement,
        slot,
        parent!.childNodes.indexOf(node) + 1,
      )
    }
  }

  static getSlotElement(node: Node) {
    if (node._$nodeSlotElement) return node._$nodeSlotElement
    let parent = node.parentNode
    while (parent?._$inheritSlots) {
      parent = parent.parentNode
    }
    if (parent instanceof Component && !parent._$external) {
      const slot = (parent.shadowRoot as ShadowRoot).getContainingSlot(node)
      return slot
    }
    return undefined
  }

  /** Get composed parent (including virtual nodes) */
  getComposedParent(): Element | null {
    if (this instanceof ShadowRoot) {
      return this.getHostNode()
    }
    let parent = this.parentNode
    while (parent?._$inheritSlots) {
      parent = parent.parentNode
    }
    if (parent instanceof Component && !parent._$external) {
      return (parent.shadowRoot as ShadowRoot).getContainingSlot(this)
    }
    return parent
  }

  /**
   * Get the composed children
   *
   * This method always returns a new array.
   * It is convinient but less performant.
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
    if (this instanceof Component && !this._$external) {
      return f(this.shadowRoot as ShadowRoot) !== false
    }
    if (this._$slotName !== null) {
      let notEnded = true
      if (this.ownerShadowRoot) {
        this.ownerShadowRoot.forEachNodeInSpecifiedSlot(this, (node) => {
          if (f(node) === false) notEnded = false
          return notEnded
        })
      }
      return notEnded
    }
    const recInheritSlots = (children: Node[]) => {
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i]!
        if (f(child) === false) return false
        if (child instanceof Element && child._$inheritSlots) {
          if (!recInheritSlots(child.childNodes)) return false
        }
      }
      return true
    }
    if (!recInheritSlots(this.childNodes)) return false
    return true
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
    if (backendElement) {
      if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
        const e = backendElement as domlikeBackend.Element
        const res = e.getBoundingClientRect()
        setTimeout(() => {
          cb(res)
        }, 0)
      } else {
        ;(backendElement as backend.Element | composedBackend.Element).getBoundingClientRect(cb)
      }
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

  /**
   * Get the bounding client rect
   *
   * Return zero values when the backend element is invalid or it does not have layout information.
   */
  getScrollOffset(cb: (res: ScrollOffset) => void): void {
    const backendElement = this._$backendElement
    if (backendElement) {
      if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
        const e = backendElement as domlikeBackend.Element
        const res = {
          scrollLeft: e.scrollLeft,
          scrollTop: e.scrollTop,
          scrollWidth: e.scrollWidth,
          scrollHeight: e.scrollHeight,
        }
        setTimeout(() => {
          cb(res)
        }, 0)
      } else {
        ;(backendElement as backend.Element | composedBackend.Element).getScrollOffset(cb)
      }
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
    listener: (res: IntersectionStatus) => void,
  ): Observer | null {
    const backendElement = this._$backendElement
    if (backendElement) {
      if (relativeElement && !relativeElement._$backendElement) {
        return null
      }
      if (BM.DOMLIKE || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Domlike)) {
        return (this._$nodeTreeContext as domlikeBackend.Context).createIntersectionObserver(
          backendElement as domlikeBackend.Element,
          (relativeElement?._$backendElement as domlikeBackend.Element | undefined) || null,
          relativeElementMargin,
          thresholds,
          listener,
        )
      }
      return (backendElement as backend.Element).createIntersectionObserver(
        (relativeElement?._$backendElement as backend.Element | undefined) || null,
        relativeElementMargin,
        thresholds,
        listener,
      )
    }
    return null
  }
}
