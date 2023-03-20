export const guid = (): string =>
  Math.floor((1 + Math.random()) * 0x100000000)
    .toString(16)
    .slice(1)
