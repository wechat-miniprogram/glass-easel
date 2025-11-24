/* eslint-disable class-methods-use-this */

import { Component, type GeneralComponent } from '../component'
import { type DataPath } from '../data_path'
import { type DataValue } from '../data_proxy'
import { Element, StyleSegmentIndex } from '../element'
import { type EventListener } from '../event'
import { safeCallback } from '../func_arr'
import { type NativeNode } from '../native_node'
import { type Node } from '../node'
import { SlotMode, type ShadowRoot } from '../shadow_root'
import { type TextNode } from '../text_node'
import { type ProcGenGroupList } from '../tmpl'
import { isComponent, isNativeNode } from '../type_symbol'
import { type VirtualNode } from '../virtual_node'
import { dispatchError, triggerWarning } from '../warning'
import { RangeListManager } from './range_list_diff'

export type UpdatePathTreeNode = true | { [key: string]: UpdatePathTreeNode } | UpdatePathTreeNode[]

export type UpdatePathTreeRoot = UpdatePathTreeNode | undefined

export type ChangePropListener<T> = (
  this: null,
  newValue: T,
  oldValue: T,
  host: GeneralComponent,
  elem: Element,
) => void

export type ChangePropFilter = <T>(
  listener: ChangePropListener<T>,
  generalLvaluePath: DataPath | null | undefined,
  elem: Element,
  propName: string,
) => ChangePropListener<T>

export interface EventListenerWrapper {
  <T>(
    elem: Element,
    evName: string,
    listener: EventListener<T>,
    final: boolean,
    mutated: boolean,
    capture: boolean,
    generalLvaluePath?: DataPath | null,
  ): EventListener<T> | null
  isEventListenerWrapper?: true
}

const defaultChangePropFilter: ChangePropFilter = <T>(x: T) => x

const defaultEventListenerWrapper: EventListenerWrapper = (elem, evName, listener) => (e) =>
  listener.call(elem.ownerShadowRoot?.getHostNode().getMethodCaller(), e)

type TmplArgs = {
  key?: number | string
  keyList?: RangeListManager
  dynEvListeners?: {
    [name: string]: EventListener<unknown> | null
  }
  dynamicSlotNameMatched?: boolean
  changeProp?: {
    [name: string]: {
      listener: ChangePropListener<unknown>
      oldValue: unknown
    }
  }
  staticClasses?: string[] // [class1, class2, ...]
  staticClassesDirty?: boolean
  styleNameValues?: string[] // [name1, value1, name2, value2, ...]
  styleNameValuesDirty?: boolean
}
export type TmplDevArgs = {
  A?: string[] // active attributes
}
export type TmplNode = Node & { _$wxTmplArgs?: TmplArgs; _$wxTmplDevArgs?: TmplDevArgs }

export const getTmplArgs = (elem: Node): TmplArgs => {
  const node = elem as TmplNode
  // eslint-disable-next-line no-return-assign
  return (node._$wxTmplArgs = node._$wxTmplArgs || {})
}

export const getTmplDevArgs = (elem: Node): TmplDevArgs => {
  const node = elem as TmplNode
  // eslint-disable-next-line no-return-assign
  return (node._$wxTmplDevArgs = node._$wxTmplDevArgs || {})
}

export const dataValueToString = (v: DataValue): string => {
  if (v === null || v === undefined) {
    return ''
  }
  return String(v)
}

const dashToCamelCase = (dash: string): string => {
  const ret = dash.replace(/-(.|$)/g, (s) => (s[1] ? s[1].toUpperCase() : ''))
  return ret
}

const camelToDashCase = (dash: string): string => {
  const ret = dash.replace(/[A-Z]/g, (s) => `-${s.toLowerCase()}`)
  return ret
}

export interface ProcGen {
  (wrapper: ProcGenWrapper, isCreation: true, data: DataValue): {
    C: DefineChildren
    B?: { [field: string]: BindingMapGen[] }
  }
  (
    wrapper: ProcGenWrapper,
    isCreation: false,
    data: DataValue,
    dataUpdatePathTree: UpdatePathTreeNode,
  ): { C: DefineChildren }
}

export type ProcGenEnv = {
  group: (name: string) => ProcGen
  list: ProcGenGroupList
}

export type BindingMapGen = (
  data: DataValue,
  elementUpdated: (elem: Element) => void,
  updateText: (node: TextNode, content: string) => void,
) => void

export type DefineChildren = (
  isCreation: boolean,
  defineTextNode: DefineTextNode,
  defineElement: DefineElement,
  defineIfGroup: DefineIfGroup,
  defineForLoop: DefineForLoop,
  defineSlot: DefineSlot,
  definePureVirtualNode: DefinePureVirtualNode,
  dynamicSlotValues: { [name: string]: unknown } | undefined,
  slotValueUpdatePathTrees: UpdatePathTreeNode | undefined,
) => void

type DefineTextNode = (text: string | undefined, textInit?: (elem: TextNode) => boolean) => void

type DefineElement = (
  tag: string,
  genericImpls: { [key: string]: string },
  propertyInit: (elem: Element, isCreation: boolean) => void,
  children: DefineChildren,
  slot?: string,
  dynamicSlotValueNames?: string[],
) => void

type DefineIfGroup = (branchKey: number | string, branchFunc: DefineChildren) => void

