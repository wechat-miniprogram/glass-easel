/* eslint-disable class-methods-use-this */

import { type GeneralBehavior } from '../behavior'
import { type GeneralComponent } from '../component'
import { type DataChange, type DataValue } from '../data_proxy'
import { type ExternalShadowRoot } from '../external_shadow_tree'
import { type NormalizedComponentOptions } from '../global_options'
import { type ShadowRoot } from '../shadow_root'
import { type Template, type TemplateEngine, type TemplateInstance } from '../template_engine'
import { GlassEaselTemplateDOM } from './native_rendering'
import {
  ProcGenWrapper,
  type BindingMapGen,
  type ProcGen,
  type ProcGenEnv,
  type UpdatePathTreeNode,
} from './proc_gen_wrapper'

export {
  setDefaultChangePropFilter,
  setDefaultEventListenerWrapper,
  type TmplDevArgs,
  type EventListenerWrapper,
  type ChangePropListener,
  type ChangePropFilter,
} from './proc_gen_wrapper'

const DEFAULT_PROC_GEN: ProcGen = () => ({
  C: (isCreation, defineTextNode, defineElement, defineIfGroup, defineForLoop, defineSlot) => {
    defineSlot('')
  },
  B: Object.create(null) as { [field: string]: BindingMapGen[] },
})
export const DEFAULT_PROC_GEN_GROUP: (name: string) => ProcGen = () => DEFAULT_PROC_GEN

export type ProcGenGroup = (name: string) => ProcGen

export type ProcGenGroupList = { [path: string]: ProcGenGroup }

export type ComponentTemplate = {
  groupList?: ProcGenGroupList
  content: (name: string) => ProcGen
  updateMode?: string
  fallbackListenerOnNativeNode?: boolean
  procGenWrapperType?: typeof ProcGenWrapper
}

export { GeneralLvaluePathPrefix } from './proc_gen_wrapper'

const enum BindingMapUpdateEnabled {
  Disabled,
  Enabled,
  Forced,
}

// eslint-disable-next-line no-bitwise
const isPositiveInteger = (x: string) => String((x as any) >>> 0) === x

export class GlassEaselTemplateEngine implements TemplateEngine {
  create(behavior: GeneralBehavior, componentOptions: NormalizedComponentOptions): Template {
    if (componentOptions.externalComponent) {
      return new GlassEaselTemplateDOM(behavior)
    }
    return new GlassEaselTemplate(behavior)
  }
}

class GlassEaselTemplate implements Template {
  genObjectGroupEnv!: ProcGenEnv
  updateMode!: string
  fallbackListenerOnNativeNode!: boolean

  constructor(behavior: GeneralBehavior) {
    this.updateTemplate(behavior)
  }

  /**
   * Update the underlying template content
   *
   * This method does not affect created instances.
   */
  updateTemplate(behavior: GeneralBehavior) {
    const template = behavior._$template
    if (typeof template !== 'object' && template !== undefined) {
      throw new Error(
        `Component template of ${behavior.is} must be a valid compiled template (or "null" for default template).`,
      )
    }
    const c = (template as ComponentTemplate | null | undefined) || {
      content: DEFAULT_PROC_GEN_GROUP,
    }
    this.genObjectGroupEnv = {
      list: c.groupList || (Object.create(null) as ProcGenGroupList),
      group: c.content,
    }
    this.updateMode = c.updateMode || ''
    this.fallbackListenerOnNativeNode = c.fallbackListenerOnNativeNode || false
  }

  createInstance(
    comp: GeneralComponent,
    createShadowRoot: (component: GeneralComponent) => ShadowRoot,
  ): TemplateInstance {
    return new GlassEaselTemplateInstance(this, comp, createShadowRoot(comp))
  }
}

class GlassEaselTemplateInstance implements TemplateInstance {
  comp: GeneralComponent
  shadowRoot: ShadowRoot
  procGenWrapper!: ProcGenWrapper
  forceBindingMapUpdate!: BindingMapUpdateEnabled
  bindingMapGen: { [field: string]: BindingMapGen[] } | undefined

  constructor(template: GlassEaselTemplate, comp: GeneralComponent, shadowRoot: ShadowRoot) {
    this.comp = comp
    this.shadowRoot = shadowRoot
    this.shadowRoot.destroyBackendElementOnRemoval()
    this._$applyTemplate(template)
  }

  updateTemplate(template: GlassEaselTemplate, data: DataValue) {
    this._$applyTemplate(template)
    this.shadowRoot.removeChildren(0, this.shadowRoot.childNodes.length)
    this.bindingMapGen = this.procGenWrapper.create(data)
  }

