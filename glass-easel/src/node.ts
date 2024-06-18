import { type GeneralComponent, type ComponentDefinition } from './component'
import {
  type ComponentInstance,
  type DataList,
  type MethodList,
  type PropertyList,
} from './component_params'
import { type Element } from './element'
import { type NativeNode } from './native_node'
import { type TextNode } from './text_node'
import { isComponent, isElement, isNativeNode, isTextNode, isVirtualNode } from './type_symbol'
import { type VirtualNode } from './virtual_node'

export type Node = TextNode | Element

export interface NodeCast {
  /**
   * Cast a node to a text node
   *
   * Returns `null` if the element is not a text node.
   */
  asTextNode(): TextNode | null

  /**
   * Cast a node to an element (native node, virtual node, or component node)
   *
   * Returns `null` if the element is not a text node.
   */
  asElement(): Element | null

  /**
   * Cast an element to a native node
   *
   * Returns `null` if the element is not a native node.
   */
  asNativeNode(): NativeNode | null

  /**
   * Cast an element to a virtual node
   *
   * Returns `null` if the element is not a virtual node.
   */
  asVirtualNode(): VirtualNode | null

  /**
   * Cast an element to a general component
   *
   * Returns `null` if the element is not a component
   */
  asGeneralComponent(): GeneralComponent | null

  /**
   * Cast an element to the instance of the specified component
   *
   * Returns `null` if the element is not the instance of the specified component.
   */
  asInstanceOf<UData extends DataList, UProperty extends PropertyList, UMethod extends MethodList>(
    componentDefinition: ComponentDefinition<UData, UProperty, UMethod>,
  ): ComponentInstance<UData, UProperty, UMethod> | null
}

const dumpAttributesToString = (elem: Element): string => {
  let ret = ''
  if (isElement(elem)) {
    if (elem._$slotName !== null) ret += ` (slot) name="${elem._$slotName}"`
    if (elem.id) ret += ` id="${elem.id}"`
    if (elem.slot) ret += ` slot="${elem.slot}"`
    const nodeClass = elem.class
    if (nodeClass) ret += ` class="${nodeClass}"`
    const style = elem.style
    if (style) ret += ` style="${elem.style}"`
  }
  if (isVirtualNode(elem)) {
    // empty
  } else if (isComponent(elem)) {
    Object.keys(elem._$behavior._$propertyMap).forEach((propName) => {
      ret += ` ${propName}="${String((elem.data as DataList)[propName])}"`
    })
  } else {
    elem.attributes.forEach((attr) => {
      ret += ` ${attr.name}="${String(attr.value)}"`
    })
  }
  return ret
}

export const dumpSingleElementToString = (elem: any) => {
  if (isElement(elem)) {
    let tagName: string
    if (isVirtualNode(elem)) {
      tagName = `(virtual):${elem.is}`
    } else if (isComponent(elem)) {
      tagName = `${elem.tagName}:${elem.is}`
    } else if (isNativeNode(elem)) {
      tagName = elem.is
    } else {
      tagName = '(unknown)'
    }
    return `<${tagName}${dumpAttributesToString(elem)}>`
  }
  if (isTextNode(elem)) {
    return elem.textContent.trim()
  }
  if (elem === null) {
    return '<(null)>'
  }
  if (elem === undefined) {
    return '<(undefined)>'
  }
  return '<(unknown)>'
}

export const dumpElementToString = (elem: any, composed: boolean, tabDepth = 0) => {
  let linePrefix = ''
  for (let i = tabDepth; i; i -= 1) {
    linePrefix += '  '
  }

  let ret = linePrefix + dumpSingleElementToString(elem)
  let isExternal = false

  if (isElement(elem)) {
    if (isComponent(elem)) {
      isExternal = elem._$external
    }
    if (composed) {
      if (isExternal) {
        ret += `\n${linePrefix}  <(external)>`
        elem.forEachComposedChild((node) => {
          ret += `\n${dumpElementToString(node, composed, tabDepth + 2)}`
        })
      } else {
        elem.forEachComposedChild((node) => {
          ret += `\n${dumpElementToString(node, composed, tabDepth + 1)}`
        })
      }
    } else {
      elem.childNodes.forEach((node) => {
        ret += `\n${dumpElementToString(node, composed, tabDepth + 1)}`
      })
    }
  }

  return ret
}

export const dumpElement = (elem: any, composed: boolean) => {
  // eslint-disable-next-line no-console
  console.log(dumpElementToString(elem, composed))
}