type DefineForLoop = (
  list: DataValue[],
  key: string | null,
  oriListUpdatePathTree: UpdatePathTreeRoot,
  lvaluePath: DataPath | null,
  itemCallback: (
    isCreation: boolean,
    item: DataValue,
    index: number | string,
    itemUpdatePathTree: UpdatePathTreeRoot,
    indexUpdatePathTree: UpdatePathTreeRoot,
    itemLvaluePath: DataPath | null,
    defineTextNode: DefineTextNode,
    defineElement: DefineElement,
    defineIfGroup: DefineIfGroup,
    defineForLoop: DefineForLoop,
    defineSlot: DefineSlot,
    definePureVirtualNode: DefinePureVirtualNode,
  ) => void,
) => void

type DefineSlot = (
  name: string | undefined,
  slotValueInit?: (elem: Element) => void,
  slot?: string,
) => void

type DefinePureVirtualNode = (children: DefineChildren, slot: string | undefined) => void

export class ProcGenWrapper {
  shadowRoot: ShadowRoot
  procGen: ProcGen
  fallbackListenerOnNativeNode: boolean
  bindingMapDisabled = false
  changePropFilter: ChangePropFilter = defaultChangePropFilter
  eventListenerWrapper: EventListenerWrapper = defaultEventListenerWrapper

  constructor(shadowRoot: ShadowRoot, procGen: ProcGen, fallbackListenerOnNativeNode: boolean) {
    this.shadowRoot = shadowRoot
    this.procGen = procGen
    this.fallbackListenerOnNativeNode = fallbackListenerOnNativeNode
  }

  create(data: DataValue): { [field: string]: BindingMapGen[] } | undefined {
    const { shadowRoot, procGen } = this
    const children = procGen(this, true, data)
    this.handleChildrenCreationAndInsert(children.C, shadowRoot, undefined, undefined)
    return children.B
  }

  update(data: DataValue, dataUpdatePathTree: UpdatePathTreeNode): void {
    const { shadowRoot, procGen } = this
    const children = procGen(this, false, data, dataUpdatePathTree)
    this.handleChildrenUpdate(children.C, shadowRoot, undefined, undefined)
  }

  private endBindingMapUpdateForElement(elem: Element) {
    const tmplArgs = (elem as TmplNode)._$wxTmplArgs
    if (tmplArgs) {
      if (tmplArgs.staticClassesDirty) {
        tmplArgs.staticClassesDirty = false
        this.applyClassListUpdates(elem)
      }
      if (tmplArgs.styleNameValuesDirty) {
        tmplArgs.styleNameValuesDirty = false
        this.applyStyleListUpdates(elem)
      }
    }
    if (isComponent(elem)) {
      if (elem.hasPendingChanges()) {
        const nodeDataProxy = Component.getDataProxy(elem)
        nodeDataProxy.applyDataUpdates(true)
      }
    }
  }

  bindingMapUpdate(
    field: string,
    data: DataValue,
    bindingMapGenList: { [field: string]: BindingMapGen[] },
  ): boolean {
    if (this.bindingMapDisabled) return false
    const updaters = bindingMapGenList[field]
    if (!updaters) return false
    let prevElement: Element | null = null
    for (let i = 0; i < updaters.length; i += 1) {
      const bindingMapGen = updaters[i]!
      bindingMapGen(
        data,
        // eslint-disable-next-line no-loop-func
        (elem: Element) => {
          if (prevElement !== null && elem !== prevElement) {
            this.endBindingMapUpdateForElement(prevElement)
          }
          prevElement = elem
        },
        (elem: TextNode, v: string) => {
          elem.textContent = v
        },
      )
    }
    const elem = prevElement as Element | null
    if (elem !== null) {
      this.endBindingMapUpdateForElement(elem)
    }
    return true
  }

