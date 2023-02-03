const deepCopyWithRecursion = <T>(src: T, visited: WeakMap<any, unknown>): T => {
  if (typeof src === 'object' && src !== null) {
    const v = visited.get(src)
    if (v !== undefined) return v as T
    if (Array.isArray(src)) {
      const dest: unknown[] = []
      visited.set(src, dest)
      for (let i = 0; i < src.length; i += 1) {
        dest[i] = deepCopyWithRecursion(src[i], visited)
      }
      return dest as unknown as T
    }
    const dest: { [key: string]: unknown } = {}
    visited.set(src, dest)
    const keys = Object.keys(src)
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i]!
      dest[k] = deepCopyWithRecursion((src as { [key: string]: unknown })[k], visited)
    }
    return dest as T
  }
  if (typeof src === 'symbol') return Symbol(src.description) as unknown as T
  return src
}

export const simpleDeepCopy = <T>(src: T): T => {
  if (typeof src === 'object' && src !== null) {
    if (Array.isArray(src)) {
      const dest: unknown[] = []
      for (let i = 0; i < src.length; i += 1) {
        dest[i] = simpleDeepCopy(src[i])
      }
      return dest as unknown as T
    }
    const dest: { [key: string]: unknown } = {}
    const keys = Object.keys(src)
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i]!
      dest[k] = simpleDeepCopy((src as { [key: string]: unknown })[k])
    }
    return dest as T
  }
  if (typeof src === 'symbol') return Symbol((src as unknown as symbol).description) as unknown as T
  return src
}

export const deepCopy = <T>(src: T, withRecursion: boolean): T => {
  if (withRecursion) return deepCopyWithRecursion(src, new WeakMap())
  return simpleDeepCopy(src)
}
