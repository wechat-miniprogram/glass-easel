/* eslint-disable */

const { tmpl, domBackend } = require('../base/env')
const glassEasel = require('../../src')

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
})
componentSpace.defineComponent({
  is: '',
})

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

describe('Element Iterator', function () {
  beforeAll(function () {
    regElem({
      is: 'element-iterator-simple',
    })
    regElem({
      is: 'element-iterator-native',
      options: {
        externalComponent: true,
      },
      template: '<div id="a"> <div id="b"><slot /></div> </div> <div id="c"></div>',
    })
    regElem({
      is: 'element-iterator-full',
      template:
        '<element-iterator-simple id="d"> <div id="e"><slot /></div> </element-iterator-simple> <div id="f"></div>',
    })
    regElem({
      is: 'element-iterator-combined',
      template:
        '<element-iterator-full id="g"> <element-iterator-native id="h"> TEXT </element-iterator-native> <element-iterator-simple id="i"></element-iterator-simple> </element-iterator-full>',
    })
  })

  it('should support shadow-ancestors traversing', function () {
    var elem = createElem('element-iterator-combined')
    var expectResArr = [elem.$.h.childNodes[0], elem.$.h, elem.$.g, elem.shadowRoot]
    glassEasel.ElementIterator.create(elem.$.h.childNodes[0], 'shadow-ancestors', Object).forEach(
      function (e) {
        expect(e).toBe(expectResArr.shift())
      },
    )
    expect(expectResArr.length).toBe(0)
  })

  it('should support composed-ancestors traversing', function () {
    var elem = createElem('element-iterator-combined')
    var expectResArr = [
      elem.$.h.childNodes[0],
      elem.$.h,
      elem.$.g.$.e.childNodes[0],
      elem.$.g.$.e,
      elem.$.g.$.d.shadowRoot.childNodes[0],
      elem.$.g.$.d.shadowRoot,
      elem.$.g.$.d,
      elem.$.g.shadowRoot,
      elem.$.g,
      elem.shadowRoot,
      elem,
    ]
    glassEasel.ElementIterator.create(elem.$.h.childNodes[0], 'composed-ancestors', Object).forEach(
      function (e) {
        expect(e).toBe(expectResArr.shift())
      },
    )
    expect(expectResArr.length).toBe(0)
  })

  it('should support ancestors traversing with break', function () {
    var elem = createElem('element-iterator-combined')
    var expectResArr = [elem.$.h.childNodes[0], elem.$.h, elem.$.g.$.e.childNodes[0]]
    glassEasel.ElementIterator.create(elem.$.h.childNodes[0], 'composed-ancestors', Object).forEach(
      function (e) {
        if (e === elem.$.g.$.e) return false
        expect(e).toBe(expectResArr.shift())
      },
    )
    expect(expectResArr.length).toBe(0)
  })

  it('should support shadow-descendants-root-first traversing', function () {
    var elem = createElem('element-iterator-combined')
    var expectResArr = [elem.shadowRoot, elem.$.g, elem.$.h, elem.$.i]
    glassEasel.ElementIterator.create(elem.shadowRoot, 'shadow-descendants-root-first').forEach(
      function (e) {
        expect(e).toBe(expectResArr.shift())
      },
    )
    expect(expectResArr.length).toBe(0)
  })

  it('should support shadow-descendants-root-last traversing', function () {
    var elem = createElem('element-iterator-combined')
    var expectResArr = [elem.$.h, elem.$.i, elem.$.g]
    glassEasel.ElementIterator.create(
      elem.shadowRoot,
      'shadow-descendants-root-last',
      glassEasel.Component,
    ).forEach(function (e) {
      expect(e).toBe(expectResArr.shift())
    })
    expect(expectResArr.length).toBe(0)
  })

  it('should support shadow-descendants-root-first traversing with break', function () {
    var elem = createElem('element-iterator-combined')
    var expectResArr = [elem.$.g]
    glassEasel.ElementIterator.create(elem.$.g, 'shadow-descendants-root-first', Object).forEach(
      function (e) {
        if (e === elem.$.h) return false
        expect(e).toBe(expectResArr.shift())
      },
    )
    expect(expectResArr.length).toBe(0)
  })

  it('should support shadow-descendants-root-last traversing with break', function () {
    var elem = createElem('element-iterator-combined')
    var expectResArr = [elem.$.h]
    glassEasel.ElementIterator.create(
      elem.$.g,
      'shadow-descendants-root-last',
      glassEasel.Component,
    ).forEach(function (e) {
      if (e === elem.$.i) return false
      expect(e).toBe(expectResArr.shift())
    })
    expect(expectResArr.length).toBe(0)
  })

  it('should support composed-descendants-root-first traversing', function () {
    var elem = createElem('element-iterator-combined')
    var expectResArr = [
      elem.$.g,
      elem.$.g.shadowRoot,
      elem.$.g.$.d,
      elem.$.g.$.d.shadowRoot,
      elem.$.g.$.d.shadowRoot.childNodes[0],
      elem.$.g.$.e,
      elem.$.g.$.e.childNodes[0],
      elem.$.h,
      elem.$.h.childNodes[0],
      elem.$.i,
      elem.$.i.shadowRoot,
      elem.$.i.shadowRoot.childNodes[0],
      elem.$.g.$.f,
    ]
    glassEasel.ElementIterator.create(elem.$.g, 'composed-descendants-root-first', Object).forEach(
      function (e) {
        expect(e).toBe(expectResArr.shift())
      },
    )
    expect(expectResArr.length).toBe(0)
    var expectResArr = [
      elem.$.g.$.e,
      elem.$.g.$.e.childNodes[0],
      elem.$.h,
      elem.$.h.childNodes[0],
      elem.$.i,
      elem.$.i.shadowRoot,
      elem.$.i.shadowRoot.childNodes[0],
    ]
    glassEasel.ElementIterator.create(
      elem.$.g.$.e,
      'composed-descendants-root-first',
      Object,
    ).forEach(function (e) {
      expect(e).toBe(expectResArr.shift())
    })
    expect(expectResArr.length).toBe(0)
  })

  it('should support composed-descendants-root-last traversing', function () {
    var elem = createElem('element-iterator-combined')
    var expectResArr = [elem.$.h, elem.$.i, elem.$.g.$.d, elem.$.g]
    glassEasel.ElementIterator.create(
      elem.$.g,
      'composed-descendants-root-last',
      glassEasel.Component,
    ).forEach(function (e) {
      expect(e).toBe(expectResArr.shift())
    })
    expect(expectResArr.length).toBe(0)
  })

  it('should support composed-descendants-root-first traversing with break', function () {
    var elem = createElem('element-iterator-combined')
    var expectResArr = [elem.$.g, elem.$.g.shadowRoot]
    glassEasel.ElementIterator.create(elem.$.g, 'composed-descendants-root-first', Object).forEach(
      function (e) {
        if (e === elem.$.g.$.d) return false
        expect(e).toBe(expectResArr.shift())
      },
    )
    expect(expectResArr.length).toBe(0)
  })

  it('should support composed-descendants-root-last traversing with break', function () {
    var elem = createElem('element-iterator-combined')
    var expectResArr = [elem.$.h, elem.$.i]
    glassEasel.ElementIterator.create(
      elem.$.g,
      'composed-descendants-root-last',
      glassEasel.Component,
    ).forEach(function (e) {
      if (e === elem.$.g.$.d) return false
      expect(e).toBe(expectResArr.shift())
    })
    expect(expectResArr.length).toBe(0)
  })
})