  handleChildrenCreation(
    children: DefineChildren,
    slotElement: Element | undefined,
    dynamicSlotName: string | undefined,
  ): Node[] {
    const childNodes: Node[] = []
    children(
      true,

      // text node
      (textContent: string | undefined, textInit?: (elem: TextNode) => void) => {
        if (slotElement && dynamicSlotName !== '') {
          const elem = this.createDynamicPlaceholder(slotElement)
          childNodes.push(elem)
          return
        }
        const elem = this.shadowRoot.createTextNode(textContent)
        elem.destroyBackendElementOnRemoval()
        if (slotElement) Element.setSlotElement(elem, slotElement)
        if (textInit) textInit(elem)
        childNodes.push(elem)
      },

      // component or native node
      (
        tagName: string,
        genericImpls: { [key: string]: string },
        propertyInit: (elem: Element, isCreation: boolean) => void,
        children: DefineChildren,
        slot?: string,
        dynamicSlotValueNames?: string[],
      ) => {
        if (slotElement && dynamicSlotName !== (slot || '')) {
          const elem = this.createDynamicPlaceholder(slotElement)
          childNodes.push(elem)
          return
        }
        const elem = this.createCommonElement(
          tagName,
          genericImpls,
          propertyInit,
          children,
          dynamicSlotValueNames,
        )
        if (slotElement) {
          Element.setSlotElement(elem, slotElement)
          const tmplArgs = getTmplArgs(elem)
          tmplArgs.dynamicSlotNameMatched = true
        } else if (slot !== undefined) {
          elem.slot = slot
        }
        childNodes.push(elem)
      },

      // wx:if node or template-is node
      (branchKey: number | string, branchFunc: DefineChildren) => {
        const elem = this.shadowRoot.createVirtualNode('wx:if')
        elem.destroyBackendElementOnRemoval()
        Element.setInheritSlots(elem)
        if (slotElement) Element.setSlotElement(elem, slotElement)
        const tmplArgs = getTmplArgs(elem)
        tmplArgs.key = branchKey
        this.handleChildrenCreationAndInsert(branchFunc, elem, slotElement, dynamicSlotName)
        childNodes.push(elem)
      },

      // wx:for node
      (
        list: DataValue[],
        key: string | null,
        oriListUpdatePathTree: UpdatePathTreeRoot,
        lvaluePath: DataPath | null,
        itemCallback: (
          isCreation: boolean,
          item: DataValue,
          index: number | string,
          itemUpdatePathTree: UpdatePathTreeRoot,
          indexUpdatePathTree: UpdatePathTreeRoot,
          itemLvaluePath: DataPath | null,
          defineTextNode: DefineTextNode,
          defineElement: DefineElement,
          defineIfGroup: DefineIfGroup,
          defineForLoop: DefineForLoop,
          defineSlot: DefineSlot,
          definePureVirtualNode: DefinePureVirtualNode,
        ) => void,
      ) => {
        const shadowRoot = this.shadowRoot
        const elem = shadowRoot.createVirtualNode('wx:for')
        elem.destroyBackendElementOnRemoval()
        Element.setInheritSlots(elem)
        if (slotElement) Element.setSlotElement(elem, slotElement)
        const tmplArgs = getTmplArgs(elem)
        tmplArgs.keyList = new RangeListManager(
          key,
          list,
          elem,
          shadowRoot,
          (item: DataValue, index: number | string): VirtualNode => {
            const childNode = shadowRoot.createVirtualNode('wx:for-item')
            childNode.destroyBackendElementOnRemoval()
            Element.setInheritSlots(childNode)
            if (slotElement) Element.setSlotElement(elem, slotElement)
            this.handleChildrenCreationAndInsert(
              (
                isCreation,
                defineTextNode,
                defineElement,
                defineIfGroup,
                defineForLoop,
                defineSlot,
                definePureVirtualNode,
              ) => {
                itemCallback(
                  true,
                  item,
                  index,
                  undefined,
                  undefined,
                  lvaluePath ? [...lvaluePath, index] : null,
                  defineTextNode,
                  defineElement,
                  defineIfGroup,
                  defineForLoop,
                  defineSlot,
                  definePureVirtualNode,
                )
              },
              childNode,
              slotElement,
              dynamicSlotName,
            )
            return childNode
          },
        )
        childNodes.push(elem)
      },

      // slot node
      (slotName: string | undefined, slotValueInit?: (elem: Element) => void, slot?: string) => {
        const elem = this.shadowRoot.createVirtualNode('slot')
        elem.destroyBackendElementOnRemoval()
        Element.setSlotName(elem, dataValueToString(slotName))
        if (slotElement) {
          Element.setSlotElement(elem, slotElement)
        } else if (slot !== undefined) {
          elem.slot = slot
        }
        if (slotValueInit) slotValueInit(elem)
        childNodes.push(elem)
      },

      // other virtual node
      (children: DefineChildren, slot: string | undefined) => {
        if (slot !== undefined) {
          if (slotElement) {
            if (dynamicSlotName! === slot) {
              const elem = this.shadowRoot.createVirtualNode('virtual')
              elem.destroyBackendElementOnRemoval()
              Element.setSlotElement(elem, slotElement)
              const tmplArgs = getTmplArgs(elem)
              tmplArgs.dynamicSlotNameMatched = true
              this.handleChildrenCreationAndInsert(children, elem, undefined, undefined)
              childNodes.push(elem)
            } else {
              const elem = this.createDynamicPlaceholder(slotElement)
              childNodes.push(elem)
            }
          } else {
            const elem = this.shadowRoot.createVirtualNode('virtual')
            elem.destroyBackendElementOnRemoval()
            elem.slot = slot
            this.handleChildrenCreationAndInsert(children, elem, undefined, undefined)
            childNodes.push(elem)
          }
        } else {
          const elem = this.shadowRoot.createVirtualNode('virtual')
          elem.destroyBackendElementOnRemoval()
          Element.setInheritSlots(elem)
          if (slotElement) Element.setSlotElement(elem, slotElement)
          this.handleChildrenCreationAndInsert(children, elem, slotElement, dynamicSlotName)
          childNodes.push(elem)
        }
      },
      undefined,
      undefined,
    )
    return childNodes
  }

  private handleChildrenCreationAndInsert(
    children: DefineChildren,
    parentNode: Element,
    slotElement: Element | undefined,
    dynamicSlotName: string | undefined,
  ): void {
    const childNodes = this.handleChildrenCreation(children, slotElement, dynamicSlotName)
    if (childNodes.length) parentNode.insertChildren(childNodes, -1)
  }

