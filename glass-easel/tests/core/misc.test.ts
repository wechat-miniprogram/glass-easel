import { tmpl, domBackend } from '../base/env'
import * as glassEasel from '../../src'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
  writeIdToDOM: true,
})
componentSpace.defineComponent({
  is: '',
})

describe('dump element', () => {
  test('dump node structure (shadow)', () => {
    const compDef = componentSpace.defineComponent({
      template: tmpl('<block wx:if="1"><div id="a" class="a" style="color: red">A</div></block>'),
    })
    const elem = glassEasel.Component.createWithContext('root', compDef.general(), domBackend)
    const shadowDump = glassEasel.dumpElementToString(elem.shadowRoot, false)
    expect(shadowDump).toBe(
      [
        '<(virtual):shadow>',
        '  <(virtual):wx:if>',
        '    <div id="a" class="a" style="color: red">',
        '      A',
      ].join('\n'),
    )
  })

  test('dump node structure (composed)', () => {
    const compDefA = componentSpace.defineComponent({
      is: 'comp-a',
      options: { multipleSlots: true },
      properties: {
        prop: String,
      },
      template: tmpl('<block wx:if="1"> <slot name="a" /> </block>'),
    })
    componentSpace.setGlobalUsingComponent('comp-a', compDefA.general())
    const compDef = componentSpace.defineComponent({
      is: 'comp-b',
      template: tmpl('<comp-a prop="p"><div attr="c" slot="a">A</div></comp-a>'),
    })
    const elem = glassEasel.Component.createWithContext('root', compDef.general(), domBackend)
    const composedDump = glassEasel.dumpElementToString(elem, true)
    expect(composedDump).toBe(
      [
        '<root:comp-b>',
        '  <(virtual):shadow>',
        '    <comp-a:comp-a prop="p">',
        '      <(virtual):shadow>',
        '        <(virtual):wx:if>',
        '        <(virtual):slot (slot) name="a">',
        '          <div slot="a" attr="c">',
        '            A',
      ].join('\n'),
    )
  })

  test('dump node structure (external component)', () => {
    const def = componentSpace.defineComponent({
      options: { externalComponent: true },
      properties: {
        prop: String,
      },
      template: tmpl('<div />'),
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), domBackend)
    const composedDump = glassEasel.dumpElementToString(elem, true)
    expect(composedDump).toBe(['<root: prop="">', '  <(external)>'].join('\n'))
  })

  test('dump invalid node', () => {
    expect(glassEasel.dumpElementToString(null, false)).toBe('<(null)>')
    expect(glassEasel.dumpElementToString(undefined, false)).toBe('<(undefined)>')
    expect(glassEasel.dumpElementToString(NaN, false)).toBe('<(unknown)>')
  })
})

describe('deep copy', () => {
  test('simple deep copy', () => {
    const data = {
      a: [1, 'a'],
      b: {
        b1: true,
      },
      s: Symbol('syn'),
    }
    const copied = glassEasel.dataUtils.deepCopy(data, false)
    expect(copied.a).toStrictEqual(data.a)
    expect(copied.a !== data.a).toBe(true)
    expect(copied.b).toStrictEqual(data.b)
    expect(copied.b !== data.b).toBe(true)
    expect(copied.s.description).toBe(data.s.description)
    expect(copied.s !== data.s).toBe(true)
  })

  test('deep copy with object recursion', () => {
    const data = {
      a: {
        b: null,
        c: 123,
      },
    }
    data.a.b = data.a as unknown as null
    const copied = glassEasel.dataUtils.deepCopy(data, true)
    expect(copied.a.c).toBe(data.a.c)
    expect(copied.a !== data.a).toBe(true)
    expect(copied.a.b !== data.a.b).toBe(true)
    expect(copied.a.b).toBe(copied.a)
  })

  test('deep copy with array recursion', () => {
    const data = {
      a: [null, Symbol('syn')],
    }
    data.a[0] = data.a as unknown as null
    const copied = glassEasel.dataUtils.deepCopy(data, true)
    expect(copied.a[1]!.description).toBe(data.a[1]!.description)
    expect(copied.a !== data.a).toBe(true)
    expect(copied.a[0] !== data.a[0]).toBe(true)
    expect(copied.a[0]).toBe(copied.a)
  })
})

