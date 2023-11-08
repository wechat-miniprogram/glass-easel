/* eslint-disable class-methods-use-this */
/* global document */

import { type GeneralBackendElement } from '../backend'
import { type DataPath } from '../data_path'
import { type DataValue } from '../data_proxy'
import { type ShadowedEvent } from '../event'
import { type GlassEaselTemplateDOMInstance } from './native_rendering'
import {
  dataValueToString,
  type BindingMapGen,
  type ProcGen,
  type ProcGenWrapper,
  type UpdatePathTreeRoot,
} from './proc_gen_wrapper'
import { type RangeListManager } from './range_list_diff'

type TmplArgs = {
  key?: number | string
  keyList?: RangeListManager
  dynEvListeners?: {
    [name: string]: (ev: ShadowedEvent<unknown>) => boolean | undefined
  }
  index?: number
  slotProps?: Record<string, [DataValue, DataPath | null, boolean]>
  slotPropsUpdatePathTree?: Record<string, UpdatePathTreeRoot>
}
export type TmplNode = Node & { _$wxTmplArgs?: TmplArgs }

const noop = () => {
  /* empty */
}

export type DefineChildren = (
  isCreation: boolean,
  defineTextNode: DefineTextNode,
  defineElement: DefineElement,
  defineIfGroup: typeof noop,
  defineForLoop: typeof noop,
  defineSlot: DefineSlot,
  definePureVirtualNode: DefinePureVirtualNode,
) => void

type DefineTextNode = (text: string | undefined, textInit?: (elem: Text) => void) => void

type DefineElement = (
  tag: string,
  genericImpls: { [key: string]: string },
  propertyInit: (elem: HTMLElement, isCreation: boolean) => void,
  children: DefineChildren,
  slot: string | undefined,
) => void

type DefineSlot = () => void

type DefinePureVirtualNode = (children: DefineChildren, slot: string | undefined) => void

export class ProcGenWrapperDom {
  shadowRoot: GlassEaselTemplateDOMInstance
  procGen: ProcGen

  constructor(shadowRoot: GlassEaselTemplateDOMInstance, procGen: ProcGen) {
    this.shadowRoot = shadowRoot
    this.procGen = procGen
  }

  create(data: DataValue): { [field: string]: BindingMapGen[] } | undefined {
    const { shadowRoot, procGen } = this
    const children = procGen(this as unknown as ProcGenWrapper, true, data, undefined)
    this.handleChildrenCreation(
      children.C as unknown as DefineChildren,
      shadowRoot.shadowRootElement as HTMLElement,
    )
    return children.B
  }

  bindingMapUpdate(
    field: string,
    data: DataValue,
    bindingMapGenList: { [field: string]: BindingMapGen[] },
  ): void {
    const updaters = bindingMapGenList[field]
    if (updaters === undefined) return
    for (let i = 0; i < updaters.length; i += 1) {
      const bindingMapGen = updaters[i]!
      bindingMapGen(
        data,
        () => {
          /* empty */
        },
        (elem: unknown, v: string) => {
          ;(elem as Text).textContent = v
        },
      )
    }
  }

  handleChildrenCreation(children: DefineChildren, parentNode: HTMLElement): void {
    let slotMergeable = true
    let slotMerged = false
    const appendSlot = () => {
      slotMergeable = false
      slotMerged = false
      const elem = document.createElement('virtual')
      parentNode.appendChild(elem)
      this.shadowRoot.slot = elem as unknown as GeneralBackendElement
    }
    children(
      true,
      // text node
      (textContent: string | undefined, textInit?: (elem: Text) => void) => {
        if (slotMerged) appendSlot()
        else slotMergeable = false
        const elem = document.createTextNode(textContent || '')
        if (textInit) textInit(elem)
        parentNode.appendChild(elem)
      },
      // component or native node
      (
        tagName: string,
        genericImpls: { [key: string]: string },
        propertyInit: (elem: HTMLElement, isCreation: boolean) => void,
        children: DefineChildren,
      ) => {
        if (slotMerged) appendSlot()
        else slotMergeable = false
        const elem = document.createElement(tagName)
        propertyInit(elem, true)
        this.handleChildrenCreation(children, elem)
        parentNode.appendChild(elem)
      },
      // wx:if node or template-is node
      noop,
      // wx:for node
      noop,
      // slot node
      () => {
        if (slotMergeable) {
          slotMerged = true
          this.shadowRoot.slot = parentNode as unknown as GeneralBackendElement
        } else {
          appendSlot()
        }
      },
      // other virtual node
      (children: DefineChildren) => {
        if (slotMerged) appendSlot()
        else slotMergeable = false
        const elem = document.createElement('virtual')
        this.handleChildrenCreation(children, elem)
        parentNode.appendChild(elem)
      },
    )
  }

  // set slot
  s() {
    noop()
  }

  // set id
  i(elem: HTMLElement, v: string) {
    this.shadowRoot.idMap[v] = elem
  }

  // set class or external classes named `class`
  c(elem: HTMLElement, v: string) {
    elem.setAttribute('class', v)
  }

  // set style or property named `style`
  y(elem: HTMLElement, v: string) {
    elem.setAttribute('style', v)
  }

  // set dataset
  d(elem: HTMLElement, name: string, v: unknown) {
    elem.dataset[name] = dataValueToString(v)
  }

  // set mark
  m() {
    noop()
  }

  // set event handler
  v(elem: HTMLElement, evName: string, v: string, final: boolean) {
    this.shadowRoot.setListener(elem as unknown as GeneralBackendElement, evName, (ev) => {
      const handler = this.shadowRoot.template.methods[v]
      const ret = handler?.(ev) as unknown
      if (final) return false
      return ret
    })
  }

  // update a property or external class of a component, or an attribute of a native node
  r(elem: HTMLElement, name: string, v: unknown) {
    if (typeof v === 'boolean') {
      if (v) elem.setAttribute(name, '')
      else elem.removeAttribute(name)
    } else {
      elem.setAttribute(name, dataValueToString(v))
    }
  }

  // add a change property binding
  p() {
    noop()
  }

  // set filter functions for change properties and event listeners
  setFnFilter() {
    noop()
  }
}
