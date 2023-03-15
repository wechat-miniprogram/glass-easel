import * as backend from './backend/backend_protocol'
import * as composedBackend from './backend/composed_backend_protocol'
import * as domlikeBackend from './backend/domlike_backend_protocol'
import * as suggestedBackend from './backend/suggested_backend_protocol'
import { TextNode } from './text_node'
import { Element } from './element'
import { VirtualNode } from './virtual_node'
import { Component, ComponentDefinition } from './component'
import { NativeNode } from './native_node'
import { DataList, PropertyList, MethodList, ComponentInstance } from './component_params'

export type GeneralBackendContext = (
  | backend.Context
  | composedBackend.Context
  | domlikeBackend.Context
) &
  Partial<suggestedBackend.Context>
export type GeneralBackendElement = (
  | backend.Element
  | composedBackend.Element
  | domlikeBackend.Element
) &
  Partial<suggestedBackend.Element>

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
  if (elem instanceof Element) {
    if (elem._$slotName !== null) ret += ` (slot) name="${elem._$slotName}"`
    if (elem.id) ret += ` id="${elem.id}"`
    if (elem.slot) ret += ` slot="${elem.slot}"`
    const nodeClass = elem.class
    if (nodeClass) ret += ` class="${nodeClass}"`
    const style = elem.style
    if (style) ret += ` style="${elem.style}"`
  }
  if (elem instanceof VirtualNode) {
    // empty
  } else if (elem instanceof Component) {
    Component.listProperties(elem).forEach((propName) => {
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
  if (elem instanceof Element) {
    let tagName: string
    if (elem instanceof VirtualNode) {
      tagName = `(virtual):${elem.is}`
    } else if (elem instanceof Component) {
      tagName = `${elem.tagName}:${elem.is}`
    } else if (elem instanceof NativeNode) {
      tagName = elem.is
    } else {
      tagName = '(unknown)'
    }
    return `<${tagName}${dumpAttributesToString(elem)}>`
  }
  if (elem instanceof TextNode) {
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

  if (elem instanceof Element) {
    if (elem instanceof Component) {
      isExternal = elem.getComponentOptions().externalComponent
    }
    if (composed) {
      if (isExternal) {
        ret += `\n${linePrefix}  <(external)>`
        elem.childNodes.forEach((node) => {
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
