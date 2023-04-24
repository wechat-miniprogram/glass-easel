import { safeCallback, triggerWarning } from './func_arr'
import { convertValueToType, PropertyDefinition } from './behavior'
import { deepCopy, simpleDeepCopy } from './data_utils'
import { DataPath, MultiPaths } from './data_path'
import { DeepCopyKind } from './global_options'
import { MutationObserverTarget } from './mutation_observer'
import {
  GeneralComponentInstance,
  DataList,
  PropertyList,
  MethodList,
  ComponentInstance,
  DataWithPropertyValues,
} from './component_params'

// eslint-disable-next-line @typescript-eslint/unbound-method
const hasOwnProperty = Object.prototype.hasOwnProperty

export const enum DeepCopyStrategy {
  None,
  Simple,
  SimpleWithRecursion,
}

export type DataValue = unknown

export type DataObserver = (...values: unknown[]) => void

export type DataChange = DataReplace | DataSplice
// for replace
export type DataReplace = [DataPath, DataValue, undefined, undefined]
// for splice, numbers are index, removal count
export type DataSplice = [DataPath, DataValue[], number, number]

export type PropertyChange = {
  propName: string
  prop: PropertyDefinition
  oldValue: unknown
  newValue: unknown
  skipModelListener: boolean
}

export type DataUpdateCallback = (
  data: { [name: string]: DataValue },
  combinedChanges: DataChange[],
) => void

export type ModelBindingListener = (value: DataValue) => void

type ObserverNode = {
  listener?: number[]
  wildcard?: number[]
  sub: { [name: string]: ObserverNode }
}

export class DataGroupObserverTree {
  propFields: { [name: string]: PropertyDefinition }
  observerTree: ObserverNode = { sub: {} }
  observers: DataObserverWithPath[] = []

  constructor(propFields: { [name: string]: PropertyDefinition }) {
    this.propFields = propFields
  }

  cloneSub(): DataGroupObserverTree {
    const ret = new DataGroupObserverTree(this.propFields)
    if (this.observers.length > 0) {
      ret.observerTree = simpleDeepCopy(this.observerTree)
      ret.observers = this.observers.slice()
    }
    return ret
  }

  addObserver(func: DataObserver, dataPath: MultiPaths) {
    const id = this.observers.length
    this.observers.push({
      path: dataPath,
      f: func,
    })
    for (let i = 0; i < dataPath.length; i += 1) {
      const singlePath = dataPath[i]!
      let cur = this.observerTree
      let wildcard = false
      for (let j = 0; j < singlePath.length; j += 1) {
        const pathSlice = singlePath[j]!
        if (pathSlice === '**') {
          wildcard = true
          break
        }
        if (!cur.sub[pathSlice]) cur.sub[pathSlice] = { sub: {} }
        cur = cur.sub[pathSlice]!
      }
      if (wildcard) {
        if (!cur.wildcard) cur.wildcard = [id]
        else cur.wildcard.push(id)
      } else {
        if (!cur.listener) cur.listener = [id]
        else cur.listener.push(id)
      }
    }
  }
}

const callObserver = <
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
>(
  comp: ComponentInstance<TData, TProperty, TMethod>,
  data: { [key: string]: DataValue },
  path: MultiPaths,
  f: DataObserver,
) => {
  const args: unknown[] = new Array(path.length)
  for (let i = 0; i < path.length; i += 1) {
    const singlePath = path[i]!
    let cur: DataValue = data
    for (let j = 0; j < singlePath.length; j += 1) {
      const slice = singlePath[j]!
      if (slice === '**') break
      if (typeof cur === 'object' && cur !== null) {
        cur = (cur as { [name: string]: DataValue })[slice]
      } else {
        cur = undefined
        break
      }
    }
    args[i] = cur
  }
  safeCallback(
    'Data Observer',
    f,
    comp.getMethodCaller() as any,
    args,
    (comp as unknown as GeneralComponentInstance) || undefined,
  )
}

const dfsMarkTriggerBitOnPath = (node: ObserverNode, observerStatus: boolean[]) => {
  if (node.listener) {
    for (let i = 0; i < node.listener.length; i += 1) {
      const observerId = node.listener[i]!
      observerStatus[observerId] = true
    }
  }
  if (node.wildcard) {
    for (let i = 0; i < node.wildcard.length; i += 1) {
      const observerId = node.wildcard[i]!
      observerStatus[observerId] = true
    }
  }
  const keys = Object.keys(node.sub)
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i]!
    dfsMarkTriggerBitOnPath(node.sub[k]!, observerStatus)
  }
}