  handleChildrenUpdate(
    children: DefineChildren,
    parentNode: Element,
    slotElement: Element | undefined,
    dynamicSlotName: string | undefined,
  ): void {
    let index = 0
    const childNodes = slotElement
      ? slotElement.slotNodes!.filter((node) => node.parentNode === parentNode)
      : parentNode.childNodes
    children(
      false,

      // text node
      (textContent: string | undefined) => {
        const elem = childNodes[index] as TextNode
        index += 1
        if (!elem) return
        if (slotElement) {
          const tmplArgs = getTmplArgs(elem)
          if (!tmplArgs.dynamicSlotNameMatched) {
            return
          }
        }
        if (textContent !== undefined) {
          elem.textContent = textContent
        }
      },

      // component or native node
      (
        tagName: string,
        genericImpls: { [key: string]: string },
        propertyInit: (elem: Element, isCreation: boolean) => void,
        children: DefineChildren,
        slot?: string,
        dynamicSlotValueNames?: string[],
      ) => {
        const elem = childNodes[index] as Element
        index += 1
        if (!elem) return
        if (slotElement) {
          const tmplArgs = getTmplArgs(elem)
          if (dynamicSlotName! === (slot || '')) {
            if (!tmplArgs.dynamicSlotNameMatched) {
              const newElem = this.createCommonElement(
                tagName,
                genericImpls,
                propertyInit,
                children,
                dynamicSlotValueNames,
              )
              Element.setSlotElement(newElem, slotElement)
              const newTmplArgs = getTmplArgs(newElem)
              newTmplArgs.dynamicSlotNameMatched = true
              parentNode.replaceChild(newElem, elem)
              return
            }
          } else {
            if (tmplArgs.dynamicSlotNameMatched) {
              const newElem = this.createDynamicPlaceholder(slotElement)
              parentNode.replaceChild(newElem, elem)
            }
            return
          }
        }
        propertyInit(elem, false)
        let dynSlot = false
        if (isComponent(elem)) {
          const sr = this.dynamicSlotUpdate(elem, dynamicSlotValueNames, children)
          if (sr) dynSlot = true
          if (elem.hasPendingChanges()) {
            const nodeDataProxy = Component.getDataProxy(elem)
            nodeDataProxy.applyDataUpdates(true)
          }
          sr?.applySlotUpdates()
        }
        if (!slotElement) {
          if (slot !== undefined) elem.slot = slot
        }
        if (!dynSlot) {
          this.handleChildrenUpdate(children, elem, undefined, undefined)
        }
      },

      // wx:if node or template-is node
      (branchKey: number | string, branchFunc: DefineChildren) => {
        const elem = childNodes[index] as Element
        index += 1
        if (!elem) return
        const prevTmplArgs = getTmplArgs(elem)
        if (prevTmplArgs.key === branchKey) {
          this.handleChildrenUpdate(branchFunc, elem, slotElement, dynamicSlotName)
        } else {
          const newElem = this.shadowRoot.createVirtualNode('wx:if')
          newElem.destroyBackendElementOnRemoval()
          Element.setInheritSlots(newElem)
          if (slotElement) Element.setSlotElement(newElem, slotElement)
          const tmplArgs = getTmplArgs(newElem)
          prevTmplArgs.key = tmplArgs.key = branchKey
          this.handleChildrenCreationAndInsert(branchFunc, newElem, slotElement, dynamicSlotName)
          if (slotElement) parentNode.replaceChild(newElem, elem)
          else parentNode.replaceChildAt(newElem, index - 1)
        }
      },

      // wx:for node
      (
        list: DataValue[],
        key: string | null,
        oriListUpdatePathTree: UpdatePathTreeRoot,
        lvaluePath: DataPath | null,
        itemCallback: (
          isCreation: boolean,
          item: DataValue,
          index: number | string,
          itemUpdatePathTree: UpdatePathTreeRoot,
          indexUpdatePathTree: UpdatePathTreeRoot,
          itemLvaluePath: DataPath | null,
          defineTextNode: DefineTextNode,
          defineElement: DefineElement,
          defineIfGroup: DefineIfGroup,
          defineForLoop: DefineForLoop,
          defineSlot: DefineSlot,
          definePureVirtualNode: DefinePureVirtualNode,
        ) => void,
      ) => {
        const elem = childNodes[index] as Element
        index += 1
        if (!elem) return
        const tmplArgs = getTmplArgs(elem)
        const keyListManager = tmplArgs.keyList!
        keyListManager.diff(
          list,
          oriListUpdatePathTree,
          elem,
          (item: DataValue, index: number | string): VirtualNode => {
            const childNode = this.shadowRoot.createVirtualNode('wx:for-item')
            childNode.destroyBackendElementOnRemoval()
            Element.setInheritSlots(childNode)
            if (slotElement) Element.setSlotElement(elem, slotElement)
            this.handleChildrenCreationAndInsert(
              (
                isCreation,
                defineTextNode,
                defineElement,
                defineIfGroup,
                defineForLoop,
                defineSlot,
                definePureVirtualNode,
              ) => {
                itemCallback(
                  true,
                  item,
                  index,
                  undefined,
                  undefined,
                  lvaluePath ? [...lvaluePath, index] : null,
                  defineTextNode,
                  defineElement,
                  defineIfGroup,
                  defineForLoop,
                  defineSlot,
                  definePureVirtualNode,
                )
              },
              childNode,
              slotElement,
              dynamicSlotName,
            )
            return childNode
          },
          (
            item: DataValue,
            index: string | number,
            updatePathTree: UpdatePathTreeRoot,
            indexChanged: boolean,
            childNode: Element | undefined,
          ) => {
            if (!childNode) return
            this.handleChildrenUpdate(
              (
                isCreation,
                defineTextNode,
                defineElement,
                defineIfGroup,
                defineForLoop,
                defineSlot,
                definePureVirtualNode,
              ) => {
                itemCallback(
                  false,
                  item,
                  index,
                  updatePathTree,
                  indexChanged ? true : undefined,
                  lvaluePath ? [...lvaluePath, index] : null,
                  defineTextNode,
                  defineElement,
                  defineIfGroup,
                  defineForLoop,
                  defineSlot,
                  definePureVirtualNode,
                )
              },
              childNode,
              slotElement,
              dynamicSlotName,
            )
          },
        )
      },

      // slot node
      (slotName: string | undefined, slotValueInit?: (elem: Element) => void, slot?: string) => {
        const elem = childNodes[index] as Element
        index += 1
        if (!elem) return
        if (slotName !== undefined) {
          Element.setSlotName(elem, dataValueToString(slotName))
        }
        if (!slotElement) {
          if (slot !== undefined) elem.slot = slot
        }
        if (slotValueInit) slotValueInit(elem)
        this.shadowRoot.applySlotValueUpdates(elem)
      },

      // other virtual node
      (children: DefineChildren, slot: string | undefined) => {
        const elem = childNodes[index] as Element
        index += 1
        if (!elem) return
        if (slot !== undefined) {
          if (slotElement) {
            const tmplArgs = getTmplArgs(elem)
            if (dynamicSlotName! === slot) {
              if (tmplArgs.dynamicSlotNameMatched) {
                this.handleChildrenUpdate(children, elem, undefined, undefined)
              } else {
                const newElem = this.shadowRoot.createVirtualNode('virtual')
                newElem.destroyBackendElementOnRemoval()
                Element.setSlotElement(newElem, slotElement)
                const newTmplArgs = getTmplArgs(newElem)
                newTmplArgs.dynamicSlotNameMatched = true
                this.handleChildrenCreationAndInsert(children, newElem, undefined, undefined)
                parentNode.replaceChild(newElem, elem)
              }
            } else {
              if (tmplArgs.dynamicSlotNameMatched) {
                const newElem = this.createDynamicPlaceholder(slotElement)
                parentNode.replaceChild(newElem, elem)
              }
            }
          } else {
            elem.slot = slot
            this.handleChildrenUpdate(children, elem, undefined, undefined)
          }
        } else {
          this.handleChildrenUpdate(children, elem, slotElement, dynamicSlotName)
        }
      },
      undefined,
      undefined,
    )
  }

