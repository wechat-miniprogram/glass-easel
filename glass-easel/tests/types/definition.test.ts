/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expectType } from 'tsd'
import * as glassEasel from '../../src'

/**
 * Properties
 */
glassEasel.registerElement({
  properties: {
    propStr: String,
    propStrSf: glassEasel.NormalizedPropertyType.String,
    propNum: Number,
    propNumSf: glassEasel.NormalizedPropertyType.Number,
    propBool: Boolean,
    propBoolSf: glassEasel.NormalizedPropertyType.Boolean,
    propObj: Object,
    propObjSf: glassEasel.NormalizedPropertyType.Object,
    propObjFoo: {
      value: { foo: 'foo' },
    },
    propObjBar: {
      default: () => ({ bar: 'bar' }),
    },
    propFunc: Function,
    propFuncSf: glassEasel.NormalizedPropertyType.Function,
    propFuncFoo: {
      type: Function,
      value: () => 'foo',
    },
    propArr: Array,
    propArrSf: glassEasel.NormalizedPropertyType.Array,
    propArrBooks: {
      value: [] as { name: string }[],
    },

    propOptional: {
      type: String,
      optionalTypes: [Number, Boolean],
    },
    propOptionalFoo: {
      type: String,
      optionalTypes: [Number, Boolean],
      value: 'foo',
    },

    invalid: {
      type: String,
      value: 123,
    },

    propAnySf: glassEasel.NormalizedPropertyType.Any,
    propNull: null,
  },
  created() {
    expectType<string>(this.data.propStr)
    expectType<string>(this.data.propStrSf)
    expectType<number>(this.data.propNum)
    expectType<number>(this.data.propNumSf)
    expectType<boolean>(this.data.propBool)
    expectType<boolean>(this.data.propBoolSf)
    expectType<Readonly<Record<string, any>> | null>(this.data.propObj)
    expectType<Readonly<Record<string, any>> | null>(this.data.propObjSf)
    expectType<{ readonly foo: string }>(this.data.propObjFoo)
    expectType<string>(this.data.propObjFoo.foo)
    expectType<{ readonly bar: string }>(this.data.propObjBar)
    expectType<string>(this.data.propObjBar.bar)
    expectType<(...args: any[]) => any>(this.data.propFunc)
    expectType<(...args: any[]) => any>(this.data.propFuncSf)
    expectType<() => 'foo'>(this.data.propFuncFoo)
    expectType<readonly any[]>(this.data.propArr)
    expectType<readonly any[]>(this.data.propArrSf)
    expectType<readonly { readonly name: string }[]>(this.data.propArrBooks)
    expectType<any>(this.data.propAnySf)
    expectType<any>(this.data.propNull)

    expectType<string | number | boolean>(this.data.propOptional)
    expectType<string | number | boolean>(this.data.propOptionalFoo)

    expectType<never>(this.data.invalid)

    // @ts-expect-error
    expectType<any>(this.data.nonExists)

    // @ts-expect-error
    this.data.propStr = '123'
    // @ts-expect-error
    this.data.propObjFoo.foo = '123'
  },
})

// glassEasel.registerElement({
//   properties: {
//     invalid: {
//       // @ts-expect-error
//       type: '123',
//       // @ts-expect-error
//       optionalTypes: {},
//       // @ts-expect-error
//       observer: true,
//     },
//   },
// })

glassEasel.registerElement({
  created() {
    // @ts-expect-error
    expectType<any>(this.data.non_exists)
  },
})

/**
 * Data
 */
glassEasel.registerElement({
  data: {
    str: '123',
    num: 123,
    bool: true,
    foo: {
      foo: 'foo',
    },
    func: () => 'foo',
    arr: [1],
    books: [{ name: 'book' }],
  },
  created() {
    expectType<string>(this.data.str)
    expectType<number>(this.data.num)
    expectType<boolean>(this.data.bool)
    expectType<{ readonly foo: string }>(this.data.foo)
    expectType<() => 'foo'>(this.data.func)
    expectType<readonly number[]>(this.data.arr)
    expectType<readonly { readonly name: string }[]>(this.data.books)

    // @ts-expect-error
    expectType<any>(this.data.nonExists)

    // @ts-expect-error
    this.data.str = '123'
    // @ts-expect-error
    this.data.foo.foo = '123'
  },
})

/**
 * SetData
 */
