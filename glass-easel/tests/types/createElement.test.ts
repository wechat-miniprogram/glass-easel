/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expectType } from 'tsd'
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

expectType<string>(definitionInstance.data.propStr)
expectType<{ readonly foo: string }>(definitionInstance.data.foo)
expectType<string>(definitionInstance.func())

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

expectType<{ readonly [x: string]: any }>(definitionGeneralInstance.data)

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

expectType<string>(chainingInstance.data.propStr)
expectType<{ readonly foo: string }>(chainingInstance.data.foo)
expectType<string>(chainingInstance.func())

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

expectType<{ readonly [x: string]: any }>(chainingGeneralInstance.data)
