/* eslint-disable class-methods-use-this */

import { ProcGenGroupList } from '.'
import {
  DataValue,
  Element,
  ShadowRoot,
  VirtualNode,
  TextNode,
  Component,
  GeneralComponent,
  Node,
  ShadowedEvent,
  StyleSegmentIndex,
  NativeNode,
} from '..'
import { DataPath } from '../data_path'
import { RangeListManager } from './range_list_diff'

export type UpdatePathTreeNode = true | { [key: string]: UpdatePathTreeNode } | UpdatePathTreeNode[]

export type UpdatePathTreeRoot = UpdatePathTreeNode | undefined

type ChangePropListener = (
  this: unknown,
  newValue: unknown,
  oldValue: unknown,
  host: unknown,
  elem: unknown,
) => void

const emptyFilter = <T>(x: T) => x

type TmplArgs = {
  key?: number | string
  keyList?: RangeListManager
  dynEvListeners?: {
    [name: string]: (ev: ShadowedEvent<unknown>) => boolean | undefined
  }
  index?: number
  dynamicSlotNameMatched?: boolean
  slotProps?: Record<string, [DataValue, DataPath | null, boolean]>
  slotPropsUpdatePathTree?: Record<string, UpdatePathTreeRoot>
  changeProp?: {
    [name: string]: {
      listener: ChangePropListener
      oldValue: unknown
    }
  }
}
export type TmplNode = Node & { _$wxTmplArgs?: TmplArgs }

export const getTmplArgs = (elem: Node): TmplArgs => {
  const node = elem as TmplNode
  // eslint-disable-next-line no-return-assign
  return (node._$wxTmplArgs = node._$wxTmplArgs || {})
}

export const dataValueToString = (v: DataValue): string => {
  if (v === null || v === undefined) {
    return ''
  }
  return String(v)
}

const dashToCamelCase = (dash: string): string => {
  const ret = dash.indexOf('-') <= 0 ? dash : dash.replace(/-[a-z]/g, (s) => s[1]!.toUpperCase())
  return ret
}