glassEasel.registerElement({
  properties: {
    propStr: String,
  },
  data: {
    str: '123',
  },
  created() {
    this.setData({ propStr: '123' })

    this.setData({ str: '123' })

    // @ts-expect-error
    this.setData({ propStr: 123 })
    // @ts-expect-error
    this.setData({ str: 123 })
    // @ts-expect-error
    this.setData({ propStr: null })
    // @ts-expect-error
    this.setData({ str: null })
    // @ts-expect-error
    this.setData({ 'propStr.length': 123 })
    // @ts-expect-error
    this.setData({ 'str.length': 123 })
    // @ts-expect-error
    this.setData({ 'propStr[0]': 123 })
    // @ts-expect-error
    this.setData({ 'str[0]': 123 })
  },
})

glassEasel.registerElement({
  properties: {
    propNum: Number,
  },
  data: {
    num: 123,
  },
  created() {
    this.setData({ propNum: 123 })

    this.setData({ num: 123 })

    // @ts-expect-error
    this.setData({ propNum: '123' })
    // @ts-expect-error
    this.setData({ num: '123' })
    // @ts-expect-error
    this.setData({ propNum: null })
    // @ts-expect-error
    this.setData({ num: null })
    // @ts-expect-error
    this.setData({ 'propNum.length': 123 })
    // @ts-expect-error
    this.setData({ 'num.length': 123 })
    // @ts-expect-error
    this.setData({ 'propNum[0]': 123 })
    // @ts-expect-error
    this.setData({ 'num[0]': 123 })
  },
})

glassEasel.registerElement({
  properties: {
    propBool: Boolean,
  },
  data: {
    bool: true,
  },
  created() {
    this.setData({ propBool: true })

    this.setData({ bool: true })

    // @ts-expect-error
    this.setData({ propBool: 0 })
    // @ts-expect-error
    this.setData({ bool: 0 })
    // @ts-expect-error
    this.setData({ propBool: null })
    // @ts-expect-error
    this.setData({ bool: null })
    // @ts-expect-error
    this.setData({ 'propBool.length': 123 })
    // @ts-expect-error
    this.setData({ 'bool.length': 123 })
    // @ts-expect-error
    this.setData({ 'propBool[0]': 123 })
    // @ts-expect-error
    this.setData({ 'bool[0]': 123 })
  },
})

glassEasel.registerElement({
  properties: {
    propObj: Object,
  },
  data: {
    obj: {} as Record<string, any> | null,
  },
  created() {
    this.setData({ propObj: {} })
    this.setData({ propObj: null })
    this.setData({ 'propObj.foo': 123 })

    this.setData({ obj: {} })
    this.setData({ obj: null })
    this.setData({ 'obj.foo': 123 })

    // @ts-expect-error
    this.setData({ propObj: 0 })
    // @ts-expect-error
    this.setData({ obj: 0 })
    // @ts-expect-error
    this.setData({ 'propObj[0]': 123 })
    // @ts-expect-error
    this.setData({ 'obj[0]': 123 })
  },
})

glassEasel.registerElement({
  properties: {
    propObjFoo: {
      type: Object,
      value: { foo: 'foo' },
    },
  },
  data: {
    foo: { foo: 'foo' },
  },
  created() {
    this.setData({ propObjFoo: { foo: 'foo' } })
    this.setData({ 'propObjFoo.foo': '123' })

    this.setData({ foo: { foo: 'foo' } })
    this.setData({ 'foo.foo': '123' })

    // @ts-expect-error
    this.setData({ propObjFoo: null })
    // @ts-expect-error
    this.setData({ foo: null })
    // @ts-expect-error
    this.setData({ propObjFoo: 0 })
    // @ts-expect-error
    this.setData({ foo: 0 })
    // @ts-expect-error
    this.setData({ propObjFoo: { foo: 'foo', bar: 'bar' } })
    // @ts-expect-error
    this.setData({ foo: { foo: 'foo', bar: 'bar' } })
    // @ts-expect-error
    this.setData({ 'propObjFoo[0]': 123 })
    // @ts-expect-error
    this.setData({ 'foo[0]': 123 })
    // @ts-expect-error
    this.setData({ 'propObjFoo.foo': 123 })
    // @ts-expect-error
    this.setData({ 'foo.foo': 123 })
    // @ts-expect-error
    this.setData({ 'propObjFoo.nonExists': 123 })
    // @ts-expect-error
    this.setData({ 'foo.nonExists': 123 })
  },
})

