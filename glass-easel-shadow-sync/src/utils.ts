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
  const usedIds = new Set<number>()

  const gen = (): number => {
    let id
    do {
      id = Math.floor((1 + Math.random()) * 0x100000000)
    } while (usedIds.has(id))
    usedIds.add(id)
    return id
  }

  const release = (id: number) => {
    usedIds.delete(id)
  }

  return {
    gen,
    release,
  }
}

export function assertUnreachable(_x: never) {
  return new Error('unreachable')
}
