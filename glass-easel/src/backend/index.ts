import type * as backend from './backend_protocol'
import type * as composedBackend from './composed_backend_protocol'
import type * as domlikeBackend from './domlike_backend_protocol'

export * from './shared'
export * as backend from './backend_protocol'
export * as composedBackend from './composed_backend_protocol'
export * as domlikeBackend from './domlike_backend_protocol'

export type GeneralBackendContext =
  | backend.Context
  | composedBackend.Context
  | domlikeBackend.Context

export type GeneralBackendElement =
  | backend.Element
  | composedBackend.Element
  | domlikeBackend.Element
