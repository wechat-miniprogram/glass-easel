/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/ban-ts-comment */

// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from 'tstyche'
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
      expect(newProp).type.toEqual<{ foo: string }>()
      expect(newProp.foo).type.toBeString()
      expect(oldProp).type.toEqual<{ foo: string }>()
      expect(oldProp.foo).type.toBeString()
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
    expect(data.propStr).type.toBeString()
    expect(data.propNum).type.toBeNumber()
    expect(data.propBool).type.toBeBoolean()
    expect(data.propObj).type.toEqual<Record<string, any> | null>()
    expect(data.propObjFoo).type.toEqual<{ foo: string }>()
    expect(data.propObjFoo.foo).type.toBeString()
    expect(data.propObjBar).type.toEqual<{ bar: string }>()
    expect(data.propObjBar.bar).type.toBeString()
    expect(data.propFunc).type.toEqual<(...args: any[]) => any>()
    expect(data.propFuncFoo).type.toEqual<() => 'foo'>()
    expect(data.propArr).type.toEqual<any[]>()
    expect(data.propArrBooks).type.toEqual<{ name: string }[]>()

    expect(data.propOptional).type.toEqual<string | number | boolean>()
    expect(data.propOptionalFoo).type.toEqual<number | boolean | 'foo'>()

    expect(data.propNull).type.toBeAny()

    expect(data).type.not.toHaveProperty('nonExists')

    data.propStr = '123'
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
  expect(data).type.not.toHaveProperty('nonExists')
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
    expect(data.str).type.toBeString()
    expect(data.num).type.toBeNumber()
    expect(data.bool).type.toBeBoolean()
    expect(data.foo).type.toEqual<{ foo: string }>()
    expect(data.func).type.toEqual<() => 'foo'>()
    expect(data.arr).type.toEqual<number[]>()
    expect(data.books).type.toEqual<{ name: string }[]>()

    expect(data).type.not.toHaveProperty('nonExists')

    data.str = '123'
    data.foo.foo = '123'
  })

componentSpace
  .define()
  .property('prop', String)
  .data(function () {
    // @ts-expect-error
    expect(this).type.toBeAny()
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
      expect(newValue).type.toBeString()
    })

    observer('objFoo', (newValue) => {
      expect(newValue).type.toEqual<{ foo: string }>()
      expect(newValue.foo).type.toBeString()
    })

    observer('objFoo.foo', (newValue) => {
      expect(newValue).type.toBeString()
    })

    observer('objFoo.**', (newValue) => {
      expect(newValue).type.toEqual<{ foo: string }>()
    })

    observer(['str', 'objFoo'], (str, objFoo) => {
      expect(str).type.toBeString()
      expect(objFoo).type.toEqual<{ foo: string }>()
    })

    observer(['str', 'objFoo.**'], (str, objFoo) => {
      expect(str).type.toBeString()
      expect(objFoo).type.toEqual<{ foo: string }>()
    })

    observer('**', (newValue) => {
      expect(newValue).type.toEqual<{
        str: string
        objFoo: {
          foo: string
        }
      }>()
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
    expect(newValue).type.toBeString()
  })

  .observer('objFoo', (newValue) => {
    expect(newValue).type.toEqual<{ foo: string }>()
    expect(newValue.foo).type.toBeString()
  })

  .observer('objFoo.foo', (newValue) => {
    expect(newValue).type.toBeString()
  })

  .observer('objFoo.**', (newValue) => {
    expect(newValue).type.toEqual<{ foo: string }>()
  })

  .observer(['str', 'objFoo'], (str, objFoo) => {
    expect(str).type.toBeString()
    expect(objFoo).type.toEqual<{ foo: string }>()
  })

  .observer(['str', 'objFoo.**'], (str, objFoo) => {
    expect(str).type.toBeString()
    expect(objFoo).type.toEqual<{ foo: string }>()
  })

  .observer('**', (newValue) => {
    expect(newValue).type.toEqual<{
      str: string
      objFoo: {
        foo: string
      }
    }>()
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
      expect(impl.getName()).type.toBeString()
      expect(impl.getValue()).type.toEqual<{ foo: string }>()
    },
  })
  expect(rel.list()).type.toEqual<any[]>()
  expect(rel.listAsTrait()).type.toEqual<SimpleFormControlInterface[]>()
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
  expect(rel.list()).type.toEqual<any[]>()
  expect(rel.listAsTrait()).type.toEqual<SimpleFormControlInterface[]>()
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
    expect(data.propA).type.toBeNumber()
    expect(data.propB).type.toBeString()

    expect(data).type.not.toHaveProperty('behaviorData')

    expect(data).type.not.toHaveProperty('nonExists')
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
    expect(data).type.toEqual<{
      prop1: string
      prop2: string
    }>()
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
      expect(e.detail).type.toEqual<{ bar: string }>()
      return false
    })

    expect(foo()).type.toBeNumber()

    return {
      foo,
      bar,
    }
  })
  .lifetime('created', function () {
    expect(this.foo()).type.toBeNumber()
  })
  .registerComponent()

/**
 * Lifetimes
 */
componentSpace
  .define()
  .lifetime('listenerChange', (isAdd, name, func, options) => {
    expect(isAdd).type.toBeBoolean()
    expect(name).type.toBeString()
    expect(func).type.toEqual<glassEasel.EventListener<unknown>>()
    expect(options).type.toEqual<glassEasel.EventListenerOptions | undefined>()
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
