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

describe('Extra Info', function () {
  beforeAll(function () {
    glassEasel.globalOptions.writeExtraInfoToAttr = true
  })

  it('should output id', function () {
    regElem({
      is: 'extra-info-id',
      template: '<span id="a"></span>',
    })
    var elem = createElem('extra-info-id')
    expect(elem.$.a.$$.getAttribute('exparser:info-attr-id')).toBe('a')
  })

  it('should output component id', function () {
    regElem({
      is: 'extra-info-component-id-sub',
    })
    regElem({
      is: 'extra-info-component-id',
      template: '<span><extra-info-component-id-sub id="a"></extra-info-component-id-sub></span>',
    })
    var elem = createElem('extra-info-component-id')
    expect(elem.$.a.$$.getAttribute('exparser:info-component-id') > 0).toBe(true)
    expect(elem.$$.getAttribute('exparser:info-component-id') > 0).toBe(true)
  })

  it('should output currect slot info (single slotted)', function () {
    regElem({
      is: 'extra-info-slot-a',
      template: '<span id="a"/><slot/>',
    })
    regElem({
      is: 'extra-info-slot-b',
      template: '<a/><extra-info-slot-a id="a"><slot/><span id="b"/></extra-info-slot-a>',
    })
    regElem({
      is: 'extra-info-slot',
      template: '<extra-info-slot-b id="b"><p id="p"></p></extra-info-slot-b>',
    })
    var elem = createElem('extra-info-slot')
    expect(elem.$.p.$$.getAttribute('exparser:info-in-slot-of')).toBe(
      elem.$.b.$$.getAttribute('exparser:info-component-id'),
    )
    expect(elem.$.b.$.b.$$.getAttribute('exparser:info-in-slot-of')).toBe(
      elem.$.b.$.a.$$.getAttribute('exparser:info-component-id'),
    )
    expect(elem.$.b.$.a.$.a.$$.getAttribute('exparser:info-in-slot-of')).toBe(null)
  })

  it('should output currect slot info (multiple slotted)', function () {
    regElem({
      is: 'extra-info-slot-multi-a',
      template: '<span id="a"/><slot/>',
    })
    regElem({
      is: 'extra-info-slot-multi-b',
      options: {
        multipleSlots: true,
      },
      template:
        '<extra-info-slot-multi-a id="a"> <slot name="1" /> <slot name="2" /> <span id="b"/> </extra-info-slot-multi-a>',
    })
    regElem({
      is: 'extra-info-slot-multi',
      template:
        '<extra-info-slot-multi-b id="b"> <p id="p1" slot="1"></p> <p id="p2" slot="2"></p> </extra-info-slot-multi-b>',
    })

    var elem = createElem('extra-info-slot-multi')
    expect(elem.$.p1.$$.getAttribute('exparser:info-in-slot-of')).toBe(
      elem.$.b.$$.getAttribute('exparser:info-component-id'),
    )
    expect(elem.$.p2.$$.getAttribute('exparser:info-in-slot-of')).toBe(
      elem.$.b.$$.getAttribute('exparser:info-component-id'),
    )
    expect(elem.$.b.$.b.$$.getAttribute('exparser:info-in-slot-of')).toBe(
      elem.$.b.$.a.$$.getAttribute('exparser:info-component-id'),
    )
    expect(elem.$.b.$.a.$.a.$$.getAttribute('exparser:info-in-slot-of')).toBe(null)

    var newSlot1 = elem.$.b.shadowRoot.createVirtualNode('slot')
    glassEasel.Element.setSlotName(newSlot1, '1')
    var elemA = elem.$.b.$.a
    elemA.replaceChild(newSlot1, elemA.childNodes[0])
    expect(elem.$.p1.$$.getAttribute('exparser:info-in-slot-of')).toBe(
      elem.$.b.$$.getAttribute('exparser:info-component-id'),
    )
    expect(elem.$.p2.$$.getAttribute('exparser:info-in-slot-of')).toBe(
      elem.$.b.$$.getAttribute('exparser:info-component-id'),
    )
    expect(elem.$.b.$.b.$$.getAttribute('exparser:info-in-slot-of')).toBe(
      elem.$.b.$.a.$$.getAttribute('exparser:info-component-id'),
    )
    expect(elem.$.b.$.a.$.a.$$.getAttribute('exparser:info-in-slot-of')).toBe(null)
  })

  afterAll(function () {
    glassEasel.globalOptions.writeExtraInfoToAttr = false
  })
})
