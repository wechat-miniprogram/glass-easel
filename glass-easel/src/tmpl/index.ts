/* eslint-disable class-methods-use-this */

import {
  ShadowRoot,
  ExternalShadowRoot,
  DataValue,
  templateEngine,
  GeneralBehavior,
  NormalizedComponentOptions,
  GeneralComponent,
  ShadowedEvent,
} from '..'
import { DataChange } from '../data_proxy'
import { GlassEaselTemplateDOM } from './native_rendering'
import {
  ProcGenWrapper,
  ProcGenEnv,
  ProcGen,
  BindingMapGen,
  UpdatePathTreeNode,
  setGlobalEventObjectFilter,
} from './proc_gen_wrapper'

export { setGlobalEventObjectFilter }

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
  disallowNativeNode?: boolean
  eventObjectFilter?: (x: ShadowedEvent<unknown>) => ShadowedEvent<unknown>
  procGenWrapperType?: typeof ProcGenWrapper
}

const enum BindingMapUpdateEnabled {
  Disabled,
  Enabled,
  Forced,
}

export class GlassEaselTemplateEngine implements templateEngine.TemplateEngine {
  create(
    behavior: GeneralBehavior,
    componentOptions: NormalizedComponentOptions,
  ): templateEngine.Template {
    if (componentOptions.externalComponent) {
      return new GlassEaselTemplateDOM(behavior)
    }
    return new GlassEaselTemplate(behavior)
  }
}

class GlassEaselTemplate implements templateEngine.Template {
  genObjectGroupEnv!: ProcGenEnv
  updateMode!: string
  disallowNativeNode!: boolean
  eventObjectFilter?: (x: ShadowedEvent<unknown>) => ShadowedEvent<unknown>

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
    this.disallowNativeNode = c.disallowNativeNode || false
    this.eventObjectFilter = c.eventObjectFilter
  }

  createInstance(comp: GeneralComponent): templateEngine.TemplateInstance {
    return new GlassEaselTemplateInstance(this, comp)
  }
}

class GlassEaselTemplateInstance implements templateEngine.TemplateInstance {
  comp: GeneralComponent
  shadowRoot: ShadowRoot
  procGenWrapper!: ProcGenWrapper
  forceBindingMapUpdate!: BindingMapUpdateEnabled
  bindingMapGen: { [field: string]: BindingMapGen[] } | undefined

  constructor(template: GlassEaselTemplate, comp: GeneralComponent) {
    this.comp = comp
    this.shadowRoot = ShadowRoot.createShadowRoot(comp)
    this.shadowRoot.destroyBackendElementOnDetach()
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
      template.disallowNativeNode,
      template.eventObjectFilter,
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
            cur[field] = true
          } else {
            const startIndex = spliceIndex
            if (v === undefined) {
              cur[field] = new Array(startIndex)
            } else if (!Array.isArray(v)) {
              const arr = new Array(startIndex)
              const keys = Object.keys(v)
              for (let i = 0; i < keys.length; i += 1) {
                const key = keys[i]!
                const item = v[key]!
                const index = Number(key)
                if (arr.length < index) arr.length = index
                arr[key as unknown as number] = item
              }
              cur[field] = arr
            }
            const arr = cur[field] as UpdatePathTreeNode[]
            if (arr.length < startIndex) {
              arr.length = startIndex
            }
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