  private dynamicSlotUpdate(
    elem: GeneralComponent,
    dynamicSlotValueNames: string[] | undefined,
    children: DefineChildren,
  ): ShadowRoot | null {
    const sr = elem.getShadowRoot()
    if (sr?.getSlotMode() === SlotMode.Dynamic) {
      sr.setDynamicSlotHandler(
        dynamicSlotValueNames || [],
        (slots) => {
          const childNodes: Node[] = []
          for (let i = 0; i < slots.length; i += 1) {
            const { slot, name: slotName, slotValues } = slots[i]!
            const slotChildNodes = this.handleChildrenCreation(
              (
                isCreation,
                defineTextNode,
                defineElement,
                defineIfGroup,
                defineForLoop,
                defineSlot,
                definePureVirtualNode,
              ) => {
                children(
                  true,
                  defineTextNode,
                  defineElement,
                  defineIfGroup,
                  defineForLoop,
                  defineSlot,
                  definePureVirtualNode,
                  slotValues,
                  undefined,
                )
              },
              slot,
              slotName,
            )
            childNodes.push(...slotChildNodes)
          }
          if (childNodes.length) elem.insertChildren(childNodes, -1)
        },
        (slots) => {
          if (!slots.length) return
          const sortedSlots: Element[] = []
          for (let i = 0; i < slots.length; i += 1) {
            // ignore empty slots
            if (slots[i]!.slotNodes!.length) sortedSlots.push(slots[i]!)
          }
          sortedSlots.sort(
            (slot1, slot2) => slot1.slotNodes![0]!.parentIndex - slot2.slotNodes![0]!.parentIndex,
          )
          let l = 0
          let r = 0
          for (let i = 0; i < sortedSlots.length; i += 1) {
            const slotNodes = sortedSlots[i]!.slotNodes!
            const firstIndex = slotNodes[0]!.parentIndex
            const lastIndex = slotNodes.findLast((node) => node.parentNode === elem)!.parentIndex
            if (r !== firstIndex) {
              if (l >= 0) elem.removeChildren(l, r - l)
              l = firstIndex
            }
            r = lastIndex + 1
          }
          if (l !== r) elem.removeChildren(l, r - l)
        },
        (slot, slotValues, slotValueUpdatePathTrees) => {
          const slotName = slot._$slotName || ''
          this.handleChildrenUpdate(
            (
              isCreation,
              defineTextNode,
              defineElement,
              defineIfGroup,
              defineForLoop,
              defineSlot,
              definePureVirtualNode,
            ) => {
              children(
                false,
                defineTextNode,
                defineElement,
                defineIfGroup,
                defineForLoop,
                defineSlot,
                definePureVirtualNode,
                slotValues,
                slotValueUpdatePathTrees,
              )
            },
            elem,
            slot,
            slotName,
          )
        },
      )
      return sr
    }
    return null
  }

