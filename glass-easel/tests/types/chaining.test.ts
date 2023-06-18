/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { expectType } from 'tsd-lite'
import * as glassEasel from '../../src'

const componentSpace = glassEasel.getDefaultComponentSpace()

/**
 * Properties
 */
componentSpace
  .define()
  .property('propStr', String)
  .property('propNum', Number)
  .property('propBool', Boolean)
  .property('propObj', Object)
  .property('propObjFoo', {
    type: Object,
    value: { foo: 'foo' },
    observer: (newProp, oldProp) => {
      expectType<{ readonly foo: string }>(newProp)
      expectType<string>(newProp.foo)
      expectType<{ readonly foo: string }>(oldProp)
      expectType<string>(oldProp.foo)
    },
  })
  .property('propObjBar', {
    default: () => ({ bar: 'bar' }),
  })
  .property('propFunc', Function)
  .property('propFuncFoo', {
    value: () => 'foo',
  })
  .property('propArr', Array)
  .property('propArrBooks', {
    value: [] as { name: string }[],
  })

  .property('propOptional', {
    optionalTypes: [String, Number, Boolean],
  })
  .property('propOptionalFoo', {
    optionalTypes: [String, Number, Boolean],
    value: 'foo' as const,
  })

  .property('propNull', null)
  .init(({ data }) => {
    expectType<string>(data.propStr)
    expectType<number>(data.propNum)
    expectType<boolean>(data.propBool)
    expectType<Readonly<Record<string, any>> | null>(data.propObj)
    expectType<{ readonly foo: string }>(data.propObjFoo)
    expectType<string>(data.propObjFoo.foo)
    expectType<{ readonly bar: string }>(data.propObjBar)
    expectType<string>(data.propObjBar.bar)
    expectType<(...args: any[]) => any>(data.propFunc)
    expectType<() => 'foo'>(data.propFuncFoo)
    expectType<readonly any[]>(data.propArr)
    expectType<readonly { readonly name: string }[]>(data.propArrBooks)

    expectType<string | number | boolean>(data.propOptional)
    expectType<number | boolean | 'foo'>(data.propOptionalFoo)

    expectType<any>(data.propNull)

    // @ts-expect-error
    expectType<any>(data.nonExists)

    // @ts-expect-error
    data.propStr = '123'
    // @ts-expect-error
    data.propObjFoo.foo = '123'
  })

componentSpace.define().property('invalid', {
  type: String,
  // @ts-expect-error
  value: 123,
})

componentSpace
  .define()
  .property('duplicate', String)
  // @ts-expect-error
  .property('duplicate', String)

componentSpace.define().property('invalid', {
  // @ts-expect-error
  type: '123',
  // @ts-expect-error
  optionalTypes: {},
  // @ts-expect-error
  observer: true,
})

componentSpace.define().init(({ data }) => {
  // @ts-expect-error
  expectType<any>(data.non_exists)
})

/**
 * Data
 */
componentSpace
  .define()
  .data(() => ({
    str: '123',
    num: 123,
    bool: true,
    foo: {
      foo: 'foo',
    },
    func: () => 'foo',
    arr: [1],
    books: [{ name: 'book' }],
  }))
  .init(({ data }) => {
    expectType<string>(data.str)
    expectType<number>(data.num)
    expectType<boolean>(data.bool)
    expectType<{ readonly foo: string }>(data.foo)
    expectType<() => 'foo'>(data.func)
    expectType<readonly number[]>(data.arr)
    expectType<readonly { readonly name: string }[]>(data.books)

    // @ts-expect-error
    expectType<any>(data.nonExists)

    // @ts-expect-error
    data.str = '123'
    // @ts-expect-error
    data.foo.foo = '123'
  })

componentSpace
  .define()
  .property('prop', String)
  .data(function () {
    // @ts-expect-error
    expectType<any>(this.prop)
    return {}
  })

/**
 * SetData
 */
componentSpace
  .define()
  .data(() => ({
    str: '123',
  }))
  .init(({ setData }) => {
    setData({ str: '123' })

    // @ts-expect-error
    setData({ str: 123 })
    // @ts-expect-error
    setData({ str: null })
    // @ts-expect-error
    setData({ 'str.length': 123 })
    // @ts-expect-error
    setData({ 'str[0]': 123 })
  })

componentSpace
  .define()
  .data(() => ({
    num: 123,
  }))
  .init(({ setData }) => {
    setData({ num: 123 })

    // @ts-expect-error
    setData({ num: '123' })
    // @ts-expect-error
    setData({ num: null })
    // @ts-expect-error
    setData({ 'num.length': 123 })
    // @ts-expect-error
    setData({ 'num[0]': 123 })
  })

