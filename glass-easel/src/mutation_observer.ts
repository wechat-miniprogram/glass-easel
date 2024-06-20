import { type Element } from './element'
import { FuncArr } from './func_arr'
import { type Node } from './node'
import { type TextNode } from './text_node'
import { isElement } from './type_symbol'

/**
 * What the observer will listen
 */
export type MutationObserverOptions = {
  /** Attribute changes, including property, id, slot, and class changes */
  properties: boolean
  /** Child nodes changes */
  childList: boolean
  /** Text content changes */
  characterData: boolean
  /** Enable property, childList, and characterData changes in subtree */
  subtree: boolean
  /** Attached status changes */
  attachStatus: boolean
}

export type MutationObserverAttrEvent = {
  type: 'properties'
  target: Element
  propertyName?: string
  attributeName?: string
}

export type MutationObserverTextEvent = {
  type: 'characterData'
  target: TextNode
}

export type MutationObserverChildEvent = {
  type: 'childList'
  target: Element
  addedNodes?: Node[]
  removedNodes?: Node[]
}

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

export type MutationObserverListener<T> = (this: Element, ev: T) => void

export class MutationObserverTarget {
  private _$boundElement: Element
  private _$subtreeObserversCount = 0
  attrObservers: FuncArr<MutationObserverListener<MutationObserverAttrEvent>> | null = null
  textObservers: FuncArr<MutationObserverListener<MutationObserverTextEvent>> | null = null
  childObservers: FuncArr<MutationObserverListener<MutationObserverChildEvent>> | null = null
  attachObservers: FuncArr<MutationObserverListener<MutationObserverAttachEvent>> | null = null

  constructor(boundElement: Element) {
    this._$boundElement = boundElement
  }

  attachChild(child: Element) {
    if (!child._$mutationObserverTarget) {
      child._$mutationObserverTarget = new MutationObserverTarget(child)
    }
    if (this._$subtreeObserversCount > 0) {
      child._$mutationObserverTarget.updateSubtreeCount(this._$subtreeObserversCount)
    }
  }

  detachChild(child: Element) {
    if (child._$mutationObserverTarget) {
      child._$mutationObserverTarget.updateSubtreeCount(-this._$subtreeObserversCount)
    }
  }

  updateSubtreeCount(diff: number) {
    this._$subtreeObserversCount += diff
    const children = this._$boundElement.childNodes
    children.forEach((child) => {
      if (isElement(child)) {
        if (!child._$mutationObserverTarget) {
          child._$mutationObserverTarget = new MutationObserverTarget(child)
        }
        child._$mutationObserverTarget.updateSubtreeCount(diff)
      }
    })
  }

  hasSubtreeListeners(): boolean {
    return this._$subtreeObserversCount > 0
  }

  static callAttrObservers(node: Element, eventObj: MutationObserverAttrEvent) {
    let cur = node
    do {
      const target = cur._$mutationObserverTarget
      target?.attrObservers?.call(cur, [eventObj])
      const next = cur.parentNode
      if (!next) break
      cur = next
      if (!cur._$mutationObserverTarget) break
    } while (cur._$mutationObserverTarget._$subtreeObserversCount > 0)
  }

  static callTextObservers(textNode: TextNode, eventObj: MutationObserverTextEvent) {
    let cur = textNode.parentNode
    while (cur) {
      const target = cur._$mutationObserverTarget
      if (!target || target._$subtreeObserversCount === 0) break
      target.textObservers?.call(cur, [eventObj])
      cur = cur.parentNode
    }
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
  private _$listener: MutationObserverListener<MutationObserverEvent> | null
  private _$normalizedListener: MutationObserverListener<MutationObserverEvent> | null
  private _$subtreeListenersCount = 0
  private _$boundFuncArrs: FuncArr<MutationObserverListener<MutationObserverEvent>>[] = []
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
    targetElement: Element,
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
    if (targetElement._$mutationObserverTarget) {
      target = targetElement._$mutationObserverTarget
    } else {
      target = new MutationObserverTarget(targetElement)
      targetElement._$mutationObserverTarget = target
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
    if (options.properties) {
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