  private _$applyTemplate(template: GlassEaselTemplate) {
    const procGen = template.genObjectGroupEnv.group('') || DEFAULT_PROC_GEN_GROUP('')
    if (template.updateMode === 'bindingMap') {
      this.forceBindingMapUpdate = BindingMapUpdateEnabled.Forced
    } else if (template.updateMode === 'virtualTree') {
      this.forceBindingMapUpdate = BindingMapUpdateEnabled.Disabled
    } else {
      this.forceBindingMapUpdate = BindingMapUpdateEnabled.Enabled
    }
    this.procGenWrapper = new ProcGenWrapper(
      this.shadowRoot,
      procGen,
      template.fallbackListenerOnNativeNode,
    )
    this.bindingMapGen = undefined
  }

  initValues(data: DataValue): ShadowRoot | ExternalShadowRoot {
    this.bindingMapGen = this.procGenWrapper.create(data)
    return this.shadowRoot
  }

  updateValues(data: DataValue, changes: DataChange[]) {
    if (this.forceBindingMapUpdate === BindingMapUpdateEnabled.Forced) {
      for (let i = 0; i < changes.length; i += 1) {
        this.tryBindingMapUpdate(data, changes[i])
      }
      return
    }
    if (this.forceBindingMapUpdate === BindingMapUpdateEnabled.Enabled && changes.length <= 1) {
      if (this.bindingMapGen) {
        if (this.tryBindingMapUpdate(data, changes[0])) {
          return
        }
      }
    }
    const dataUpdatePathTree: UpdatePathTreeNode = Object.create(null) as UpdatePathTreeNode
    for (let i = 0; i < changes.length; i += 1) {
      const [p, newVal, spliceIndex, spliceDel] = changes[i]!
      let cur = dataUpdatePathTree as { [key: string]: UpdatePathTreeNode }
      for (let j = 0; j < p.length; j += 1) {
        const field = p[j]!
        const v = cur[field]
        if (v === true) break
        if (j === p.length - 1) {
          if (spliceDel === undefined) {
            // replace update
            cur[field] = true
          } else {
            // splice update
            const startIndex = spliceIndex
            if (v === undefined) {
              cur[field] = Object.create(new Array(startIndex)) as UpdatePathTreeNode[]
            } else if (!Array.isArray(Object.getPrototypeOf(v))) {
              // if the target is not an array, replace it as an array
              const arr = new Array(startIndex)
              const keys = Object.keys(v)
              let lengthChanged = false
              for (let i = 0; i < keys.length; i += 1) {
                // collect items that have been changed
                const key = keys[i]!
                const item = (v as { [key: string]: UpdatePathTreeNode })[key]!
                if (isPositiveInteger(key)) {
                  arr[Number(key)] = item
                } else if (key === 'length') {
                  lengthChanged = true
                }
              }
              const wrappedArr = Object.create(arr) as { [key: string]: UpdatePathTreeNode }
              if (lengthChanged) {
                wrappedArr.length = true
              }
              cur[field] = wrappedArr
            } else {
              // if the target is already an array, use it
              const arr = Object.getPrototypeOf(v) as UpdatePathTreeNode[]
              if (arr.length < startIndex) arr.length = startIndex
              const wrapper = v as { [key: string]: UpdatePathTreeNode }
              const keys = Object.keys(wrapper)
              for (let i = 0; i < keys.length; i += 1) {
                // NOTE
                // Some items may be changed separatedly after the array splice.
                // These fields should be reassigned to the array,
                // so that they can be spliced.
                const key = keys[i]!
                if (isPositiveInteger(key)) {
                  arr[Number(key)] = wrapper[key]!
                  delete wrapper[key]
                }
              }
            }
            const arr = Object.getPrototypeOf(cur[field]) as UpdatePathTreeNode[]
            const inserts = new Array(newVal.length)
            inserts.fill(true)
            arr.splice(spliceIndex, spliceDel, ...inserts)
          }
          break
        }
        if (v === undefined) {
          const next = Object.create(null) as { [key: string]: UpdatePathTreeNode }
          cur[field] = next
          cur = next
        } else {
          cur = v as { [key: string]: UpdatePathTreeNode }
        }
      }
    }
    this.procGenWrapper.update(data, dataUpdatePathTree)
  }

  tryBindingMapUpdate(data: DataValue, change?: DataChange): boolean {
    if (!change) return true
    const bindingMapGen = this.bindingMapGen
    if (!bindingMapGen) {
      return false
    }
    const [path] = change
    if (path.length !== 1) return false
    return this.procGenWrapper.bindingMapUpdate(path[0] as string, data, bindingMapGen)
  }
}

let defaultTemplateEngine: TemplateEngine | null = null

export const getDefaultTemplateEngine = (): TemplateEngine => {
  if (defaultTemplateEngine) {
    return defaultTemplateEngine
  }
  const tmpl = new GlassEaselTemplateEngine()
  defaultTemplateEngine = tmpl
  return tmpl
}
