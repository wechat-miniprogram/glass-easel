/* eslint-disable */

const { tmpl, domBackend, shadowBackend } = require('../base/env')
const glassEasel = require('../../src')

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
})
componentSpace.defineComponent({
  is: '',
})

const regBeh = (config) => {
  return componentSpace.defineBehavior(config)
}

const regElem = (config) => {
  const { template, ...c } = config
  if (template) c.template = tmpl(template)
  const ret = componentSpace.defineComponent(c)
  componentSpace.setGlobalUsingComponent(config.is, ret)
  return ret
}

const createElem = (is, backend) => {
  const def = componentSpace.getComponent(is)
  return glassEasel.Component.createWithContext(is || 'test', def, backend || domBackend)
}

describe('Behavior', function(){

  it('should do lazy registration', function(){
    var behA = regBeh({
      is: 'behavior-lazy-a',
      methods: {
        fA: function fA(){}
      }
    })
    expect(behA._$methodMap.fA).toBe(undefined)

    glassEasel.Behavior.prepare(behA)
    expect(typeof behA._$methodMap.fA).toBe('function')
  })

  it('should combine definitions correctly', function(){
    var callOrder = []
    var behB = regBeh({
      is: 'behavior-b',
      options: {
        lazyRegistration: false,
      },
      properties: {
        a: null,
        d: Array,
      },
      listeners: {
        'contentchange': 'fB',
        'tap': 'fB2'
      },
      created: function cB(){
        callOrder.push(3)
      },
      attached: function cB(){
        callOrder.push(4)
      },
      moved: function cB(){
        callOrder.push(5)
      },
      detached: function cB(){
        callOrder.push(6)
      },
      lifetimes: {
        created: function lrB(){
          callOrder.push(7)
        },
      },
      pageLifetimes: {
        show: function psB(){
          callOrder.push(8)
        },
      },
      methods: {
        fB: function fB(){
          callOrder.push(1)
        },
        fB2: function fB2(){
          callOrder.push(2)
        },
      }
    })
    regElem({
      is: 'behavior-b-comp',
      behaviors: [behB],
      template: 'B<slot></slot>',
    })

    var elem = createElem('behavior-b-comp')
    expect(behB.is).toBe('behavior-b')
    expect(elem.is).toBe('behavior-b-comp')

    expect(elem.data.a).toBe(null)
    expect(elem.data.d).toStrictEqual([])
    elem.shadowRoot.triggerEvent('contentchange', null)
    elem.shadowRoot.triggerEvent('tap', null)
    glassEasel.Element.pretendAttached(elem)
    elem.triggerLifetime('moved', [])
    elem.triggerPageLifetime('show', [])
    glassEasel.Element.pretendDetached(elem)
    expect(callOrder).toStrictEqual([7, 1, 2, 4, 5, 8, 6])
  })

  it('should combine definitions correctly (diamond inherit)', function(){
    var callOrder = []
    var createSingleBeh = function (suffix, behaviors) {
      return regBeh({
        is: 'behavior-diamond-' + suffix,
        behaviors: behaviors,
        properties: {
          a: null,
          d: Array,
        },
        listeners: {
          'contentchange': 'fB',
        },
        created: function cB(){
          callOrder.push(3 + suffix)
        },
        attached: function cB(){
          callOrder.push(4 + suffix)
        },
        moved: function cB(){
          callOrder.push(5 + suffix)
        },
        detached: function cB(){
          callOrder.push(6 + suffix)
        },
        lifetimes: {
          created: function lrB(){
            callOrder.push(7 + suffix)
          },
        },
        pageLifetimes: {
          show: function psB(){
            callOrder.push(8 + suffix)
          },
        },
        methods: {
          fB: function fB(){
            callOrder.push(1 + suffix)
          },
        }
      })
    }
    var behA = createSingleBeh('a', [])
    var behB = createSingleBeh('b', ['behavior-diamond-a'])
    var behC = createSingleBeh('c', ['behavior-diamond-a'])
    var behD = createSingleBeh('d', ['behavior-diamond-b', 'behavior-diamond-c'])
    regElem({
      is: 'behavior-diamond-comp',
      behaviors: [behD],
    })

    var elem = createElem('behavior-diamond-comp')
    expect(elem.hasBehavior(behA)).toBe(true)
    expect(elem.hasBehavior(behB)).toBe(true)
    expect(elem.hasBehavior(behC)).toBe(true)
    expect(elem.hasBehavior(behD)).toBe(true)
    expect(elem.hasBehavior('behavior-diamond-a')).toBe(true)
    expect(elem.hasBehavior('behavior-diamond-b')).toBe(true)
    expect(elem.hasBehavior('behavior-diamond-c')).toBe(true)
    expect(elem.hasBehavior('behavior-diamond-d')).toBe(true)

    expect(elem.data.a).toBe(null)
    expect(elem.data.d).toStrictEqual([])
    elem.shadowRoot.triggerEvent('contentchange', null)
    elem.shadowRoot.triggerEvent('tap', null)
    glassEasel.Element.pretendAttached(elem)
    elem.triggerLifetime('moved', [])
    elem.triggerPageLifetime('show', [])
    glassEasel.Element.pretendDetached(elem)
    expect(callOrder).toStrictEqual([
      '7a', '7b', '7c', '7d',
      '1d',
      '4a', '4b', '4c', '4d',
      '5a', '5b', '5c', '5d',
      '8a', '8b', '8c', '8d',
      '6a', '6b', '6c', '6d',
    ])
  })

  it('should merge data correctly (with merge)', function(){
    regBeh({
      is: 'behavior-data-merge-base',
      data: {
        obj: {
          k1: 1
        },
        a: 1,
        b: 0
      }
    })
    var behA = regBeh({
      is: 'behavior-data-merge-a',
      behaviors: ['behavior-data-merge-base'],
      data: {
        obj: {
          k2: 2
        },
        b: 2
      }
    })
    var behB = regBeh({
      is: 'behavior-data-merge-b',
      behaviors: ['behavior-data-merge-base'],
      data: {
        obj: {
          k3: 3
        },
        c: 3
      }
    })
    glassEasel.Behavior.prepare(behA)
    glassEasel.Behavior.prepare(behB)
    expect(behA._$staticData).toStrictEqual({ a: 1, b: 2, obj: { k1: 1, k2: 2 } })
    expect(behB._$staticData).toStrictEqual({ a: 1, b: 0, c: 3, obj: { k1: 1, k3: 3 } })
  })

  it('should merge data correctly (without arrays)', function(){
    regBeh({
      is: 'behavior-data-a',
      data: {
        a: 1,
        b: {
          b1: 'a',
          b2: {
            b3: true,
            b4: {}
          }
        }
      }
    })
    regBeh({
      is: 'behavior-data-b',
      data: null
    })
    var behDataC = regBeh({
      is: 'behavior-data-c',
      options: {
        lazyRegistration: false
      },
      behaviors: ['behavior-data-a', 'behavior-data-b'],
      data: {
        b: null,
        __proto__: {a: 1},
        d: {d1: '1', d2: { d3: {} }}
      }
    })
    behDataC.prepare()
    expect(behDataC._$staticData).toStrictEqual({a: 1, b: null, __proto__: {a: 1}, d: {d1: '1', d2: { d3: {} }}})
  })

  it('should merge data correctly (with arrays)', function(){
    regBeh({
      is: 'behavior-data-d',
      data: {
        a: [0, 1, {a1: {a2: false}}],
        b: [2, null],
        c: {0: 3}
      }
    })
    regBeh({
      is: 'behavior-data-e',
      data: {
        a: {1: -1, 2: {a1: {a3: true}}, 3: ['a', 'b']},
        b: [0],
        c: [0]
      }
    })
    var behDataF = regBeh({
      is: 'behavior-data-f',
      options: {
        lazyRegistration: false
      },
      behaviors: ['behavior-data-d', 'behavior-data-e']
    })
    behDataF.prepare()
    expect(behDataF._$staticData).toStrictEqual({
      a: [0, -1, {a1: {a2: false, a3: true}}, ['a', 'b']],
      b: [0],
      c: [0]
    })
  })

})
