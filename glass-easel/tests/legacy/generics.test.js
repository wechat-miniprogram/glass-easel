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

const regElem = (config) => {
  const { template, ...c } = config
  if (template) c.template = tmpl(template)
  return componentSpace.defineComponent(c)
}

const createElem = (is, backend) => {
  const def = componentSpace.getComponent(is)
  return glassEasel.Component.createWithContext(is || 'test', def, backend || domBackend)
}

describe('Generics, using and write-only', function(){

  beforeAll(function(){
    regElem({
      is: 'generics-common',
      options: {
        writeOnly: true
      },
      template: '<span />'
    })
    regElem({
      is: 'generics-common-cross-domain',
      options: {
        domain: 'XXX'
      },
      template: '<span />'
    })
  })

  describe('Component using', function(){

    it('should support using', function(){
      var compA = regElem({
        is: 'generics-using-a',
        properties: {
          propA: String
        },
        template: '<span></span>'
      })
      regElem({
        is: 'generics-using-b',
        using: {
          'a-a': 'generics-using-a',
          'a-b': compA
        },
        template: '<a-a></a-a><a-b></a-b>'
      })
      var elem = createElem('generics-using-b')
      expect(elem.shadowRoot.childNodes[0].is).toStrictEqual('generics-using-a')
      expect(elem.shadowRoot.childNodes[0].$$.tagName).toStrictEqual('A-A')
      expect(elem.shadowRoot.childNodes[0].propA).toStrictEqual('')
      expect(elem.shadowRoot.childNodes[0].shadowRoot.childNodes[0].is).toStrictEqual('span')
      expect(elem.shadowRoot.childNodes[1].is).toStrictEqual('generics-using-a')
      expect(elem.shadowRoot.childNodes[1].$$.tagName).toStrictEqual('A-B')
      expect(elem.shadowRoot.childNodes[1].propA).toStrictEqual('')
      var child1 = elem.shadowRoot.createComponent('a-a')
      var child2 = elem.shadowRoot.createComponent('a-b')
      expect(child1.is).toStrictEqual('generics-using-a')
      expect(child1.$$.tagName).toStrictEqual('A-A')
      expect(child2.is).toStrictEqual('generics-using-a')
      expect(child2.$$.tagName).toStrictEqual('A-B')
    })

  })

  describe('Component generics', function(){

    it('should be able to declare generics', function(){
      regElem({
        is: 'generics-declare-inner',
        generics: {
          'g-a': '',
          'g-b': {
            default: 'generics-common'
          },
        },
        template: '<g-a></g-a><g-b></g-b>'
      })
      regElem({
        is: 'generics-declare-outer',
        using: {
          'g-common': 'generics-common'
        },
        template: '<generics-declare-inner generic:g-a="generics-common" />'
      })
      var elem = createElem('generics-declare-outer')
      expect(elem.is).toStrictEqual('generics-declare-outer')
      expect(elem.shadowRoot.childNodes[0].is).toStrictEqual('generics-declare-inner')
      expect(elem.shadowRoot.childNodes[0].$$.tagName).toStrictEqual('GENERICS-DECLARE-INNER')
      expect(elem.shadowRoot.childNodes[0].shadowRoot.childNodes[0].is).toStrictEqual('generics-common')
      expect(elem.shadowRoot.childNodes[0].shadowRoot.childNodes[0].$$.tagName).toStrictEqual('G-A')
      expect(elem.shadowRoot.childNodes[0].shadowRoot.childNodes[1].is).toStrictEqual('generics-common')
      expect(elem.shadowRoot.childNodes[0].shadowRoot.childNodes[1].$$.tagName).toStrictEqual('G-B')
    })

    it('should be able to pass generics', function(){
      regElem({
        is: 'generics-passing-a',
        generics: {
          'g-a': ''
        },
        template: '<g-a id="x"></g-a>'
      })
      regElem({
        is: 'generics-passing-b',
        generics: {
          'g-b': ''
        },
        using: {
          'c-a': 'generics-passing-a'
        },
        template: '<c-a generic:g-a="g-b" id="x" />'
      })
      regElem({
        is: 'generics-passing-c',
        using: {
          'c-common': 'generics-common',
          'c-b': 'generics-passing-b'
        },
        template: '<c-b generic:g-b="c-common" id="x" />'
      })
      var elem = createElem('generics-passing-c')
      expect(elem.is).toStrictEqual('generics-passing-c')
      expect(elem.$.x.is).toStrictEqual('generics-passing-b')
      expect(elem.$.x.$.x.is).toStrictEqual('generics-passing-a')
      expect(elem.$.x.$.x.$.x.is).toStrictEqual('generics-common')
      expect(elem.$.x.$.x.$.x.$$.tagName).toStrictEqual('G-A')
    })

    it('should be able to pass a cross domain component', function(){
      regElem({
        is: 'generics-cross-domain-inner',
        options: {
          domain: 'XXX'
        },
        generics: {
          'g-a': ''
        },
        template: '<g-a></g-a>'
      })
      regElem({
        is: 'generics-cross-domain-outer',
        using: {
          'x-domain': 'generics-cross-domain-inner'
        },
        template: '<x-domain generic:g-a="generics-common-cross-domain" /> <x-domain generic:g-a="generics-common" />'
      })
      var elem = createElem('generics-cross-domain-outer')
      expect(elem.is).toStrictEqual('generics-cross-domain-outer')
      expect(elem.shadowRoot.childNodes[0].is).toStrictEqual('generics-cross-domain-inner')
      expect(elem.shadowRoot.childNodes[0].$$.tagName).toStrictEqual('X-DOMAIN')
      expect(elem.shadowRoot.childNodes[0].shadowRoot.childNodes[0].is).toStrictEqual('generics-common-cross-domain')
      expect(elem.shadowRoot.childNodes[0].shadowRoot.childNodes[0].$$.tagName).toStrictEqual('G-A')
      expect(elem.shadowRoot.childNodes[1].is).toStrictEqual('generics-cross-domain-inner')
      expect(elem.shadowRoot.childNodes[1].$$.tagName).toStrictEqual('X-DOMAIN')
      expect(elem.shadowRoot.childNodes[1].shadowRoot.childNodes[0].is).toStrictEqual('generics-common')
      expect(elem.shadowRoot.childNodes[1].shadowRoot.childNodes[0].$$.tagName).toStrictEqual('G-A')
    })

  })

})
