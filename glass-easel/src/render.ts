import { safeCallback } from './func_arr'
import { Element } from './element'
import { GeneralBackendContext } from './node'

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
