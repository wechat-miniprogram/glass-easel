import { type GeneralBehavior } from './behavior'
import { type ShadowRoot } from './shadow_root'
import { type DataChange, type DataValue } from './data_proxy'
import { type NormalizedComponentOptions } from './global_options'
import { type ExternalShadowRoot } from './external_shadow_tree'
import { type GeneralComponent } from './component'

/**
 * A template engine that handles the template part of a component
 */
export interface TemplateEngine {
  /**
   * Preprocess a behavior and generate a preprocessed template
   *
   * This function is called during component prepare.
   * The `_$template` field of the behavior is designed to be handled by the template engine,
   * and should be preprocessed in this function.
   */
  create(behavior: GeneralBehavior, componentOptions: NormalizedComponentOptions): Template
}

/**
 * A preprocessed template
 */
export interface Template {
  /**
   * Create a template instance for a component instance
   */
  createInstance(elem: GeneralComponent): TemplateInstance

  /**
   * Update the content of the template (optional)
   *
   * Implement this function if template update is needed (usually used during development).
   * The behavior is always the object which used when creation.
   */
  updateTemplate?(behavior: GeneralBehavior): void
}

/**
 * A template instance that works with a component instance
 */
export interface TemplateInstance {
  /**
   * The shadow root of the component
   *
   * This field should not be changed.
   */
  shadowRoot: ShadowRoot | ExternalShadowRoot

  /**
   * Apply the updated template content (optional)
   *
   * Implement this function if template update is needed (usually used during development).
   * The template is always the object which used when creation.
   */
  updateTemplate?(template: Template, data: DataValue): void

  initValues(data: DataValue): void

  updateValues(data: DataValue, changes: DataChange[]): void
}
