import { type GeneralBackendContext } from './backend'
import { type Element } from './element'
import { safeCallback } from './func_arr'

const triggerRenderOnContext = (
  context: GeneralBackendContext,
  cb: ((err: Error | null) => void) | null,
) => {
  context.render(() => {
    if (typeof cb === 'function') {
      safeCallback('render', cb, context, [null])
    }
  })
}

export const triggerRender = (element: Element, callback?: (err: Error | null) => void) => {
  const context = element.getBackendContext()
  triggerRenderOnContext(context, callback || null)
}