componentSpace
  .define()
  .data(() => ({
    bool: true,
  }))
  .init(({ setData }) => {
    setData({ bool: true })

    // @ts-expect-error
    setData({ bool: 0 })
    // @ts-expect-error
    setData({ bool: null })
    // @ts-expect-error
    setData({ 'bool.length': 123 })
    // @ts-expect-error
    setData({ 'bool[0]': 123 })
  })

componentSpace
  .define()
  .data(() => ({
    obj: {} as Record<string, any> | null,
  }))
  .init(({ setData }) => {
    setData({ obj: {} })
    setData({ obj: null })
    setData({ 'obj.foo': 123 })

    // @ts-expect-error
    setData({ obj: 0 })
    // @ts-expect-error
    setData({ 'obj[0]': 123 })
  })

componentSpace
  .define()
  .data(() => ({
    foo: { foo: 'foo' },
  }))
  .init(({ setData }) => {
    setData({ foo: { foo: 'foo' } })
    setData({ 'foo.foo': '123' })

    // @ts-expect-error
    setData({ foo: null })
    // @ts-expect-error
    setData({ foo: 0 })
    // @ts-expect-error
    setData({ foo: { foo: 'foo', bar: 'bar' } })
    // @ts-expect-error
    setData({ 'foo[0]': 123 })
    // @ts-expect-error
    setData({ 'foo.foo': 123 })
    // @ts-expect-error
    setData({ 'foo.nonExists': 123 })
  })

componentSpace
  .define()
  .data(() => ({
    func: () => 'foo',
  }))
  .init(({ setData }) => {
    setData({ func: () => 'foo' })

    // @ts-expect-error
    setData({ func: null })
    // @ts-expect-error
    setData({ func: 0 })
    // @ts-expect-error
    setData({ func: (_: any) => 'foo' })
    // @ts-expect-error
    setData({ 'func[0]': 123 })
    // @ts-expect-error
    setData({ 'func.foo': 123 })
  })

componentSpace
  .define()
  .data(() => ({
    arr: [] as any[],
  }))
  .init(({ setData }) => {
    setData({ arr: [] })
    setData({ arr: [1, 'foo', true, {}, null, undefined] })
    setData({ 'arr[0]': 123 })
    setData({ 'arr[0].foo': 'foo' })

    // @ts-expect-error
    setData({ arr: null })
    // @ts-expect-error
    setData({ arr: 0 })
    // @ts-expect-error
    setData({ 'arr.foo': 123 })
  })

componentSpace
  .define()
  .data(() => ({
    arrObj: [{ name: 'book' }],
  }))
  .init(({ setData }) => {
    setData({ arrObj: [] })
    setData({ arrObj: [{ name: '123' }, { name: '233' }] })
    setData({ 'arrObj[0]': { name: 'foo' } })
    setData({ 'arrObj[0].name': 'foo' })

    // @ts-expect-error
    setData({ arrObj: null })
    // @ts-expect-error
    setData({ arrObj: 0 })
    // @ts-expect-error
    setData({ 'arrObj.foo': 123 })
    // @ts-expect-error
    setData({ 'arrObj[0].name': 123 })
    // @ts-expect-error
    setData({ 'arrObj[0].nonExists': 'foo' })
  })

/**
 * Observer
 */
componentSpace
  .define()
  .data(() => ({
    str: 'foo',
    objFoo: { foo: 'foo' },
  }))
  .init(({ observer }) => {
    observer('str', (newValue) => {
      expectType<string>(newValue)
    })

    observer('objFoo', (newValue) => {
      expectType<{ readonly foo: string }>(newValue)
      expectType<string>(newValue.foo)
    })

    observer('objFoo.foo', (newValue) => {
      expectType<string>(newValue)
    })

    observer('objFoo.**', (newValue) => {
      expectType<{ readonly foo: string }>(newValue)
    })

    observer(['str', 'objFoo'], (str, objFoo) => {
      expectType<string>(str)
      expectType<{ readonly foo: string }>(objFoo)
    })

    observer(['str', 'objFoo.**'], (str, objFoo) => {
      expectType<string>(str)
      expectType<{ readonly foo: string }>(objFoo)
    })

    observer('**', (newValue) => {
      expectType<{
        readonly str: string
        readonly objFoo: {
          readonly foo: string
        }
      }>(newValue)
    })

    // @ts-expect-error
    observer('nonExists', () => {
      /* */
    })
    // @ts-expect-error
    observer(['str', 'nonExists'], () => {
      /* */
    })
    // @ts-expect-error
    observer('objFoo.**.**', () => {
      /* */
    })
  })

