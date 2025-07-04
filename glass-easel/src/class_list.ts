import {
  BM,
  BackendMode,
  type GeneralBackendElement,
  type backend,
  type composedBackend,
  type domlikeBackend,
} from './backend'
import { StyleSegmentIndex, type Element } from './element'

const CLASS_NAME_REG_EXP = /[^\s.,]+/g

const matchClassName = (str: string) => {
  const result: string[] = []
  let m: RegExpExecArray | null | undefined
  CLASS_NAME_REG_EXP.lastIndex = 0
  // eslint-disable-next-line no-cond-assign
  while ((m = CLASS_NAME_REG_EXP.exec(str)) !== null) {
    result.push(String(m[0]))
  }
  return result
}

/**
 * The style scope identifier
 *
 * It is actually a non-negative integer.
 *
 * Specifically, `0` represents *global* scope, which means it is a global style in stylesheets.
 * However, in elements, `0` means it does not match any stylesheets other than the global styles.
 */
export type StyleScopeId = number

/**
 * Style scope manager
 */
export class StyleScopeManager {
  /** @internal */
  private _$names: string[] = ['']

  static globalScope(): StyleScopeId {
    return 0
  }

  register(name: string): StyleScopeId {
    const ret = this._$names.length
    this._$names.push(name)
    return ret
  }

  queryName(id: StyleScopeId): string | undefined {
    return this._$names[id]
  }
}

export type AliasTarget = {
  scopeId: StyleScopeId | undefined
  className: string
}

/**
 * Class manager for non-virtual `Element`
 */
export class ClassList {
  /** @internal */
  private _$element: Element
  /** @internal */
  private _$owner: ClassList | null
  /** @internal */
  private _$defaultScope: StyleScopeId
  /** @internal */
  private _$extraScope: StyleScopeId | undefined
  /** @internal */
  private _$rootScope: StyleScopeId | undefined
  /** @internal */
  private _$externalNames: string[] | undefined = undefined
  /** @internal */
  private _$externalRawAlias: (string[] | undefined)[] | null = null
  /** @internal */
  private _$dirtyExternalNames: string[] | null = null
  /** @internal */
  private _$rawNames: string[][] = []
  /** @internal */
  private _$backendNames: string[] = []
  /** @internal */
  private _$backendNameScopes: (StyleScopeId | undefined)[] = []
  /** @internal */
  private _$backendNamesCount: number[] = []
  /** @internal */
  private _$hasAliasNames = false
  /** @internal */
  private _$prefixManager: StyleScopeManager | undefined

  constructor(
    element: Element,
    externalNames: string[] | undefined,
    owner: ClassList | null,
    styleScope: number,
    extraStyleScope: number | undefined,
    styleScopeManager: StyleScopeManager | undefined,
  ) {
    this._$element = element
    this._$owner = owner
    this._$defaultScope = styleScope
    this._$extraScope = extraStyleScope
    // root owner got globalScope as it's styleScope, avoid the root owner
    this._$rootScope = owner?._$owner ? owner._$rootScope : styleScope
    this._$prefixManager = styleScopeManager
    if (externalNames) {
      this._$externalNames = externalNames
      this._$externalRawAlias = []
    }
  }

  /** @internal */
  private _$resolvePrefixes(
    name: string,
    cb: (scopeId: StyleScopeId | undefined, className: string) => void,
  ) {
    const owner = this._$owner
    const externalNames = owner?._$externalNames
    const externalIndex = externalNames ? externalNames.indexOf(name) : -1
    if (owner && externalIndex !== -1) {
      this._$hasAliasNames = true
      const rawAlias = owner._$externalRawAlias![externalIndex]
      if (rawAlias) {
        for (let i = 0; i < rawAlias.length; i += 1) {
          owner._$resolvePrefixes(rawAlias[i]!, cb)
        }
      }
    } else if (name[0] === '~') {
      cb(this._$rootScope, name.slice(1))
    } else if (name[0] === '^') {
      let n = name.slice(1)
      let owner: ClassList | null | undefined = this._$owner
      while (n[0] === '^') {
        n = n.slice(1)
        owner = owner?._$owner
      }
      // root owner got globalScope as it's styleScope, avoid the root owner
      const scopeId = owner?._$owner ? owner._$defaultScope : this._$rootScope
      cb(scopeId, n)
    } else {
      if (this._$extraScope !== undefined) {
        cb(this._$extraScope, name)
      }
      cb(this._$defaultScope, name)
    }
  }

  /** @internal */
  _$hasAlias(name: string): boolean {
    return !!this._$externalNames && this._$externalNames.includes(name)
  }

