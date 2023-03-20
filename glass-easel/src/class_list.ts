import * as backend from './backend/backend_protocol'
import * as composedBackend from './backend/composed_backend_protocol'
import * as domlikeBackend from './backend/domlike_backend_protocol'
import { BM, BackendMode } from './backend/mode'
import { Element, GeneralComponent, GeneralBackendElement } from '.'
import { MutationObserverTarget } from './mutation_observer'

const CLASS_NAME_REG_EXP = /(~|\^+)?-?[_0-9a-z][-_0-9a-z]*/gi

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
  private _$elem: Element
  /** @internal */
  private _$owner: ClassList | null
  /** @internal */
  private _$defaultScope: StyleScopeId
  /** @internal */
  private _$extraScope: StyleScopeId | undefined
  /** @internal */
  private _$alias: { [externalName: string]: string[] | null } | null
  /** @internal */
  private _$resolvedAlias: { [externalName: string]: AliasTarget[] | null } | null
  /** @internal */
  private _$aliasDirty = false
  /** @internal */
  private _$rawNames: string[] = []
  /** @internal */
  private _$hasResolvedNames = false
  /** @internal */
  private _$prefixManager: StyleScopeManager | undefined

  constructor(
    elem: Element,
    externalNameAlias: { [externalName: string]: string[] | null } | null,
  ) {
    this._$elem = elem
    const ownerComp = elem.ownerShadowRoot?.getHostNode()
    if (ownerComp) {
      const compOptions = ownerComp.getComponentOptions()
      this._$owner = ownerComp.classList
      this._$defaultScope = compOptions.styleScope
      this._$extraScope =
        compOptions.extraStyleScope === null ? undefined : compOptions.extraStyleScope
    } else {
      this._$owner = null
      this._$defaultScope = StyleScopeManager.globalScope()
      this._$extraScope = undefined
    }
    this._$alias = externalNameAlias
    if (externalNameAlias) {
      const resolved = Object.create(null) as { [externalName: string]: null }
      Object.keys(externalNameAlias).forEach((k) => {
        resolved[k] = null
      })
      this._$resolvedAlias = resolved
    } else {
      this._$resolvedAlias = null
    }
    if (BM.DOMLIKE || (BM.DYNAMIC && elem.getBackendMode() === BackendMode.Domlike)) {
      this._$prefixManager = elem.ownerShadowRoot
        ?.getHostNode()
        .getRootBehavior().ownerSpace.styleScopeManager
    }
  }

  /** @internal */
  private _$resolvePrefixes(
    name: string,
    cb: (scopeId: StyleScopeId | undefined, className: string) => void,
  ) {
    const resolvedAlias = this._$owner?._$resolvedAlias
    if (resolvedAlias && resolvedAlias[name] !== undefined) {
      const targets = resolvedAlias[name]
      this._$hasResolvedNames = true
      if (targets) {
        for (let i = 0; i < targets.length; i += 1) {
          const target = targets[i]!
          cb(target.scopeId, target.className)
        }
      }
    } else if (name[0] === '~') {
      cb(this._$extraScope, name.slice(1))
    } else if (name[0] === '^') {
      let n = name.slice(1)
      let owner = this._$owner
      while (owner && n[0] === '^') {
        n = n.slice(1)
        owner = owner._$owner
      }
      const scopeId = owner ? owner._$defaultScope : this._$extraScope
      cb(scopeId, n)
    } else {
      if (this._$extraScope !== undefined) {
        cb(this._$extraScope, name)
      }
      cb(this._$defaultScope, name)
    }
  }

  /** @internal */
  private _$updateResolvedAliases(name: string): boolean {
    const slices = this._$alias![name]
    const resolved: AliasTarget[] = []
    if (slices) {
      slices.forEach((name) => {
        this._$resolvePrefixes(name, (scopeId, className) => {
          resolved.push({
            scopeId,
            className,
          })
        })
      })
    }
    let changed = false
    const prevResolved = this._$resolvedAlias![name]
    if (prevResolved) {
      if (prevResolved.length !== resolved.length) {
        changed = true
      } else {
        for (let i = 0; i < prevResolved.length; i += 1) {
          const a = prevResolved[i]!
          const b = resolved[i]!
          if (a.scopeId !== b.scopeId || a.className !== b.className) {
            changed = true
            break
          }
        }
      }
    } else if (resolved.length > 0) {
      changed = true
    }
    this._$resolvedAlias![name] = resolved
    return changed
  }

  /** @internal */
  _$hasAlias(name: string): boolean {
    if (this._$alias && this._$alias[name] !== undefined) {
      return true
    }
    return false
  }

  /** @internal */
  _$setAlias(name: string, target: string) {
    if (this._$alias) {
      const slices = (String(target).match(CLASS_NAME_REG_EXP) as string[]) || null
      this._$alias[name] = slices
      const changed = this._$updateResolvedAliases(name)
      if (changed) this._$aliasDirty = true
    }
  }

  /** @internal */
  _$spreadAliasUpdate() {
    if (this._$aliasDirty) {
      this._$aliasDirty = false
      const callClassListUpdate = (elem: Element) => {
        const classList = elem.classList
        if (classList) {
          const alias = classList._$alias
          if (alias) {
            let changed = false
            Object.keys(alias).forEach((name) => {
              if (classList._$updateResolvedAliases(name)) {
                changed = true
              }
            })
            if (changed) {
              const comp = elem as GeneralComponent
              if (comp._$external === false) {
                callClassListUpdate(comp.shadowRoot as Element)
              }
            }
          }
          if (classList._$hasResolvedNames) {
            classList._$updateResolvedNames()
          }
        }
        const children = elem.childNodes
        children.forEach((child) => {
          if (child instanceof Element) callClassListUpdate(child)
        })
      }
      const comp = this._$elem as GeneralComponent
      if (comp._$external === false) {
        callClassListUpdate(comp.shadowRoot as Element)
      }
    }
  }

  /** @internal */
  private _$updateResolvedNames() {
    const backendElement = this._$elem.getBackendElement()
    if (!backendElement) return
    this._$hasResolvedNames = false
    if (BM.DOMLIKE || (BM.DYNAMIC && this._$elem.getBackendMode() === BackendMode.Domlike)) {
      ;(backendElement as domlikeBackend.Element).setAttribute('class', '')
    } else {
      ;(backendElement as backend.Element | composedBackend.Element).clearClasses()
    }
    this._$rawNames.forEach((name) => {
      this._$addClassToBackend(name, backendElement)
    })
  }

  /** @internal */
  private _$classListAdd(name: string, scope: StyleScopeId | undefined, e: GeneralBackendElement) {
    if (BM.DOMLIKE || (BM.DYNAMIC && this._$elem.getBackendMode() === BackendMode.Domlike)) {
      const prefix = scope === undefined ? '' : this._$prefixManager?.queryName(scope)
      const val = prefix ? `${prefix}--${name}` : name
      ;(e as domlikeBackend.Element).classList.add(val)
    } else {
      ;(e as backend.Element | composedBackend.Element).addClass(name, scope)
    }
  }

  /** @internal */
  private _$classListRemove(
    name: string,
    scope: StyleScopeId | undefined,
    e: GeneralBackendElement,
  ) {
    if (BM.DOMLIKE || (BM.DYNAMIC && this._$elem.getBackendMode() === BackendMode.Domlike)) {
      const prefix = scope && this._$prefixManager?.queryName(scope)
      const val = prefix ? `${prefix}--${name}` : name
      ;(e as domlikeBackend.Element).classList.remove(val)
    } else {
      ;(e as backend.Element | composedBackend.Element).removeClass(name, scope)
    }
  }

  /** @internal */
  private _$addClassToBackend(name: string, backendElement: GeneralBackendElement) {
    this._$resolvePrefixes(name, (scopeId, className) => {
      this._$classListAdd(className, scopeId, backendElement)
    })
  }

  /** @internal */
  private _$removeClassFromBackend(name: string, backendElement: GeneralBackendElement) {
    this._$resolvePrefixes(name, (scopeId, className) => {
      this._$classListRemove(className, scopeId, backendElement)
    })
  }

  toggle(name: string, force?: boolean) {
    const slices = (String(name).match(CLASS_NAME_REG_EXP) as string[]) || null
    if (slices) {
      const backendElement = this._$elem.getBackendElement()
      slices.forEach((slice) => {
        const index = this._$rawNames.indexOf(name)
        let isAdd: boolean
        if (force === undefined) {
          if (index < 0) isAdd = true
          else isAdd = false
        } else {
          isAdd = !!force
        }
        let changed = false
        if (isAdd) {
          if (index < 0) {
            this._$rawNames.push(slice)
            if (backendElement) this._$addClassToBackend(slice, backendElement)
            changed = true
          }
        } else if (index >= 0) {
          this._$rawNames.splice(index, 1)
          if (backendElement) this._$removeClassFromBackend(slice, backendElement)
          changed = true
        }
        if (changed) {
          const elem = this._$elem
          if (elem._$mutationObserverTarget) {
            MutationObserverTarget.callAttrObservers(elem, {
              type: 'properties',
              target: elem,
              attributeName: 'class',
            })
          }
        }
      })
    }
  }

  contains(name: string): boolean {
    for (let i = 0; i < this._$rawNames.length; i += 1) {
      const rn = this._$rawNames[i]!
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

  /** Set class string */
  setClassNames(names: string) {
    let n: string
    if (names === undefined || names === null) n = ''
    else n = String(names)
    this._$rawNames = n.match(CLASS_NAME_REG_EXP) || []
    this._$updateResolvedNames()
    const elem = this._$elem
    if (elem._$mutationObserverTarget) {
      MutationObserverTarget.callAttrObservers(elem, {
        type: 'properties',
        target: elem,
        attributeName: 'class',
      })
    }
  }

  /** Returns space separated class string */
  getClassNames(): string {
    return this._$rawNames ? this._$rawNames.join(' ') : ''
  }
}