glassEasel.registerElement({
  properties: {
    propFunc: {
      type: Function,
      value: () => 'foo',
    },
  },
  data: {
    func: () => 'foo',
  },
  created() {
    this.setData({ propFunc: () => 'foo' })

    this.setData({ func: () => 'foo' })

    // @ts-expect-error
    this.setData({ propFunc: null })
    // @ts-expect-error
    this.setData({ func: null })
    // @ts-expect-error
    this.setData({ propFunc: 0 })
    // @ts-expect-error
    this.setData({ func: 0 })
    // @ts-expect-error
    this.setData({ propFunc: (_: any) => 'foo' })
    // @ts-expect-error
    this.setData({ func: (_: any) => 'foo' })
    // @ts-expect-error
    this.setData({ 'propFunc[0]': 123 })
    // @ts-expect-error
    this.setData({ 'func[0]': 123 })
    // @ts-expect-error
    this.setData({ 'propFunc.foo': 123 })
    // @ts-expect-error
    this.setData({ 'func.foo': 123 })
  },
})

glassEasel.registerElement({
  properties: {
    propArr: Array,
  },
  data: {
    arr: [] as any[],
  },
  created() {
    this.setData({ propArr: [] })
    this.setData({ propArr: [1, 'foo', true, {}, null, undefined] })
    this.setData({ 'propArr[0]': 123 })
    this.setData({ 'propArr[0].foo': 'foo' })

    this.setData({ arr: [] })
    this.setData({ arr: [1, 'foo', true, {}, null, undefined] })
    this.setData({ 'arr[0]': 123 })
    this.setData({ 'arr[0].foo': 'foo' })

    // @ts-expect-error
    this.setData({ propArr: null })
    // @ts-expect-error
    this.setData({ arr: null })
    // @ts-expect-error
    this.setData({ propArr: 0 })
    // @ts-expect-error
    this.setData({ arr: 0 })
    // @ts-expect-error
    this.setData({ 'propArr.foo': 123 })
    // @ts-expect-error
    this.setData({ 'arr.foo': 123 })
  },
})

glassEasel.registerElement({
  properties: {
    propArrObj: {
      type: Array,
      value: [{ name: 'book' }],
    },
  },
  data: {
    arrObj: [{ name: 'book' }],
  },
  created() {
    this.setData({ propArrObj: [] })
    this.setData({ propArrObj: [{ name: '123' }, { name: '233' }] })
    this.setData({ 'propArrObj[0]': { name: 'foo' } })
    this.setData({ 'propArrObj[0].name': 'foo' })

    this.setData({ arrObj: [] })
    this.setData({ arrObj: [{ name: '123' }, { name: '233' }] })
    this.setData({ 'arrObj[0]': { name: 'foo' } })
    this.setData({ 'arrObj[0].name': 'foo' })

    // @ts-expect-error
    this.setData({ propArrObj: null })
    // @ts-expect-error
    this.setData({ arrObj: null })
    // @ts-expect-error
    this.setData({ propArrObj: 0 })
    // @ts-expect-error
    this.setData({ arrObj: 0 })
    // @ts-expect-error
    this.setData({ 'propArrObj.foo': 123 })
    // @ts-expect-error
    this.setData({ 'arrObj.foo': 123 })
    // @ts-expect-error
    this.setData({ 'propArrObj[0].name': 123 })
    // @ts-expect-error
    this.setData({ 'arrObj[0].name': 123 })
    // @ts-expect-error
    this.setData({ 'propArrObj[0].nonExists': 'foo' })
    // @ts-expect-error
    this.setData({ 'arrObj[0].nonExists': 'foo' })
  },
})

/**
 * Methods
 */
glassEasel.registerElement({
  methods: {
    sum(a: number, b: number) {
      return a + b
    },
    foo() {
      //
    },
    bar() {
      expectType<void>(this.bar())
      expectType<void>(this.foo())
      expectType<number>(this.sum(1, 2))

      // @ts-expect-error
      this.bar(1)
      // @ts-expect-error
      this.foo(1)
      // @ts-expect-error
      this.sum()
      // @ts-expect-error
      this.sum('1', '2')
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this.nonExists()
    },
  },
})