const markTriggerBitOnPath = (
  root: ObserverNode,
  observerStatus: boolean[],
  singlePath: DataPath,
) => {
  let cur: ObserverNode = root
  let found = true
  for (let i = 0; i < singlePath.length; i += 1) {
    const slice = singlePath[i]!
    if (cur.wildcard) {
      const arr = cur.wildcard
      for (let i = 0; i < arr.length; i += 1) {
        const observerId = arr[i]!
        observerStatus[observerId] = true
      }
    }
    if (!hasOwnProperty.call(cur.sub, slice)) {
      found = false
      break
    }
    cur = cur.sub[slice]!
  }
  if (found) dfsMarkTriggerBitOnPath(cur, observerStatus)
}

type DataObserverWithPath = { path: MultiPaths; f: DataObserver }

const triggerAndCleanTriggerBit = <
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
>(
  observers: DataObserverWithPath[],
  observerStatus: boolean[],
  comp: ComponentInstance<TData, TProperty, TMethod> | null,
  data: { [key: string]: DataValue },
) => {
  for (let i = 0; i < observers.length; i += 1) {
    const { path, f } = observers[i]!
    const status = observerStatus[i]
    if (status) {
      observerStatus[i] = false
      if (comp) callObserver(comp, data, path, f)
    }
  }
}

export const getDeepCopyStrategy = (level: DeepCopyKind) => {
  if (level === DeepCopyKind.Simple) return DeepCopyStrategy.Simple
  if (level === DeepCopyKind.SimpleWithRecursion) return DeepCopyStrategy.SimpleWithRecursion
  return DeepCopyStrategy.None
}

