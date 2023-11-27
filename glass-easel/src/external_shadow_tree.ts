import { type Event, type ShadowedEvent } from './event'
import { type GeneralBackendElement } from './backend'

/**
 * An external shadow root
 *
 * It can be used to build an external component.
 * External component is a customizable subtree that can be composed with normal components.
 * It allows third-party frameworks to render a subtree and then compose it together.
 * However, the subtree must be created in the same backend context.
 */
export interface ExternalShadowRoot {
  root: GeneralBackendElement
  slot: GeneralBackendElement
  getIdMap(): { [id: string]: GeneralBackendElement }
  handleEvent<T>(target: GeneralBackendElement, event: Event<T>): void
  setListener<T>(
    elem: GeneralBackendElement,
    ev: string,
    listener: (event: ShadowedEvent<T>) => unknown,
  ): void
}
