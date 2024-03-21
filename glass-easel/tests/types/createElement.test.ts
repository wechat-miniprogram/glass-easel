/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/ban-ts-comment */

// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from 'tstyche'
import * as glassEasel from '../../src'

const componentSpace = glassEasel.getDefaultComponentSpace()

/**
 * Definition createElement
 */
const definitionInstance = glassEasel.createElement(
  'comp',
  glassEasel.registerElement({
    properties: {
      propStr: String,
    },
    data: {
      foo: { foo: 'foo' },
    },
    methods: {
      func() {
        return this.data.propStr + this.data.foo.foo
      },
    },
  }),
)

expect(definitionInstance.data.propStr).type.toBeString()
expect(definitionInstance.data.foo).type.toEqual<{ foo: string }>()
expect(definitionInstance.func()).type.toBeString()

const definitionGeneralInstance = glassEasel.createElement(
  'comp',
  glassEasel
    .registerElement({
      properties: {
        propStr: String,
      },
      data: {
        foo: { foo: 'foo' },
      },
    })
    .general(),
)

expect(definitionGeneralInstance.data).type.toEqual<{ [x: string]: any }>()

/**
 * Chaining createElement
 */
const chainingInstance = glassEasel.createElement(
  'comp',
  componentSpace
    .define()
    .property('propStr', String)
    .data(() => ({
      foo: { foo: 'foo' },
    }))
    .init(({ data, method }) => {
      const func = method(() => data.propStr + data.foo.foo)

      return { func }
    })
    .registerComponent(),
)

expect(chainingInstance.data.propStr).type.toBeString()
expect(chainingInstance.data.foo).type.toEqual<{ foo: string }>()
expect(chainingInstance.func()).type.toBeString()

const chainingGeneralInstance = glassEasel.createElement(
  'comp',
  componentSpace
    .define()
    .property('propStr', String)
    .data(() => ({
      foo: { foo: 'foo' },
    }))
    .registerComponent()
    .general(),
)

expect(chainingGeneralInstance.data).type.toEqual<{ [x: string]: any }>()