  private createDynamicPlaceholder(slotElement: Element): Element {
    const elem = this.shadowRoot.createVirtualNode('virtual')
    elem.destroyBackendElementOnRemoval()
    Element.setSlotElement(elem, slotElement)
    const tmplArgs = getTmplArgs(elem)
    tmplArgs.dynamicSlotNameMatched = false
    return elem
  }

  private checkFallbackEventListener(
    elem: Element,
    camelName: string,
    value: unknown,
    generalLvaluePath?: DataPath | null,
  ): boolean {
    if (camelName.startsWith('bind')) {
      this.v(
        elem,
        camelName.slice('bind'.length),
        value,
        false,
        false,
        false,
        true,
        generalLvaluePath,
      )
    } else if (camelName.startsWith('captureBind')) {
      this.v(
        elem,
        camelName.slice('captureBind'.length),
        value,
        false,
        false,
        true,
        true,
        generalLvaluePath,
      )
    } else if (camelName.startsWith('catch')) {
      this.v(
        elem,
        camelName.slice('catch'.length),
        value,
        true,
        false,
        false,
        true,
        generalLvaluePath,
      )
    } else if (camelName.startsWith('captureCatch')) {
      this.v(
        elem,
        camelName.slice('captureCatch'.length),
        value,
        true,
        false,
        true,
        true,
        generalLvaluePath,
      )
    } else if (camelName.startsWith('on')) {
      this.v(
        elem,
        camelName.slice('on'.length),
        value,
        false,
        false,
        false,
        true,
        generalLvaluePath,
      )
    } else {
      return false
    }
    return true
  }

  private createCommonElement(
    tagName: string,
    genericImpls: { [key: string]: string },
    propertyInit: (elem: Element, isCreation: boolean) => void,
    children: DefineChildren,
    dynamicSlotValueNames: string[] | undefined,
  ): Element {
    let dynSlot = false
    const initPropValues = (elem: GeneralComponent | NativeNode) => {
      const sr = isComponent(elem)
        ? this.dynamicSlotUpdate(elem, dynamicSlotValueNames, children)
        : null
      if (sr) dynSlot = true
      propertyInit(elem, true)
      if (isComponent(elem)) {
        if (elem.hasPendingChanges()) {
          const nodeDataProxy = Component.getDataProxy(elem)
          nodeDataProxy.applyDataUpdates(true)
        }
        sr?.applySlotUpdates()
      }
    }
    const placeholderCallback = () => {
      const replacer = this.shadowRoot.createComponent(
        tagName,
        tagName,
        genericImpls,
        undefined,
        initPropValues,
      )
      replacer.destroyBackendElementOnRemoval()
      const replacerShadowRoot = (replacer as GeneralComponent).getShadowRoot()
      const elemShadowRoot = isComponent(elem) ? elem.getShadowRoot() : null
      const isElemDynamicSlots = elemShadowRoot?.getSlotMode() === SlotMode.Dynamic
      const isReplacerDynamicSlots = replacerShadowRoot?.getSlotMode() === SlotMode.Dynamic
      if (isReplacerDynamicSlots !== isElemDynamicSlots) {
        dispatchError(
          new Error(
            `The "dynamicSlots" option of component <${replacer.is}> and its placeholder <${elem.is}> should be the same.`,
          ),
          '[render]',
          isComponent(replacer) ? replacer : replacer.is,
        )
      } else if (isReplacerDynamicSlots) {
        elem.parentNode?.replaceChild(replacer, elem)
      } else {
        elem.selfReplaceWith(replacer)
      }
    }
    const elem = this.shadowRoot.createComponent(
      tagName,
      tagName,
      genericImpls,
      placeholderCallback,
      initPropValues,
    )
    elem.destroyBackendElementOnRemoval()
    if (dynSlot) {
      this.bindingMapDisabled = true // IDEA better binding map disable detection
    } else {
      this.handleChildrenCreationAndInsert(children, elem, undefined, undefined)
    }
    return elem
  }

  private tryCallPropertyChangeListener(elem: Element, name: string, v: unknown) {
    const tmplArgs = getTmplArgs(elem)
    if (tmplArgs.changeProp?.[name]) {
      const lv = tmplArgs.changeProp[name]!
      const oldValue = lv.oldValue
      if (oldValue !== v) {
        lv.oldValue = v
        const host = elem.ownerShadowRoot!.getHostNode()
        safeCallback('Property Change Observer', lv.listener, null, [v, oldValue, host, elem], host)
      }
    }
  }

  // set slot
  // (not used any more, leaving for compatibilities)
  s = (elem: Element, v: string) => {
    elem.slot = v
    this.tryCallPropertyChangeListener(elem, 'slot', v)
  }

