/* eslint-disable */

export const escapeJsString = (str: string) =>
  str.replace(/["'\\\r\n`]/g, (c) => {
    if (c === '\r') return '\\r'
    if (c === '\n') return '\\n'
    return `\\${c}`
  })