componentSpace
  .define()
  .data(() => ({
    str: 'foo',
    objFoo: { foo: 'foo' },
  }))
  .observer('str', (newValue) => {
    expectType<string>(newValue)
  })

  .observer('objFoo', (newValue) => {
    expectType<{ readonly foo: string }>(newValue)
    expectType<string>(newValue.foo)
  })

  .observer('objFoo.foo', (newValue) => {
    expectType<string>(newValue)
  })

  .observer('objFoo.**', (newValue) => {
    expectType<{ readonly foo: string }>(newValue)
  })

  .observer(['str', 'objFoo'], (str, objFoo) => {
    expectType<string>(str)
    expectType<{ readonly foo: string }>(objFoo)
  })

  .observer(['str', 'objFoo.**'], (str, objFoo) => {
    expectType<string>(str)
    expectType<{ readonly foo: string }>(objFoo)
  })

  .observer('**', (newValue) => {
    expectType<{
      readonly str: string
      readonly objFoo: {
        readonly foo: string
      }
    }>(newValue)
  })

componentSpace
  .define()
  // @ts-expect-error
  .observer('nonExists', () => {
    /* */
  })

// @ts-expect-error
componentSpace
  .define()
  .data(() => ({
    str: 'foo',
    objFoo: { foo: 'foo' },
  }))
  .observer(['str', 'nonExists'], () => {
    /* */
  })

componentSpace
  .define()
  .data(() => ({
    str: 'foo',
    objFoo: { foo: 'foo' },
  }))
  // @ts-expect-errors
  .observer('objFoo.**.**', () => {
    /* */
  })

/**
 * Trait
 */
interface SimpleFormControlInterface {
  getName(): string
  getValue(): { foo: string }
}
const FormControl = componentSpace.defineTraitBehavior<SimpleFormControlInterface>()

componentSpace.define().init(({ relation }) => {
  const rel = relation({
    type: 'descendant',
    target: FormControl,
    linked(target) {
      const impl = target.traitBehavior(FormControl)!
      expectType<string>(impl.getName())
      expectType<{ foo: string }>(impl.getValue())
    },
  })
  expectType<any[]>(rel.list())
  expectType<SimpleFormControlInterface[]>(rel.listAsTrait())
})

componentSpace.define().init(({ implement, relation }) => {
  implement(FormControl, {
    getName: () => '...',
    getValue: () => ({ foo: '...' }),
  })
  const rel = relation({
    type: 'ancestor',
    target: FormControl,
  })
  expectType<any[]>(rel.list())
  expectType<SimpleFormControlInterface[]>(rel.listAsTrait())
})

/**
 * Behavior
 */
const beh = componentSpace
  .define()
  .property('propA', {
    type: Number,
    value: 123,
    default: () => 456,
  })
  .data(() => ({
    behaviorData: 'fpp',
  }))
  .registerBehavior()

componentSpace
  .define()
  .behavior(beh)
  .property('propB', String)
  .init(({ data }) => {
    expectType<number>(data.propA)
    expectType<string>(data.propB)

    // @ts-expect-error
    expectType<any>(data.behaviorData)

    // @ts-expect-error
    expectType<any>(data.nonExists)
  })
  .registerComponent()

/**
 * Chaining Filter
 */
const propCheck = componentSpace
  .define()
  .chainingFilter<
    {
      myInit<T>(
        this: T,
        name: string,
        fn: T extends { init: (fn: infer Fn) => any } ? Fn : never,
      ): T
    },
    never
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  >((chain) => chain as any)
  .registerBehavior()

componentSpace
  .define()
  .property('prop1', String)
  .behavior(propCheck)
  .property('prop2', String)
  .myInit('foo', ({ data }) => {
    expectType<{
      readonly prop1: string
      readonly prop2: string
    }>(data)
  })
  .registerComponent()

/**
 * Methods
 */
componentSpace
  .define()
  .property('prop', String)
  .data(() => ({
    num: 123,
  }))
  .init(({ data, method, listener }) => {
    const foo = method(() => data.num)

    const bar = listener<{ bar: string }>((e) => {
      expectType<{ bar: string }>(e.detail)
      return false
    })

    expectType<number>(foo())

    return {
      foo,
      bar,
    }
  })
  .lifetime('created', function () {
    expectType<number>(this.foo())
  })
  .registerComponent()

componentSpace
  .define()
  // @ts-expect-error
  .init(() => {
    const foo = () => {
      /* */
    }
    return {
      foo,
    }
  })

/**
 * Share Code
 */
declare function onThemeChanged(callback: (res: { theme: string }) => void): void
declare function offThemeChanged(callback: (res: { theme: string }) => void): void

const useTheme = (
  { lifetime }: glassEasel.BuilderContext<any, any, any>,
  setTheme: (theme: string) => void,
) => {
  const onThemeChange = ({ theme }: { theme: string }) => {
    setTheme(theme)
  }

  lifetime('attached', () => {
    onThemeChanged(onThemeChange)
  })

  lifetime('detached', () => {
    offThemeChanged(onThemeChange)
  })

  onThemeChange({ theme: 'light' })
}

componentSpace
  .define()
  .data(() => ({
    theme: 'light',
  }))
  .init((ctx) => {
    const { setData } = ctx

    useTheme(ctx, (theme) => setData({ theme }))
  })
  .registerComponent()
