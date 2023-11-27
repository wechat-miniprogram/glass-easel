/* eslint-disable import/first */
/* eslint-disable arrow-body-style */

export {
  BackendMode,
  GeneralBackendContext,
  GeneralBackendElement,
  backend,
  composedBackend,
  domlikeBackend,
} from './backend'
export { CurrentWindowBackendContext } from './backend/current_window_backend_context'
export { EmptyBackendContext } from './backend/empty_backend'
export { EmptyComposedBackendContext } from './backend/empty_composed_backend'
export {
  Behavior,
  BehaviorBuilder,
  BuilderContext,
  GeneralBehavior,
  GeneralBehaviorBuilder,
} from './behavior'
export { ClassList, StyleScopeId, StyleScopeManager } from './class_list'
export {
  Component,
  ComponentDefinition,
  GeneralComponent,
  GeneralComponentDefinition,
} from './component'
export * as typeUtils from './component_params'
export { ComponentSpace, getDefaultComponentSpace } from './component_space'
export * as dataPath from './data_path'
export {
  DataChange,
  DataGroup,
  DataObserver,
  DataUpdateCallback,
  DataValue,
  GeneralDataGroup,
  NormalizedPropertyType,
  PropertyChange,
} from './data_proxy'
export * as dataUtils from './data_utils'
export { Element, StyleSegmentIndex, setRevertEventDefaultPrevented } from './element'
export { ElementIterator, ElementIteratorType } from './element_iterator'
export {
  Event,
  EventBubbleStatus,
  EventListener,
  EventListenerOptions,
  MutLevel as EventMutLevel,
  EventOptions,
  ShadowedEvent,
} from './event'
export { ExternalShadowRoot } from './external_shadow_tree'
export { FuncArr, GeneralFuncType, safeCallback } from './func_arr'
export {
  ComponentOptions,
  DeepCopyKind,
  EnvironmentOptions,
  NormalizedComponentOptions,
  globalOptions,
} from './global_options'
export { MutationObserver, MutationObserver as Observer } from './mutation_observer'
export { NativeNode, NativeNodeAttributeFilter, ExtendedNativeNodeDefinition } from './native_node'
export { Node, NodeCast, dumpElement, dumpElementToString, dumpSingleElementToString } from './node'
export { RelationFailedListener, RelationListener, RelationType } from './relation'
export { triggerRender } from './render'
export { ParsedSelector } from './selector'
export { ShadowRoot } from './shadow_root'
export * as templateEngine from './template_engine'
export { TextNode } from './text_node'
export * as template from './tmpl'
export { TraitBehavior } from './trait_behaviors'
export { VirtualNode } from './virtual_node'
export {
  addGlobalErrorListener,
  addGlobalWarningListener,
  removeGlobalErrorListener,
  removeGlobalWarningListener,
} from './warning'

import { type Behavior } from './behavior'
import {
  Component,
  type ComponentDefinition,
  type GeneralComponent,
  type GeneralComponentDefinition,
} from './component'
import {
  type ComponentInstance,
  type ComponentParams,
  type DataList,
  type Empty,
  type MethodList,
  type PropertyList,
} from './component_params'
import { getDefaultComponentSpace } from './component_space'
import { Event } from './event'

export const registerBehavior = <
  TData extends DataList = Empty,
  TProperty extends PropertyList = Empty,
  TMethod extends MethodList = Empty,
>(
  def: ComponentParams<TData, TProperty, TMethod> &
    ThisType<ComponentInstance<TData, TProperty, TMethod>>,
): Behavior<TData, TProperty, TMethod, never> => {
  return getDefaultComponentSpace().defineBehavior(def)
}

export const registerElement = <
  TData extends DataList = Empty,
  TProperty extends PropertyList = Empty,
  TMethod extends MethodList = Empty,
>(
  def: ComponentParams<TData, TProperty, TMethod> &
    ThisType<ComponentInstance<TData, TProperty, TMethod>>,
): ComponentDefinition<TData, TProperty, TMethod> => {
  return getDefaultComponentSpace().defineComponent(def)
}

export function createElement(
  tagName: string,
  compDef?: GeneralComponentDefinition,
): GeneralComponent
export function createElement<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
>(
  tagName: string,
  compDef: ComponentDefinition<TData, TProperty, TMethod>,
): ComponentInstance<TData, TProperty, TMethod>
export function createElement(
  tagName: string,
  compDef?: GeneralComponentDefinition,
): GeneralComponent {
  return Component.create(tagName, compDef || null)
}

export const triggerEvent = Event.triggerEvent
export const triggerExternalEvent = Event.triggerExternalEvent