  /** @internal */
  _$setAlias(name: string, target: string | string[]) {
    if (!this._$externalNames) return
    let slices: string[]
    if (target === undefined || target === null) {
      slices = []
    } else if (Array.isArray(target)) {
      slices = Array<string>(target.length)
      for (let i = 0, l = target.length; i < l; i += 1) {
        slices[i] = String(target[i])
      }
    } else {
      slices = matchClassName(String(target))
    }
    const externalIndex = this._$externalNames.indexOf(name)
    if (externalIndex === -1) return
    this._$dirtyExternalNames = this._$dirtyExternalNames || []
    this._$dirtyExternalNames.push(name)
    this._$externalRawAlias![externalIndex] = slices
  }

  /** @internal */
  _$getAlias(): { [name: string]: string[] | undefined } {
    const result = Object.create(null) as { [name: string]: string[] | undefined }
    this._$externalNames?.forEach((externalName, index) => {
      result[externalName] = this._$externalRawAlias![index]
    })
    return result
  }

  /** @internal */
  _$spreadExternalClassUpdate(): boolean {
    const owner = this._$owner
    if (!owner?._$dirtyExternalNames || !this._$hasAliasNames) return false
    const dirtyExternalNames = owner._$dirtyExternalNames
    const externalNames = this._$externalNames
    if (externalNames) {
      for (let externalIndex = 0; externalIndex < externalNames.length; externalIndex += 1) {
        const externalRawAlias = this._$externalRawAlias![externalIndex] || []
        for (let i = 0; i < dirtyExternalNames.length; i += 1) {
          if (externalRawAlias.includes(dirtyExternalNames[i]!)) {
            this._$dirtyExternalNames = this._$dirtyExternalNames || []
            this._$dirtyExternalNames.push(externalNames[externalIndex]!)
          }
        }
      }
    }
    const shouldUpdate = this._$rawNames.some((names) =>
      names.some((name) => dirtyExternalNames.includes(name)),
    )
    if (shouldUpdate) {
      this._$updateResolvedNames()
    }
    return !!this._$dirtyExternalNames || shouldUpdate
  }

  /** @internal */
  _$shouldUpdateExternalClass() {
    if (!this._$dirtyExternalNames) return false
    if (BM.SHADOW || (BM.DYNAMIC && this._$element.getBackendMode() === BackendMode.Shadow)) {
      const dirtyExternalNames = this._$dirtyExternalNames
      for (let i = 0; i < dirtyExternalNames.length; i += 1) {
        const name = dirtyExternalNames[i]!
        const externalIndex = this._$externalNames!.indexOf(name)
        const targets = this._$externalRawAlias![externalIndex] || []
        ;(this._$element._$backendElement as backend.Element).setClassAlias(name, targets)
      }
      this._$dirtyExternalNames = null
      return false
    }
    return true
  }

  /** @internal */
  _$markExternalClassUpdated() {
    this._$dirtyExternalNames = null
  }

  /** @internal */
  private _$fasterAddUpdateResolvedNames(): boolean {
    const backendElement = this._$element._$backendElement
    if (!backendElement) return false
    const rawNames = this._$rawNames

    this._$hasAliasNames = false
    for (let i = 0, l = rawNames.length; i < l; i += 1) {
      const names = rawNames[i]
      if (!names) continue
      for (let j = 0, ll = names.length; j < ll; j += 1) {
        const rawName = names[j]!
        if (BM.SHADOW || (BM.DYNAMIC && this._$element.getBackendMode() === BackendMode.Shadow)) {
          this._$addClass(rawName, undefined, backendElement)
        } else {
          this._$resolvePrefixes(rawName, (scopeId, className) => {
            this._$addClass(className, scopeId, backendElement)
          })
        }
      }
    }
    return true
  }

