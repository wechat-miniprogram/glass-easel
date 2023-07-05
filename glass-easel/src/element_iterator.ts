import { Element } from './element'
import { TextNode } from './text_node'
import { Node } from './node'

/** The iterator direction and order */
export const enum ElementIteratorType {
  /** Iterate all ancestors in shadow tree */
  ShadowAncestors = 'shadow-ancestors',
  /** Iterate all ancestors in composed tree */
  ComposedAncestors = 'composed-ancestors',
  /** Iterate all descendants in shadow tree, returning parents before their children */
  ShadowDescendantsRootFirst = 'shadow-descendants-root-first',
  /** Iterate all descendants in shadow tree, returning parents after their children */
  ShadowDescendantsRootLast = 'shadow-descendants-root-last',
  /** Iterate all descendants in composed tree, returning parents before their children */
  ComposedDescendantsRootFirst = 'composed-descendants-root-first',
  /** Iterate all descendants in composed tree, returning parents after their children */
  ComposedDescendantsRootLast = 'composed-descendants-root-last',
}

/**
 * An iterator for node tree traversal
 *
 * This iterator is convinient but seems a little slower.
 */
export class ElementIterator {
  private _$node: Node
  private _$nodeTypeLimit: unknown
  private _$composed: boolean
  private _$isAncestor: boolean
  private _$rootFirst: boolean

  /**
   * Create an iterator with type specified
   *
   * The `nodeTypeLimit` is used to limit which kind of nodes will be returned.
   * It limits the returned result by an `instanceof` call.
   * The default value is `Element` ,
   * which means only elements will be returned (text nodes will not).
   * Consider specifying `Node` if text nodes need to be returned as well as elements.
   * Specify `Component` will only return components.
   */
  constructor(node: Node, type: ElementIteratorType, nodeTypeLimit: unknown = Element) {
    if (!(node instanceof Element) && !(node instanceof TextNode)) {
      throw new Error('Element iterators can only be used in elements or text nodes')
    }
    this._$node = node
    this._$nodeTypeLimit = nodeTypeLimit || Element
    if (
      type === ElementIteratorType.ShadowAncestors ||
      type === ElementIteratorType.ShadowDescendantsRootFirst ||
      type === ElementIteratorType.ShadowDescendantsRootLast
    ) {
      this._$composed = false
    } else if (
      type === ElementIteratorType.ComposedAncestors ||
      type === ElementIteratorType.ComposedDescendantsRootFirst ||
      type === ElementIteratorType.ComposedDescendantsRootLast
    ) {
      this._$composed = true
    } else {
      throw new Error(`Unrecognized iterator type "${String(type)}"`)
    }
    if (
      type === ElementIteratorType.ShadowAncestors ||
      type === ElementIteratorType.ComposedAncestors
    ) {
      this._$isAncestor = true
    } else {
      this._$isAncestor = false
    }
    if (
      type === ElementIteratorType.ShadowDescendantsRootFirst ||
      type === ElementIteratorType.ComposedDescendantsRootFirst
    ) {
      this._$rootFirst = true
    } else {
      this._$rootFirst = false
    }
  }

  /** Same as constructor (for backward compatibility) */
  static create(node: Node, type: ElementIteratorType, nodeTypeLimit?: unknown): ElementIterator {
    return new ElementIterator(node, type, nodeTypeLimit)
  }

  forEach(f: (node: Node) => boolean) {
    const nodeTypeLimit: any = this._$nodeTypeLimit
    const composed = this._$composed
    if (this._$isAncestor) {
      const rec = (node: Node): boolean => {
        let cur = node
        for (;;) {
          if (cur instanceof nodeTypeLimit) {
            if (f(cur) === false) return false
          }
          const next = composed ? cur.getComposedParent() : cur.parentNode
          if (!next) break
          cur = next
        }
        return true
      }
      rec(this._$node)
    } else {
      const rootFirst = this._$rootFirst
      const rec = (node: Node): boolean => {
        if (rootFirst) {
          if (node instanceof nodeTypeLimit) {
            if (f(node) === false) return false
          }
        }
        if (node instanceof Element) {
          let interrupted = false
          const childFn = (child: Node) => {
            if (rec(child) === false) {
              interrupted = true
              return false
            }
            return true
          }
          if (composed) {
            node.forEachComposedChild(childFn)
          } else {
            node.childNodes.forEach(childFn)
          }
          if (interrupted) return false
        }
        if (!rootFirst) {
          if (node instanceof nodeTypeLimit) {
            if (f(node) === false) return false
          }
        }
        return true
      }
      rec(this._$node)
    }
  }
}
