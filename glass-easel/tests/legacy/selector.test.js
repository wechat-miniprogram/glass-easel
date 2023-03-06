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

describe('Selector', function(){

  describe('Element.parseSelector', function(){

    it('should parse a selector string to a selector object', function(){
      var selector = glassEasel.Element.parseSelector('#b:.-c._d_')
      expect(typeof selector).toBe('object')
      regElem({
        is: 'glassEasel-selector-parse',
        template: '<div id="b:" class="_d_ -c"/>'
      })
      var elem = createElem('glassEasel-selector-parse').shadowRoot
      expect(elem.matchSelector(selector, elem.childNodes[0])).toBe(true)
    })

    it('should return null on failure', function(){
      expect(glassEasel.Element.parseSelector('.-').isEmpty()).toBe(true)
    })

  })

  describe('#matchSelector', function(){

    beforeAll(function(){
      regElem({
        is: 'glassEasel-selector-match-selector-a',
        template: '<div id="b" class="b"> b <slot/> </div> <div id="c" class="c"/>'
      })
      regElem({
        is: 'glassEasel-selector-match-selector-b',
        template: '<glassEasel-selector-match-selector-a id="a" class="a"> a <span id="b" class="b"> b <span id="c" class="c"/></span> </glassEasel-selector-match-selector-a>'
      })
    })

    it('should be able to test selector (without deep selector)', function(){
      var elem = createElem('glassEasel-selector-match-selector-b')
      expect(elem.matchSelector('.a .b', elem.$.b)).toBe(false)
      expect(glassEasel.Element.matchSelector('.a .b', elem.$.b)).toBe(true)
      expect(elem.$.a.shadowRoot.matchSelector('.a, .b', elem)).toBe(false)
      expect(elem.$.a.shadowRoot.matchSelector('.a .b', elem.$.a.$.b)).toBe(false)
      expect(elem.shadowRoot.matchSelector('.aa .b', elem.$.b)).toBe(false)
      expect(elem.shadowRoot.matchSelector('.a .b', elem.$.b)).toBe(true)
      expect(elem.shadowRoot.matchSelector(' .a  .c ', elem.$.c)).toBe(true)
      expect(elem.shadowRoot.matchSelector('.a>.b', elem.$.b)).toBe(true)
      expect(elem.shadowRoot.matchSelector('.a >.c', elem.$.c)).toBe(false)
      expect(elem.shadowRoot.matchSelector('.a .b, .a >.c ', elem.$.b)).toBe(true)
      expect(elem.shadowRoot.matchSelector(' .a  .c ,.a> .b', elem.$.c)).toBe(true)
      expect(elem.shadowRoot.matchSelector('.a>.b,.a > .c', elem.$.b)).toBe(true)
      expect(elem.$.a.shadowRoot.matchSelector(' .a .b', elem.$.a.$.b)).toBe(false)
      expect(elem.$.a.shadowRoot.matchSelector('.a .c ', elem.$.a.$.c)).toBe(false)
      expect(elem.$.a.shadowRoot.matchSelector('.a> .b', elem.$.a.$.b)).toBe(false)
      expect(elem.$.a.shadowRoot.matchSelector('.a > .c', elem.$.a.$.c)).toBe(false)
    })

    it('should be able to test selector (with deep selector)', function(){
      var owner = createElem('glassEasel-selector-match-selector-a')
      var elem = owner.shadowRoot.createComponent('glassEasel-selector-match-selector-b')
      elem.classList.toggle('e', true)
      var parent = owner.shadowRoot.createVirtualNode()
      parent.appendChild(elem)
      expect(parent.matchSelector('.a >>> .b', elem.$.b)).toBe(false)
      expect(parent.matchSelector('.e >>>.a>>> .b', elem.$.b)).toBe(true)
      expect(parent.matchSelector('.e>>>.b', elem.$.b)).toBe(true)
      expect(glassEasel.Element.matchSelector('.a >>> .b', elem.$.b)).toBe(true)
      expect(elem.$.a.shadowRoot.matchSelector('.a >>> .b', elem)).toBe(false)
      expect(elem.$.a.shadowRoot.matchSelector('.a >>> .b', elem.$.a.$.b)).toBe(false)
      expect(parent.matchSelector('.e >>> .aa >>> .b', elem.$.b)).toBe(false)
      expect(elem.matchSelector('.e >>> .a >>> .b', elem.$.b)).toBe(false)
      expect(parent.matchSelector('.e >>> .a > .c', elem.$.c)).toBe(false)
      expect(parent.matchSelector('.e >>> .a >>> .b, .a > .c ', elem.$.b)).toBe(true)
      expect(elem.shadowRoot.matchSelector('.a >>> .b', elem.$.b)).toBe(true)
      expect(elem.shadowRoot.matchSelector('.a >>> .b', elem.$.a.$.b)).toBe(true)
      expect(elem.shadowRoot.matchSelector('.a >>> .c', elem.$.c)).toBe(true)
      expect(parent.matchSelector('.e >>> .a >>> .c', elem.$.c)).toBe(true)
      expect(parent.matchSelector('.a >>> .c', elem.$.c)).toBe(false)
      elem.classList.toggle('a', true)
      var mid = owner.shadowRoot.createNativeNode('div')
      mid.appendChild(elem)
      parent.appendChild(mid)
      expect(parent.matchSelector('.f > .a >>> .c', elem.$.c)).toBe(false)
      mid.classList.toggle('f')
      expect(parent.matchSelector('.f > .a >>> .c', elem.$.c)).toBe(true)
    })

  })

  describe('#querySelector, #querySelectorAll', function(){

    var compDefC = null

    beforeAll(function(){
      regElem({
        is: 'glassEasel-selector-query-selector-a',
        template: '<div id="a1" class="a common"/> <slot/> <div id="a2" class="common a"/>'
      })
      regElem({
        is: 'glassEasel-selector-query-selector-b',
        template: '<glassEasel-selector-query-selector-a id="a1" class="a"> <span id="b" class="common"/> </glassEasel-selector-query-selector-a> <glassEasel-selector-query-selector-a id="a2" class="a"/>'
      })
      componentSpace.exportComponent('glassEasel-selector-query-selector-a', 'glassEasel-selector-query-selector-a')
      const componentSpace2 = new glassEasel.ComponentSpace('', componentSpace)
      compDefC = componentSpace2.defineComponent({
        is: 'glassEasel-selector-query-selector-c',
        template: tmpl('<glassEasel-selector-query-selector-a id="a" class="a"/> <div id="c" class="c"/>')
      })
    })

    it('should be able to select virtual-host components', function(){
      regElem({
        is: 'glassEasel-selector-query-selector-virtual-host-a',
        options: {
          virtualHost: true,
        },
        template: '<slot />'
      })
      regElem({
        is: 'glassEasel-selector-query-selector-virtual-host-b',
        options: {
          virtualHost: true,
        },
        template: '<div><glassEasel-selector-query-selector-virtual-host-a class="a" /></div>'
      })
      var elem = createElem('glassEasel-selector-query-selector-virtual-host-b')
      expect(elem.shadowRoot.querySelector('.a')).toBe(elem.shadowRoot.childNodes[0].childNodes[0])
    })

    it('should be able to select the first matched node (without deep selector)', function(){
      var elem = createElem('glassEasel-selector-query-selector-b')
      expect(elem.querySelector('.a')).toBe(null)
      expect(elem.shadowRoot.querySelector('.a')).toBe(elem.$.a1)
      expect(elem.shadowRoot.querySelector('#a1, #a2')).toBe(elem.$.a1)
      expect(elem.shadowRoot.querySelector('#a2, #a1')).toBe(elem.$.a1)
      expect(elem.shadowRoot.querySelector('#b, #a2')).toBe(elem.$.b)
      expect(elem.shadowRoot.querySelector('#a2')).toBe(elem.$.a2)
      expect(elem.shadowRoot.querySelector('.common')).toBe(elem.$.b)
      expect(elem.shadowRoot.querySelector('#a2.common')).toBe(null)
      expect(elem.shadowRoot.querySelector('#b.common')).toBe(elem.$.b)
    })

    it('should be able to select the first matched node (with deep selector)', function(){
      var owner = createElem('glassEasel-selector-query-selector-a')
      var elem = owner.shadowRoot.createComponent('glassEasel-selector-query-selector-b')
      elem.classList.toggle('b', true)
      var parent = owner.shadowRoot.createVirtualNode()
      parent.appendChild(elem)
      expect(parent.querySelector('.b')).toBe(elem)
      expect(parent.querySelector('.a')).toBe(null)
      expect(parent.querySelector('.b .a')).toBe(null)
      expect(parent.querySelector('.b >>> .a')).toBe(elem.$.a1)
      expect(parent.querySelector('.b >>> #b')).toBe(elem.$.b)
      expect(parent.querySelector('.b >>> #a1, .b >>> #a2')).toBe(elem.$.a1)
      expect(parent.querySelector('.b >>> #a2, .b >>> #a1')).toBe(elem.$.a1)
      expect(parent.querySelector('.b >>> #a2')).toBe(elem.$.a1.$.a2)
      expect(parent.querySelector('.b >>> #b, .b >>> #a2')).toBe(elem.$.a1.$.a2)
      expect(parent.querySelector('.b >>> .common')).toBe(elem.$.a1.$.a1)
      expect(parent.querySelector('.b >>> #a2.common')).toBe(elem.$.a1.$.a2)
      expect(parent.querySelector('.b >>> #b.common')).toBe(elem.$.b)
    })

    it('should be able to select all matched nodes (without deep selector)', function(){
      var elem = createElem('glassEasel-selector-query-selector-b')
      expect(elem.querySelectorAll('.a')).toStrictEqual([])
      expect(elem.shadowRoot.querySelectorAll('.a')).toStrictEqual([elem.$.a1, elem.$.a2])
      expect(elem.shadowRoot.querySelectorAll('#a1, #a2')).toStrictEqual([elem.$.a1, elem.$.a2])
      expect(elem.shadowRoot.querySelectorAll('#a2, #a1')).toStrictEqual([elem.$.a1, elem.$.a2])
      expect(elem.shadowRoot.querySelectorAll('#b, #a2')).toStrictEqual([elem.$.b, elem.$.a2])
      expect(elem.shadowRoot.querySelectorAll('#a2')).toStrictEqual([elem.$.a2])
      expect(elem.shadowRoot.querySelectorAll('.common')).toStrictEqual([elem.$.b])
      expect(elem.shadowRoot.querySelectorAll('#a2.common')).toStrictEqual([])
      expect(elem.shadowRoot.querySelectorAll('#b.common')).toStrictEqual([elem.$.b])
    })

    it('should be able to select all matched nodes (with deep selector)', function(){
      var owner = createElem('glassEasel-selector-query-selector-a')
      var elem = owner.shadowRoot.createComponent('glassEasel-selector-query-selector-b')
      elem.classList.toggle('b', true)
      var parent = owner.shadowRoot.createVirtualNode()
      parent.appendChild(elem)
      expect(parent.querySelectorAll('.b')).toStrictEqual([elem])
      expect(parent.querySelectorAll('.a')).toStrictEqual([])
      expect(parent.querySelectorAll('.b .a')).toStrictEqual([])
      expect(parent.querySelectorAll('.b >>> .a')).toStrictEqual([elem.$.a1, elem.$.a1.$.a1, elem.$.a1.$.a2, elem.$.a2, elem.$.a2.$.a1, elem.$.a2.$.a2])
      expect(parent.querySelectorAll('.b >>> #b')).toStrictEqual([elem.$.b])
      expect(parent.querySelectorAll('.b >>> #a1, .b >>> #a2')).toStrictEqual([elem.$.a1, elem.$.a1.$.a1, elem.$.a1.$.a2, elem.$.a2, elem.$.a2.$.a1, elem.$.a2.$.a2])
      expect(parent.querySelectorAll('.b >>> #a2, .b >>> #a1')).toStrictEqual([elem.$.a1, elem.$.a1.$.a1, elem.$.a1.$.a2, elem.$.a2, elem.$.a2.$.a1, elem.$.a2.$.a2])
      expect(parent.querySelectorAll('.b >>> #a2')).toStrictEqual([elem.$.a1.$.a2, elem.$.a2, elem.$.a2.$.a2])
      expect(parent.querySelectorAll('.b >>> #b, .b >>> #a2')).toStrictEqual([elem.$.a1.$.a2, elem.$.b, elem.$.a2, elem.$.a2.$.a2])
      expect(parent.querySelectorAll('.b >>> .common')).toStrictEqual([elem.$.a1.$.a1, elem.$.a1.$.a2, elem.$.b, elem.$.a2.$.a1, elem.$.a2.$.a2])
      expect(parent.querySelectorAll('.b >>> #a2.common')).toStrictEqual([elem.$.a1.$.a2, elem.$.a2.$.a2])
      expect(parent.querySelectorAll('.b >>> #b.common')).toStrictEqual([elem.$.b])
    })

    it('should prevent deep selector find in different component space', function(){
      var cs1 = new glassEasel.ComponentSpace()
      var cs2 = new glassEasel.ComponentSpace()
      var compDef = cs2.defineComponent({
        template: tmpl('<div class="b"></div>'),
      })
      var innerCompDef = cs1.defineComponent({
        using: {
          comp: compDef,
        },
        template: tmpl('<comp class="inner"></comp>'),
      })
      var outerCompDef = cs2.defineComponent({
        using: {
          inner: innerCompDef,
        },
        template: tmpl('<inner class="a"></inner>'),
      })
      var owner = glassEasel.Component.createWithContext('test', outerCompDef, domBackend)
      var parent = owner.shadowRoot
      var a = parent.childNodes[0]
      var inner = a.shadowRoot.childNodes[0]
      var b = inner.shadowRoot.childNodes[0]
      expect(parent.querySelectorAll('.a')).toStrictEqual([a])
      expect(parent.querySelectorAll('.b')).toStrictEqual([])
      expect(parent.querySelectorAll('.inner')).toStrictEqual([])
      expect(parent.querySelectorAll('.a >>> .inner')).toStrictEqual([])
      expect(parent.querySelectorAll('.a >>> .b')).toStrictEqual([b])
      expect(parent.querySelectorAll('.b >>> .inner >>> .b')).toStrictEqual([])
      expect(a.shadowRoot.querySelectorAll('.inner')).toStrictEqual([inner])
      expect(a.shadowRoot.querySelectorAll('.b')).toStrictEqual([])
      expect(a.shadowRoot.querySelectorAll('.inner >>> .b')).toStrictEqual([])
      expect(a.shadowRoot.querySelectorAll('.inner >>> .b')).toStrictEqual([])
      expect(parent.matchSelector('.a >>> .b', b)).toBe(true)
      expect(parent.matchSelector('.inner', inner)).toBe(false)
      expect(glassEasel.Element.matchSelector('.a', a)).toBe(true)
      expect(glassEasel.Element.matchSelector('.inner', inner)).toBe(true)
      expect(glassEasel.Element.matchSelector('.a >>> .inner', inner)).toBe(false)
    })

  })

})
