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