  // set slot value
  l = (elem: Element, name: string, value: unknown, generalLvaluePath?: DataPath | null) => {
    if (this.shadowRoot.getSlotMode() === SlotMode.Dynamic) {
      this.shadowRoot.replaceSlotValue(elem, name, value)
    } else {
      // compatibilities for legacy event binding syntax
      if (!this.checkFallbackEventListener(elem, name, value, generalLvaluePath)) {
        triggerWarning(
          `"${name}" is not a valid event binding or slot value`,
          elem.ownerShadowRoot?.getHostNode(),
          elem,
        )
      }
    }
    this.tryCallPropertyChangeListener(elem, name, value)
  }

  // set id
  i = (elem: Element, v: string) => {
    elem.id = v
    this.tryCallPropertyChangeListener(elem, 'id', v)
  }

  // set class or external classes named `class`
  c = (elem: Element, v: string | string[]) => {
    if (isComponent(elem)) {
      // "class" itself can also be an external class
      const hasExternalClass = elem.hasExternalClass('class')
      if (hasExternalClass) {
        elem.setExternalClass('class', v)
      }
    }
    elem.setNodeClass(v as any)
    this.tryCallPropertyChangeListener(elem, 'class', v)
  }

  // set a list of classes and use previous value if an item is null
  e = (elem: Element, classNames: (string | null)[]) => {
    const tmplArgs = getTmplArgs(elem)
    if (!tmplArgs.staticClasses) tmplArgs.staticClasses = new Array(classNames.length)
    const arr = tmplArgs.staticClasses
    for (let i = 0; i < classNames.length; i += 1) {
      const item = classNames[i]
      if (typeof item === 'string') {
        arr[i] = item
      }
    }
    this.applyClassListUpdates(elem)
  }

  // set a single class in the list of classes (should only be used in binding-map updates)
  ei = (elem: Element, index: number, className: string) => {
    const tmplArgs = getTmplArgs(elem)
    if (!tmplArgs.staticClasses) tmplArgs.staticClasses = []
    const arr = tmplArgs.staticClasses
    arr[index] = className
    tmplArgs.staticClassesDirty = true
  }

  private applyClassListUpdates(elem: Element) {
    const arr = getTmplArgs(elem).staticClasses!
    elem.setNodeClassList(arr)
    this.tryCallPropertyChangeListener(elem, 'class', arr)
  }

  // set style (or property named `style`)
  y = (elem: Element, v: string) => {
    if (isComponent(elem) && Component.getDataProxy(elem).replaceProperty('style', v)) {
      // empty
    } else {
      elem.setNodeStyle(dataValueToString(v), StyleSegmentIndex.MAIN)
    }
    this.tryCallPropertyChangeListener(elem, 'style', v)
  }

  // set a list of styles and use previous value if an item is null
  w = (elem: Element, styles: (string | null)[]) => {
    const tmplArgs = getTmplArgs(elem)
    if (!tmplArgs.styleNameValues) tmplArgs.styleNameValues = new Array(styles.length)
    const arr = tmplArgs.styleNameValues
    for (let i = 0; i < styles.length; i += 2) {
      const value = styles[i + 1]
      if (typeof value === 'string') {
        arr[i] = styles[i] as string
        arr[i + 1] = value
      }
    }
    this.applyStyleListUpdates(elem)
  }

  // set a single style value in the list of styles (should only be used in binding-map updates)
  wi = (elem: Element, valueIndex: number, newValue: string) => {
    const tmplArgs = getTmplArgs(elem)
    if (!tmplArgs.styleNameValues) tmplArgs.styleNameValues = []
    const arr = tmplArgs.styleNameValues
    const nvIndex = valueIndex * 2
    arr[nvIndex + 1] = newValue
    tmplArgs.styleNameValuesDirty = true
  }

  private applyStyleListUpdates(elem: Element) {
    const arr = getTmplArgs(elem).styleNameValues!
    let v = ''
    for (let i = 0; i < arr.length; i += 2) {
      const name = arr[i]
      const value = arr[i + 1]
      v += `${name}:${value};`
    }
    if (isComponent(elem) && Component.getDataProxy(elem).replaceProperty('style', v)) {
      // empty
    } else {
      elem.setNodeStyle(dataValueToString(v), StyleSegmentIndex.MAIN)
    }
    this.tryCallPropertyChangeListener(elem, 'style', v)
  }

  // set dataset
  d = (elem: Element, name: string, v: unknown, fallbackDataHyphen: boolean) => {
    if (fallbackDataHyphen && isComponent(elem)) {
      const nodeDataProxy = Component.getDataProxy(elem)
      const fullName = `data${name[0]!.toUpperCase()}${name.slice(1)}`
      if (nodeDataProxy.replaceProperty(fullName, v)) {
        // empty
      } else {
        const fullDashName = `data-${camelToDashCase(name)}`
        if (elem.hasExternalClass(fullDashName)) {
          elem.setExternalClass(fullDashName, v as string)
        } else if (nodeDataProxy.replaceProperty(fullDashName, v)) {
          // leave for compatibilities
        } else {
          elem.setDataset(name, v)
        }
      }
      this.tryCallPropertyChangeListener(elem, name, v)
    } else {
      elem.setDataset(name, v)
    }
  }

  // set mark
  m = (elem: Element, name: string, v: unknown) => {
    elem.setMark(name, v)
  }

