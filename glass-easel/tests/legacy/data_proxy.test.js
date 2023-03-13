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

describe('DataProxy', function(){

  it('should allow independent usage', function(){
    var callOrder = []
    var da = {
      a: 1,
    }
    var g = glassEasel.DataGroup.create(da, function(data, combinedChanges){
      callOrder.push([data, combinedChanges])
    })
    g.replaceDataOnPath(['a'], 2)
    g.applyDataUpdates()
    expect(g.data).toStrictEqual({a: 2})
    var db = {
      b: 1,
    }
    g.replaceWholeData(db)
    expect(g.data).toBe(db)
    g.replaceDataOnPath(['b'], 2)
    g.applyDataUpdates()
    expect(g.data).toStrictEqual({b: 2})
  })

  it('should separate template data', function(){
    regElem({
      is: 'data-proxy-separate-a',
      template: '<div id="c" prop-abc="{{a}} {{b}} {{c}}" />',
      data: {
        a: 1,
        b: 2,
        c: 3,
      }
    })
    var elem = createElem('data-proxy-separate-a')
    expect(elem.$.c.$$.getAttribute('prop-abc')).toBe('1 2 3')
    elem.data.a = 4
    elem.setData({
      b: 5
    })
    expect(elem.$.c.$$.getAttribute('prop-abc')).toBe('1 5 3')
  })

  it('should support inner data filter', function(){
    regElem({
      is: 'data-proxy-inner-data-exclude-a',
      options: {
        pureDataPattern: /^_/
      },
      template: '<div id="c" prop-abc="{{a}} {{_b}} {{_c}} {{d}} {{_e}}" />',
      data: {
        a: 1,
        _b: 2,
      },
      observers: {
        '_b': function() {
          this.setData({
            d: this.data._b * 10,
            _e: this.data._b * 100,
          })
        },
      }
    })
    var elem = createElem('data-proxy-inner-data-exclude-a')
    expect(elem.data.a).toBe(1)
    expect(elem.data._b).toBe(2)
    expect(elem.$.c.getAttribute('prop-abc')).toBe('1    ')
    elem.setData({
      a: 10,
      _b: 20,
      _c: 30,
    })
    expect(elem.data.a).toBe(10)
    expect(elem.data._b).toBe(20)
    expect(elem.data._c).toBe(30)
    expect(elem.data.d).toBe(200)
    expect(elem.data._e).toBe(2000)
    expect(elem.$.c.getAttribute('prop-abc')).toBe('10   200 ')
  })

  it('should support inner data filter on properties', function(){
    var observerTriggered = []
    regElem({
      is: 'data-proxy-inner-data-exclude-b',
      options: {
        pureDataPattern: /^_/
      },
      template: '<div id="c" prop-abc="{{a}} {{_b}}" />',
      properties: {
        a: {
          type: Number,
          value: 1,
          observer: function() {
            observerTriggered.push('a1')
          }
        },
        _b: {
          type: Number,
          value: 2,
          observer: function() {
            observerTriggered.push('b1')
          }
        },
      },
      observers: {
        a: function() {
          observerTriggered.push('a2')
        },
        _b: function() {
          observerTriggered.push('b2')
        },
      }
    })
    var elem = createElem('data-proxy-inner-data-exclude-b')
    expect(elem.data.a).toBe(1)
    expect(elem.data._b).toBe(2)
    expect(elem.$.c.getAttribute('prop-abc')).toBe('1 ')
    elem.setData({
      a: 10,
      _b: 20,
    })
    expect(elem.data.a).toBe(10)
    expect(elem.data._b).toBe(20)
    expect(elem.$.c.getAttribute('prop-abc')).toBe('10 ')
    expect(observerTriggered).toStrictEqual(['a2', 'b2', 'a1'])
  })

  it('should support inner data filter (when separating template data disabled)', function(){
    regElem({
      is: 'data-proxy-inner-data-exclude-c',
      options: {
        dataDeepCopy: glassEasel.DeepCopyKind.None,
        pureDataPattern: /^_/
      },
      template: '<div id="c" prop-abc="{{a}} {{_b}} {{_c}} {{d}} {{_e}}" />',
      data: {
        a: 1,
        _b: 2,
      },
      observers: {
        '_b': function() {
          this.setData({
            d: (this.data._b || 40) * 10,
            _e: (this.data._b || 40) * 100,
          })
        },
      }
    })
    var elem = createElem('data-proxy-inner-data-exclude-c')
    expect(elem.data.a).toBe(1)
    expect(elem.data._b).toBe(2)
    expect(elem.$.c.getAttribute('prop-abc')).toBe('1    ')
    elem.setData({
      a: 10,
      _b: 20,
      _c: 30,
    })
    expect(elem.data.a).toBe(10)
    expect(elem.data._b).toBe(20)
    expect(elem.data._c).toBe(30)
    expect(elem.data.d).toBe(200)
    expect(elem.data._e).toBe(2000)
    expect(elem.$.c.getAttribute('prop-abc')).toBe('10   200 ')
  })

  it('should support inner data filter on properties (when separating template data disabled)', function(){
    var observerTriggered = []
    regElem({
      is: 'data-proxy-inner-data-exclude-d',
      options: {
        dataDeepCopy: glassEasel.DeepCopyKind.None,
        pureDataPattern: /^_/
      },
      template: '<div id="c" prop-abc="{{a}} {{_b}}" />',
      properties: {
        a: {
          type: Number,
          value: 1,
          observer: function() {
            observerTriggered.push('a1')
          }
        },
        _b: {
          type: Number,
          value: 2,
          observer: function() {
            observerTriggered.push('b1')
          }
        },
      },
      observers: {
        a: function() {
          observerTriggered.push('a2')
        },
        _b: function() {
          observerTriggered.push('b2')
        },
      }
    })
    var elem = createElem('data-proxy-inner-data-exclude-d')
    expect(elem.data.a).toBe(1)
    expect(elem.data._b).toBe(2)
    expect(elem.$.c.getAttribute('prop-abc')).toBe('1 ')
    elem.setData({
      a: 10,
      _b: 20,
    })
    expect(elem.data.a).toBe(10)
    expect(elem.data._b).toBe(20)
    expect(elem.$.c.getAttribute('prop-abc')).toBe('10 ')
    expect(observerTriggered).toStrictEqual(['a2', 'b2', 'a1'])
  })

  it('should not separate template data if options specified', function(){
    regElem({
      is: 'data-proxy-separate-b',
      options: {
        dataDeepCopy: glassEasel.DeepCopyKind.None,
      },
      template: '<div id="c" prop-abc="{{a}} {{b}} {{c}}" />',
      data: {
        a: 1,
        b: 2,
        c: 3,
      }
    })
    var elem = createElem('data-proxy-separate-b')
    expect(elem.$.c.getAttribute('prop-abc')).toBe('1 2 3')
    elem.data.a = 4
    elem.setData({
      b: 5
    })
    expect(elem.$.c.getAttribute('prop-abc')).toBe('4 5 3')
  })

  it('should not copy when property passing if options specified', function(){
    regElem({
      is: 'data-proxy-prop-passing-deep-copy',
      options: {
        propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
      },
      template: '<div id="c" prop-abc="{{a.b}}" />',
      properties: {
        a: {
          value: {
            b: 1,
          },
        },
      }
    })
    var elem = createElem('data-proxy-prop-passing-deep-copy')
    expect(elem.$.c.getAttribute('prop-abc')).toBe('1')
    var dataGroup = glassEasel.Component.getDataProxy(elem)
    var c = 4
    dataGroup.replaceDataOnPath(['a', 'b'], c)
    c = 5
    dataGroup.applyDataUpdates()
    expect(elem.$.c.getAttribute('prop-abc')).toBe('4')
    d = {b: c}
    dataGroup.replaceProperty('a', d)
    d.b = 6
    dataGroup.applyDataUpdates()
    expect(elem.$.c.getAttribute('prop-abc')).toBe('6')
  })

  describe('#scheduleReplace #setChanges #getChanges', function(){

    it('should support global observer', function(){
      regElem({
        is: 'data-proxy-a',
        properties: {
          prop1: String,
        },
        data: {
          data1: {
            arr: [10, 100]
          }
        },
        observers: [{
          observer: function(newVal) {
            if(observesLeft === 2) {
              expect(newVal).toBe(this.data)
            } else {
              expect(newVal).toBe(this.data)
            }
            observesLeft--
          }
        }]
      })
      var elem = createElem('data-proxy-a')
      var observesLeft = 2
      elem.prop1 = 123
      elem.setData({
        'data1.arr[1]': '200'
      })
      expect(observesLeft).toBe(0)
    })

    it('should do replace in correct order', function(){
      regElem({
        is: 'data-proxy-replace',
        data: {
          data1: []
        }
      })
      var elem = createElem('data-proxy-replace')
      elem.groupUpdates(function() {
        elem.replaceDataOnPath(['data2'], {
          f1: {}
        })
        elem.replaceDataOnPath(['data2'], {
          f2: {
            sf1: {
              obj: {}
            },
            sf2: {
              arr: ['a']
            }
          }
        })
        elem.replaceDataOnPath(['data2', 'f3'], {})
        elem.replaceDataOnPath(['data2', 'f2', 'sf1'], true)
        elem.replaceDataOnPath(['data2', 'f2', 'sf2', 'arr', 2], 'c')
        elem.replaceDataOnPath(['data2', 'f2', 'sf2', 'arr', 1], 'b')
      })
      expect(elem.data).toStrictEqual({
        data1: [],
        data2: {
          f2: {
            sf1: true,
            sf2: {
              arr: ['a', 'b', 'c']
            }
          },
          f3: {}
        }
      })
    })

    it('should be able to set all data changes', function(){
      regElem({
        is: 'data-proxy-replace-set',
      })
      var elem = createElem('data-proxy-replace-set')
      elem.replaceDataOnPath(['data3'], true)
      glassEasel.Component.getDataProxy(elem).setChanges([
        [['data2'], {f1: {}}],
        [['data2'], {
          f2: {
            sf1: {
              obj: {}
            }
          }
        }],
        [['data2'], {f3: {}}],
        [['data2', 'f2', 'sf1'], true],
      ])
      elem.replaceDataOnPath(['data4'], 123)
      elem.applyDataUpdates()
      expect(elem.data).toStrictEqual({
        data4: 123,
        data2: {
          f2: { sf1: true },
          f3: {}
        }
      })
    })

    it('should be able to get and set all data changes', function(){
      regElem({
        is: 'data-proxy-replace-set',
      })
      var elem = createElem('data-proxy-replace-set')
      elem.replaceDataOnPath(['a'], 1)
      elem.replaceDataOnPath(['b'], 2)
      var changes = glassEasel.Component.getDataProxy(elem).getChanges()
      glassEasel.Component.getDataProxy(elem).setChanges(changes.slice(1))
      elem.applyDataUpdates()
      expect(elem.data.a).toBe(undefined)
      expect(elem.data.b).toBe(2)
    })

  })

  describe('#addObserver', function(){

    it('should trigger data observers', function(){
      var beh = regBeh({
        observers: {
          'data2.arr.**': function(newVal){
            actualOrder.push(7)
            expect(newVal).toBe(this.data.data2 && this.data.data2.arr)
          }
        }
      })
      regElem({
        is: 'data-proxy-observer',
        behaviors: [beh],
        properties: {
          prop1: {
            type: Number,
            observer: function(newVal){
              actualOrder.push(0)
            }
          }
        },
        observers: {
          'data2': function f1(newVal){
            actualOrder.push(1)
            expect(newVal).toBe(this.data.data2)
          },
          'data2.**': function f2(newVal){
            actualOrder.push(2)
            expect(newVal).toBe(this.data.data2)
          },
          'data2.arr.**': function f3(newVal){
            actualOrder.push(3)
            expect(newVal).toBe(this.data.data2 && this.data.data2.arr)
          },
          'data2.arr[0].sf1, data2.arr[1].**': function f4(newVal1, newVal2){
            actualOrder.push(4)
            expect(newVal1).toBe(this.data.data2 && this.data.data2.arr[0] && this.data.data2.arr[0].sf1)
            expect(newVal2).toBe(this.data.data2 && this.data.data2.arr[1])
          },
          'data2.arr[0]': function f5(newVal){
            actualOrder.push(5)
            expect(newVal).toBe(this.data.data2 && this.data.data2.arr[0])
          },
          'data2.**, not.exists, prop1': function f6(newVal1, newVal2, newVal3){
            actualOrder.push(6)
            expect(newVal1).toBe(this.data.data2)
            expect(newVal2).toBe(undefined)
            expect(newVal3).toBe(this.data.prop1)
          },
        }
      })
      var elem = createElem('data-proxy-observer')
      var actualOrder = null

      actualOrder = []
      elem.setData({
        prop1: '123',
        data1: null
      })
      expect(elem.data.prop1).toBe(123)
      expect(actualOrder).toStrictEqual([6, 0])

      actualOrder = []
      elem.setData({
        data2: {
          arr: [{ sf2: 'b' }]
        }
      })
      expect(actualOrder).toStrictEqual([7, 1, 2, 3, 4, 5, 6])

      actualOrder = []
      elem.setData({
        'data2.arr[0]': {
          sf1: 'a'
        }
      })
      expect(actualOrder).toStrictEqual([7, 2, 3, 4, 5, 6])

      actualOrder = []
      elem.setData({
        'data2.arr[0].sf1': 'a'
      })
      expect(actualOrder).toStrictEqual([7, 2, 3, 4, 6])

      actualOrder = []
      elem.setData({
        'data2.arr[1].sf2': 'b'
      })
      expect(actualOrder).toStrictEqual([7, 2, 3, 4, 6])

      actualOrder = []
      elem.setData({
        prop1: 456,
        'data2.arr[1]': null
      })
      expect(actualOrder).toStrictEqual([7, 2, 3, 4, 6, 0])

      actualOrder = []
      elem.setData({
        'data2.arr[2].sf2': 'b'
      })
      expect(actualOrder).toStrictEqual([7, 2, 3, 6])
    })

    it('should trigger data observers before applied to templates', function(){
      regElem({
        is: 'data-proxy-observer-b',
        template: '<div id="a" prop-a="{{prop1}}">',
        properties: {
          prop1: {
            type: Number,
            value: 123,
            observer: function(){
              actualOrder.push(0)
              expect(elem.data.prop1).toBe(456)
              expect(elem.$.a.getAttribute('prop-a')).toBe('456')
            }
          }
        },
        observers: {
          '**': function(){
            actualOrder.push(1)
            expect(elem.data.prop1).toBe(456)
            expect(elem.$.a.getAttribute('prop-a')).toBe('123')
          }
        }
      })
      var actualOrder = []
      var elem = createElem('data-proxy-observer-b')
      elem.setData({
        prop1: 456
      })
      expect(actualOrder).toStrictEqual([1, 0])
    })

    it('should support setData in observers', function(){
      regElem({
        is: 'data-proxy-observer-c',
        template: '<div id="a" prop-a="{{propA}}" prop-b="{{dataB}}">',
        properties: {
          propA: {
            type: Number,
            value: 0,
            public: true,
            observer: function() {
              actualOrder.push(1)
              expect(this.data.propA).toBe(123)
              expect(this.data.dataB).toBe(456)
              expect(this.$.a.getAttribute('prop-a')).toBe('123')
              expect(this.$.a.getAttribute('prop-b')).toBe('456')
              expect(elem.data.dataE).toBe(true)
            }
          }
        },
        observers: {
          propA: function(propA) {
            if (this.propA === 0) return
            actualOrder.push(6)
            expect(propA).toBe(123)
            this.setData({
              dataB: 456
            })
          }
        }
      })
      regElem({
        is: 'data-proxy-observer-d',
        template: '<data-proxy-observer-c id="a" prop-a="{{propC}}" />',
        properties: {
          propC: {
            type: String,
            value: '0',
            observer: function(){
              actualOrder.push(2)
              expect(this.data.propC).toBe('123')
              expect(this.data.dataD).toBe('DDD')
              expect(elem.data.dataE).toBe(true)
            }
          }
        },
        data: {
          dataF: null,
        },
        observers: {
          dataF: function(){
            actualOrder.push(5)
          },
          dataD: function(){
            expect(elem.data.dataE).toBe(false)
            this.setData({
              propC: '123',
              dataE: true,
              dataF: null,
            })
            actualOrder.push(3)
            expect(elem.data.dataE).toBe(true)
          },
          dataE: function(){
            this.setData({
              dataF: null,
            })
            actualOrder.push(4)
          }
        }
      })
      var actualOrder = []
      var elem = createElem('data-proxy-observer-d')
      elem.setData({
        dataD: 'DDD',
        dataE: false,
        dataF: null,
      })
      expect(actualOrder).toStrictEqual([5, 3, 4, 5, 6, 1, 2])
    })

    it('should treat arrays and objects as the same', function(){
      regElem({
        is: 'data-proxy-observer-obj-arr',
        observers: [{
          fields: 'arr[0]',
          observer: function() {
            actualOrder.push(1)
          }
        }]
      })
      var elem = createElem('data-proxy-observer-obj-arr')
      var actualOrder = null
      actualOrder = []
      elem.setData({
        'arr.0': 1
      })
      expect(actualOrder).toStrictEqual([1])
      actualOrder = []
      elem.setData({
        'arr[0]': 1
      })
      expect(actualOrder).toStrictEqual([1])
    })

    it('should allow multiple listeners on one path', function(){
      var callOrder = []
      var beh = regBeh({
        observers: [{
          fields: 'a',
          observer: 'b1',
        }],
        methods: {
          b1: function(){
            callOrder.push(1)
          }
        },
      })
      regElem({
        is: 'data-proxy-multi-observer-on-field',
        behaviors: [beh],
        observers: {
          a: function(){
            callOrder.push(2)
          }
        },
      })
      var elem = createElem('data-proxy-multi-observer-on-field')
      elem.setData({
        a: 1
      })
      expect(callOrder).toStrictEqual([1, 2])
    })
  })

  it('should support recursive data fields', function(){
    regElem({
      is: 'data-proxy-rec-data-fields',
      options: {
        dataDeepCopy: glassEasel.DeepCopyKind.SimpleWithRecursion,
      },
    })
    var elem = createElem('data-proxy-rec-data-fields')
    var a = {
      b: null,
      c: 1,
    }
    a.b = a
    elem.setData({
      a: a,
    })
    expect(elem.data.a.c).toBe(1)
    expect(elem.data.a.b.c).toBe(1)
    expect(elem.data.a.b.b.c).toBe(1)
  })

  it('should support recursive property fields', function(){
    regElem({
      is: 'data-proxy-rec-data-fields',
      options: {
        dataDeepCopy: glassEasel.DeepCopyKind.SimpleWithRecursion,
        propertyPassingDeepCopy: glassEasel.DeepCopyKind.SimpleWithRecursion,
      },
      properties: {
        a: Object,
      },
    })
    var elem = createElem('data-proxy-rec-data-fields')
    var dataGroup = glassEasel.Component.getDataProxy(elem)
    var a = {
      b: null,
      c: 1,
    }
    a.b = a
    dataGroup.replaceProperty('a', a)
    dataGroup.applyDataUpdates()
    expect(elem.data.a.c).toBe(1)
    expect(elem.data.a.b.c).toBe(1)
    expect(elem.data.a.b.b.c).toBe(1)
  })

  it('should support attributes reflection and ID prefixes', function(){
    regElem({
      is: 'data-proxy-data-reflect-child',
      options: {
        reflectToAttributes: true,
      },
      properties: {
        pA: {
          type: String,
          reflectIdPrefix: true,
        },
        pB: Number,
      },
    })
    regElem({
      is: 'data-proxy-data-reflect-parent',
      options: {
        idPrefixGenerator: function(){
          return 'rid'
        },
      },
      template: '<data-proxy-data-reflect-child id="a" p-a="123" p-b="456" />'
    })
    var elem = createElem('data-proxy-data-reflect-parent')
    var child = elem.$.a
    expect(child.data.pA).toBe('123')
    expect(child.$$.getAttribute('p-a')).toBe('rid--123')
    expect(child.data.pB).toBe(456)
    expect(child.$$.getAttribute('p-b')).toBe('456')
  })
  
})
