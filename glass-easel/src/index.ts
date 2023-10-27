/* eslint-disable import/first */
/* eslint-disable arrow-body-style */

export { TextNode } from './text_node'
export { NativeNode } from './native_node'
export { ShadowRoot } from './shadow_root'
export { VirtualNode } from './virtual_node'
export {
  globalOptions,
  DeepCopyKind,
  ComponentOptions,
  EnvironmentOptions,
  NormalizedComponentOptions,
  getDefaultComponentSpace,
} from './global_options'
export { Element, StyleSegmentIndex, setRevertEventDefaultPrevented } from './element'
export * as dataUtils from './data_utils'
export * as dataPath from './data_path'
export {
  DataGroup,
  GeneralDataGroup,
  DataValue,
  DataObserver,
  DataChange,
  PropertyChange,
  DataUpdateCallback,
} from './data_proxy'
export {
  Event,
  ShadowedEvent,
  EventBubbleStatus,
  EventOptions,
  EventListener,
  EventListenerOptions,
  MutLevel as EventMutLevel,
} from './event'
export * as typeUtils from './component_params'
export {
  Behavior,
  GeneralBehavior,
  BehaviorBuilder,
  GeneralBehaviorBuilder,
  BuilderContext,
  NormalizedPropertyType,
} from './behavior'
export {
  Component,
  ComponentDefinition,
  GeneralComponent,
  GeneralComponentDefinition,
} from './component'
export { MutationObserver as Observer, MutationObserver } from './mutation_observer'
export * as mutationObserver from './mutation_observer'
export {
  Node,
  dumpElement,
  dumpElementToString,
  dumpSingleElementToString,
  GeneralBackendElement,
  GeneralBackendContext,
  NodeCast,
} from './node'
export { ElementIterator, ElementIteratorType } from './element_iterator'
export {
  FuncArr,
  GeneralFuncType,
  safeCallback,
  addGlobalErrorListener,
  removeGlobalErrorListener,
  addGlobalWarningListener,
  removeGlobalWarningListener,
} from './func_arr'
export { ParsedSelector } from './selector'
export { StyleScopeManager, ClassList, StyleScopeId } from './class_list'
export { RelationType, RelationListener, RelationFailedListener } from './relation'
export { TraitBehavior } from './trait_behaviors'
export { triggerRender } from './render'
export { ComponentSpace } from './component_space'
export { ExternalShadowRoot } from './external_shadow_tree'
export * as template from './tmpl'
export * as backend from './backend/backend_protocol'
export * as composedBackend from './backend/composed_backend_protocol'
export * as domlikeBackend from './backend/domlike_backend_protocol'
export { BackendMode } from './backend/mode'
export * as templateEngine from './template_engine'
export * as glassEaselTemplate from './tmpl'

import {
  ComponentParams,
  DataList,
  PropertyList,
  MethodList,
  ComponentInstance,
  Empty,
} from './component_params'
import { Behavior } from './behavior'
import {
  Component,
  ComponentDefinition,
  GeneralComponent,
  GeneralComponentDefinition,
} from './component'
import { Event } from './event'
import { getDefaultComponentSpace } from './global_options'

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