  // set event handler
  v = (
    elem: Element,
    evName: string,
    v: unknown,
    final: boolean,
    mutated: boolean,
    capture: boolean,
    isDynamic: boolean,
    generalLvaluePath?: DataPath | null,
  ) => {
    const handler = typeof v === 'function' ? v : dataValueToString(v)
    const listener = this.eventListenerWrapper(
      elem,
      evName,
      function (this: any, ...args: any[]) {
        const host = elem.ownerShadowRoot!.getHostNode()
        const f = typeof handler === 'function' ? handler : Component.getMethod(host, handler)
        if (typeof f === 'function') {
          return f.call(this, ...args) as boolean | void
        }
        return undefined
      },
      final,
      mutated,
      capture,
      generalLvaluePath,
    )
    if (listener) {
      Object.defineProperty(listener, 'name', {
        value: typeof handler === 'string' ? handler : handler.name,
      })
    }
    const evOptions = {
      final,
      mutated,
      capture,
    }
    if (isDynamic) {
      const tmplArgs = getTmplArgs(elem)
      if (!tmplArgs.dynEvListeners) tmplArgs.dynEvListeners = {}
      const dynEvListeners = tmplArgs.dynEvListeners
      if (dynEvListeners[evName]) {
        elem.removeListener(evName, dynEvListeners[evName]!, evOptions)
      }
      dynEvListeners[evName] = listener
    }
    if (handler && listener) elem.addListener(evName, listener, evOptions)
  }

  // update a property or external class of a component, or an attribute of a native node
  r = (
    elem: Element,
    name: string,
    v: unknown,
    modelLvaluePath?: DataPath | null,
    generalLvaluePath?: DataPath | null,
  ) => {
    if (isComponent(elem)) {
      const nodeDataProxy = Component.getDataProxy(elem)
      const camelName = dashToCamelCase(name)
      if (nodeDataProxy.replaceProperty(camelName, v)) {
        if (modelLvaluePath !== undefined) {
          if (modelLvaluePath === null) {
            nodeDataProxy.setModelBindingListener(camelName, () => {})
          } else {
            nodeDataProxy.setModelBindingListener(camelName, (value) => {
              const host = elem.ownerShadowRoot!.getHostNode()
              const nodeDataProxy = Component.getDataProxy(host)
              nodeDataProxy.replaceDataOnPath(modelLvaluePath, value)
              nodeDataProxy.applyDataUpdates(false)
            })
          }
        }
      } else if (elem.hasExternalClass(name)) {
        elem.setExternalClass(name, v as string)
      } else {
        // compatibilities for legacy event binding syntax
        if (!this.checkFallbackEventListener(elem, camelName, v, generalLvaluePath)) {
          triggerWarning(
            `"${camelName}" is not a valid property`,
            elem.ownerShadowRoot?.getHostNode(),
            elem,
          )
        }
      }
    } else if (isNativeNode(elem)) {
      if (this.fallbackListenerOnNativeNode) {
        // compatibilities for legacy event binding syntax
        const camelName = dashToCamelCase(name)
        if (!this.checkFallbackEventListener(elem, camelName, v, generalLvaluePath)) {
          elem.updateAttribute(name, v)
        }
      } else {
        elem.updateAttribute(name, v)
      }
      if (modelLvaluePath) {
        elem.setModelBindingListener(name, (value) => {
          const host = elem.ownerShadowRoot!.getHostNode()
          const nodeDataProxy = Component.getDataProxy(host)
          nodeDataProxy.replaceDataOnPath(modelLvaluePath, value)
          nodeDataProxy.applyDataUpdates(false)
        })
      }
    }
    this.tryCallPropertyChangeListener(elem, name, v)
  }

  // update a attribute
  a = (elem: Element, name: string, v: unknown) => {
    elem.updateAttribute(name, v)
    this.tryCallPropertyChangeListener(elem, name, v)
  }

  // set a worklet directive value
  wl = (elem: Element, name: string, value: unknown) => {
    if (isComponent(elem)) {
      elem.triggerWorkletChangeLifetime(name, value)
    } else {
      // TODO warn unused worklet
    }
  }

  // add a change property binding
  p = (
    elem: Element,
    name: string,
    v: ChangePropListener<unknown>,
    generalLvaluePath?: DataPath | null,
  ) => {
    const tmplArgs = getTmplArgs(elem)
    if (!tmplArgs.changeProp) {
      tmplArgs.changeProp = Object.create(null) as typeof tmplArgs.changeProp
    }
    tmplArgs.changeProp![name] = {
      listener: this.changePropFilter(v, generalLvaluePath, elem, name),
      oldValue: undefined,
    }
  }

  // set change properties filter
  setFnFilter(changePropFilter: ChangePropFilter) {
    this.changePropFilter = changePropFilter
  }

  // set event listener wrapper
  setEventListenerWrapper(eventListenerWrapper?: EventListenerWrapper) {
    if (typeof eventListenerWrapper === 'function') {
      this.eventListenerWrapper = eventListenerWrapper
    }
  }

  // get dev args object
  devArgs(elem: Element): TmplDevArgs {
    return getTmplDevArgs(elem)
  }
}

export const enum GeneralLvaluePathPrefix {
  Data = 0,
  Script = 1, // `abs_path` followed
  InlineScript = 2, // `abs_path` and `mod_name` followed
}
