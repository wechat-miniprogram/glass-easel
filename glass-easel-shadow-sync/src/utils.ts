import type { Component, DataChange, Element, DataValue } from 'glass-easel'

export interface IDGenerator {
  gen(): number
  release(id: number): void
}

export const getLinearIdGenerator = (): IDGenerator => {
  let nextId = 1
  const releasedIds: number[] = []

  const gen = (): number => {
    if (releasedIds.length) {
      return releasedIds.pop()!
    }
    const id = nextId
    nextId += 1
    return id
  }

  const release = (id: number) => {
    releasedIds.push(id)
  }

  return {
    gen,
    release,
  }
}

export const getRandomIdGenerator = (): IDGenerator => {
  let nextId = 1
  const releasedIds: number[] = []

  const gen = (): number => {
    const randomId = Math.floor(Math.random() * 16)
    if (randomId < releasedIds.length) {
      const targetId = releasedIds[randomId]!
      releasedIds.splice(randomId, 1)
      return targetId
    }
    const targetId = nextId + randomId - releasedIds.length
    while (nextId < targetId) {
      releasedIds.push(nextId)
      nextId += 1
    }
    nextId += 1
    return targetId
  }

  const release = (id: number) => {
    releasedIds.push(id)
  }

  return {
    gen,
    release,
  }
}

export function assertUnreachable(_x: never) {
  return new Error('unreachable')
}

export const dashToCamelCase = (dash: string): string =>
  dash.indexOf('-') <= 0 ? dash : dash.replace(/-(.|$)/g, (s) => (s[1] ? s[1].toUpperCase() : ''))

export const camelCaseToDash = (camel: string): string =>
  camel.replace(/(^|.)([A-Z])/g, (s) => (s[0] ? `${s[0]}-` : '') + s[1]!.toLowerCase())

export function initValues(element: Element, values: DataValue): void {
  const comp = element.asGeneralComponent() as Component<any, any, any>
  if (!comp) return

  const val: Record<string, any> = values || {}
  const data: Record<string, unknown> = {}
  const keys = Object.keys(val)
  let externalClassDirty = false
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i]!
    const dashName = camelCaseToDash(key)
    if (comp.hasExternalClass(dashName)) {
      comp.scheduleExternalClassChange(dashName, val[key] as string)
      externalClassDirty = true
    } else {
      data[key] = val[key]
    }
  }
  comp.setData(values as any)
  if (externalClassDirty) comp.applyExternalClassChanges()
}

export function updateValues(element: Element, changes: DataChange[]): void {
  const comp = element.asGeneralComponent() as Component<any, any, any>
  if (!comp) return

  let dataDirty = false
  let externalClassDirty = false

  for (let i = 0; i < changes.length; i += 1) {
    const [path, newData, spliceIndex, spliceDel] = changes[i]!
    let dashName
    if (
      path.length === 1 &&
      typeof path[0] === 'string' &&
      // eslint-disable-next-line no-cond-assign
      ((dashName = camelCaseToDash(path[0])), comp.hasExternalClass(dashName))
    ) {
      comp.scheduleExternalClassChange(dashName, newData as string)
      externalClassDirty = true
    } else if (spliceDel !== undefined && spliceDel !== null) {
      comp.spliceArrayDataOnPath(path, spliceIndex, spliceDel, newData)
      dataDirty = true
    } else {
      comp.replaceDataOnPath(path, newData)
      dataDirty = true
    }
  }
  if (dataDirty) comp.applyDataUpdates()
  if (externalClassDirty) comp.applyExternalClassChanges()
}
