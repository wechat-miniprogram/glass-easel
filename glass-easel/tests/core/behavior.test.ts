import {
  domBackend,
  execWithWarn,
  tmpl,
} from '../base/env'
import * as glassEasel from '../../src'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
})
componentSpace.defineComponent({
  is: '',
})

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

describe('chaining-form interface', () => {
  test('chaining options and template', () => {
    const beh = componentSpace.define()
      .options({
        writeIdToDOM: false,
      })
      .template(tmpl(`
        <div></div>
      `))
      .registerBehavior()
    const compDef = componentSpace.define()
      .options({
        writeIdToDOM: true,
      })
      .template(tmpl(`
        <div id="{{a}}"></div>
      `))
      .behavior(beh)
      .data(() => ({
        a: 'abc',
      }))
      .registerComponent()
    const elem = glassEasel.Component.createWithContext('root', compDef, domBackend)
    expect(domHtml(elem)).toBe('<div id="abc"></div>')
  })

  test('chaining using and generics', () => {
    const child = componentSpace.define()
      .options({
        virtualHost: true,
      })
      .externalClasses(['a-class', 'b-class'])
      .template(tmpl(`
        <span></span>
      `))
      .registerComponent()
    const beh = componentSpace.define()
      .usingComponents({
        'invalid-comp': child,
      })
      .generics({
        'invalid-gen': true,
      })
      .registerBehavior()
    const compDef = componentSpace.define()
      .behavior(beh)
      .usingComponents({
        'comp-a': child,
      })
      .usingComponents({
        'comp-b': child,
      })
      .generics({
        'gen-a': true,
      })
      .generics({
        'gen-b': {
          default: 'comp-b',
        },
      })
      .template(tmpl(`
        <comp-a />
        <comp-b />
        <gen-a />
        <gen-b />
        <invalid-comp />
        <invalid-gen />
      `))
      .registerComponent()
    const elem = glassEasel.Component.createWithGenericsAndContext(
      'root',
      compDef,
      {
        'gen-a': child,
        'gen-b': child,
        'invalid-gen': child,
      },
      domBackend,
    )
    expect(domHtml(elem)).toBe('<span></span><span></span><span></span><span></span><invalid-comp></invalid-comp><invalid-gen></invalid-gen>')
  })

  test('chaining external classes', () => {
    const beh = componentSpace.define()
      .externalClasses(['invalid'])
      .registerBehavior()
    const child = componentSpace.define()
      .behavior(beh)
      .externalClasses(['a-class', 'b-class'])
      .template(tmpl(`
        <div class="invalid a-class b-class"></div>
      `))
      .registerComponent()
    const compDef = componentSpace.define()
      .usingComponents({
        child,
      })
      .template(tmpl(`
        <child invalid="i" a-class="a" b-class="b" />
      `))
      .registerComponent()
    const elem = glassEasel.Component.createWithContext('root', compDef, domBackend)
    expect(domHtml(elem)).toBe('<child><div class="invalid a b"></div></child>')
  })

  test('chaining data and observers', () => {
    const callOrder: number[] = []
    const beh = componentSpace.define()
      .data(() => ({
        a: 123,
        a2: 456,
      }))
      .observer('a', function () {
        callOrder.push(1)
        this.setData({
          a2: this.data.a * 2,
        })
      })
      .registerBehavior()
    const compDef = componentSpace.define()
      .behavior(beh)
      .data(() => ({
        b: 'abc',
        b2: '',
        b3: '',
        c: 'ccc',
      }))
      .init(({ data, setData, observer }) => {
        observer('b', () => {
          callOrder.push(3)
          setData({
            b3: `${data.b}3`,
          })
          let catched = false
          try { observer('b', () => undefined) } catch { catched = true }
          expect(catched).toBe(true)
        })

        observer(['b', 'c'], () => {
          callOrder.push(4)
        })
      })
      .definition({
        observers: {
          b() {
            callOrder.push(2)
            this.setData({
              b2: `${this.data.b}2`,
            })
          },
        },
      })
      .registerComponent()
    const elem = glassEasel.Component.createWithContext('root', compDef, domBackend)
    expect(elem.data).toStrictEqual({
      a: 123,
      a2: 456,
      b: 'abc',
      b2: '',
      b3: '',
      c: 'ccc',
    })
    elem.setData({
      a: 234,
      b: 'def',
      c: '',
    })
    expect(callOrder).toStrictEqual([1, 2, 3, 4])
    expect(elem.data).toStrictEqual({
      a: 234,
      a2: 468,
      b: 'def',
      b2: 'def2',
      b3: 'def3',
      c: '',
    })
  })

  test('chaining properties', () => {
    const callOrder: number[] = []
    const beh = componentSpace.define()
      .property('propA', {
        type: Number,
        value: 123,
        default: () => 456,
      })
      .observer('propA', () => {
        callOrder.push(1)
      })
      .registerBehavior()
    const compDef = componentSpace.define()
      .behavior(beh)
      .property('propB', String)
      .definition({
        properties: {
          propC: {
            default: () => 789,
          },
        },
        observers: {
          propA() {
            callOrder.push(2)
          },
        },
      })
      .init(({ observer }) => {
        observer('propB', () => {
          callOrder.push(3)
        })
      })
      .registerComponent()
    const elem = glassEasel.Component.createWithContext('root', compDef, domBackend)
    expect(elem.data).toStrictEqual({ propA: 456, propB: '', propC: 789 })
    execWithWarn(1, () => {
      elem.setData({
        propA: 'abc' as unknown as number,
        propB: 'def',
        propC: undefined,
      })
    })
    expect(callOrder).toStrictEqual([1, 2, 3])
    expect(elem.data).toStrictEqual({ propA: 456, propB: 'def', propC: 789 })
  })

  test('chaining methods', () => {
    const beh = componentSpace.define()
      .data(() => ({
        a1: '',
      }))
      .methods({
        a1(s: string) {
          this.setData({
            a1: s,
          })
        },
      })
      .registerBehavior()
    const compDef = componentSpace.define()
      .template(tmpl(`
        <div id="a" bind:customEv="cev" bind:customEv2="cev2">{{a1}}-{{a2}}-{{a3}}</div>
      `))
      .behavior(beh)
      .definition({
        data: {
          a2: '',
        },
        methods: {
          a2(s: string) {
            this.setData({
              a2: s,
            })
          },
        },
      })
      .data(() => ({
        a3: '',
      }))
      .init(({
        setData,
        method,
        lifetime,
        listener,
      }) => {
        const cev = method((s: glassEasel.Event<{ detailStr: string }>) => {
          setData({ a3: s.detail.detailStr })
        })
        const cev2 = listener<{ detailStr: string }>((s) => {
          setData({ a3: s.detail.detailStr })
        })
        lifetime('created', () => {
          let catched = false
          try { method(() => undefined) } catch { catched = true }
          try { listener(() => undefined) } catch { catched = true }
          expect(catched).toBe(false)
        })

        return {
          cev,
          cev2,
        }
      })
      .registerComponent()
    const elem = glassEasel.Component.createWithContext('root', compDef, domBackend)
    expect(domHtml(elem)).toBe('<div>--</div>')
    elem.a1('b1')
    expect(domHtml(elem)).toBe('<div>b1--</div>')
    elem.a2('b2')
    expect(domHtml(elem)).toBe('<div>b1-b2-</div>')
    elem.getShadowRoot()!.getElementById('a')!.asNativeNode()?.triggerEvent('customEv', { detailStr: 'b3' })
    expect(domHtml(elem)).toBe('<div>b1-b2-b3</div>')
    elem.getShadowRoot()!.getElementById('a')!.asNativeNode()?.triggerEvent('customEv2', { detailStr: 'b33' })
    expect(domHtml(elem)).toBe('<div>b1-b2-b33</div>')
  })

  test('chaining lifetimes', () => {
    const callOrder: number[] = []
    const beh = componentSpace.define()
      .data(() => ({
        a: 0,
      }))
      .lifetime('created', function () {
        callOrder.push(1)
        this.setData({ a: 1 })
      })
      .registerBehavior()
    const compDef = componentSpace.define()
      .template(tmpl(`
        <div>{{a}}-{{b}}-{{c}}</div>
      `))
      .behavior(beh)
      .data(() => ({
        b: 0,
      }))
      .definition({
        lifetimes: {
          created() {
            callOrder.push(2)
            this.setData({ b: 2 })
          },
        },
      })
      .data(() => ({
        c: 0,
      }))
      .init(({ data, setData, lifetime }) => {
        lifetime('created', () => {
          callOrder.push(3)
          setData({ c: 3 })
          expect(data.c).toBe(3)
        })
        lifetime('attached', () => {
          callOrder.push(-1)
        })
        expect(data.c).toBe(0)
        lifetime('created', () => {
          let catched = false
          try { lifetime('attached', () => { callOrder.push(-100) }) } catch { catched = true }
          expect(catched).toBe(true)
        })
      })
      .registerComponent()
    const elem = glassEasel.Component.createWithContext('root', compDef, domBackend)
    expect(callOrder).toStrictEqual([1, 2, 3])
    expect(elem.data).toStrictEqual({ a: 1, b: 2, c: 3 })
    glassEasel.Element.pretendAttached(elem)
    expect(callOrder).toStrictEqual([1, 2, 3, -1])
    expect(domHtml(elem)).toBe('<div>1-2-3</div>')
  })

  test('chaining page-lifetimes', () => {
    const callOrder: number[] = []
    const beh = componentSpace.define()
      .data(() => ({
        a: 0,
      }))
      .pageLifetime('show', function (opt: { inc: number }) {
        callOrder.push(opt.inc)
        this.setData({ a: opt.inc })
        const r = opt
        r.inc += 1
      })
      .registerBehavior()
    const compDef = componentSpace.define()
      .template(tmpl(`
        <div>{{a}}-{{b}}-{{c}}</div>
      `))
      .behavior(beh)
      .data(() => ({
        b: 0,
      }))
      .definition({
        pageLifetimes: {
          show(opt: { inc: number }) {
            callOrder.push(opt.inc)
            this.setData({ b: opt.inc * 10 })
            const r = opt
            r.inc += 1
          },
        },
      })
      .data(() => ({
        c: 0,
      }))
      .init(({
        data,
        setData,
        pageLifetime,
        lifetime,
      }) => {
        pageLifetime('show', (opt: { inc: number }) => {
          callOrder.push(opt.inc)
          setData({ c: opt.inc * 100 })
          const r = opt
          r.inc += 1
          expect(data.c).toBe(300)
        })
        pageLifetime('hide', () => {
          callOrder.push(-1)
        })
        expect(data.c).toBe(0)
        lifetime('created', () => {
          let catched = false
          try { pageLifetime('hide', () => { callOrder.push(-100) }) } catch { catched = true }
          expect(catched).toBe(true)
        })
      })
      .registerComponent()
    const elem = glassEasel.Component.createWithContext('root', compDef, domBackend)
    expect(domHtml(elem)).toBe('<div>0-0-0</div>')
    elem.triggerPageLifetime('show', [{ inc: 1 }])
    expect(callOrder).toStrictEqual([1, 2, 3])
    expect(elem.data).toStrictEqual({ a: 1, b: 20, c: 300 })
    expect(domHtml(elem)).toBe('<div>1-20-300</div>')
    elem.triggerPageLifetime('hide', [])
    expect(callOrder).toStrictEqual([1, 2, 3, -1])
  })

  test('chaining init and methodCallerInit', () => {
    const callOrder: number[] = []
    const beh = componentSpace.define()
      .init(() => {
        callOrder.push(1)
      })
      .registerBehavior()
    const compDef = componentSpace.define()
      .init(() => {
        callOrder.push(2)
      })
      .behavior(beh)
      .methodCallerInit(function () {
        callOrder.push(3)
        return this
      })
      .registerComponent()
    glassEasel.Component.createWithContext('root', compDef, domBackend)
    expect(callOrder).toStrictEqual([3, 1, 2])
  })

  test('chaining relations', () => {
    const eventArr: number[] = []
    const parentDef = componentSpace.define('parent-comp')
      .relation('child', {
        type: 'child',
        target: 'child-comp',
        linked() {
          eventArr.push(1)
          this.getRelationNodes('child').forEach((c, index) => {
            // eslint-disable-next-line no-use-before-define
            const cc = c.asInstanceOf(childDef)!
            cc.setIndex(index)
          })
        },
      })
      .registerComponent()
    const childDef = componentSpace.define('child-comp')
      .template(tmpl('{{index}}'))
      .data(() => ({
        index: '',
      }))
      .methods({
        setIndex(index: number) {
          this.setData({
            index: String.fromCharCode(index + 'A'.charCodeAt(0)),
          })
        },
      })
      .init(({ relation, lifetime }) => {
        relation({
          type: 'parent',
          target: 'parent-comp',
          linked() {
            eventArr.push(2)
          },
        })
        lifetime('created', () => {
          let catched = false
          try { relation({ type: 'child' }) } catch { catched = true }
          expect(catched).toBe(true)
        })
      })
      .registerComponent()
    const compDef = componentSpace.define()
      .usingComponents({
        parent: parentDef,
        child: childDef,
      })
      .template(tmpl(`
        <parent>
          <child wx:for="{{list}}" />
        </parent>
      `))
      .data(() => ({
        list: [1, 2, 3],
      }))
      .registerComponent()
    const comp = glassEasel.Component.createWithContext('root', compDef, domBackend)
    glassEasel.Element.pretendAttached(comp)
    expect(eventArr).toStrictEqual([1, 2, 1, 2, 1, 2])
    expect(domHtml(comp)).toBe('<parent><child>A</child><child>B</child><child>C</child></parent>')
  })

  test('chaining filter', () => {
    const beh = componentSpace.define()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      .chainingFilter<{ myData<T>(this: T): T }, never>((chain) => Object.create(chain, {
        myData: {
          value() {
            return chain.data(() => ({
              a: 123,
            }))
          },
        },
      }))
      .registerBehavior()
    const compDef = componentSpace.define()
      .behavior(beh)
      .data(() => ({ b: '233' }))
      .myData()
      .template(tmpl(`
        <div>{{a}}</div>
      `))
      .registerComponent()
    const elem = glassEasel.Component.createWithContext('root', compDef, domBackend)
    expect(domHtml(elem)).toBe('<div>123</div>')
  })
})