/** A data wrapper for data operations such as `setData` */
export class DataGroup<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
> {
  data: DataWithPropertyValues<TData, TProperty>
  innerData: { [key: string]: DataValue } | null
  private _$comp: ComponentInstance<TData, TProperty, TMethod> | null
  private _$pureDataPattern: RegExp | null
  private _$dataDeepCopy: DeepCopyStrategy
  private _$propertyPassingDeepCopy: DeepCopyStrategy
  private _$reflectToAttributes: boolean
  private _$propFields: { [name: string]: PropertyDefinition }
  private _$observerTree: ObserverNode
  private _$observers: DataObserverWithPath[]
  private _$observerStatus: boolean[]
  private _$modelBindingListener: { [name: string]: ModelBindingListener } | null = null
  private _$updateListener?: DataUpdateCallback
  private _$pendingChanges: DataChange[] = []
  private _$doingUpdates: {
    prop: PropertyChange[]
    combined: DataChange[]
    count: number
  } | null = null

  private _$generateInnerData(data: { [key: string]: DataValue }) {
    const pureDataPattern = this._$pureDataPattern
    const dataDeepCopy = this._$dataDeepCopy
    if (pureDataPattern || dataDeepCopy !== DeepCopyStrategy.None) {
      const innerData = {} as { [key: string]: DataValue }
      const keys = Object.keys(data)
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i]!
        const v = data[k]!
        if (pureDataPattern && pureDataPattern.test(k)) continue
        if (dataDeepCopy === DeepCopyStrategy.None) {
          innerData[k] = v
        } else if (dataDeepCopy === DeepCopyStrategy.SimpleWithRecursion) {
          innerData[k] = deepCopy(v, true)
        } else {
          innerData[k] = simpleDeepCopy(v)
        }
      }
      return innerData
    }
    return null
  }

  constructor(
    associatedComponent: ComponentInstance<TData, TProperty, TMethod> | null,
    data: DataWithPropertyValues<TData, TProperty>,
    pureDataPattern: RegExp | null,
    dataDeepCopy: DeepCopyStrategy,
    propertyPassingDeepCopy: DeepCopyStrategy,
    reflectToAttributes: boolean,
    observerTree: DataGroupObserverTree,
  ) {
    this._$comp = associatedComponent
    this.data = data
    this._$pureDataPattern = pureDataPattern
    this._$dataDeepCopy = dataDeepCopy
    this._$propertyPassingDeepCopy = propertyPassingDeepCopy
    this._$reflectToAttributes = reflectToAttributes && !!associatedComponent
    this._$propFields = observerTree.propFields
    this._$observerTree = observerTree.observerTree
    this._$observers = observerTree.observers
    this._$observerStatus = new Array(observerTree.observers.length) as boolean[]
    this.innerData = this._$generateInnerData(data)
  }

  /** Create a simple data group */
  static create(data: { [key: string]: DataValue }) {
    return new DataGroup(
      null,
      data as any,
      null,
      DeepCopyStrategy.None,
      DeepCopyStrategy.None,
      false,
      new DataGroupObserverTree({}),
    )
  }

  /** Set a callback for every grouped update */
  setUpdateListener(updateListener: DataUpdateCallback) {
    this._$updateListener = updateListener
  }

  /** Replace the underlying data */
  replaceWholeData(data: DataWithPropertyValues<TData, TProperty>) {
    this.data = data
    this.innerData = this._$generateInnerData(data)
  }

  /** Add a new common data change to queue */
  replaceDataOnPath(path: DataPath, newData: DataValue) {
    this._$pendingChanges.push([path, newData, undefined, undefined])
  }

  /** Add a new array splice operation to queue */
  spliceArrayDataOnPath(
    path: DataPath,
    index: number | undefined,
    del: number | undefined,
    inserts: DataValue[],
  ) {
    if (!Array.isArray(inserts)) {
      triggerWarning(
        `The splice insertion must be a string (on path "${path.join(
          '.',
        )}"). The change is ignored.`,
      )
      return
    }
    this._$pendingChanges.push([path, inserts, index ?? -1, del || 0])
  }

  /**
   * Add a new property change to queue
   *
   * (Generally designed for template engines.)
   * If the `propName` is a property,
   * the `newData` will be deep-copied according to the `propertyPassingDeepCopy` configuration.
   * Otherwise, it returns false.
   */
  replaceProperty(propName: string, newData: DataValue): boolean {
    let data = newData
    const prop = this._$propFields[propName]
    if (!prop) return false
    if (this._$propertyPassingDeepCopy !== DeepCopyStrategy.None) {
      if (this._$propertyPassingDeepCopy === DeepCopyStrategy.SimpleWithRecursion) {
        data = deepCopy(newData, true)
      } else {
        data = simpleDeepCopy(newData)
      }
    }
    if (prop.comparison && !prop.comparison(data, this.data[propName])) return false
    this._$pendingChanges.push([[propName], data, undefined, undefined])
    return true
  }

  /** Discard changes in queue and generate a new queue with specified changes */
  setChanges(changes: DataChange[]) {
    this._$pendingChanges = changes
  }

  /** Get the data change queue */
  getChanges(): DataChange[] {
    return this._$pendingChanges
  }

  /**
   * Set a callback when a specified property changes
   *
   * (Generally designed for template engines.)
   */
  setModelBindingListener(propName: string, listener: ModelBindingListener) {
    if (this._$modelBindingListener) {
      this._$modelBindingListener[propName] = listener
    } else {
      const map = (this._$modelBindingListener = Object.create(null) as {
        [name: string]: ModelBindingListener
      })
      map[propName] = listener
    }
  }

  /** Apply all changes in queue */
  applyDataUpdates(skipModelListener = false) {
    const propFields = this._$propFields
    const comp = this._$comp
    const pureDataPattern = this._$pureDataPattern
    const dataDeepCopy = this._$dataDeepCopy

    // handling chained updates if observers are used
    const isChainedUpdates = !!this._$doingUpdates
    let combinedChanges: DataChange[]
    let propChanges: PropertyChange[]
    if (this._$observers.length > 0) {
      if (this._$doingUpdates) {
        combinedChanges = this._$doingUpdates.combined
        propChanges = this._$doingUpdates.prop
      } else {
        this._$doingUpdates = {
          prop: [] as PropertyChange[],
          combined: [] as DataChange[],
          count: 0,
        }
        combinedChanges = this._$doingUpdates.combined
        propChanges = this._$doingUpdates.prop
      }
    } else {
      combinedChanges = []
      propChanges = []
    }

    // find all changes
    const changes = this._$pendingChanges
    this._$pendingChanges = []

    // apply changes and collect changing information
    for (let i = 0; i < changes.length; i += 1) {
      const change = changes[i]!
      const [path, newData, spliceIndex, spliceDel] = change
      const isSplice = spliceDel !== undefined
      const propName = String(path[0])
      const excluded = pureDataPattern ? pureDataPattern.test(propName) : false
      const prop: PropertyDefinition | undefined = propFields[propName]
      if (prop && path.length === 1) {
        // do update for 1-level fields
        const oldData: unknown = this.data[propName]
        let normalizedSpliceIndex: number | undefined
        let filteredData: DataValue
        if (isSplice) {
          if (Array.isArray(oldData)) {
            const c = change as DataSplice
            normalizedSpliceIndex =
              spliceIndex! >= 0 && spliceIndex! < oldData.length ? spliceIndex! : oldData.length
            c[2] = normalizedSpliceIndex
            oldData.splice(normalizedSpliceIndex, spliceDel, ...(newData as typeof oldData))
          } else {
            triggerWarning(
              `An array splice change cannot be applied to a non-array value (on path "${path.join(
                '.',
              )}"). The change is ignored.`,
            )
          }
          filteredData = oldData
        } else {
          filteredData = convertValueToType(newData, propName, prop)
        }
        if (!excluded) {
          if (this.innerData) {
            let innerNewData: unknown
            if (dataDeepCopy === DeepCopyStrategy.None) {
              change[1] = innerNewData = filteredData
            } else if (normalizedSpliceIndex !== undefined) {
              innerNewData = this.innerData[propName] as DataValue[]
              let inserts: DataValue[]
              if (dataDeepCopy === DeepCopyStrategy.SimpleWithRecursion) {
                change[1] = inserts = deepCopy(newData as unknown[], true)
              } else {
                change[1] = inserts = simpleDeepCopy(newData as unknown[])
              }
              ;(innerNewData as DataValue[]).splice(normalizedSpliceIndex, spliceDel!, ...inserts)
            } else if (dataDeepCopy === DeepCopyStrategy.SimpleWithRecursion) {
              change[1] = innerNewData = deepCopy(filteredData, true)
            } else {
              change[1] = innerNewData = simpleDeepCopy(filteredData)
            }
            this.innerData[propName] = innerNewData
          }
        }
        ;(this.data as DataList)[propName] = filteredData
        if (this._$reflectToAttributes) {
          const be = comp!.getBackendElement()
          if (be) {
            let attrValue = filteredData
            if (prop.reflectIdPrefix) {
              const owner = comp!.ownerShadowRoot
              if (owner) {
                const idPrefix = owner.getHostNode()._$idPrefix
                if (idPrefix) {
                  attrValue = `${idPrefix}--${filteredData as string}`
                }
              }
            }
            const attrName = propName.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
            const type = typeof attrValue
            if (type === 'boolean') {
              if (filteredData) be.setAttribute(attrName, '')
              else be.removeAttribute(attrName)
            } else if (type === 'object') {
              be.setAttribute(attrName, JSON.stringify(attrValue))
            } else {
              be.setAttribute(attrName, attrValue)
            }
          }
        }
        if (!excluded && oldData !== filteredData) {
          propChanges.push({
            propName,
            prop,
            oldValue: oldData,
            newValue: filteredData,
            skipModelListener,
          })
        }
      } else {
        // do update for multi-level fields
        let curData: { [key: string]: unknown } | unknown[] = this.data
        let curSlice: string | number = propName
        for (let i = 1; i < path.length; i += 1) {
          const nextSlice = path[i]!
          if (Number.isFinite(nextSlice)) {
            if (
              !hasOwnProperty.call(curData, curSlice) ||
              !Array.isArray((curData as { [key: string]: unknown })[curSlice as string])
            ) {
              ;(curData as { [key: string]: unknown })[curSlice as string] = []
            }
          } else {
            if (
              !hasOwnProperty.call(curData, curSlice) ||
              (curData as { [key: string]: unknown })[curSlice as string] === null ||
              typeof (curData as { [key: string]: unknown })[curSlice as string] !== 'object' ||
              Array.isArray((curData as { [key: string]: unknown })[curSlice as string])
            ) {
              ;(curData as { [key: string]: unknown })[curSlice as string] = {}
            }
          }
          curData = (curData as { [key: string]: unknown })[curSlice as string] as
            | { [key: string]: unknown }
            | unknown[]
          curSlice = nextSlice
        }
        let normalizedSpliceIndex: number | undefined
        if (isSplice) {
          const oldData = (curData as DataList)[curSlice as string]
          if (Array.isArray(oldData)) {
            const c = change as DataSplice
            normalizedSpliceIndex =
              spliceIndex! >= 0 && spliceIndex! < oldData.length ? spliceIndex! : oldData.length
            c[2] = normalizedSpliceIndex
            oldData.splice(normalizedSpliceIndex, spliceDel, ...(newData as typeof oldData))
          } else {
            triggerWarning(
              `An array splice change cannot be applied to a non-array value (on path "${path.join(
                '.',
              )}"). The change is ignored.`,
            )
          }
        } else {
          ;(curData as DataList)[curSlice as string] = newData
        }
        if (!excluded && this.innerData) {
          curData = this.innerData
          curSlice = propName
          for (let i = 1; i < path.length; i += 1) {
            const nextSlice = path[i]!
            if (Number.isFinite(nextSlice)) {
              if (
                !hasOwnProperty.call(curData, curSlice) ||
                !Array.isArray((curData as { [key: string]: unknown })[curSlice as string])
              ) {
                ;(curData as { [key: string]: unknown })[curSlice as string] = []
              }
            } else {
              if (
                !hasOwnProperty.call(curData, curSlice) ||
                (curData as { [key: string]: unknown })[curSlice as string] === null ||
                typeof (curData as { [key: string]: unknown })[curSlice as string] !== 'object' ||
                Array.isArray((curData as { [key: string]: unknown })[curSlice as string])
              ) {
                ;(curData as { [key: string]: unknown })[curSlice as string] = {}
              }
            }
            curData = (curData as { [key: string]: unknown })[curSlice as string] as
              | { [key: string]: unknown }
              | unknown[]
            curSlice = nextSlice
          }
          let innerNewData: unknown
          if (dataDeepCopy === DeepCopyStrategy.None) {
            change[1] = innerNewData = newData
          } else if (normalizedSpliceIndex !== undefined) {
            innerNewData = (curData as { [key: string]: unknown })[
              curSlice as string
            ] as DataValue[]
            let inserts: DataValue[]
            if (dataDeepCopy === DeepCopyStrategy.SimpleWithRecursion) {
              change[1] = inserts = deepCopy(newData as unknown[], true)
            } else {
              change[1] = inserts = simpleDeepCopy(newData as unknown[])
            }
            ;(innerNewData as DataValue[]).splice(normalizedSpliceIndex, spliceDel!, ...inserts)
          } else if (dataDeepCopy === DeepCopyStrategy.SimpleWithRecursion) {
            change[1] = innerNewData = deepCopy(newData, true)
          } else {
            change[1] = innerNewData = simpleDeepCopy(newData)
          }
          ;(curData as { [key: string]: unknown })[curSlice as string] = innerNewData
        }
        if (!excluded && prop) {
          // NOTE for prop observers, oldVal will be undefined when doing a sub-path update
          propChanges.push({
            propName,
            prop,
            oldValue: undefined,
            newValue: newData,
            skipModelListener: skipModelListener || false,
          })
        }
      }
      markTriggerBitOnPath(this._$observerTree, this._$observerStatus, path)
      if (!excluded) {
        combinedChanges.push(change)
      }
      if (this._$doingUpdates) {
        this._$doingUpdates.count += 1
      }
    }

    // trigger data observers
    if (isChainedUpdates) return
    if (this._$doingUpdates) {
      let changesCount: number
      do {
        changesCount = this._$doingUpdates.count
        triggerAndCleanTriggerBit(this._$observers, this._$observerStatus, comp, this.data)
      } while (changesCount !== this._$doingUpdates.count)
      this._$doingUpdates = null
    }

    // tell template engine what changed
    this._$updateListener?.(this.innerData || this.data, combinedChanges)

    // trigger prop observers (to simulating legacy behaviors)
    if (comp) {
      for (let i = 0; i < propChanges.length; i += 1) {
        const { propName, prop, oldValue, newValue, skipModelListener } = propChanges[i]!
        if (!skipModelListener && this._$modelBindingListener) {
          const listener = this._$modelBindingListener[propName]
          if (listener) listener(newValue)
        }
        if (prop.observer) {
          safeCallback(
            'Property Observer',
            prop.observer,
            comp.getMethodCaller() as any,
            [newValue, oldValue],
            comp as unknown as GeneralComponentInstance,
          )
        }
        if (comp._$mutationObserverTarget) {
          MutationObserverTarget.callAttrObservers(comp, {
            type: 'properties',
            target: comp,
            propertyName: propName,
          })
        }
      }
    }
  }
}

export type GeneralDataGroup = DataGroup<DataList, PropertyList, MethodList>
