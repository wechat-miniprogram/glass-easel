import { type GeneralComponent } from './component'
import { type Element } from './element'
import { type NativeNode } from './native_node'
import { type ShadowRoot } from './shadow_root'
import { type TextNode } from './text_node'
import { type VirtualNode } from './virtual_node'

export const TEXT_NODE_SYMBOL = Symbol('TextNode')

export const ELEMENT_SYMBOL = Symbol('Element')

export const NATIVE_NODE_SYMBOL = Symbol('NativeNode')

export const VIRTUAL_NODE_SYMBOL = Symbol('VirtualNode')

export const SHADOW_ROOT_SYMBOL = Symbol('ShadowRootSymbol')

export const COMPONENT_SYMBOL = Symbol('Component')

export const isTextNode = (e: any): e is TextNode =>
  !!e && (e as { [TEXT_NODE_SYMBOL]: boolean })[TEXT_NODE_SYMBOL]

export const isElement = (e: any): e is Element =>
  !!e && (e as { [ELEMENT_SYMBOL]: boolean })[ELEMENT_SYMBOL]

export const isNativeNode = (e: any): e is NativeNode =>
  !!e && (e as { [NATIVE_NODE_SYMBOL]: boolean })[NATIVE_NODE_SYMBOL]

export const isVirtualNode = (e: any): e is VirtualNode =>
  !!e && (e as { [VIRTUAL_NODE_SYMBOL]: boolean })[VIRTUAL_NODE_SYMBOL]

export const isShadowRoot = (e: any): e is ShadowRoot =>
  !!e && (e as { [SHADOW_ROOT_SYMBOL]: boolean })[SHADOW_ROOT_SYMBOL]

export const isComponent = (e: any): e is GeneralComponent =>
  !!e && (e as { [COMPONENT_SYMBOL]: boolean })[COMPONENT_SYMBOL]
