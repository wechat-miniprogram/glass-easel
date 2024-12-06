import { type AnyComponent, type GeneralComponent } from './component'
import { performanceMeasureEnd, performanceMeasureStart } from './dev_tools'
import { ENV } from './global_options'
import { type Node } from './node'

export type GeneralFuncType = (this: any, ...args: any[]) => any

export class FuncArr<F extends GeneralFuncType> {
  empty = true
  /* @internal */
  private _$type: string
  /* @internal */
  private _$arr: F[] | null = null
  /* @internal */

  constructor(type: string) {
    this._$type = type
  }

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
    relatedComponent?: AnyComponent | string,
  ): boolean {
    const arr = this._$arr
    let ret = true
    if (arr) {
      for (let i = 0; i < arr.length; i += 1) {
        const r = safeCallback<F>(this._$type, arr[i]!, caller, args, relatedComponent)
        if (r === false) ret = false
      }
    }
    return ret
  }
}

export class FuncArrWithMeta<F extends GeneralFuncType, T> {
  empty = true
  private _$type: string
  private _$arr: { f: F; data: T }[] | null = null

  constructor(type: string) {
    this._$type = type
  }

  getArr() {
    return this._$arr
  }

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
    handleReturn?: (ret: unknown) => boolean | void,
  ): boolean {
    const arr = this._$arr
    let ret = true
    if (arr) {
      for (let i = 0; i < arr.length; i += 1) {
        const { f, data } = arr[i]!
        if (!retainFn(data)) continue
        const rawReturn = safeCallback(this._$type, f, caller, args, relatedComponent)
        const r = handleReturn ? handleReturn(rawReturn) : rawReturn
        if (r === false) ret = false
      }
    }
    return ret
  }
}

let dispatchError: (
  err: unknown,
  method?: string,
  relatedComponent?: AnyComponent | string,
  element?: Node,
) => void = () => {}

export function _setErrorDispatcher(dispatcher: typeof dispatchError) {
  dispatchError = dispatcher
}

export function safeCallback<F extends GeneralFuncType>(
  this: void,
  type: string,
  method: F,
  caller: ThisParameterType<F>,
  args: Parameters<F>,
  relatedComponent?: AnyComponent | string,
): ReturnType<F> | undefined {
  try {
    if (ENV.DEV)
      performanceMeasureStart(`${type}.${method.name || '(anonymous)'}`, relatedComponent, { args })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return method.apply(caller, args)
  } catch (e) {
    dispatchError(e, `${type || 'Listener'} ${method.name || '(anonymous)'}`, relatedComponent)
    return undefined
  } finally {
    if (ENV.DEV) performanceMeasureEnd()
  }
}