  /** @internal */
  private _$updateResolvedNames(): boolean {
    const backendElement = this._$element._$backendElement
    if (!backendElement) return false
    const rawNames = this._$rawNames
    const oldBackendNames = this._$backendNames
    const oldBackendNameScopes = this._$backendNameScopes
    const oldBackendNamesCount = this._$backendNamesCount

    const newBackendNames: string[] = []
    const newBackendNameScopes: (StyleScopeId | undefined)[] = []
    const newBackendNamesCount: number[] = []

    this._$hasAliasNames = false

    if (BM.SHADOW || (BM.DYNAMIC && this._$element.getBackendMode() === BackendMode.Shadow)) {
      for (let i = 0, l = rawNames.length; i < l; i += 1) {
        const names = rawNames[i]
        if (!names) continue
        for (let j = 0, ll = names.length; j < ll; j += 1) {
          const rawName = names[j]!
          let found = false
          for (let i = 0; i < newBackendNames.length; i += 1) {
            if (rawName === newBackendNames[i]) {
              newBackendNamesCount[i]! += 1
              found = true
              break
            }
          }
          if (!found) {
            newBackendNames.push(rawName)
            newBackendNameScopes.push(undefined)
            newBackendNamesCount.push(1)
          }
        }
      }
    } else {
      for (let i = 0, l = rawNames.length; i < l; i += 1) {
        const names = rawNames[i]
        if (!names) continue
        for (let j = 0, ll = names.length; j < ll; j += 1) {
          const rawName = names[j]!
          this._$resolvePrefixes(rawName, (scopeId, className) => {
            for (let i = 0; i < newBackendNames.length; i += 1) {
              if (className === newBackendNames[i] && scopeId === newBackendNameScopes[i]) {
                newBackendNamesCount[i]! += 1
                return
              }
            }
            newBackendNames.push(className)
            newBackendNameScopes.push(scopeId)
            newBackendNamesCount.push(1)
          })
        }
      }
    }

    let changed = false

    for (let i = 0; i < newBackendNames.length; i += 1) {
      let found = false
      for (let j = 0; j < oldBackendNames.length; j += 1) {
        if (
          newBackendNames[i] === oldBackendNames[j] &&
          newBackendNameScopes[i] === oldBackendNameScopes[j]
        ) {
          found = true
          oldBackendNamesCount[j] = 0 // mark as exists
          break
        }
      }
      if (!found) {
        changed = true
        this._$addClassToBackend(newBackendNames[i]!, newBackendNameScopes[i], backendElement)
      }
    }
    for (let j = 0; j < oldBackendNames.length; j += 1) {
      // 0 means old exists
      if (oldBackendNamesCount[j] !== 0) {
        changed = true
        this._$removeClassFromBackend(oldBackendNames[j]!, oldBackendNameScopes[j], backendElement)
      }
    }

    this._$backendNames = newBackendNames
    this._$backendNameScopes = newBackendNameScopes
    this._$backendNamesCount = newBackendNamesCount

    return changed
  }

  /** @internal */
  private _$addClassToBackend(
    name: string,
    scope: StyleScopeId | undefined,
    e: GeneralBackendElement,
  ) {
    if (BM.DOMLIKE || (BM.DYNAMIC && this._$element.getBackendMode() === BackendMode.Domlike)) {
      const prefix = scope === undefined ? '' : this._$prefixManager?.queryName(scope)
      const val = prefix ? `${prefix}--${name}` : name
      ;(e as domlikeBackend.Element).classList.add(val)
    } else if (
      BM.COMPOSED ||
      (BM.DYNAMIC && this._$element.getBackendMode() === BackendMode.Composed)
    ) {
      ;(e as composedBackend.Element).addClass(name, scope)
    } else {
      ;(e as backend.Element).addClass(name)
    }
  }

  /** @internal */
  private _$removeClassFromBackend(
    name: string,
    scope: StyleScopeId | undefined,
    e: GeneralBackendElement,
  ) {
    if (BM.DOMLIKE || (BM.DYNAMIC && this._$element.getBackendMode() === BackendMode.Domlike)) {
      const prefix = scope && this._$prefixManager?.queryName(scope)
      const val = prefix ? `${prefix}--${name}` : name
      ;(e as domlikeBackend.Element).classList.remove(val)
    } else if (
      BM.COMPOSED ||
      (BM.DYNAMIC && this._$element.getBackendMode() === BackendMode.Composed)
    ) {
      ;(e as composedBackend.Element).removeClass(name, scope)
    } else {
      ;(e as backend.Element).removeClass(name)
    }
  }

  /** @internal */
  private _$addClass(
    name: string,
    scopeId: StyleScopeId | undefined,
    backendElement: GeneralBackendElement,
  ) {
    const oldClassNames = this._$backendNames
    const oldScopeIds = this._$backendNameScopes
    const classNamesCount = this._$backendNamesCount
    let found = false
    for (let j = 0; j < oldClassNames.length; j += 1) {
      if (name === oldClassNames[j] && scopeId === oldScopeIds[j]) {
        found = true
        classNamesCount[j]! += 1
        break
      }
    }
    if (!found) {
      oldClassNames.push(name)
      oldScopeIds.push(scopeId)
      classNamesCount.push(1)
      this._$addClassToBackend(name, scopeId, backendElement)
    }
  }

