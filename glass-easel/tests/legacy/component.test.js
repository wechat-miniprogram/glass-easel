/* eslint-disable */

const { tmpl, domBackend, shadowBackend, execWithWarn, composedBackend, getCustomExternalTemplateEngine } = require('../base/env')
const glassEasel = require('../../src')


const testCases = function (testBackend) {
  const componentSpace = new glassEasel.ComponentSpace(
    undefined,
    undefined,
    glassEasel.getDefaultComponentSpace().styleScopeManager,
  )
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
    return glassEasel.Component.createWithContext(is || 'test', def, backend || testBackend)
  }

  describe('#register', function () {
    it('should be able to register component', function () {
      regElem({
        is: 'component-a',
      })
      var elem = createElem('component-a')
      expect(elem).toBeInstanceOf(glassEasel.Element)
      expect(elem.is).toBe('component-a')
    })

    it('should construct typed properties and JSON-compatible data', function () {
      regElem({
        is: 'component-b',
        options: {
          writeFieldsToNode: true,
          lazyRegistration: false,
        },
        properties: {
          a: String,
          b: Number,
          c: Boolean,
          d: Object,
          e: Array,
          f: Function,
          y: Date,
          z: null,
        },
        data: {
          g: {
            h: 1,
          },
        },
      })
      var elem = createElem('component-b')
      var elem2 = createElem('component-b')
      expect(elem.a).toBe('')
      expect(elem.b).toBe(0)
      expect(elem.c).toBe(false)
      expect(elem.d).toBe(null)
      expect(elem.e).toStrictEqual([])
      expect(typeof elem.f).toBe('function')
      expect(elem.y).toBe(null)
      expect(elem.z).toBe(null)
      elem.a = 123
      elem.b = '4.5'
      elem.c = {}
      elem.d = []
      elem.e = ['bbb']
      elem.f = function () {}
      expect(elem.a).toBe('123')
      expect(elem.b).toBe(4.5)
      expect(elem.c).toBe(true)
      expect(elem.d).toStrictEqual([])
      expect(elem.e).toStrictEqual(['bbb'])
      expect(typeof elem.f).toBe('function')
      elem.y = 12
      expect(elem.y).toBe(12)
      elem.y = '4.0'
      expect(elem.y).toBe('4.0')
      elem.y = undefined
      expect(elem.y).toBe(null)
      elem.z = 12
      expect(elem.z).toBe(12)
      elem.z = '4.0'
      expect(elem.z).toBe('4.0')
      elem.z = undefined
      expect(elem.z).toBe(null)
      expect(elem.data.g).toStrictEqual({ h: 1 })
      elem.data = { g: { h: 2 } }
      expect(elem.data.g).toStrictEqual({ h: 2 })
      expect(elem2.data.g).toStrictEqual({ h: 1 })
    })

    it('should construct string-typed properties and JSON-compatible data', function () {
      regElem({
        is: 'component-b-string',
        options: {
          writeFieldsToNode: true,
          lazyRegistration: false,
        },
        properties: {
          a: 'string',
          b: 'number',
          c: 'boolean',
          d: 'object',
          e: 'array',
          f: 'function',
          y: 'date',
          z: null,
        },
        data: {
          g: {
            h: 1,
          },
        },
      })
      var elem = createElem('component-b')
      var elem2 = createElem('component-b')
      expect(elem.a).toBe('')
      expect(elem.b).toBe(0)
      expect(elem.c).toBe(false)
      expect(elem.d).toBe(null)
      expect(elem.e).toStrictEqual([])
      expect(typeof elem.f).toBe('function')
      expect(elem.y).toBe(null)
      expect(elem.z).toBe(null)
      elem.a = 123
      elem.b = '4.5'
      elem.c = {}
      elem.d = []
      elem.e = ['bbb']
      elem.f = function () {}
      expect(elem.a).toBe('123')
      expect(elem.b).toBe(4.5)
      expect(elem.c).toBe(true)
      expect(elem.d).toStrictEqual([])
      expect(elem.e).toStrictEqual(['bbb'])
      expect(typeof elem.f).toBe('function')
      elem.y = 12
      expect(elem.y).toBe(12)
      elem.y = '4.0'
      expect(elem.y).toBe('4.0')
      elem.y = undefined
      expect(elem.y).toBe(null)
      elem.z = 12
      expect(elem.z).toBe(12)
      elem.z = '4.0'
      expect(elem.z).toBe('4.0')
      elem.z = undefined
      expect(elem.z).toBe(null)
      expect(elem.data.g).toStrictEqual({ h: 1 })
      elem.data = { g: { h: 2 } }
      expect(elem.data.g).toStrictEqual({ h: 2 })
      expect(elem2.data.g).toStrictEqual({ h: 1 })
    })

    it('should construct string-sub-typed properties and JSON-compatible data', function () {
      regElem({
        is: 'component-b-string',
        options: {
          writeFieldsToNode: true,
          lazyRegistration: false,
        },
        properties: {
          a: { type: 'string' },
          b: { type: 'number' },
          c: { type: 'boolean' },
          d: { type: 'object' },
          e: { type: 'array' },
          f: { type: 'function' },
          y: { type: 'date' },
          z: { type: null },
        },
        data: {
          g: {
            h: 1,
          },
        },
      })
      var elem = createElem('component-b')
      var elem2 = createElem('component-b')
      expect(elem.a).toBe('')
      expect(elem.b).toBe(0)
      expect(elem.c).toBe(false)
      expect(elem.d).toBe(null)
      expect(elem.e).toStrictEqual([])
      expect(typeof elem.f).toBe('function')
      expect(elem.y).toBe(null)
      expect(elem.z).toBe(null)
      elem.a = 123
      elem.b = '4.5'
      elem.c = {}
      elem.d = []
      elem.e = ['bbb']
      elem.f = function () {}
      expect(elem.a).toBe('123')
      expect(elem.b).toBe(4.5)
      expect(elem.c).toBe(true)
      expect(elem.d).toStrictEqual([])
      expect(elem.e).toStrictEqual(['bbb'])
      expect(typeof elem.f).toBe('function')
      elem.y = 12
      expect(elem.y).toBe(12)
      elem.y = '4.0'
      expect(elem.y).toBe('4.0')
      elem.y = undefined
      expect(elem.y).toBe(null)
      elem.z = 12
      expect(elem.z).toBe(12)
      elem.z = '4.0'
      expect(elem.z).toBe('4.0')
      elem.z = undefined
      expect(elem.z).toBe(null)
      expect(elem.data.g).toStrictEqual({ h: 1 })
      elem.data = { g: { h: 2 } }
      expect(elem.data.g).toStrictEqual({ h: 2 })
      expect(elem2.data.g).toStrictEqual({ h: 1 })
    })

    it('should support default value generator', function () {
      const f = function () {}
      regElem({
        is: 'component-property-default',
        properties: {
          a: {
            type: String,
            default: function () {
              return 'def'
            },
          },
          b: {
            type: Number,
            default: function () {
              return 456
            },
          },
          c: {
            type: Boolean,
            default: function () {
              return true
            },
          },
          d: {
            type: Object,
            default: function () {
              return { obj: null }
            },
          },
          e: {
            type: Array,
            default: function () {
              return [null]
            },
          },
          f: {
            type: Function,
            default: function () {
              return f
            },
          },
          g: {
            type: null,
            default: function () {
              return 789
            },
          },
        },
      })
      var elem = createElem('component-property-default')
      expect(elem.data.a).toBe('def')
      expect(elem.data.b).toBe(456)
      expect(elem.data.c).toBe(true)
      expect(elem.data.d).toStrictEqual({ obj: null })
      expect(elem.data.e).toStrictEqual([null])
      expect(elem.data.f).toBe(f)
      expect(elem.data.g).toBe(789)
      elem.setData({
        a: '',
        b: 0,
        c: false,
        d: null,
        e: [],
        f: function () {
          return 123
        },
        g: null,
      })
      expect(elem.data.a).toBe('')
      expect(elem.data.b).toBe(0)
      expect(elem.data.c).toBe(false)
      expect(elem.data.d).toStrictEqual(null)
      expect(elem.data.e).toStrictEqual([])
      expect(elem.data.f()).toBe(123)
      expect(elem.data.g).toBe(null)
      execWithWarn(5, function () {
        elem.setData({
          a: null,
          b: 'abc',
          c: undefined,
          d: false,
          e: {},
          f: 123,
          g: undefined,
        })
      })
      expect(elem.data.a).toBe('def')
      expect(elem.data.b).toBe(456)
      expect(elem.data.c).toBe(false)
      expect(elem.data.d).toStrictEqual({ obj: null })
      expect(elem.data.e).toStrictEqual([null])
      expect(elem.data.f).toBe(f)
      expect(elem.data.g).toBe(789)
    })

    it('should support optional types (number and boolean)', function () {
      regElem({
        is: 'component-optional-types',
        properties: {
          a: {
            type: String,
            optionalTypes: [Number, Boolean],
            value: false,
          },
          b: {
            optionalTypes: ['boolean', 'number'],
          },
        },
      })
      var elem = createElem('component-optional-types')
      elem.setData({ a: '1' })
      expect(elem.data.a).toBe('1')
      elem.setData({ a: 1 })
      expect(elem.data.a).toBe(1)
      elem.setData({ a: false, b: -1.2 })
      expect(elem.data.a).toBe(false)
      expect(elem.data.b).toBe(-1.2)
      elem.setData({ b: true })
      expect(elem.data.b).toBe(true)
      elem.setData({ b: '1' })
      expect(elem.data.b).toBe(true)
      elem.setData({ b: '' })
      expect(elem.data.b).toBe(false)
    })

    it('should support optional types (string)', function () {
      regElem({
        is: 'component-optional-types-string',
        properties: {
          a: {
            type: Number,
            optionalTypes: [String],
            value: 'abc',
          },
        },
      })
      var elem = createElem('component-optional-types-string')
      expect(elem.data.a).toBe('abc')
      elem.setData({ a: '1' })
      expect(elem.data.a).toBe('1')
      elem.setData({ a: 1 })
      expect(elem.data.a).toBe(1)
    })

    it('should support optional types (function)', function () {
      regElem({
        is: 'component-optional-types-function',
        properties: {
          a: {
            type: Number,
            optionalTypes: [Function],
            value: function () {},
          },
        },
      })
      var elem = createElem('component-optional-types-function')
      expect(typeof elem.data.a).toBe('function')
      elem.setData({ a: function () {} })
      expect(typeof elem.data.a).toBe('function')
      elem.setData({ a: 1 })
      expect(elem.data.a).toBe(1)
    })

    it('should support optional types (object)', function () {
      regElem({
        is: 'component-optional-types-obj',
        properties: {
          a: {
            type: Number,
            optionalTypes: [Object],
            value: { b: 1 },
          },
        },
      })
      var elem = createElem('component-optional-types-obj')
      expect(elem.data.a).toStrictEqual({ b: 1 })
      elem.setData({ a: { b: 2 } })
      expect(elem.data.a).toStrictEqual({ b: 2 })
      elem.setData({ a: 1 })
      expect(elem.data.a).toBe(1)
    })

    it('should support optional types (array)', function () {
      regElem({
        is: 'component-optional-types-arr',
        properties: {
          a: {
            type: Number,
            optionalTypes: [Array],
            value: [1, 2],
          },
        },
      })
      var elem = createElem('component-optional-types-arr')
      expect(elem.data.a).toStrictEqual([1, 2])
      elem.setData({ a: [3] })
      expect(elem.data.a).toStrictEqual([3])
      elem.setData({ a: 1 })
      expect(elem.data.a).toBe(1)
    })

    it('should call methods with proper arguments (method name binding)', function () {
      var callOrder = []
      regElem({
        is: 'component-c',
        template: '<span id="a" attr-a="{{prop1}}"></span> <slot></slot>',
        properties: {
          prop1: {
            type: String,
            value: 'OLD',
            observer: 'func2',
          },
        },
        listeners: {
          'a.tap': 'func3',
        },
        methods: {
          func2: function F2(newVal, oldVal) {
            callOrder.push('F2')
            expect(this).toBe(elem)
            expect(oldVal).toBe('OLD')
            expect(newVal).toBe('1')
          },
          func3: function F3() {
            callOrder.push('F3')
            expect(this).toBe(elem)
          },
        },
      })
      var elem = createElem('component-c')
      expect(elem.func2.name).toBe('F2')
      expect(elem.func3.name).toBe('F3')
      expect(elem.prop1).toBe('OLD')
      expect(elem.$.a.$$.getAttribute('attr-a')).toBe('OLD')
      expect(elem.$.a.getAttribute('attr-a')).toBe('OLD')
      elem.prop1 = 1
      expect(elem.prop1).toBe('1')
      expect(elem.$.a.$$.getAttribute('attr-a')).toBe('1')
      expect(elem.$.a.getAttribute('attr-a')).toBe('1')
      glassEasel.triggerEvent(elem.$.a, 'tap', {}, { bubbles: true, composed: true })
      expect(callOrder).toStrictEqual(['F2', 'F3'])
    })

    it('should call methods with proper arguments (function binding)', function () {
      var callOrder = []
      regElem({
        is: 'component-d',
        template: '<span id="a" attr-a="{{prop1}}"></span> <slot></slot>',
        properties: {
          prop1: {
            type: String,
            value: 'OLD',
            observer: function (newVal, oldVal) {
              expect(newVal).toBe('NEW')
              expect(oldVal).toBe('OLD')
              callOrder.push(1)
            },
          },
        },
        listeners: {
          'a.tap': function () {
            callOrder.push(2)
          },
        },
      })
      var elem = createElem('component-d')
      expect(elem.prop1).toBe('OLD')
      elem.prop1 = 'NEW'
      expect(elem.prop1).toBe('NEW')
      glassEasel.triggerEvent(elem.$.a, 'tap', {}, { bubbles: true, composed: true })
      expect(callOrder).toStrictEqual([1, 2])
    })

    it('should call property observers', function () {
      var callArgs = []
      regElem({
        is: 'component-property-observer',
        properties: {
          obj: {
            type: Object,
            observer: function (newVal, oldVal) {
              callArgs.push(['obj', newVal, oldVal])
            },
          },
          str: {
            type: String,
            observer: function (newVal, oldVal) {
              callArgs.push(['str', newVal, oldVal])
            },
          },
          arr: {
            type: Array,
            observer: function (newVal, oldVal) {
              callArgs.push(['arr', newVal, oldVal])
            },
          },
        },
      })
      var elem = createElem('component-property-observer')
      elem.setData({
        obj: { f1: 1, f2: [{ f3: false }] },
      })
      expect(callArgs.shift()).toStrictEqual(['obj', { f1: 1, f2: [{ f3: false }] }, null])
      elem.setData({
        'obj.f2[0].f3': true,
      })
      expect(callArgs.shift()).toStrictEqual(['obj', true, undefined])
      elem.setData({
        'obj.f1': 2,
        'arr[0]': 'b',
        'obj.f2[1].f3': false,
      })
      expect(callArgs.shift()).toStrictEqual(['obj', 2, undefined])
      expect(callArgs.shift()).toStrictEqual(['arr', 'b', undefined])
      expect(callArgs.shift()).toStrictEqual(['obj', false, undefined])
      expect(elem.data).toStrictEqual({
        obj: { f1: 2, f2: [{ f3: true }, { f3: false }] },
        str: '',
        arr: ['b'],
      })
      elem.setData({
        obj: elem.data.obj,
        str: elem.data.str,
        arr: elem.data.arr,
      })
      expect(callArgs.length).toBe(0)
    })
  })

  describe('#create', function () {
    it('should has a default component', function () {
      var elem = createElem('')
      expect(elem).toBeInstanceOf(glassEasel.Element)
      expect(elem.is).toBe('')
      if (testBackend === domBackend) {
        expect(elem.$$).toBeInstanceOf(window.HTMLElement)
      }
    })

    it('should call lifetime methods', function () {
      var callOrder = []
      regElem({
        is: 'component-e',
        template: '<slot></slot>',
        created: function () {
          expect(this).toBeInstanceOf(glassEasel.Element)
          callOrder.push('c')
        },
        attached: function () {
          expect(this).toBeInstanceOf(glassEasel.Element)
          callOrder.push('a')
        },
        detached: function () {
          expect(this).toBeInstanceOf(glassEasel.Element)
          callOrder.push('d')
        },
      })
      var elem = createElem('component-e')
      var root = createElem('root')
      root.appendChild(elem)
      expect(callOrder).toStrictEqual(['c'])
      root.$$.id = 'root'
      glassEasel.Element.pretendAttached(root)
      expect(callOrder).toStrictEqual(['c', 'a'])
      root.removeChild(elem)
      expect(callOrder).toStrictEqual(['c', 'a', 'd'])
    })

    it('should be able to prevent event bubbling out', function () {
      var callOrder = []
      regElem({
        is: 'component-f',
        listeners: {
          customevent: 'prevent',
        },
        methods: {
          prevent: function () {
            callOrder.push('a')
            return false
          },
        },
      })
      var elem = createElem('component-f')
      var root = createElem('root')
      root.appendChild(elem)
      elem.addListener('customevent', function () {
        callOrder.push('b')
      })
      glassEasel.Element.pretendAttached(root)
      elem.shadowRoot.triggerEvent('customevent', undefined, { bubbles: true })
      expect(callOrder).toStrictEqual(['a'])
    })
  })

  describe('#hasProperty #hasPublicProperty', function () {
    it('should be able to detect properties', function () {
      regElem({
        is: 'component-g',
        properties: {
          a: String,
          b: {
            type: String,
          },
        },
      })
      var elem = createElem('component-g')
      expect(glassEasel.Component.hasProperty(elem, 'a')).toBe(true)
      expect(glassEasel.Component.hasProperty(elem, 'b')).toBe(true)
      expect(glassEasel.Component.hasProperty(elem, 'c')).toBe(false)
    })
  })

  describe('#setData #data', function () {
    it('should be able to update data and properties', function () {
      var callOrder = []
      regElem({
        is: 'component-data-update',
        template: '<span id="a" attr-a="{{da}}"></span> <span id="b" attr-b="{{db}}"></span>',
        properties: {
          db: {
            type: String,
            value: 'OLD',
            observer: function () {
              callOrder.push(1)
            },
          },
          dc: {
            type: String,
            observer: function () {
              callOrder.push(2)
            },
          },
          dd: {
            type: Number,
            value: 0,
            observer: function () {
              callOrder.push(3)
            },
            observeAssignments: true,
          },
        },
        data: {
          da: 1,
        },
      })
      var elem = createElem('component-data-update')
      expect(elem.data.da).toBe(1)
      expect(elem.db).toBe('OLD')
      elem.setData({
        da: 2,
        dc: '...',
        db: 'NEW',
        dd: 0,
      })
      expect(callOrder).toStrictEqual([2, 1])
      expect(elem.data.da).toBe(2)
      expect(elem.db).toBe('NEW')
      expect(elem.dc).toBe('...')
      expect(elem.$.b.$$.getAttribute('attr-b')).toBe('NEW')
      expect(elem.$.b.getAttribute('attr-b')).toBe('NEW')
    })

    it('should be able to apply to template', function () {
      regElem({
        is: 'component-attr-a',
        template: '<span id="a" attr-a="{{da}}"></span>',
        data: {
          da: 1,
        },
      })
      var elem = createElem('component-attr-a')
      expect(elem.data.da).toBe(1)
      expect(elem.$.a.$$.getAttribute('attr-a')).toBe('1')
      expect(elem.$.a.getAttribute('attr-a')).toBe(1)
      elem.data = { da: 2 }
      expect(elem.data.da).toBe(2)
      expect(elem.$.a.$$.getAttribute('attr-a')).toBe('2')
      expect(elem.$.a.getAttribute('attr-a')).toBe(2)
    })

    it('should reflect to attributes', function () {
      regElem({
        is: 'component-reflect-attr-a',
        properties: {
          a1: String,
        },
      })
      regElem({
        is: 'component-reflect-attr-b',
        options: {
          reflectToAttributes: true,
        },
        properties: {
          a1: String,
          a2: Boolean,
          a3: Object,
          a4: null,
        },
      })
      var elem1 = createElem('component-reflect-attr-a')
      elem1.a1 = 'A'
      expect(elem1.$$.getAttribute('a1')).toBe(null)
      var elem2 = createElem('component-reflect-attr-b')
      expect(elem2.$$.getAttribute('a1')).toBe(null)
      expect(elem2.$$.getAttribute('a2')).toBe(null)
      expect(elem2.$$.getAttribute('a3')).toBe(null)
      expect(elem2.$$.getAttribute('a4')).toBe(null)
      elem2.setData({
        a1: '',
        a2: true,
        a3: {},
        a4: [1, 'a'],
      })
      expect(elem2.$$.getAttribute('a1')).toBe('')
      expect(elem2.$$.getAttribute('a2')).toBe('')
      expect(elem2.$$.getAttribute('a3')).toBe('{}')
      expect(elem2.$$.getAttribute('a4')).toBe('[1,"a"]')
      elem2.a2 = false
      expect(elem2.$$.getAttribute('a2')).toBe(null)
      elem2.a3 = null
      expect(elem2.$$.getAttribute('a3')).toBe('null')
    })

    it('should parse path string correctly', function () {
      regElem({
        is: 'component-data-parse',
        data: {
          arr: [1, 2, 3],
          'o.b.j': {},
        },
      })
      var elem = createElem('component-data-parse')
      elem.setData({
        'arr[1]': 'A',
        'arr\\[1\\]': 'B',
        'o.b.j.\\\\': 'C',
        'o\\.b\\.j.a': [],
        'o\\.b\\.j.a[1]': 'D',
        'o\\.b\\.j.a[0]': 'DD',
        '\\\\.\\\\': 'E',
      })
      expect(elem.data).toStrictEqual({
        arr: [1, 'A', 3],
        'arr[1]': 'B',
        o: {
          b: {
            j: { '\\': 'C' },
          },
        },
        'o.b.j': {
          a: ['DD', 'D'],
        },
        '\\': {
          '\\': 'E',
        },
      })
    })
  })

  it('should be able to catch exceptions', function () {
    var oldConsoleError = console.error
    console.error = function () {}

    var waitingEvents = 3
    var elem = null
    var id = glassEasel.addGlobalErrorListener(function (e, info) {
      if (waitingEvents === 0) {
        return true
      }
      expect(Number(e.message)).toBe(waitingEvents)
      waitingEvents--
      return false
    })
    var def = regElem({
      is: 'component-h',
      template: '<div attr-a="{{a}}"></div>',
      properties: {
        a: {
          type: String,
          observer: '_observer',
        },
      },
      listeners: {
        customevent: '_listener',
      },
      created: function () {
        throw new Error('3')
      },
      methods: {
        _observer: function () {
          throw new Error('2')
        },
        _listener: function () {
          throw new Error('1')
        },
      },
    })
    elem = createElem('component-h')
    elem.a = 'a'
    elem.shadowRoot.triggerEvent('customevent')

    console.error = oldConsoleError
    var hasError = false
    try {
      elem.a = 'b'
    } catch (e) {
      hasError = true
    }
    expect(hasError).toBe(true)
    expect(waitingEvents).toBe(0)
    glassEasel.removeGlobalErrorListener(id)
  })

  it('should call error lifetimes', function () {
    var oldConsoleError = console.error
    console.error = function () {}
    glassEasel.globalOptions.throwGlobalError = false

    var errorCalled = 0
    var errorObj = null
    regElem({
      is: 'component-error-lifetimes-a',
      template: '<div></div>',
      lifetimes: {
        created: function (e) {
          throw new Error('created')
        },
        attached: function (e) {
          throw new Error('attached')
        },
        error: function (e) {
          errorCalled++
          errorObj = e
        },
      },
    })
    const elem = createElem('component-error-lifetimes-a')

    expect(errorCalled).toBe(1)
    expect(errorObj.message).toBe('created')
    glassEasel.Element.pretendAttached(elem)
    expect(errorCalled).toBe(2)
    expect(errorObj.message).toBe('attached')
    console.error = oldConsoleError
    glassEasel.globalOptions.throwGlobalError = true
  })

  describe('#ownerShadowRoot', function () {
    beforeAll(function () {
      regElem({
        is: 'component-i',
        template: '<span id="a"></span> <slot></slot>',
      })
      regElem({
        is: 'component-j',
        template: '<component-i id="b"></component-i> <slot></slot>',
      })
    })

    it('should point to the shadow root with correct id manipulation', function () {
      var elem = createElem('component-j')
      expect(elem.ownerShadowRoot).toBe(null)
      expect(elem.shadowRoot.ownerShadowRoot).toBe(elem.shadowRoot)
      expect(elem.$.b.ownerShadowRoot).toBe(elem.shadowRoot)
      expect(elem.$.b.shadowRoot.ownerShadowRoot).toBe(elem.$.b.shadowRoot)
      expect(elem.$.b.$.a.ownerShadowRoot).toBe(elem.$.b.shadowRoot)
      var removedChild = elem.$.b
      elem.shadowRoot.removeChild(elem.$.b)
      expect(removedChild.ownerShadowRoot).toBe(elem.shadowRoot)
      expect(elem.$.a).toBe(undefined)
      expect(elem.$.b).toBe(undefined)
    })

    it('should update id cache when needed', function () {
      var elem = createElem('component-j')
      expect(elem.$.b.$.a.ownerShadowRoot).toBe(elem.$.b.shadowRoot)
      elem.$.b.$.a.id = 'c'
      expect(elem.$.b.$.c.ownerShadowRoot).toBe(elem.$.b.shadowRoot)
      expect(elem.$.b.$.a).toBe(undefined)
    })
  })

  describe('#classList', function () {
    beforeAll(function () {
      regBeh({
        is: 'component-class-beh',
      })
      regElem({
        is: 'component-class-a',
        options: {
          styleScope: componentSpace.styleScopeManager.register('component-class-a'),
        },
        behaviors: ['component-class-beh'],
        template: '<span id="a" class="aa"></span>',
      })
      regElem({
        is: 'component-class-b',
        options: {
          styleScope: componentSpace.styleScopeManager.register('component-class-b'),
          extraStyleScope: glassEasel.StyleScopeManager.globalScope(),
        },
        behaviors: ['component-class-beh'],
        template: '<span id="b" class="bb"></span>',
      })
      regElem({
        is: 'component-class-c',
        options: {
          styleScope: componentSpace.styleScopeManager.register('component-class-c'),
          extraStyleScope: componentSpace.styleScopeManager.register('component-class-cc'),
        },
        behaviors: ['component-class-beh'],
        template: '<span id="c" class="cc"></span>',
      })
    })

    it('should allow setting classes', function () {
      var elem = createElem('component-class-a')
      expect(elem.$.a.classList.contains('aa')).toBe(true)
      expect(elem.$.a.classList.contains('component-class-a--aa')).toBe(false)
      expect(elem.$.a.class).toBe('aa')
      expect(elem.$.a.$$.getAttribute('class')).toBe('component-class-a--aa')
      elem.$.a.classList.toggle('aa')
      elem.$.a.classList.toggle('a-a')
      expect(elem.$.a.class).toBe('a-a')
      expect(elem.$.a.classList.contains('aa')).toBe(false)
      expect(elem.$.a.classList.contains('a-a')).toBe(true)
      expect(elem.$.a.$$.getAttribute('class')).toBe('component-class-a--a-a')
      elem.$.a.classList.toggle('aa', false)
      elem.$.a.classList.toggle('a-a', true)
      expect(elem.$.a.class).toBe('a-a')
      expect(elem.$.a.classList.contains('aa')).toBe(false)
      expect(elem.$.a.classList.contains('a-a')).toBe(true)
      expect(elem.$.a.$$.getAttribute('class')).toBe('component-class-a--a-a')
      elem.$.a.classList.setClassNames(['aa', 'a-a'])
      expect(elem.$.a.class).toBe('aa a-a')
      expect(elem.$.a.classList.contains('aa')).toBe(true)
      expect(elem.$.a.classList.contains('a-a')).toBe(true)
      expect(elem.$.a.$$.getAttribute('class')).toBe('component-class-a--a-a component-class-a--aa')
    })

    it('should allow setting classes with extra global style scope', function () {
      var elem = createElem('component-class-b')
      expect(elem.$.b.classList.contains('bb')).toBe(true)
      expect(elem.$.b.classList.contains('component-class-b--bb')).toBe(false)
      expect(elem.$.b.class).toBe('bb')
      expect(elem.$.b.$$.getAttribute('class')).toBe('bb component-class-b--bb')
      elem.$.b.classList.toggle('bb')
      elem.$.b.classList.toggle('b-b')
      expect(elem.$.b.class).toBe('b-b')
      expect(elem.$.b.classList.contains('bb')).toBe(false)
      expect(elem.$.b.classList.contains('b-b')).toBe(true)
      expect(elem.$.b.$$.getAttribute('class')).toBe('b-b component-class-b--b-b')
      elem.$.b.classList.toggle('bb', false)
      elem.$.b.classList.toggle('b-b', true)
      expect(elem.$.b.class).toBe('b-b')
      expect(elem.$.b.classList.contains('bb')).toBe(false)
      expect(elem.$.b.classList.contains('b-b')).toBe(true)
      expect(elem.$.b.$$.getAttribute('class')).toBe('b-b component-class-b--b-b')
    })

    it('should allow setting classes with extra style scope', function () {
      var elem = createElem('component-class-c')
      expect(elem.$.c.classList.contains('cc')).toBe(true)
      expect(elem.$.c.classList.contains('component-class-c--cc')).toBe(false)
      expect(elem.$.c.class).toBe('cc')
      expect(elem.$.c.$$.getAttribute('class')).toBe('component-class-cc--cc component-class-c--cc')
      elem.$.c.classList.toggle('cc')
      elem.$.c.classList.toggle('c-c')
      expect(elem.$.c.class).toBe('c-c')
      expect(elem.$.c.classList.contains('cc')).toBe(false)
      expect(elem.$.c.classList.contains('c-c')).toBe(true)
      expect(elem.$.c.$$.getAttribute('class')).toBe('component-class-cc--c-c component-class-c--c-c')
      elem.$.c.classList.toggle('cc', false)
      elem.$.c.classList.toggle('c-c', true)
      expect(elem.$.c.class).toBe('c-c')
      expect(elem.$.c.classList.contains('cc')).toBe(false)
      expect(elem.$.c.classList.contains('c-c')).toBe(true)
      expect(elem.$.c.$$.getAttribute('class')).toBe('component-class-cc--c-c component-class-c--c-c')
    })

    it('should be able to disable class prefix', function () {
      regElem({
        is: 'component-class-prefix-empty',
        behaviors: ['component-class-beh'],
        template: '<span id="c" class="cc"></span>',
      })
      var elem = createElem('component-class-prefix-empty')
      var elem2 = elem.shadowRoot.createComponent('component-class-b')
      elem2.class = 'bb'
      expect(elem.$.c.classList.contains('cc')).toBe(true)
      expect(elem.$.c.classList.contains('bb')).toBe(false)
      expect(elem.$.c.classList.contains('component-class-beh--cc')).toBe(false)
      expect(elem.$.c.classList.contains('component-class-owner-attr--cc')).toBe(false)
      expect(elem.$.c.class).toBe('cc')
      if (glassEasel.globalOptions.documentBackend === 'dom') {
        expect(elem.$.c.$$.getAttribute('class')).toBe('cc')
        expect(elem2.$$.getAttribute('class')).toBe('bb')
      }
      elem.$.c.appendChild(elem2)
      expect(elem2.classList.contains('cc')).toBe(false)
      expect(elem2.classList.contains('bb')).toBe(true)
      expect(elem2.classList.contains('component-class-beh--bb')).toBe(false)
      expect(elem2.classList.contains('component-class-owner-attr--bb')).toBe(false)
      expect(elem2.classList.contains('component-class-b--bb')).toBe(false)
      expect(elem2.class).toBe('bb')
      if (glassEasel.globalOptions.documentBackend === 'dom') {
        expect(elem2.$$.getAttribute('class')).toBe('bb')
      }
      elem.$.c.removeChild(elem2)
      expect(elem2.classList.contains('cc')).toBe(false)
      expect(elem2.classList.contains('bb')).toBe(true)
      expect(elem2.classList.contains('component-class-beh--bb')).toBe(false)
      expect(elem2.classList.contains('component-class-owner-attr--bb')).toBe(false)
      expect(elem2.classList.contains('component-class-b--bb')).toBe(false)
      expect(elem2.class).toBe('bb')
      if (glassEasel.globalOptions.documentBackend === 'dom') {
        expect(elem2.$$.getAttribute('class')).toBe('bb')
      }
    })

    it('should support special class prefix', function () {
      regElem({
        is: 'component-class-special-prefix-a',
        options: {
          styleScope: componentSpace.styleScopeManager.register('a'),
        },
        template: '<span id="a" class="a ^a1 ^^a2 ^^^a3 ^^^^a4 ~a5"></span>',
      })
      regElem({
        is: 'component-class-special-prefix-b',
        options: {
          styleScope: componentSpace.styleScopeManager.register('b'),
          extraStyleScope: glassEasel.StyleScopeManager.globalScope(),
        },
        template: '<component-class-special-prefix-a id="b" class="b ^b1 ^^b2 ^^^b3 ~b4" />',
      })
      regElem({
        is: 'component-class-special-prefix-c',
        options: {
          styleScope: componentSpace.styleScopeManager.register('c'),
        },
        template: '<component-class-special-prefix-b id="c" class="c ^c1 ^^c2 ~c3" />',
      })
      var elem = createElem('component-class-special-prefix-c')
      expect(elem.$.c.class).toBe('c ^c1 ^^c2 ~c3')
      expect(elem.$.c.$$.getAttribute('class')).toBe('c--c c--c1 c--c2 c--c3')
      expect(elem.$.c.shadowRoot.querySelector('.b2').$$.getAttribute('class')).toBe(
        'b b--b c--b1 c--b2 c--b3 c--b4',
      )
      expect(elem.$.c.$.b.shadowRoot.querySelector('.a2').$$.getAttribute('class')).toBe(
        'a--a b--a1 c--a2 c--a3 c--a4 c--a5',
      )
      expect(elem.$.c.$.b.$.a.$$.getAttribute('class')).toBe('a--a b--a1 c--a2 c--a3 c--a4 c--a5')
    })

    it('should adding write ID and class prefix info to DOM when required', function () {
      glassEasel.globalOptions.writeExtraInfoToAttr = true
      regElem({
        is: 'component-class-dom-id',
        options: {
          writeIdToDOM: true,
        },
        template: '<span id="a" class="aa"></span>',
      })
      var elem = createElem('component-class-dom-id')
      var elem2 = elem.shadowRoot.createComponent('component-class-b')
      elem2.id = '22'
      elem2.class = 'bb'
      expect(elem2.classList.contains('cc')).toBe(false)
      expect(elem2.classList.contains('bb')).toBe(true)
      if (glassEasel.globalOptions.documentBackend === 'dom') {
        expect(elem.$.a.$$.getAttribute('glassEasel:info-class-prefix')).toBe(
          'component-class-dom-id--',
        )
        expect(elem2.$$.getAttribute('class')).toBe('component-class-dom-id--bb')
        expect(elem2.$$.id).toBe('22')
      }
      elem.$.a.appendChild(elem2)
      expect(elem2.classList.contains('cc')).toBe(false)
      expect(elem2.classList.contains('bb')).toBe(true)
      if (glassEasel.globalOptions.documentBackend === 'dom') {
        expect(elem2.$$.getAttribute('glassEasel:info-class-prefix')).toBe(
          'component-class-dom-id--',
        )
        expect(elem2.$$.getAttribute('class')).toBe('component-class-dom-id--bb')
        expect(elem2.$$.id).toBe('22')
      }
      elem.$.a.removeChild(elem2)
      expect(elem2.classList.contains('cc')).toBe(false)
      expect(elem2.classList.contains('bb')).toBe(true)
      if (glassEasel.globalOptions.documentBackend === 'dom') {
        expect(elem2.$$.getAttribute('glassEasel:info-class-prefix')).toBe(
          'component-class-dom-id--',
        )
        expect(elem2.$$.getAttribute('class')).toBe('component-class-dom-id--bb')
        expect(elem2.$$.id).toBe('22')
      }
    })

    it('should support external classes', function () {
      regElem({
        is: 'component-external-classes-native',
        options: {
          externalComponent: true,
          styleScope: componentSpace.styleScopeManager.register(
            'component-external-classes-native',
          ),
          templateEngine:
            testBackend === domBackend
              ? undefined
              : getCustomExternalTemplateEngine((comp) => {
                  var root = comp.getBackendElement()
                  var slot
                  if (testBackend === shadowBackend) {
                    var shadowRoot = root.getShadowRoot()
                    slot = shadowRoot.createElement('div', 'div')
                    slot.setSlotName('')
                    shadowRoot.appendChild(slot)
                  } else {
                    slot = root
                  }
                  return {
                    root,
                    slot,
                    getIdMap: () => ({}),
                    handleEvent() {},
                    setListener() {},
                  }
                }),
        },
      })
      regElem({
        is: 'component-external-classes-a',
        options: {
          styleScope: componentSpace.styleScopeManager.register('component-external-classes-a'),
        },
        externalClasses: ['A1'],
        template: '<component-external-classes-native id="child" class="static A1" /> <slot />',
      })
      regElem({
        is: 'component-external-classes-b',
        externalClasses: ['B1', 'B2'],
        options: {
          styleScope: componentSpace.styleScopeManager.register('component-external-classes-b'),
        },
        template:
          '<component-external-classes-a id="a1" class="B1" /> <component-external-classes-a id="a2" class="B2 static" />',
      })
      regElem({
        is: 'component-external-classes-c',
        externalClasses: ['C1'],
        options: {
          styleScope: componentSpace.styleScopeManager.register('component-external-classes-c'),
        },
        template: '<component-external-classes-b id="b1" class="C1" />',
      })
      regElem({
        is: 'component-external-classes-d',
        options: {
          styleScope: componentSpace.styleScopeManager.register('component-external-classes-d'),
        },
        template: '<component-external-classes-c id="c1" /> <span id="span" />',
      })
      var elem = createElem('component-external-classes-d')
      expect(elem.$.c1.hasExternalClass('C1')).toBe(true)
      expect(elem.$.c1.hasExternalClass('C123')).toBe(false)

      expect(elem.$.c1.$.b1.$.a1.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static',
      )
      expect(elem.$.c1.$.b1.$.a1.$$.getAttribute('class')).toBe(null)
      expect(elem.$.c1.$.b1.$.a2.$$.getAttribute('class')).toBe(
        'component-external-classes-b--static',
      )
      expect(elem.$.c1.$.b1.$$.getAttribute('class')).toBe(null)
      expect(elem.$.c1.$$.getAttribute('class')).toBe(null)
      elem.$.c1.$.b1.$.a1.setExternalClass('A1', 'B1')
      expect(elem.$.c1.$.b1.$.a1.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static',
      )
      elem.$.c1.$.b1.setExternalClass('B1', 'C1')
      expect(elem.$.c1.$.b1.$.a1.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static',
      )
      expect(elem.$.c1.$.b1.$.a1.$$.getAttribute('class')).toBe(null)
      expect(elem.$.c1.$.b1.$.a2.$$.getAttribute('class')).toBe(
        'component-external-classes-b--static',
      )
      elem.$.c1.setExternalClass('C1', 'AAA')
      expect(elem.$.c1.$.b1.$.a1.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static component-external-classes-d--AAA',
      )
      expect(elem.$.c1.$.b1.$.a1.$$.getAttribute('class')).toBe('component-external-classes-d--AAA')
      expect(elem.$.c1.$.b1.$.a2.$$.getAttribute('class')).toBe(
        'component-external-classes-b--static',
      )
      expect(elem.$.c1.$.b1.$$.getAttribute('class')).toBe('component-external-classes-d--AAA')
      expect(elem.$.c1.$$.getAttribute('class')).toBe(null)

      elem.$.c1.$.b1.$.a2.setExternalClass('A1', 'B2 BBB')
      elem.$.c1.$.b1.setExternalClass('B2', 'C1')
      expect(elem.$.c1.$.b1.$.a1.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static component-external-classes-d--AAA',
      )
      expect(elem.$.c1.$.b1.$.a1.$$.getAttribute('class')).toBe('component-external-classes-d--AAA')
      expect(elem.$.c1.$.b1.$.a2.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static component-external-classes-b--BBB component-external-classes-d--AAA',
      )
      expect(elem.$.c1.$.b1.$.a2.$$.getAttribute('class')).toBe(
        'component-external-classes-b--static component-external-classes-d--AAA',
      )
      expect(elem.$.c1.$.b1.$$.getAttribute('class')).toBe('component-external-classes-d--AAA')

      elem.$.c1.setExternalClass('C1', 'BBB')
      expect(elem.$.c1.$.b1.$.a1.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static component-external-classes-d--BBB',
      )
      expect(elem.$.c1.$.b1.$.a1.$$.getAttribute('class')).toBe('component-external-classes-d--BBB')
      expect(elem.$.c1.$.b1.$.a2.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static component-external-classes-b--BBB component-external-classes-d--BBB',
      )
      expect(elem.$.c1.$.b1.$.a2.$$.getAttribute('class')).toBe(
        'component-external-classes-b--static component-external-classes-d--BBB',
      )
      expect(elem.$.c1.$.b1.$$.getAttribute('class')).toBe('component-external-classes-d--BBB')

      var a3 = elem.$.c1.$.b1.shadowRoot.createNativeNode('div')
      a3.id = 'a3'
      a3.class = null
      expect(a3.class).toBe('')
      a3.class = 'B1 B2'
      expect(a3.$$.getAttribute('class')).toBe('component-external-classes-d--BBB')
      elem.$.c1.$.b1.$.a2.appendChild(a3)
      expect(elem.$.c1.$.b1.$.a3.$$.getAttribute('class')).toBe('component-external-classes-d--BBB')

      elem.$.c1.$.b1.setExternalClass('B2', '~CCC CCCC')
      expect(elem.$.c1.$.b1.$.a1.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static component-external-classes-d--BBB',
      )
      expect(elem.$.c1.$.b1.$.a1.$$.getAttribute('class')).toBe('component-external-classes-d--BBB')
      expect(elem.$.c1.$.b1.$.a2.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static component-external-classes-b--BBB component-external-classes-d--CCC component-external-classes-c--CCCC',
      )
      expect(elem.$.c1.$.b1.$.a2.$$.getAttribute('class')).toBe(
        'component-external-classes-b--static component-external-classes-d--CCC component-external-classes-c--CCCC',
      )
      expect(elem.$.c1.$.b1.$.a3.$$.getAttribute('class')).toBe(
        'component-external-classes-d--BBB component-external-classes-d--CCC component-external-classes-c--CCCC',
      )
      expect(elem.$.c1.$.b1.$$.getAttribute('class')).toBe('component-external-classes-d--BBB')

      elem.$.c1.$.b1.scheduleExternalClassChange('B1', '')
      elem.$.c1.$.b1.scheduleExternalClassChange('B2', '^CCC')
      expect(elem.$.c1.$.b1.$.a1.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static component-external-classes-d--BBB',
      )
      elem.$.c1.$.b1.applyExternalClassChanges()
      expect(elem.$.c1.$.b1.$.a1.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static',
      )
      elem.$.c1.$.b1.applyExternalClassChanges()
      expect(elem.$.c1.$.b1.$.a1.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static',
      )
      expect(elem.$.c1.$.b1.$.a1.$$.getAttribute('class')).toBe('')
      expect(elem.$.c1.$.b1.$.a2.$.child.$$.getAttribute('class')).toBe(
        'component-external-classes-a--static component-external-classes-b--BBB component-external-classes-d--CCC',
      )
      expect(elem.$.c1.$.b1.$.a2.$$.getAttribute('class')).toBe(
        'component-external-classes-b--static component-external-classes-d--CCC',
      )
      expect(elem.$.c1.$.b1.$.a3.$$.getAttribute('class')).toBe('component-external-classes-d--CCC')
      expect(elem.$.c1.$.b1.$$.getAttribute('class')).toBe('component-external-classes-d--BBB')
    })

    afterAll(function () {
      glassEasel.globalOptions.writeExtraInfoToAttr = false
    })
  })

  describe('#setMethodCaller #getMethodCaller', function () {
    it('should allow changing method caller', function () {
      var newCaller = {}
      var callOrder = []
      regElem({
        is: 'component-method-caller',
        template: '<span id="a" attr-a="{{ propA }}" />',
        properties: {
          propA: {
            type: String,
            observer: function () {
              callOrder.push(1)
              expect(this).toBe(newCaller)
            },
          },
        },
        created: function () {
          callOrder.push(2)
          expect(this).not.toBe(newCaller)
          this.setMethodCaller(newCaller)
          expect(this.getMethodCaller()).toBe(newCaller)
        },
        attached: function () {
          callOrder.push(3)
          expect(this).not.toBe(elem)
          expect(this).toBe(newCaller)
        },
        moved: function () {
          callOrder.push(4)
          expect(this).toBe(newCaller)
        },
        detached: function () {
          callOrder.push(5)
          expect(this).toBe(newCaller)
        },
        listeners: {
          'this.eventA': 'funcB',
        },
        methods: {
          funcB: function (e) {
            callOrder.push(6)
            expect(this).toBe(newCaller)
            expect(e.currentTarget).toBe(newCaller)
            expect(e.target).toBe(newCaller)
          },
        },
      })
      var elem = createElem('component-method-caller')
      elem.addListener(
        'eventA',
        function (e) {
          callOrder.push(7)
          expect(this).toBe(newCaller)
          expect(e.currentTarget).toBe(newCaller)
          expect(e.target).toBe(newCaller)
        },
        {
          useCapture: true,
        },
      )
      var observer = glassEasel.Observer.create(function () {
        callOrder.push(8)
        expect(this).toBe(elem)
      })
      observer.observe(elem, {
        attributes: true,
      })
      elem.propA = 'NEW'
      glassEasel.Element.pretendAttached(elem)
      elem.triggerEvent('eventA', null, {
        bubbles: true,
        capturePhase: true,
      })
      elem.triggerLifetime('moved', [])
      glassEasel.Element.pretendDetached(elem)
      expect(callOrder).toStrictEqual([2, 1, 3, 7, 6, 4, 5])
    })

    it('should work with writeFieldsToNode option', function () {
      var methods = {
        funcA: function () {},
      }
      var caller = {}
      regElem({
        is: 'component-write-fields-to-node',
        options: {
          writeFieldsToNode: false,
        },
        properties: {
          propA: String,
        },
        methods: methods,
        created: function () {
          expect(this.propA).toBe(undefined)
          expect(this.funcA).toBe(undefined)
          this.setMethodCaller(caller)
          caller.setData = this.setData.bind(this)
        },
      })
      var elem = createElem('component-write-fields-to-node')
      caller.setData({
        propA: 'A',
      })
      expect(elem.data.propA).toBe('A')
    })
  })

  it('should call page lifetimes successfully', function () {
    var showCallResArr = []
    var hideCallResArr = []
    var customCallResArr = []
    regElem({
      is: 'component-page-lifetimes-a',
      template: '<div><slot></div>',
      pageLifetimes: {
        show: function (args) {
          showCallResArr.push(['pa', args])
        },
        custom: function (args) {
          customCallResArr.push(['pa', args])
        },
        hide: function (args) {
          hideCallResArr.push(['pa', args])
        },
      },
    })
    regElem({
      is: 'component-page-lifetimes-b',
      template:
        '<div><component-page-lifetimes-a><component-page-lifetimes-d></component-page-lifetimes-d></component-page-lifetimes-a></div>',
      pageLifetimes: {
        show: function (args) {
          showCallResArr.push(['pb', args])
        },
        hide: function (args) {
          hideCallResArr.push(['pb', args])
        },
      },
    })
    regElem({
      is: 'component-page-lifetimes-c',
      template:
        '<div><component-page-lifetimes-a></component-page-lifetimes-a><component-page-lifetimes-b id="b"></component-page-lifetimes-b></div>',
      pageLifetimes: {
        show: function (args) {
          showCallResArr.push(['pc', args])
        },
        custom: function (args) {
          customCallResArr.push(['pc', args])
        },
        hide: function (args) {
          hideCallResArr.push(['pc', args])
        },
      },
    })
    regElem({
      is: 'component-page-lifetimes-d',
      template: '<div></div>',
      pageLifetimes: {
        show: function (args) {
          showCallResArr.push(['pd', args])
        },
        custom: function (args) {
          customCallResArr.push(['pd', args])
        },
        hide: function (args) {
          hideCallResArr.push(['pd', args])
        },
      },
    })

    var elem1 = createElem('component-page-lifetimes-c')
    var elem2 = elem1.$.b
    elem1.triggerPageLifetime('show', [{ showProp: 'showValue' }])
    elem2.triggerPageLifetime('hide', [{ hideProp: 'hideValue' }])
    elem1.triggerPageLifetime('custom', [{ customProp: 'customValue' }])

    expect(showCallResArr.length).toBe(5)
    expect(showCallResArr).toStrictEqual([
      ['pc', { showProp: 'showValue' }],
      ['pa', { showProp: 'showValue' }],
      ['pb', { showProp: 'showValue' }],
      ['pa', { showProp: 'showValue' }],
      ['pd', { showProp: 'showValue' }],
    ])
    expect(hideCallResArr.length).toBe(3)
    expect(hideCallResArr).toStrictEqual([
      ['pb', { hideProp: 'hideValue' }],
      ['pa', { hideProp: 'hideValue' }],
      ['pd', { hideProp: 'hideValue' }],
    ])
    expect(customCallResArr.length).toBe(4)
    expect(customCallResArr).toStrictEqual([
      ['pc', { customProp: 'customValue' }],
      ['pa', { customProp: 'customValue' }],
      ['pa', { customProp: 'customValue' }],
      ['pd', { customProp: 'customValue' }],
    ])
  })
}

describe('Component (DOM backend)', function () {
  testCases(domBackend)
})
describe('Component (shadow backend)', function () {
  testCases(shadowBackend)
})
describe('Component (composed backend)', function () {
  testCases(composedBackend)
})
