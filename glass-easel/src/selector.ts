import { type ComponentSpace } from './component_space'
import { type Element } from './element'
import { isComponent, isElement, isShadowRoot, isVirtualNode } from './type_symbol'

const enum SegmentRelation {
  Child,
  Descendant,
  CrossShadowDescendant,
}

type Segment = {
  id: string
  classes: string[]
  relation: SegmentRelation
}

type Union = Segment[]

// eslint-disable-next-line arrow-body-style
const getOwnerSpace = (node: Element) => {
  return node.ownerShadowRoot?.getHostNode().getRootBehavior().ownerSpace
}

/** A parsed selector that can be used in selector queries */
export class ParsedSelector {
  unions: Union[] = []

  private static _$parseSegment(str: string, relation: SegmentRelation): Segment | null {
    const matches = /^(#[_a-zA-Z][-_a-zA-Z0-9:]*|)((?:\.-?[_a-zA-Z][-_a-zA-Z0-9]*)+|)$/.exec(str)
    if (!matches) return null
    const id = matches[1]!.slice(1)
    const classes = matches[2]!.split('.')
    classes.shift()
    if (!id && !classes.length) return null
    return {
      id,
      classes,
      relation,
    }
  }

  constructor(str: string) {
    const union = String(str || '').split(',')
    for (let i = 0; i < union.length; i += 1) {
      const segments = union[i]!.split(/( |\t|>+)/g)
      const parsedSegs: Segment[] = []
      let relation = SegmentRelation.Descendant
      let j = 0
      for (; j < segments.length; j += 1) {
        const seg = segments[j]
        if (!seg || seg === ' ' || seg === '\t' || seg === '>>') continue
        if (seg[0] === '>') {
          if (relation !== SegmentRelation.Descendant) break
          if (seg.length === 3) {
            relation = SegmentRelation.CrossShadowDescendant
          } else {
            relation = SegmentRelation.Child
          }
          continue
        }
        const parsedSeg = ParsedSelector._$parseSegment(seg, relation)
        relation = SegmentRelation.Descendant
        if (!parsedSeg) break
        parsedSegs.push(parsedSeg)
      }
      if (j !== segments.length) continue
      if (parsedSegs.length) this.unions.push(parsedSegs)
    }
  }

  /** Whether the selector is empty */
  isEmpty(): boolean {
    return this.unions.length === 0
  }

  private static _$testSelectorSegment(
    root: Element | null,
    ownerSpace: ComponentSpace,
    node: Element,
    segments: Segment[],
    offset: number,
    relation: SegmentRelation,
  ): boolean {
    if (node === root) return false
    const segment = segments[offset]!
    // test whether current node matches
    let match = true
    if (getOwnerSpace(node) !== ownerSpace) match = false
    else if (segment.id && segment.id !== node.id) match = false
    const classes = segment.classes
    for (let i = 0; match && i < classes.length; i += 1) {
      if (!node.classList?.contains(classes[i]!)) match = false
    }
    if (!match && relation === SegmentRelation.Child) return false
    let nextNode: Element | null = node
    if (match && offset === 0) {
      // if matches the first segment, check whether root is in the same shadow tree
      if (root === null) return true
      for (nextNode = nextNode.parentNode; nextNode; nextNode = nextNode.parentNode) {
        if (nextNode === root) return true
      }
      if (relation !== SegmentRelation.CrossShadowDescendant) return false
      nextNode = node
      match = false
    }
    // check whether ancestors matches
    const nextRelation = match ? segment.relation : relation
    do {
      if (!nextNode.parentNode) {
        if (nextRelation === SegmentRelation.CrossShadowDescendant) {
          nextNode = isShadowRoot(nextNode) ? nextNode.getHostNode() : null
        } else if (relation === SegmentRelation.CrossShadowDescendant) {
          match = false
          nextNode = isShadowRoot(nextNode) ? nextNode.getHostNode() : null
        } else {
          nextNode = null
        }
      } else {
        nextNode = nextNode.parentNode
      }
      if (nextNode === root) nextNode = null
    } while (isVirtualNode(nextNode))
    if (!nextNode) return false
    if (match) {
      // if matches, try match ancestors
      const matchRes = ParsedSelector._$testSelectorSegment(
        root,
        ownerSpace,
        nextNode,
        segments,
        offset - 1,
        nextRelation,
      )
      if (matchRes) return true
      if (relation !== SegmentRelation.CrossShadowDescendant) return false
    }
    return ParsedSelector._$testSelectorSegment(
      root,
      ownerSpace,
      nextNode,
      segments,
      offset,
      relation,
    )
  }

  /**
   * Test whether the specified node matches the selector
   *
   * If `root` is specified, than the selector is match inside this subtree;
   * otherwise it match in the whole tree.
   */
  testSelector(root: Element | null, node: Element): boolean {
    if (isVirtualNode(node)) return false
    const union = this.unions
    let ownerSpace: ComponentSpace | undefined
    if (root !== null) {
      ownerSpace = getOwnerSpace(root) || getOwnerSpace(node)
    } else {
      ownerSpace = getOwnerSpace(node)
    }
    if (ownerSpace === undefined) return false
    for (let i = 0; i < union.length; i += 1) {
      const segments = union[i]!
      const matched = ParsedSelector._$testSelectorSegment(
        root,
        ownerSpace,
        node,
        segments,
        segments.length - 1,
        SegmentRelation.Child,
      )
      if (matched) return true
    }
    return false
  }

  /** Queries an element or elements that matches this selector */
  query(root: Element, findOne: boolean): Element[] | Element | null {
    const ret: Element[] = []
    const rec = (root: Element, node: Element, findOne: boolean): Element[] | Element | null => {
      if (this.testSelector(root, node)) {
        if (findOne) return node
        ret.push(node)
      }
      if (isComponent(node)) {
        const shadowRoot = node.getShadowRoot()
        if (shadowRoot) {
          const r = rec(root, shadowRoot, findOne)
          if (r && findOne) {
            return r
          }
        }
      }
      const children = node.childNodes
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i]
        if (isElement(child)) {
          const r = rec(root, child, findOne)
          if (r && findOne) {
            return r
          }
        }
      }
      return null
    }
    const r = rec(root, root, findOne)
    if (findOne) return r
    return ret
  }
}