  /** @internal */
  private _$removeClass(
    name: string,
    scopeId: StyleScopeId | undefined,
    backendElement: GeneralBackendElement,
  ) {
    const oldClassNames = this._$backendNames
    const oldScopeIds = this._$backendNameScopes
    const classNamesCount = this._$backendNamesCount
    let index: number
    for (index = 0; index < oldClassNames.length; index += 1) {
      if (name === oldClassNames[index] && scopeId === oldScopeIds[index]) {
        if (classNamesCount[index]! <= 1) {
          oldClassNames.splice(index, 1)
          oldScopeIds.splice(index, 1)
          classNamesCount.splice(index, 1)
          this._$removeClassFromBackend(name, scopeId, backendElement)
        } else {
          classNamesCount[index]! -= 1
        }
        break
      }
    }
  }

  toggle(
    name: string,
    force?: boolean,
    segmentIndex: StyleSegmentIndex = StyleSegmentIndex.MAIN,
  ): boolean {
    const backendElement = this._$element._$backendElement
    const rawClassIndex = this._$rawNames[segmentIndex]
      ? this._$rawNames[segmentIndex]!.indexOf(name)
      : -1
    const isAdd = force === undefined ? rawClassIndex === -1 : !!force

    let changed = false
    if (isAdd) {
      if (rawClassIndex === -1) {
        const rawNames = this._$rawNames
        if (!rawNames[segmentIndex]) {
          rawNames[segmentIndex] = []
        }
        const names = rawNames[segmentIndex]!
        names.push(name)
        if (backendElement) {
          if (BM.SHADOW || (BM.DYNAMIC && this._$element.getBackendMode() === BackendMode.Shadow)) {
            this._$addClass(name, undefined, backendElement)
          } else {
            this._$resolvePrefixes(name, (scopeId, className) => {
              this._$addClass(className, scopeId, backendElement)
            })
          }
        }
        changed = true
      }
    } else if (rawClassIndex !== -1) {
      const names = this._$rawNames[segmentIndex]
      if (names) names.splice(rawClassIndex, 1)
      if (backendElement) {
        if (BM.SHADOW || (BM.DYNAMIC && this._$element.getBackendMode() === BackendMode.Shadow)) {
          this._$removeClass(name, undefined, backendElement)
        } else {
          this._$resolvePrefixes(name, (scopeId, className) => {
            this._$removeClass(className, scopeId, backendElement)
          })
        }
      }
      changed = true
    }
    return changed
  }

  contains(name: string, segmentIndex: StyleSegmentIndex = StyleSegmentIndex.MAIN): boolean {
    const names = this._$rawNames[segmentIndex] || []
    for (let i = 0; i < names.length; i += 1) {
      const rn = names[i]!
      if (rn[0] === '~') {
        const n = rn.slice(1)
        if (n === name) return true
      } else if (rn[0] === '^') {
        let n = rn.slice(1)
        while (n[0] === '^') {
          n = n.slice(1)
        }
        if (n === name) return true
      } else {
        if (rn === name) return true
      }
    }
    return false
  }

  /**
   * Set class string
   *
   * Returns `false` if the not success.
   * Although this method accepts `string[]`, it contains a deprecated behavior (use `setClassNameList` in this case).
   * */
  setClassNames(names: string, segmentIndex?: StyleSegmentIndex): boolean
  /** @deprecated */
  setClassNames(names: string[], segmentIndex?: StyleSegmentIndex): boolean
  setClassNames(
    names: string | string[],
    segmentIndex: StyleSegmentIndex = StyleSegmentIndex.MAIN,
  ): boolean {
    let n: string[]
    if (names === undefined || names === null) {
      n = []
    } else if (Array.isArray(names)) {
      n = matchClassName(names.join(' '))
    } else {
      n = matchClassName(String(names))
    }
    const useFasterAdd = this._$rawNames.length === 0
    this._$rawNames[segmentIndex] = n

    if (useFasterAdd) return this._$fasterAddUpdateResolvedNames()

    return this._$updateResolvedNames()
  }

  /** Set class list */
  setClassNameList(
    names: string[],
    segmentIndex: StyleSegmentIndex = StyleSegmentIndex.MAIN,
  ): boolean {
    const useFasterAdd = this._$rawNames.length === 0
    this._$rawNames[segmentIndex] = names.filter((name) => name !== '')
    if (useFasterAdd) return this._$fasterAddUpdateResolvedNames()
    return this._$updateResolvedNames()
  }

  /** Returns space separated class string */
  getClassNames(segmentIndex: StyleSegmentIndex = StyleSegmentIndex.MAIN): string {
    const names = this._$rawNames[segmentIndex] || []
    return names ? names.join(' ') : ''
  }
}
