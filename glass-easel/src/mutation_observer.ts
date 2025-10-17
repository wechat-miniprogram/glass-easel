import { type Element } from './element'
import { FuncArr } from './func_arr'
import { type Node } from './node'
import { type TextNode } from './text_node'
import { isElement } from './type_symbol'

/**
 * What the observer will listen
 */
export type MutationObserverOptions = {
  /**
   * Changes of element parameters
   *
   * If set to `true` , the non-data changes will be returned,
   * including attributes, component properties, external classes, id, class, style, slot, and slot names.
   * If set to `all` , all changes will be returned.
   */
  properties: boolean | 'all'
  /** Child nodes changes */
  childList: boolean
  /** Text content changes */
  characterData: boolean
  /** Enable property, childList, and characterData changes in subtree */
  subtree: boolean
  /** Attached status changes (does not support subtree listening) */
  attachStatus: boolean
}

/**
 * The event for element parameter changes
 *
 * This includes most changes to an element except for its children changes.
 * If the change is a property change for an element or slot value change for a slot node,
 * the `propertyName` field is provided as the normalized property name;
 * otherwise the `attributeName` is provided.
 * For dataset and mark changes, the `data:` and `mark:` are preserved in `attributeName` .
 * Note that attribute, dataset, mark, and external class events are dispatched whenever they are set (may not changed).
 */
export type MutationObserverAttrEvent = {
  type: 'properties'
  target: Element
  nameType:
    | 'basic'
    | 'attribute'
    | 'component-property'
    | 'slot-value'
    | 'dataset'
    | 'mark'
    | 'external-class'
  propertyName?: string
  attributeName?: string
}

/**
 * The event for the text content changes of a text node
 */
export type MutationObserverTextEvent = {
  type: 'characterData'
  target: TextNode
}

/**
 * The event for some child nodes added or removed
 */
export type MutationObserverChildEvent = {
  type: 'childList'
  target: Element
  addedNodes?: Node[]
  removedNodes?: Node[]
}

/**
 * The event for the element attaches or detaches
 */
export type MutationObserverAttachEvent = {
  type: 'attachStatus'
  target: Element
  status: 'attached' | 'detached'
}

export type MutationObserverEvent =
  | MutationObserverAttrEvent
  | MutationObserverTextEvent
  | MutationObserverChildEvent
  | MutationObserverAttachEvent

export type MutationObserverListener<T> = (this: Node, ev: T) => void

export class MutationObserverTarget {
  /* @internal */
  private _$bound: Node
  /* @internal */
  private _$subtreeObserversCount = 0
  attrObservers: FuncArr<MutationObserverListener<MutationObserverAttrEvent>> | null = null
  allAttrObservers: FuncArr<MutationObserverListener<MutationObserverAttrEvent>> | null = null
  textObservers: FuncArr<MutationObserverListener<MutationObserverTextEvent>> | null = null
  childObservers: FuncArr<MutationObserverListener<MutationObserverChildEvent>> | null = null
  attachObservers: FuncArr<MutationObserverListener<MutationObserverAttachEvent>> | null = null

  constructor(bound: Node) {
    this._$bound = bound
  }

  attachChild(child: Node) {
    if (!child._$mutationObserverTarget) {
      child._$mutationObserverTarget = new MutationObserverTarget(child)
    }
    if (this._$subtreeObserversCount > 0) {
      child._$mutationObserverTarget.updateSubtreeCount(this._$subtreeObserversCount)
    }
  }

  detachChild(child: Node) {
    if (child._$mutationObserverTarget) {
      child._$mutationObserverTarget.updateSubtreeCount(-this._$subtreeObserversCount)
    }
  }

  updateSubtreeCount(diff: number) {
    this._$subtreeObserversCount += diff
    const elem = this._$bound
    if (!isElement(elem)) return
    const children = elem.childNodes
    children.forEach((child) => {
      if (!child._$mutationObserverTarget) {
        child._$mutationObserverTarget = new MutationObserverTarget(child)
      }
      child._$mutationObserverTarget.updateSubtreeCount(diff)
    })
  }

  hasSubtreeListeners(): boolean {
    return this._$subtreeObserversCount > 0
  }

  static callAttrObservers(node: Element, eventObj: MutationObserverAttrEvent) {
    let cur = node
    do {
      const target = cur._$mutationObserverTarget
      target?.allAttrObservers?.call(cur, [eventObj])
      if (
        target?.attrObservers &&
        (eventObj.nameType === 'basic' ||
          eventObj.nameType === 'attribute' ||
          eventObj.nameType === 'component-property')
      ) {
        target.attrObservers.call(cur, [eventObj])
      }
      const next = cur.parentNode
      if (!next) break
      cur = next
      if (!cur._$mutationObserverTarget) break
    } while (cur._$mutationObserverTarget._$subtreeObserversCount > 0)
  }