describe('event', () => {
  test('read event status', () => {
    const event = new glassEasel.Event('test', {})
    expect(event.defaultPrevented()).toBe(false)
    expect(event.getEventBubbleStatus()).toBe(glassEasel.EventBubbleStatus.Normal)
    event.preventDefault()
    expect(event.defaultPrevented()).toBe(true)
    expect(event.getEventBubbleStatus()).toBe(glassEasel.EventBubbleStatus.NoDefault)
  })

  test('legacy event binding syntax', () => {
    const eventArr: number[] = []
    const childCompDef = glassEasel.Component.register(
      {
        lifetimes: {
          attached() {
            this.triggerEvent('abc', 123, { capturePhase: true })
            this.triggerEvent('abc', 456)
          },
        },
      },
      componentSpace,
    )
    const compDef = glassEasel.Component.register(
      {
        using: {
          child: childCompDef,
        },
        template: tmpl(`
        <child bindabc="handler" capture-bindabc="handler" catchabc="handler" capture-catchabc="handler" onabc="handler" />
      `),
        methods: {
          handler(ev: glassEasel.ShadowedEvent<number>) {
            eventArr.push(ev.detail)
          },
        },
      },
      componentSpace,
    )
    const comp = glassEasel.createElement('root', compDef)
    glassEasel.Element.pretendAttached(comp)
    expect(eventArr).toEqual([123, 123, 456, 456, 456])
  })

  test('listener change lifetimes', () => {
    const eventArr: [boolean, string, any][] = []
    const childCompDef = glassEasel.Component.register(
      {
        options: {
          listenerChangeLifetimes: true,
        },
        lifetimes: {
          listenerChanged: (
            isAdd: boolean,
            eventName: string,
            listener: any,
            options: EventListenerOptions,
          ) => {
            eventArr.push([isAdd, eventName, listener])
            expect(options.capture).toBe(true)
          },
        },
      },
      componentSpace,
    )
    const compDef = glassEasel.Component.register(
      {
        using: {
          child: childCompDef,
        },
        template: tmpl(`
        <child id="a" />
      `),
      },
      componentSpace,
    )
    const comp = glassEasel.createElement('root', compDef)
    const child = comp.getShadowRoot()!.getElementById('a')!.asInstanceOf(childCompDef)!
    const listener = () => {
      /* empty */
    }
    child.addListener('testEv', listener, { capture: true })
    child.removeListener('testEv', listener, { capture: true })
    child.removeListener('testEv', listener, { capture: true })
    child.removeListener('testEv2', listener, { capture: true })
    expect(eventArr).toEqual([
      [true, 'testEv', listener],
      [false, 'testEv', listener],
    ])
  })
})

