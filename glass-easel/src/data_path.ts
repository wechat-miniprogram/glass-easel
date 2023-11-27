export type DataPath = Array<string | number>

export type MultiPaths = DataPath[]

type ParseState = {
  str: string
  cur: number
}

const skipWhiteSpace = (state: ParseState): boolean => {
  const str = state.str
  while (state.cur < str.length) {
    const next = str[state.cur]
    if (next === ' ' || next === '\n' || next === '\r' || next === '\t' || next === '\f') {
      state.cur += 1
    } else {
      break
    }
  }
  return state.cur < str.length
}

const parseInteger = (state: ParseState): number => {
  const str = state.str
  let ret = ''
  while (state.cur < str.length) {
    const next = str[state.cur]!
    if (next >= '0' && next <= '9') {
      ret += next
    } else {
      break
    }
    state.cur += 1
  }
  if (!ret) {
    throw new Error(`data path descriptor "${str}" is illegal at char ${state.cur} (illegal index)`)
  }
  return parseInt(ret, 10)
}

const parseFieldName = (state: ParseState): string => {
  const str = state.str
  let ret = ''
  while (state.cur < str.length) {
    const next = str[state.cur]!
    if (next === '\\') {
      // in this mode, `\\` always translate the next char to field name
      if (state.cur + 1 === str.length) {
        // empty
      } else {
        const next2 = str[state.cur + 1]
        ret += next2
        state.cur += 1
      }
    } else if (/^[_a-zA-Z]$/.test(next)) {
      ret += next
    } else if (next >= '0' && next <= '9') {
      if (ret === '') {
        throw new Error(
          `data path descriptor "${str}" is illegal at char ${state.cur} (field name cannot start with digits)`,
        )
      }
      ret += next
    } else {
      break
    }
    state.cur += 1
  }
  return ret
}

const parseFieldNameWithSpecialChars = (state: ParseState): string => {
  const str = state.str
  let ret = ''
  while (state.cur < str.length) {
    const next = str[state.cur]
    if (next === '\\') {
      // in this mode, `\\` only escape recognized special chars. It is `\\` itself otherwise
      if (state.cur + 1 === str.length) {
        ret += '\\'
        state.cur += 1
      } else {
        const next2 = str[state.cur + 1]
        if (next2 === '.' || next2 === '[' || next2 === ']' || next2 === '\\') {
          ret += next2
          state.cur += 2
        } else {
          ret += '\\'
          state.cur += 1
        }
      }
    } else if (next === '.' || next === '[') {
      break
    } else {
      ret += next
      state.cur += 1
    }
  }
  return ret
}

const parsePath = (state: ParseState): DataPath => {
  const str = state.str
  skipWhiteSpace(state)
  if (str[state.cur] === '*' && str[state.cur + 1] === '*') {
    state.cur += 2
    return ['**']
  }
  const seg = parseFieldName(state)
  if (!seg) {
    throw new Error(
      `data path descriptor "${str}" is illegal at char ${state.cur} (first field name illegal)`,
    )
  }
  const ret: DataPath = [seg]
  while (state.cur < str.length) {
    if (!skipWhiteSpace(state)) break
    const next = str[state.cur]
    if (next === '.') {
      state.cur += 1
      skipWhiteSpace(state)
      if (str[state.cur] === '*' && str[state.cur + 1] === '*') {
        ret.push('**')
        state.cur += 2
        break
      }
      const seg = parseFieldName(state)
      if (!seg) {
        throw new Error(
          `data path descriptor "${str}" is illegal at char ${state.cur} (field name illegal)`,
        )
      }
      ret.push(seg)
    } else if (next === '[') {
      state.cur += 1
      skipWhiteSpace(state)
      const index = parseInteger(state)
      skipWhiteSpace(state)
      const next2 = str[state.cur]
      if (next2 !== ']') {
        throw new Error(
          `data path descriptor "${str}" is illegal at char ${state.cur} (illegal index)`,
        )
      }
      state.cur += 1
      ret.push(index)
    } else {
      break
    }
  }
  return ret
}

const parsePathWithSpecialChars = (state: ParseState): DataPath => {
  const str = state.str
  const ret: DataPath = []
  while (state.cur < str.length) {
    const next = str[state.cur]
    if (next === '.') {
      state.cur += 1
      const seg = parseFieldNameWithSpecialChars(state)
      if (seg !== '') ret.push(seg)
    } else if (next === '[') {
      state.cur += 1
      const index = parseInteger(state)
      const next2 = str[state.cur]
      if (next2 !== ']' && state.cur < str.length) {
        throw new Error(
          `data path descriptor "${str}" is illegal at char ${state.cur} (illegal index)`,
        )
      }
      state.cur += 1
      ret.push(index)
    } else {
      const seg = parseFieldNameWithSpecialChars(state)
      ret.push(seg)
    }
  }
  if (ret.length === 0) ret.push('')
  return ret
}

const parseCommaSepPaths = (state: ParseState): MultiPaths => {
  const ret: DataPath[] = []
  ret.push(parsePath(state))
  skipWhiteSpace(state)
  while (state.str[state.cur] === ',') {
    state.cur += 1
    ret.push(parsePath(state))
    skipWhiteSpace(state)
  }
  return ret
}

export const parseSinglePath = (str: string): DataPath => {
  const parseState: ParseState = {
    str,
    cur: 0,
  }
  const ret = parsePathWithSpecialChars(parseState)
  // NOTE currently the end check is not required here, because prev calls always eats all chars
  // if (parseState.cur !== str.length) {
  //   throw new Error(`data path descriptor "${str}" is illegal at char ${parseState.cur}`)
  // }
  return ret
}

export const parseMultiPaths = (str: string | readonly string[]): MultiPaths => {
  if (typeof str !== 'string') {
    return str.map((str) => parsePath({ str, cur: 0 }))
  }
  const parseState: ParseState = {
    str,
    cur: 0,
  }
  const ret = parseCommaSepPaths(parseState)
  if (parseState.cur !== str.length) {
    throw new Error(`data path descriptor "${str}" is illegal at char ${parseState.cur}`)
  }
  return ret
}
