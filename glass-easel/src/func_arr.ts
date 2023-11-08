import { type GeneralComponent } from './component'
import { globalOptions } from './global_options'
import { isComponent } from './type_symbol'

export type GeneralFuncType = (this: any, ...args: any[]) => any

type ErrorInfo = {
  message: string
  type: string
  element: unknown
  method: unknown
  args: unknown[]
}

function dispatchError(err: unknown, info: ErrorInfo, avoidErrorHandler?: boolean) {
  if (!avoidErrorHandler && errorFuncArr.call(err as any, [err, info]) === false) return
  if (globalOptions.throwGlobalError) {
    throw err
  } else {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err))
  }
}

export class FuncArr<F extends GeneralFuncType> {
  empty = true
  private _$type = ''
  private _$arr: F[] | null = null
  _$avoidErrorHandler = false

  add(func: F) {
    if (!this._$arr) this._$arr = [func]
    else this._$arr = this._$arr.concat(func)
    this.empty = false
  }

  remove(func: F): F | null {
    let ret: F | null = null
    if (this._$arr) {
      const newArr: F[] = []
      const oldArr = this._$arr
      for (let i = 0; i < oldArr.length; i += 1) {
        if (oldArr[i] === func) {
          newArr.push(...oldArr.slice(i + 1))
          ret = func
          break
        }
        newArr.push(oldArr[i]!)
      }
      this._$arr = newArr
      this.empty = this._$arr.length === 0
    }
    return ret
  }

  call(
    caller: ThisParameterType<F>,
    args: Parameters<F>,
    relatedComponent?: GeneralComponent,
  ): boolean {
    const arr = this._$arr
    let ret = true
    if (arr) {
      for (let i = 0; i < arr.length; i += 1) {
        const r = safeCallback(
          this._$type,
          arr[i]!,
          caller,
          args,
          relatedComponent,
          this._$avoidErrorHandler,
        )
        if (r === false) ret = false
      }
    }
    return ret
  }

  static safeCallback<F extends GeneralFuncType>(
    this: void,
    type: string,
    method: F,
    caller: ThisParameterType<F>,
    args: Parameters<F>,
    relatedComponent?: GeneralComponent,
    avoidErrorHandler = false,
  ): ReturnType<F> | undefined {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return method.apply(caller, args)
    } catch (e) {
      let msg = `[Error] [Component] ${type || 'Error Listener'} Error @ `
      if (isComponent(caller)) msg += caller.is
      else if (isComponent(relatedComponent)) msg += relatedComponent.is
      msg += `#${method.name || '(anonymous)'}`
      if (relatedComponent) {
        relatedComponent.triggerLifetime('error', [e])
      }
      dispatchError(
        e,
        {
          message: msg,
          type,
          element: caller,
          method,
          args,
        },
        avoidErrorHandler,
      )
      return undefined
    }
  }

  static addGlobalErrorListener(this: void, func: (err: Error, info: ErrorInfo) => boolean) {
    errorFuncArr.add(func)
  }

  static removeGlobalErrorListener(this: void, func: (err: Error, info: ErrorInfo) => boolean) {
    errorFuncArr.remove(func)
  }

  static addGlobalWarningListener(this: void, func: (msg: string) => void) {
    warningFuncArr.add(func)
  }

  static removeGlobalWarningListener(this: void, func: (msg: string) => void) {
    warningFuncArr.remove(func)
  }
}

export function triggerWarning(msg: string) {
  const message = `[Warning] [Component] ${msg}`
  if (warningFuncArr.call(message, [message])) {
    // eslint-disable-next-line no-console
    console.warn(message)
  }
}

const errorFuncArr = new FuncArr()
errorFuncArr._$avoidErrorHandler = true
const warningFuncArr = new FuncArr()

export class FuncArrWithMeta<F extends GeneralFuncType, T> {
  empty = true
  private _$type = ''
  private _$arr: { f: F; data: T }[] | null = null

  add(func: F, data: T) {
    const item = { f: func, data }
    if (!this._$arr) this._$arr = [item]
    else this._$arr = this._$arr.concat(item)
    this.empty = false
  }

  remove(func: F): T | null {
    let ret: T | null = null
    if (this._$arr) {
      const newArr: { f: F; data: T }[] = []
      const oldArr = this._$arr
      for (let i = 0; i < oldArr.length; i += 1) {
        const v = oldArr[i]!
        if (v.f === func) {
          newArr.push(...oldArr.slice(i + 1))
          ret = v.data
          break
        }
        newArr.push(v)
      }
      this._$arr = newArr
      this.empty = this._$arr.length === 0
    }
    return ret
  }

  call(
    caller: ThisParameterType<F>,
    args: Parameters<F>,
    retainFn: (data: T) => boolean,
    relatedComponent?: GeneralComponent,
  ): boolean {
    const arr = this._$arr
    let ret = true
    if (arr) {
      for (let i = 0; i < arr.length; i += 1) {
        const { f, data } = arr[i]!
        if (!retainFn(data)) continue
        const r = FuncArr.safeCallback(this._$type, f, caller, args, relatedComponent)
        if (r === false) ret = false
      }
    }
    return ret
  }
}

export const safeCallback = FuncArr.safeCallback
export const addGlobalErrorListener = FuncArr.addGlobalErrorListener
export const removeGlobalErrorListener = FuncArr.removeGlobalErrorListener
export const addGlobalWarningListener = FuncArr.addGlobalWarningListener
export const removeGlobalWarningListener = FuncArr.removeGlobalWarningListener