describe('component utils', () => {
  test('#getMethodsFromDef #getMethod', () => {
    const compDef = glassEasel.Component.register(
      {
        methods: {
          abc() {
            return 'abc'
          },
        },
      },
      componentSpace,
    )
    expect(compDef.isPrepared()).toBe(false)
    compDef.prepare()
    expect(compDef.isPrepared()).toBe(true)
    expect(glassEasel.Component.getMethodsFromDef(compDef.general()).abc!()).toBe('abc')
    const comp = glassEasel.createElement('root', compDef.general())
    expect(glassEasel.Component.getMethod(comp.general(), 'abc')!()).toBe('abc')
  })

  test('#getMethodsFromDef #getMethod (in init function)', () => {
    const compDef = componentSpace
      .define()
      .init(({ method }) => {
        const abc = method(() => 'abc')
        return {
          abc,
        }
      })
      .registerComponent()
    expect(compDef.isPrepared()).toBe(false)
    compDef.prepare()
    expect(compDef.isPrepared()).toBe(true)
    expect(glassEasel.Component.getMethodsFromDef(compDef.general()).abc).toBe(undefined)
    const comp = glassEasel.createElement('root', compDef.general())
    expect(glassEasel.Component.getMethod(comp.general(), 'abc')!()).toBe('abc')
  })

  test('#isInnerDataExcluded', () => {
    const compDef = glassEasel.Component.register(
      {
        options: {
          pureDataPattern: /^_/,
        },
      },
      componentSpace,
    )
    const comp = glassEasel.createElement('root', compDef.general())
    expect(comp.isInnerDataExcluded('_a')).toBe(true)
    expect(comp.isInnerDataExcluded('a')).toBe(false)
  })

  test('#getInnerData', () => {
    const compDef = glassEasel.Component.register(
      {
        options: {
          dataDeepCopy: glassEasel.DeepCopyKind.Simple,
        },
        data: {
          a: 123,
        },
      },
      componentSpace,
    )
    const comp = glassEasel.createElement('root', compDef.general())
    expect(glassEasel.Component.getInnerData(comp.general())).toStrictEqual(comp.data)
  })

  test('#getInnerData', () => {
    const compDef = glassEasel.Component.register(
      {
        options: {
          dataDeepCopy: glassEasel.DeepCopyKind.Simple,
        },
        data: {
          a: 123,
        },
      },
      componentSpace,
    )
    const comp = glassEasel.createElement('root', compDef.general())
    const oldData = comp.data
    glassEasel.Component.replaceWholeData(comp.general(), { b: 456 })
    expect(oldData).toStrictEqual({ a: 123 })
    expect(comp.data).toStrictEqual({ b: 456 })
  })

  test('getComponentDependencies', () => {
    const def0 = componentSpace.defineComponent({ is: 'common/def0', using: { p: '/common/def1' } })
    const def1 = componentSpace.defineComponent({ is: 'common/def1', using: { p: '/common/def0' } })
    const def2 = componentSpace.defineComponent({
      is: 'common/def2',
      using: { p: './none' },
      placeholders: { p: './def1' },
    })
    const def3 = componentSpace.defineComponent({ is: 'def3', using: { p: 'common/def1' } })
    const def4 = componentSpace.defineComponent({
      is: 'def4',
      using: { 'p-a': '/common/def2', 'p-b': def3 },
    })
    def3.prepare()
    const ret = def4.getComponentDependencies()
    expect(ret).toContain(def0)
    expect(ret).toContain(def1)
    expect(ret).toContain(def2)
    expect(ret).toContain(def3)
    expect(ret.size).toBe(4)
  })

  test('disallowNativeNode', () => {
    const template = Object.assign(
      tmpl(`
      <div />
    `),
      { disallowNativeNode: true },
    )
    const compDef = componentSpace.defineComponent({ template })
    const elem = glassEasel.createElement('root', compDef.general())
    expect(elem.getShadowRoot()!.childNodes[0]).toBeInstanceOf(glassEasel.Component)
  })

  test('propertyEarlyInit', () => {
    const callOrder: number[] = []
    const lateInit = componentSpace
      .define()
      .options({ propertyEarlyInit: false })
      .property('a', Boolean)
      .template(
        tmpl(`
        <div wx:if="{{a}}" id="a">{{a}}</div>
      `),
      )
      .observer('a', function () {
        callOrder.push(1)
        expect(this.getShadowRoot()!.getElementById('a')).toBe(undefined)
      })
      .lifetime('created', function () {
        callOrder.push(2)
        expect(this.getShadowRoot()!.getElementById('a')).toBe(undefined)
      })
      .lifetime('attached', function () {
        callOrder.push(3)
        expect(this.getShadowRoot()!.getElementById('a')).toBeInstanceOf(glassEasel.NativeNode)
      })
      .registerComponent()
    const earlyInit = componentSpace
      .define()
      .options({ propertyEarlyInit: true })
      .property('a', Boolean)
      .template(
        tmpl(`
        <div wx:if="{{a}}" id="a">{{a}}</div>
      `),
      )
      .observer('a', function () {
        callOrder.push(4)
        expect(this.getShadowRoot()!.getElementById('a')).toBe(undefined)
      })
      .lifetime('created', function () {
        callOrder.push(5)
        expect(this.getShadowRoot()!.getElementById('a')).toBeInstanceOf(glassEasel.NativeNode)
      })
      .lifetime('attached', function () {
        callOrder.push(6)
        expect(this.getShadowRoot()!.getElementById('a')).toBeInstanceOf(glassEasel.NativeNode)
      })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        'early-init': earlyInit.general(),
        'late-init': lateInit.general(),
      })
      .template(
        tmpl(`
        <late-init a="{{true}}" />
        <early-init a="{{true}}" />
      `),
      )
      .registerComponent()
    const elem = glassEasel.createElement('root', compDef.general())
    glassEasel.Element.pretendAttached(elem)
    expect(callOrder).toStrictEqual([2, 1, 4, 5, 3, 6])
  })

  test('hostNodeTagName', () => {
    const normalComp = componentSpace
      .define()
      .options({ externalComponent: false, hostNodeTagName: 'wx-normal' })
      .registerComponent()
    const compDef = componentSpace
      .define()
      .usingComponents({
        'normal-comp': normalComp.general(),
      })
      .template(
        tmpl(`
          <normal-comp />
        `),
      )
      .registerComponent()

    class MyBackendContext extends glassEasel.composedBackend.EmptyComposedBackendContext {
      // eslint-disable-next-line class-methods-use-this
      override createElement(tagName: string, stylingName: string): MyBackendElement {
        return new MyBackendElement(tagName, stylingName)
      }
    }
    class MyBackendElement extends glassEasel.composedBackend.EmptyComposedBackendElement {
      tagName: string
      stylingName: string

      constructor(tagName: string, stylingName: string) {
        super()
        this.tagName = tagName
        this.stylingName = stylingName
      }
    }

    const elem = glassEasel.Component.createWithContext(
      'root',
      compDef.general(),
      new MyBackendContext(),
    )
    glassEasel.Element.pretendAttached(elem)
    const e = elem.getShadowRoot()!.childNodes[0]!.asElement()!.$$ as MyBackendElement
    expect(e.tagName).toBe('wx-normal')
    expect(e.stylingName).toBe('normal-comp')
  })
})
