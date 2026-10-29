const wxssLoader = require('../wxss_loader.js')
const { StyleSheetTransformer } = require('./stubs/stylesheet-compiler')

const RESOURCE_PATH = '/project/src/pages/index/index.wxss'

const createContext = (sourceMap) => {
  let settled
  const result = new Promise((resolve, reject) => {
    settled = (err, ...args) => (err ? reject(err) : resolve(args))
  })
  return {
    context: {
      async: () => settled,
      query: {
        tagNamePrefix: '',
        classPrefix: undefined,
        disableHostConversion: false,
        setLowPriorityStyles: () => {},
      },
      resourcePath: RESOURCE_PATH,
      sourceMap,
    },
    result,
  }
}

beforeEach(() => {
  StyleSheetTransformer.reset()
})

test('calls back with content and no source map when source maps are disabled', async () => {
  const { context, result } = createContext(false)
  wxssLoader.call(context, 'a { color: red }', undefined, undefined)
  const args = await result
  expect(args).toEqual(['/* transformed: a { color: red } */', undefined, undefined])
  expect(StyleSheetTransformer.instances[0].freed).toBe(true)
})

test('calls back with the transformed source map when source maps are enabled', async () => {
  const { context, result } = createContext(true)
  wxssLoader.call(context, 'a { color: red }', undefined, undefined)
  const args = await result
  expect(args[0]).toBe('/* transformed: a { color: red } */')
  expect(args[1].sources).toEqual([RESOURCE_PATH])
  expect(StyleSheetTransformer.instances[0].freed).toBe(true)
})

test('merges the incoming source map when one is given', async () => {
  const { context, result } = createContext(true)
  const prevMap = JSON.stringify({
    version: 3,
    sources: [RESOURCE_PATH],
    names: [],
    mappings: 'AAAA',
  })
  wxssLoader.call(context, 'a { color: red }', prevMap, undefined)
  const args = await result
  expect(args[0]).toBe('/* transformed: a { color: red } */')
  expect(args[1].sources).toEqual([RESOURCE_PATH])
  expect(StyleSheetTransformer.instances[0].freed).toBe(true)
})
