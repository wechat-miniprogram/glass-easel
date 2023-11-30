import { type AnyComponent, type GeneralComponent } from './component'
import { FuncArr, _setErrorDispatcher } from './func_arr'
import { globalOptions } from './global_options'
import { type Node, dumpSingleElementToString } from './node'
import { isComponent } from './type_symbol'

let insideErrorHandler = false

const errorFuncArr = new FuncArr<ErrorListener>('error')
const warningFuncArr = new FuncArr<WarningListener>('warning')

_setErrorDispatcher(dispatchError)

export type ErrorListener = (
  error: unknown,
  method?: string,
  relatedComponent?: GeneralComponent | string,
  element?: Node,
) => boolean | void

export type WarningListener = (
  message: string,
  relatedComponent: GeneralComponent | string,
  element?: Node,
) => boolean | void

export function dispatchError(
  err: unknown,
  method?: string,
  relatedComponent?: AnyComponent | string,
  element?: Node,
) {
  if (!insideErrorHandler) {
    insideErrorHandler = true
    if (isComponent(relatedComponent)) {
      relatedComponent.triggerLifetime('error', [err])
    }
    const shouldBreak =
      errorFuncArr.call(err as any, [err, method, relatedComponent, element]) === false
    insideErrorHandler = false
    if (shouldBreak) return
  }
  if (globalOptions.throwGlobalError) {
    throw err
  } else {
    // eslint-disable-next-line no-console
    console.error(
      [
        err instanceof Error ? `${err.message}` : String(err),
        element ? `\t@${dumpSingleElementToString(element)}` : undefined,
        relatedComponent
          ? `\t${method || ''}@${
              typeof relatedComponent === 'string'
                ? `<${relatedComponent}>`
                : dumpSingleElementToString(relatedComponent || false)
            }`
          : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }
}

export function triggerWarning(
  msg: string,
  relatedComponent?: AnyComponent | string,
  element?: Node,
) {
  if (warningFuncArr.call(null, [msg, relatedComponent || '', element])) {
    // eslint-disable-next-line no-console
    console.warn(msg)
  }
}

export class ThirdError extends Error {
  constructor(
    message: string,
    public additionalStack?: string,
    public relatedComponent?: AnyComponent | string,
    public element?: Node,
  ) {
    super(message)
    dispatchError(this, additionalStack, relatedComponent, element)
  }
}

export function addGlobalErrorListener(func: ErrorListener) {
  errorFuncArr.add(func)
}

export function removeGlobalErrorListener(func: ErrorListener) {
  errorFuncArr.remove(func)
}

export function addGlobalWarningListener(func: WarningListener) {
  warningFuncArr.add(func)
}

export function removeGlobalWarningListener(func: WarningListener) {
  warningFuncArr.remove(func)
}

export function safeCallback<F extends (this: any, ...args: any[]) => any>(
  this: void,
  type: string,
  method: F,
  caller: ThisParameterType<F>,
  args: Parameters<F>,
  relatedComponent?: AnyComponent,
): ReturnType<F> | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return method.apply(caller, args)
  } catch (e) {
    dispatchError(e, `${type || 'Listener'} ${method.name || '(anonymous)'}`, relatedComponent)
    return undefined
  }
}