  static callTextObservers(textNode: TextNode, eventObj: MutationObserverTextEvent) {
    let cur: Node = textNode
    do {
      const target = cur._$mutationObserverTarget
      target?.textObservers?.call(cur, [eventObj])
      const next: Element | null = cur.parentNode
      if (!next) break
      cur = next
      if (!cur._$mutationObserverTarget) break
    } while (cur._$mutationObserverTarget._$subtreeObserversCount > 0)
  }

  static callChildObservers(node: Element, eventObj: MutationObserverChildEvent) {
    let cur = node
    do {
      const target = cur._$mutationObserverTarget
      target?.childObservers?.call(cur, [eventObj])
      const next = cur.parentNode
      if (!next) break
      cur = next
      if (!cur._$mutationObserverTarget) break
    } while (cur._$mutationObserverTarget._$subtreeObserversCount > 0)
  }

  static callAttachObservers(node: Element, eventObj: MutationObserverAttachEvent) {
    const target = node._$mutationObserverTarget
    target?.attachObservers?.call(node, [eventObj])
  }
}

/**
 * An observer that can observe shadow tree changes
 *
 * Like DOM MutationObserver,
 * this observer can observe attributes, text content, and child nodes changes.
 * It can optionally observe changes in a subtree.
 * Further more, it can listen attached/detached events on an element.
 */
export class MutationObserver {
  /* @internal */
  private _$listener: MutationObserverListener<MutationObserverEvent> | null
  /* @internal */
  private _$normalizedListener: MutationObserverListener<MutationObserverEvent> | null
  /* @internal */
  private _$subtreeListenersCount = 0
  /* @internal */
  private _$boundFuncArrs: FuncArr<MutationObserverListener<MutationObserverEvent>>[] = []
  /* @internal */
  private _$boundTarget: MutationObserverTarget | null = null

  constructor(listener: (ev: MutationObserverEvent) => void) {
    this._$listener = listener
    this._$normalizedListener = null
  }

  static create(listener: (ev: MutationObserverEvent) => void): MutationObserver {
    return new MutationObserver(listener)
  }

  /** Start observation */
  observe(
    targetNode: Node,
    options: Partial<MutationObserverOptions> = {
      properties: false,
      childList: false,
      characterData: false,
      subtree: false,
      attachStatus: false,
    },
  ) {
    const listener = this._$listener
    if (!listener) {
      throw new Error('A MutationObserver can only observe once')
    }
    let target: MutationObserverTarget
    if (targetNode._$mutationObserverTarget) {
      target = targetNode._$mutationObserverTarget
    } else {
      target = new MutationObserverTarget(targetNode)
      targetNode._$mutationObserverTarget = target
    }
    this._$listener = null
    const cb = options.subtree
      ? listener
      : function noSubtreeListener(this: Node, ev: MutationObserverEvent) {
          // this might be TextNode, but do the same as Element
          if (ev.target === this) listener.call(this as Element, ev)
        }
    this._$normalizedListener = cb
    this._$boundTarget = target
    if (options.properties === 'all') {
      if (!target.allAttrObservers) target.allAttrObservers = new FuncArr('attributeObserver')
      target.allAttrObservers.add(cb)
      this._$boundFuncArrs.push(
        target.allAttrObservers as FuncArr<MutationObserverListener<MutationObserverEvent>>,
      )
      this._$subtreeListenersCount += 1
    } else if (options.properties) {
      if (!target.attrObservers) target.attrObservers = new FuncArr('attributeObserver')
      target.attrObservers.add(cb)
      this._$boundFuncArrs.push(
        target.attrObservers as FuncArr<MutationObserverListener<MutationObserverEvent>>,
      )
      this._$subtreeListenersCount += 1
    }
    if (options.childList) {
      if (!target.childObservers) target.childObservers = new FuncArr('childObserver')
      target.childObservers.add(cb)
      this._$boundFuncArrs.push(
        target.childObservers as FuncArr<MutationObserverListener<MutationObserverEvent>>,
      )
      this._$subtreeListenersCount += 1
    }
    if (options.characterData) {
      if (!target.textObservers) target.textObservers = new FuncArr('textObserver')
      target.textObservers.add(cb)
      this._$boundFuncArrs.push(
        target.textObservers as FuncArr<MutationObserverListener<MutationObserverEvent>>,
      )
      this._$subtreeListenersCount += 1
    }
    if (options.subtree) {
      target.updateSubtreeCount(this._$subtreeListenersCount)
    }
    if (options.attachStatus) {
      if (!target.attachObservers) target.attachObservers = new FuncArr('attachObserver')
      target.attachObservers.add(cb)
      this._$boundFuncArrs.push(
        target.attachObservers as FuncArr<MutationObserverListener<MutationObserverEvent>>,
      )
    }
  }

  /** End observation */
  disconnect() {
    this._$boundTarget?.updateSubtreeCount(-this._$subtreeListenersCount)
    const arr = this._$boundFuncArrs
    this._$boundFuncArrs = []
    const nl = this._$normalizedListener
    if (nl) {
      arr.forEach((funcArr) => {
        funcArr.remove(nl)
      })
    }
  }
}
