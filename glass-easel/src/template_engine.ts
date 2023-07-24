import { GeneralBehavior } from './behavior'
import { ShadowRoot } from './shadow_root'
import { DataChange, DataValue } from './data_proxy'
import { NormalizedComponentOptions } from './global_options'
import { ExternalShadowRoot } from './external_shadow_tree'
import { GeneralComponent } from './component'

export interface TemplateEngine {
  create(behavior: GeneralBehavior, componentOptions: NormalizedComponentOptions): Template
}

export interface Template {
  createInstance(elem: GeneralComponent): TemplateInstance
}

export interface TemplateInstance {
  shadowRoot: ShadowRoot | ExternalShadowRoot

  initValues(data: DataValue): void

  updateValues(data: DataValue, changes: DataChange[]): void
}
