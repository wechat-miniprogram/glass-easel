/* global document: false */

import { BackendMode, type GeneralBackendElement } from '../backend'
import { type GeneralBehavior } from '../behavior'
import { type GeneralComponent } from '../component'
import { type DataChange, type DataValue } from '../data_proxy'
import { type Event, type ShadowedEvent } from '../event'
import { type ExternalShadowRoot } from '../external_shadow_tree'
import { type GeneralFuncType } from '../func_arr'
import { type Template, type TemplateInstance } from '../template_engine'
import { type ComponentTemplate, type ProcGenGroupList } from './index'
import { type BindingMapGen, type ProcGen, type ProcGenEnv } from './proc_gen_wrapper'
import { ProcGenWrapperDom } from './proc_gen_wrapper_dom'

type ElementWithEvent = Element & {
  _$wxTmplEv: { [ev: string]: (event: ShadowedEvent<unknown>) => unknown }
}
export type ExternalEvent = Event<unknown> & { target: Element; currentTarget: Element }

const DEFAULT_PROC_GEN_DOM: ProcGen = () => ({
  C: (isCreation, defineTextNode, defineElement, defineIfGroup, defineForLoop, defineSlot) => {
    defineSlot('')
  },
  B: Object.create(null) as { [field: string]: BindingMapGen[] },
})
export const DEFAULT_PROC_GEN_GROUP_DOM: (name: string) => ProcGen = () => DEFAULT_PROC_GEN_DOM

export class GlassEaselTemplateDOM implements Template {
  data: DataValue
  innerData: DataValue
  genObjectGroupEnv: ProcGenEnv
  updateMode: string
  methods: { [name: string]: GeneralFuncType }

  constructor(behavior: GeneralBehavior) {
    if (typeof behavior._$template !== 'object' && behavior._$template !== undefined) {
      throw new Error(
        `Component template of ${behavior.is} must be a valid compiled template (or "null" for default template).`,
      )
    } else {
      const c = (behavior._$template as ComponentTemplate | null | undefined) || {
        content: DEFAULT_PROC_GEN_GROUP_DOM,
      }
      this.genObjectGroupEnv = {
        list: c.groupList || (Object.create(null) as ProcGenGroupList),
        group: c.content,
      }
    }
    this.updateMode = ''
    this.methods = behavior._$methodMap
  }

  createInstance(comp: GeneralComponent): TemplateInstance {
    return new GlassEaselTemplateDOMInstance(this, comp)
  }
}

export class GlassEaselTemplateDOMInstance implements TemplateInstance, ExternalShadowRoot {
  template: GlassEaselTemplateDOM
  comp: GeneralComponent
  shadowRoot: ExternalShadowRoot
  shadowRootElement: Element
  root: GeneralBackendElement
  slot: GeneralBackendElement
  idMap: { [key: string]: Element }
  listeners: Array<unknown>
  procGenWrapper: ProcGenWrapperDom
  bindingMapGen: { [field: string]: BindingMapGen[] } | undefined

  constructor(template: GlassEaselTemplateDOM, comp: GeneralComponent) {
    if (comp.getBackendMode() !== BackendMode.Domlike) {
      throw new Error(
        `Component template of ${comp.is} cannot be initialized since external rendering is only supported in Domlike backend currently.`,
      )
    }
    const shadowRootElement = comp.getBackendElement() as unknown as Element
    if (!shadowRootElement) {
      throw new Error(
        `Component template of ${comp.is} cannot be initialized as external components since no suitable backend element found.`,
      )
    }
    this.comp = comp
    this.shadowRoot = this
    this.shadowRootElement = shadowRootElement
    this.root = shadowRootElement as unknown as GeneralBackendElement
    this.slot = shadowRootElement as unknown as GeneralBackendElement
    this.template = template
    const procGen = template.genObjectGroupEnv.group('') || DEFAULT_PROC_GEN_GROUP_DOM('')
    this.procGenWrapper = new ProcGenWrapperDom(this, procGen)
    this.idMap = Object.create(null) as { [key: string]: Element }
    this.listeners = []
  }

  initValues(data: DataValue) {
    this.bindingMapGen = this.procGenWrapper.create(data)
    if (!this.bindingMapGen) {
      throw new Error(
        'The component template does not support binding-map-update, so it cannot be used as external components.',
      )
    }
    const shadowRoot = this.shadowRootElement
    if ((this.slot as unknown as Element) === shadowRoot && shadowRoot.childNodes.length > 0) {
      // if `<slot />` is forgot, add one at the end of the child list
      const slot = document.createElement('virtual')
      shadowRoot.appendChild(slot)
      this.slot = slot as unknown as GeneralBackendElement
    }
  }

  getIdMap(): { [key: string]: GeneralBackendElement } {
    return this.idMap as unknown as { [key: string]: GeneralBackendElement }
  }

  updateValues(data: DataValue, changes: DataChange[]) {
    const bindingMapGen = this.bindingMapGen!
    for (let i = 0; i < changes.length; i += 1) {
      const [path] = changes[i]!
      this.procGenWrapper.bindingMapUpdate(path[0] as string, data, bindingMapGen)
    }
  }

  // eslint-disable-next-line class-methods-use-this
  setListener<T>(
    elem: GeneralBackendElement,
    ev: string,
    listener: (event: ShadowedEvent<T>) => unknown,
  ) {
    const target = elem as unknown as ElementWithEvent
    if (target._$wxTmplEv) {
      target._$wxTmplEv[ev] = listener as (event: ShadowedEvent<unknown>) => unknown
    } else {
      target._$wxTmplEv = { [ev]: listener as (event: ShadowedEvent<unknown>) => unknown }
    }
  }

  handleEvent(elem: GeneralBackendElement, event: Event<unknown>) {
    const target = elem as unknown as ElementWithEvent
    let cur: Element = target
    const root = this.shadowRootElement
    const evName = event.getEventName()
    const bubbles = event.bubbles
    for (;;) {
      const shadowedEvent = event.wrapShadowedEvent(target as any, null, cur as any)
      const f = (cur as unknown as ElementWithEvent)._$wxTmplEv?.[evName]
      if (f) {
        const r = f.call(cur, shadowedEvent)
        if (r === false) {
          event.preventDefault()
          event.stopPropagation()
        }
      }
      if (!bubbles || event.propagationStopped()) break
      if (cur === root) break
      const next = cur.parentNode
      if (next) cur = next as Element
      else break
    }
  }
}