export type ProcGen = (
  wrapper: ProcGenWrapper,
  isCreation: boolean,
  data: DataValue,
  dataUpdatePathTree: UpdatePathTreeRoot,
) => {
  C: DefineChildren
  B?: { [field: string]: BindingMapGen[] }
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

type DefineSlot = (name: string | undefined, slotValueInit?: (elem: Element) => void) => void

type DefinePureVirtualNode = (children: DefineChildren, slot: string | undefined) => void

export class ProcGenWrapper {
  shadowRoot: ShadowRoot
  procGen: ProcGen
  disallowNativeNode: boolean
  bindingMapDisabled = false
  changePropFilter = emptyFilter
  eventListenerFilter = emptyFilter

  constructor(shadowRoot: ShadowRoot, procGen: ProcGen, disallowNativeNode: boolean) {
    this.shadowRoot = shadowRoot
    this.procGen = procGen
    this.disallowNativeNode = disallowNativeNode
  }

  create(data: DataValue): { [field: string]: BindingMapGen[] } | undefined {
    const { shadowRoot, procGen } = this
    const children = procGen(this, true, data, undefined)
    this.handleChildrenCreation(children.C, shadowRoot, undefined, undefined)
    return children.B
  }

  update(data: DataValue, dataUpdatePathTree: UpdatePathTreeRoot): void {
    const { shadowRoot, procGen } = this
    const children = procGen(this, false, data, dataUpdatePathTree)
    this.handleChildrenUpdate(children.C, shadowRoot, undefined, undefined)
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
            if (prevElement instanceof Component) {
              if (prevElement.hasPendingChanges()) {
                const nodeDataProxy = Component.getDataProxy(prevElement)
                nodeDataProxy.applyDataUpdates(true)
              }
            }
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
      if (elem instanceof Component) {
        if (elem.hasPendingChanges()) {
          const nodeDataProxy = Component.getDataProxy(elem)
          nodeDataProxy.applyDataUpdates(true)
        }
      }
    }
    return true
  }

  handleChildrenCreation(
    children: DefineChildren,
    parentNode: Element,
    slotElement: Element | undefined,
    dynamicSlotName: string | undefined,
  ): void {
    children(
      true,

      // text node
      (textContent: string | undefined, textInit?: (elem: TextNode) => void) => {
        if (slotElement && dynamicSlotName !== '') {
          const elem = this.createDynamicPlaceholder(slotElement)
          parentNode.appendChild(elem)
          return
        }
        const elem = this.shadowRoot.createTextNode(textContent)
        elem.destroyBackendElementOnDetach()
        if (slotElement) Element.setSlotElement(elem, slotElement)
        if (textInit) textInit(elem)
        parentNode.appendChild(elem)
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
          parentNode.appendChild(elem)
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
        parentNode.appendChild(elem)
      },

      // wx:if node or template-is node
      (branchKey: number | string, branchFunc: DefineChildren) => {
        const elem = this.shadowRoot.createVirtualNode('wx:if')
        elem.destroyBackendElementOnDetach()
        Element.setInheritSlots(elem)
        if (slotElement) Element.setSlotElement(elem, slotElement)
        const tmplArgs = getTmplArgs(elem)
        tmplArgs.key = branchKey
        this.handleChildrenCreation(branchFunc, elem, slotElement, dynamicSlotName)
        parentNode.appendChild(elem)
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
        elem.destroyBackendElementOnDetach()
        Element.setInheritSlots(elem)
        if (slotElement) Element.setSlotElement(elem, slotElement)
        const tmplArgs = getTmplArgs(elem)
        tmplArgs.keyList = new RangeListManager(
          key,
          list,
          elem,
          (item: DataValue, index: number | string): VirtualNode => {
            const childNode = shadowRoot.createVirtualNode('wx:for-item')
            childNode.destroyBackendElementOnDetach()
            Element.setInheritSlots(childNode)
            if (slotElement) Element.setSlotElement(elem, slotElement)
            this.handleChildrenCreation(
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
        parentNode.appendChild(elem)
      },

      // slot node
      (slotName: string | undefined, slotValueInit?: (elem: Element) => void) => {
        const elem = this.shadowRoot.createVirtualNode('slot')
        elem.destroyBackendElementOnDetach()
        Element.setSlotName(elem, dataValueToString(slotName))
        if (slotElement) Element.setSlotElement(elem, slotElement)
        if (slotValueInit) slotValueInit(elem)
        parentNode.appendChild(elem)
      },

      // other virtual node
      (children: DefineChildren, slot: string | undefined) => {
        if (slot !== undefined) {
          if (slotElement) {
            if (dynamicSlotName! === slot) {
              const elem = this.shadowRoot.createVirtualNode('virtual')
              elem.destroyBackendElementOnDetach()
              Element.setSlotElement(elem, slotElement)
              const tmplArgs = getTmplArgs(elem)
              tmplArgs.dynamicSlotNameMatched = true
              this.handleChildrenCreation(children, elem, undefined, undefined)
              parentNode.appendChild(elem)
            } else {
              const elem = this.createDynamicPlaceholder(slotElement)
              parentNode.appendChild(elem)
            }
          } else {
            const elem = this.shadowRoot.createVirtualNode('virtual')
            elem.destroyBackendElementOnDetach()
            elem.slot = slot
            this.handleChildrenCreation(children, elem, undefined, undefined)
            parentNode.appendChild(elem)
          }
        } else {
          const elem = this.shadowRoot.createVirtualNode('virtual')
          elem.destroyBackendElementOnDetach()
          Element.setInheritSlots(elem)
          if (slotElement) Element.setSlotElement(elem, slotElement)
          this.handleChildrenCreation(children, elem, slotElement, dynamicSlotName)
          parentNode.appendChild(elem)
        }
      },
      undefined,
      undefined,
    )
  }

  handleChildrenUpdate(
    children: DefineChildren,
    parentNode: Element,
    slotElement: Element | undefined,
    dynamicSlotName: string | undefined,
  ): void {
    let index = 0
    const childNodes = slotElement
      ? parentNode.childNodes.filter((node) => node._$nodeSlotElement === slotElement)
      : parentNode.childNodes
    children(
      false,

      // text node
      (textContent: string | undefined) => {
        const elem = childNodes[index] as TextNode
        index += 1
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
        if (elem instanceof Component) {
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
        const tmplArgs = getTmplArgs(elem)
        if (tmplArgs.key === branchKey) {
          this.handleChildrenUpdate(branchFunc, elem, slotElement, dynamicSlotName)
        } else {
          const newElem = this.shadowRoot.createVirtualNode('wx:if')
          newElem.destroyBackendElementOnDetach()
          Element.setInheritSlots(newElem)
          if (slotElement) Element.setSlotElement(newElem, slotElement)
          const tmplArgs = getTmplArgs(newElem)
          tmplArgs.key = branchKey
          this.handleChildrenCreation(branchFunc, newElem, slotElement, dynamicSlotName)
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
        const tmplArgs = getTmplArgs(elem)
        const keyListManager = tmplArgs.keyList!
        keyListManager.diff(
          list,
          oriListUpdatePathTree,
          elem,
          (item: DataValue, index: number | string): VirtualNode => {
            const childNode = this.shadowRoot.createVirtualNode('wx:for-item')
            childNode.destroyBackendElementOnDetach()
            Element.setInheritSlots(childNode)
            if (slotElement) Element.setSlotElement(elem, slotElement)
            this.handleChildrenCreation(
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
            childNode: Element,
          ) => {
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
      (slotName: string | undefined, slotValueInit?: (elem: Element) => void) => {
        const elem = childNodes[index] as Element
        index += 1
        if (slotName !== undefined) {
          Element.setSlotName(elem, dataValueToString(slotName))
        }
        if (slotValueInit) slotValueInit(elem)
        this.shadowRoot.applySlotValueUpdates(elem)
      },

      // other virtual node
      (children: DefineChildren, slot: string | undefined) => {
        const elem = childNodes[index] as Element
        index += 1
        if (slot !== undefined) {
          if (slotElement) {
            const tmplArgs = getTmplArgs(elem)
            if (dynamicSlotName! === slot) {
              if (tmplArgs.dynamicSlotNameMatched) {
                this.handleChildrenUpdate(children, elem, undefined, undefined)
              } else {
                const newElem = this.shadowRoot.createVirtualNode('virtual')
                newElem.destroyBackendElementOnDetach()
                Element.setSlotElement(newElem, slotElement)
                const newTmplArgs = getTmplArgs(newElem)
                newTmplArgs.dynamicSlotNameMatched = true
                this.handleChildrenCreation(children, newElem, undefined, undefined)
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

  dynamicSlotUpdate(
    elem: GeneralComponent,
    dynamicSlotValueNames: string[] | undefined,
    children: DefineChildren,
  ): ShadowRoot | null {
    const sr = elem.getShadowRoot()
    if (sr?.isDynamicSlots()) {
      sr.setDynamicSlotHandler(
        dynamicSlotValueNames || [],
        (slot, slotName, slotValues) => {
          this.handleChildrenCreation(
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
            elem,
            slot,
            slotName,
          )
        },
        (slot) => {
          const childIndexes = []
          for (let i = 0; i < elem.childNodes.length; i += 1) {
            const child = elem.childNodes[i]!
            if (sr.getContainingSlot(child) === slot) {
              childIndexes.push(i)
            }
          }
          for (let i = 0; i < childIndexes.length; i += 1) {
            const childIndex = childIndexes[i]!
            elem.removeChildAt(childIndex - i)
          }
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

  createDynamicPlaceholder(slotElement: Element): Element {
    const elem = this.shadowRoot.createVirtualNode('virtual')
    elem.destroyBackendElementOnDetach()
    Element.setSlotElement(elem, slotElement)
    const tmplArgs = getTmplArgs(elem)
    tmplArgs.dynamicSlotNameMatched = false
    return elem
  }

  createCommonElement(
    tagName: string,
    genericImpls: { [key: string]: string },
    propertyInit: (elem: Element, isCreation: boolean) => void,
    children: DefineChildren,
    dynamicSlotValueNames: string[] | undefined,
  ): Element {
    const placeholding = this.shadowRoot.checkComponentPlaceholder(tagName)
    let elem: Element
    let dynSlot = false
    const initPropValues = (elem: GeneralComponent | NativeNode) => {
      const sr =
        elem instanceof Component
          ? this.dynamicSlotUpdate(elem, dynamicSlotValueNames, children)
          : null
      if (sr) dynSlot = true
      propertyInit(elem, true)
      if (elem instanceof Component) {
        if (elem.hasPendingChanges()) {
          const nodeDataProxy = Component.getDataProxy(elem)
          nodeDataProxy.applyDataUpdates(true)
        }
        sr?.applySlotUpdates()
      }
    }
    if (this.disallowNativeNode || typeof placeholding === 'boolean') {
      let placeholderCb: (() => void) | undefined
      if (placeholding) {
        placeholderCb = () => {
          const replacer = this.shadowRoot.createComponent(
            tagName,
            tagName,
            genericImpls,
            undefined,
            initPropValues,
          )
          replacer.destroyBackendElementOnDetach()
          const replacerShadowRoot = (elem as GeneralComponent).getShadowRoot()
          const elemShadowRoot = elem instanceof Component ? elem.getShadowRoot() : null
          if (replacerShadowRoot?.isDynamicSlots()) {
            if (!elemShadowRoot?.isDynamicSlots()) {
              throw new Error(
                'The "dynamicSlots" option of the component and its placeholder should be the same.',
              )
            }
            elemShadowRoot.useDynamicSlotHandlerFrom(replacerShadowRoot)
            elem.parentNode?.replaceChild(replacer, elem)
          } else {
            if (elemShadowRoot?.isDynamicSlots()) {
              throw new Error(
                'The "dynamicSlots" option of the component and its placeholder should be the same.',
              )
            }
            elem.selfReplaceWith(replacer)
          }
        }
      }
      elem = this.shadowRoot.createComponent(
        tagName,
        tagName,
        genericImpls,
        placeholderCb,
        initPropValues,
      )
      elem.destroyBackendElementOnDetach()
    } else {
      elem = this.shadowRoot.createComponentOrNativeNode(
        placeholding ?? tagName,
        genericImpls,
        initPropValues,
      )
      elem.destroyBackendElementOnDetach()
    }
    if (dynSlot) {
      this.bindingMapDisabled = true // IDEA better binding map disable detection
    } else {
      this.handleChildrenCreation(children, elem, undefined, undefined)
    }
    return elem
  }

  // set slot
  // (not used any more, leaving for compatibilities)
  s(elem: Element, v: string) {
    elem.slot = v
  }

  // set slot value
  l(elem: Element, name: string, value: unknown) {
    this.shadowRoot.replaceSlotValue(elem, name, value)
  }

  // set id
  i(elem: Element, v: string) {
    elem.id = v
  }

  // set class or external classes named `class`
  c(elem: Element, v: string) {
    if (elem instanceof Component) {
      // "class" itself can also be an external class
      const hasExternalClass = (elem as GeneralComponent).hasExternalClass('class')
      if (hasExternalClass) {
        ;(elem as GeneralComponent).setExternalClass('class', dataValueToString(v))
      }
      elem.class = dataValueToString(v)
    } else {
      elem.class = dataValueToString(v)
    }
  }

  // set style or property named `style`
  y(elem: Element, v: string) {
    elem.setNodeStyle(dataValueToString(v), StyleSegmentIndex.MAIN)
  }

  // set dataset
  d(elem: Element, name: string, v: unknown) {
    let dataset: { [name: string]: unknown }
    if (elem.dataset) dataset = elem.dataset
    else dataset = elem.dataset = {}
    dataset[name] = v
  }

  // set mark
  m(elem: Element, name: string, v: unknown) {
    elem.setMark(name, v)
  }

  // set event handler
  v(
    elem: Element,
    evName: string,
    v: string | ((ev: ShadowedEvent<unknown>) => void) | undefined,
    final: boolean,
    mutated: boolean,
    capture: boolean,
    isDynamic: boolean,
  ) {
    const handler = typeof v === 'function' ? this.eventListenerFilter(v) : dataValueToString(v)
    const listener = (ev: ShadowedEvent<unknown>) => {
      const host = elem.ownerShadowRoot!.getHostNode()
      let ret: boolean | undefined
      const methodCaller = host.getMethodCaller() as { [key: string]: unknown }
      const f = typeof handler === 'function' ? handler : Component.getMethod(host, handler)
      if (typeof f === 'function') {
        ret = (f as (ev: ShadowedEvent<unknown>) => boolean | undefined).call(methodCaller, ev)
      }
      return ret
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
    if (handler) elem.addListener(evName, listener, evOptions)
  }

  // update a property or external class of a component, or an attribute of a native node
  r(elem: Element, name: string, v: unknown, lvaluePath?: DataPath) {
    if (elem instanceof Component) {
      const nodeDataProxy = Component.getDataProxy(elem)
      const camelName = dashToCamelCase(name)
      if (nodeDataProxy.replaceProperty(camelName, v)) {
        if (lvaluePath) {
          nodeDataProxy.setModelBindingListener(camelName, (value) => {
            const host = elem.ownerShadowRoot!.getHostNode()
            const nodeDataProxy = Component.getDataProxy(host)
            nodeDataProxy.replaceDataOnPath(lvaluePath, value)
            nodeDataProxy.applyDataUpdates(false)
          })
        }
        const tmplArgs = getTmplArgs(elem)
        if (tmplArgs.changeProp?.[name]) {
          const lv = tmplArgs.changeProp[name]!
          const oldValue = lv.oldValue
          if (oldValue !== v) {
            lv.oldValue = v
            const host = elem.ownerShadowRoot!.getHostNode()
            lv.listener.call(host.getMethodCaller(), v, oldValue, host, elem)
          }
        }
      } else if (elem.hasExternalClass(name)) {
        elem.setExternalClass(name, dataValueToString(v))
      } else {
        // compatibilities for legacy event binding syntax
        if (camelName.startsWith('bind')) {
          ProcGenWrapper.prototype.v(
            elem,
            camelName.slice('bind'.length),
            dataValueToString(v),
            false,
            false,
            false,
            true,
          )
        } else if (camelName.startsWith('captureBind')) {
          ProcGenWrapper.prototype.v(
            elem,
            camelName.slice('captureBind'.length),
            dataValueToString(v),
            false,
            false,
            true,
            true,
          )
        } else if (camelName.startsWith('catch')) {
          ProcGenWrapper.prototype.v(
            elem,
            camelName.slice('catch'.length),
            dataValueToString(v),
            true,
            false,
            false,
            true,
          )
        } else if (camelName.startsWith('captureCatch')) {
          ProcGenWrapper.prototype.v(
            elem,
            camelName.slice('captureCatch'.length),
            dataValueToString(v),
            true,
            false,
            true,
            true,
          )
        } else if (camelName.startsWith('on')) {
          ProcGenWrapper.prototype.v(
            elem,
            camelName.slice('on'.length),
            dataValueToString(v),
            false,
            false,
            false,
            true,
          )
        }
      }
    } else if (elem instanceof NativeNode) {
      const camelName = dashToCamelCase(name)
      // compatibilities for legacy event binding syntax
      if (camelName.startsWith('bind')) {
        ProcGenWrapper.prototype.v(
          elem,
          camelName.slice('bind'.length),
          dataValueToString(v),
          false,
          false,
          false,
          true,
        )
      } else if (camelName.startsWith('captureBind')) {
        ProcGenWrapper.prototype.v(
          elem,
          camelName.slice('captureBind'.length),
          dataValueToString(v),
          false,
          false,
          true,
          true,
        )
      } else if (camelName.startsWith('catch')) {
        ProcGenWrapper.prototype.v(
          elem,
          camelName.slice('catch'.length),
          dataValueToString(v),
          true,
          false,
          false,
          true,
        )
      } else if (camelName.startsWith('captureCatch')) {
        ProcGenWrapper.prototype.v(
          elem,
          camelName.slice('captureCatch'.length),
          dataValueToString(v),
          true,
          false,
          true,
          true,
        )
      } else if (camelName.startsWith('on')) {
        ProcGenWrapper.prototype.v(
          elem,
          camelName.slice('on'.length),
          dataValueToString(v),
          false,
          false,
          false,
          true,
        )
      } else {
        elem.callAttributeFilter(name, v, (newPropValue) => {
          elem.updateAttribute(name, newPropValue)
          if (lvaluePath) {
            elem.setModelBindingListener(name, (value) => {
              const host = elem.ownerShadowRoot!.getHostNode()
              const nodeDataProxy = Component.getDataProxy(host)
              nodeDataProxy.replaceDataOnPath(lvaluePath, value)
              nodeDataProxy.applyDataUpdates(false)
            })
          }
        })
      }
    }
  }

  // set a worklet directive value
  wl(elem: Element, name: string, value: unknown) {
    if (elem instanceof Component) {
      elem.triggerWorkletChangeLifetime(name, value)
    } else {
      // TODO warn unused worklet
    }
  }

  // add a change property binding
  p(elem: Element, name: string, v: ChangePropListener) {
    if (elem instanceof Component) {
      if (Component.hasProperty(elem, name)) {
        const tmplArgs = getTmplArgs(elem)
        if (!tmplArgs.changeProp) {
          tmplArgs.changeProp = Object.create(null) as typeof tmplArgs.changeProp
        }
        tmplArgs.changeProp![name] = {
          listener: this.changePropFilter(v),
          oldValue: (elem.data as { [k: string]: DataValue })[name],
        }
      }
    }
  }

  // set filter functions for change properties and event listeners
  setFnFilter(changePropFilter: <T>(v: T) => T, eventListenerFilter: <T>(v: T) => T) {
    this.changePropFilter = changePropFilter
    this.eventListenerFilter = eventListenerFilter
  }
}
