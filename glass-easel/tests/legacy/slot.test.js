/* eslint-disable */

const { tmpl, domBackend, shadowBackend, composedBackend } = require('../base/env')
const glassEasel = require('../../src')

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
  writeIdToDOM: true,
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

const createElemInBackend = (is, backend) => {
  const def = componentSpace.getComponent(is)
  return glassEasel.Component.createWithContext(is || 'test', def, backend || domBackend)
}

var matchElementWithDom = require('../base/match').virtual

const testCases = function (testBackend) {
  var root = null

  const createElem = function (is) {
    return createElemInBackend(is, testBackend)
  }

  beforeAll(function () {
    regElem({
      is: 'virtual-a',
    })
    root = createElem('virtual-a')
    root.$$.id = 'root'
    var backendRoot = testBackend.getRootNode()
    if (testBackend === shadowBackend) {
      backendRoot.appendChild(root.getBackendElement())
      glassEasel.Element.pretendAttached(root)
    } else if (testBackend === domBackend) {
      var placeholder = testBackend.document.createElement('div')
      backendRoot.appendChild(placeholder)
      glassEasel.Element.replaceDocumentElement(root, backendRoot, placeholder)
    } else {
      var placeholder = testBackend.createElement('div')
      backendRoot.appendChild(placeholder)
      glassEasel.Element.replaceDocumentElement(root, backendRoot, placeholder)
    }
  })

  beforeAll(function () {
    regElem({
      is: 'component-slot-a',
      template: '<span id="a"></span>',
    })
    root = createElem('component-slot-a')
    regElem({
      is: 'component-slot-b',
      template: '<span id="b"><component-slot-a> <slot></slot> </component-slot-a></span>',
    })
    regElem({
      is: 'component-slot-c',
      options: {
        multipleSlots: true,
      },
      template: '<slot></slot> <span id="c"> <slot name="1"></slot> </span> <slot name="2"></slot>',
    })
    regElem({
      is: 'component-slot-d',
      options: {
        multipleSlots: true,
      },
      template:
        '<span id="d"><component-slot-c id="child"> <span id="a" slot="">A</span> <span id="b" slot="1">B</span> <span id="c" slot="2">C</span>D</component-slot-c></span>',
    })
    regElem({
      is: 'component-slot-e',
      template: '<span id="e"> <slot/> </span>',
    })
  })

  describe('single-slotted', function () {
    it('should support non-slot components', function () {
      var elem = root.shadowRoot.createComponent('component-slot-a')
      var text = glassEasel.TextNode.create('test', elem.ownerShadowRoot)
      var child = root.shadowRoot.createComponent('component-slot-b')
      elem.appendChild(text)
      elem.appendChild(child)
      matchElementWithDom(elem)

      var newSlot = elem.shadowRoot.createVirtualNode('slot')
      glassEasel.Element.setSlotName(newSlot)
      elem.$.a.appendChild(newSlot)
      expect(newSlot.getComposedChildren()).toStrictEqual([text, child])
      matchElementWithDom(elem)

      var newSlot2 = elem.shadowRoot.createVirtualNode('slot')
      glassEasel.Element.setSlotName(newSlot2, 's2')
      elem.shadowRoot.appendChild(newSlot2)
      expect(newSlot.getComposedChildren()).toStrictEqual([text, child])
      expect(newSlot2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(elem)

      elem.shadowRoot.insertBefore(newSlot2, elem.$.a)
      expect(newSlot.getComposedChildren()).toStrictEqual([])
      expect(newSlot2.getComposedChildren()).toStrictEqual([text, child])
      matchElementWithDom(elem)

      elem.$.a.removeChild(newSlot)
      expect(newSlot.getComposedChildren()).toStrictEqual([])
      expect(newSlot2.getComposedChildren()).toStrictEqual([text, child])
      matchElementWithDom(elem)

      elem.shadowRoot.removeChild(newSlot2)
      expect(newSlot.getComposedChildren()).toStrictEqual([])
      expect(newSlot2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(elem)
    })

    it('should support slot movement', function () {
      var elem = root.shadowRoot.createComponent('component-slot-b')
      var text = glassEasel.TextNode.create('test', root.shadowRoot)
      var text2 = elem.shadowRoot.createTextNode('test2')
      var text3 = elem.shadowRoot.createTextNode('test3')

      elem.appendChild(text)
      elem.$.b.childNodes[0].appendChild(text2)
      expect(elem.childNodes).toStrictEqual([text])
      expect(elem.shadowRoot.getSlotElementFromName('').getComposedChildren()).toStrictEqual([text])
      expect(elem.shadowRoot.getSlotElementFromName('').getComposedParent()).toBe(null)
      expect(elem.$.b.childNodes[0].childNodes).toStrictEqual([
        elem.shadowRoot.getSlotElementFromName(''),
        text2,
      ])
      expect(elem.$.b.childNodes[0].shadowRoot.getSlotElementFromName('')).toBe(null)
      matchElementWithDom(elem)

      var a = elem.$.b.childNodes[0]
      var newSlot = a.shadowRoot.createVirtualNode('slot')
      glassEasel.Element.setSlotName(newSlot)
      a.shadowRoot.insertBefore(newSlot, a.$.a)
      expect(a.shadowRoot.getSlotElementFromName('')).toBe(newSlot)
      expect(a.shadowRoot.getSlotElementFromName('').getComposedChildren()).toStrictEqual([
        elem.shadowRoot.getSlotElementFromName(''),
        text2,
      ])
      expect(elem.shadowRoot.getSlotElementFromName('').getComposedChildren()).toStrictEqual([text])
      expect(elem.shadowRoot.getSlotElementFromName('').getComposedParent()).toBe(newSlot)
      expect(a.shadowRoot.childNodes[0].getComposedChildren()).toStrictEqual([
        elem.shadowRoot.getSlotElementFromName(''),
        text2,
      ])
      matchElementWithDom(elem)

      a.shadowRoot.removeChild(newSlot)
      expect(a.shadowRoot.getSlotElementFromName('')).toBe(null)
      expect(elem.shadowRoot.getSlotElementFromName('').getComposedChildren()).toStrictEqual([text])
      expect(elem.shadowRoot.getSlotElementFromName('').getComposedParent()).toBe(null)
      expect(a.shadowRoot.childNodes[0].getComposedChildren()).toStrictEqual([])
      matchElementWithDom(elem)

      a.insertBefore(text3, text2)
      expect(text3.getComposedParent()).toBe(null)
      matchElementWithDom(elem)

      a.shadowRoot.appendChild(newSlot)
      expect(text3.getComposedParent()).toBe(newSlot)
      expect(a.shadowRoot.getSlotElementFromName('')).toBe(newSlot)
      expect(a.shadowRoot.getSlotElementFromName('').getComposedChildren()).toStrictEqual([
        elem.shadowRoot.getSlotElementFromName(''),
        text3,
        text2,
      ])
      expect(elem.shadowRoot.getSlotElementFromName('').getComposedChildren()).toStrictEqual([text])
      expect(elem.shadowRoot.getSlotElementFromName('').getComposedParent()).toBe(newSlot)
      expect(
        a.shadowRoot.childNodes[a.shadowRoot.childNodes.length - 1].getComposedChildren(),
      ).toStrictEqual([elem.shadowRoot.getSlotElementFromName(''), text3, text2])
      matchElementWithDom(elem)
    })
  })

  describe('multi-slotted (without splitting insertion)', function () {
    it('should support static slotting', function () {
      var elem = root.shadowRoot.createComponent('component-slot-d')
      var child = elem.$.child
      expect(child.childNodes[3].textContent).toBe('D')
      expect(child.shadowRoot.childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.a,
        child.childNodes[3],
      ])
      expect(child.shadowRoot.childNodes[1].childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.b,
      ])
      expect(child.shadowRoot.childNodes[2].getComposedChildren()).toStrictEqual([elem.$.c])
      matchElementWithDom(elem)

      elem.$.a.slot = '1'
      expect(child.childNodes[3].textContent).toBe('D')
      expect(child.shadowRoot.childNodes[0].getComposedChildren()).toStrictEqual([
        child.childNodes[3],
      ])
      expect(child.shadowRoot.childNodes[1].childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.a,
        elem.$.b,
      ])
      expect(child.shadowRoot.childNodes[2].getComposedChildren()).toStrictEqual([elem.$.c])
      matchElementWithDom(elem)

      elem.$.c.slot = '1'
      expect(child.childNodes[3].textContent).toBe('D')
      expect(child.shadowRoot.childNodes[0].getComposedChildren()).toStrictEqual([
        child.childNodes[3],
      ])
      expect(child.shadowRoot.childNodes[1].childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.a,
        elem.$.b,
        elem.$.c,
      ])
      expect(child.shadowRoot.childNodes[2].getComposedChildren()).toStrictEqual([])
      matchElementWithDom(elem)

      elem.$.a.slot = '2'
      expect(child.childNodes[3].textContent).toBe('D')
      expect(child.shadowRoot.childNodes[0].getComposedChildren()).toStrictEqual([
        child.childNodes[3],
      ])
      expect(child.shadowRoot.childNodes[1].childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.b,
        elem.$.c,
      ])
      expect(child.shadowRoot.childNodes[2].getComposedChildren()).toStrictEqual([elem.$.a])
      matchElementWithDom(elem)

      elem.$.b.slot = 'xxx'
      expect(child.childNodes[3].textContent).toBe('D')
      expect(elem.$.b.getComposedParent()).toBe(null)
      expect(child.shadowRoot.childNodes[0].getComposedChildren()).toStrictEqual([
        child.childNodes[3],
      ])
      expect(child.shadowRoot.childNodes[1].childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.c,
      ])
      expect(child.shadowRoot.childNodes[2].getComposedChildren()).toStrictEqual([elem.$.a])
      matchElementWithDom(elem)

      elem.$.b.slot = 'yyy'
      expect(child.childNodes[3].textContent).toBe('D')
      expect(elem.$.b.getComposedParent()).toBe(null)
      expect(child.shadowRoot.childNodes[0].getComposedChildren()).toStrictEqual([
        child.childNodes[3],
      ])
      expect(child.shadowRoot.childNodes[1].childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.c,
      ])
      expect(child.shadowRoot.childNodes[2].getComposedChildren()).toStrictEqual([elem.$.a])
      matchElementWithDom(elem)

      elem.$.b.slot = ''
      expect(child.childNodes[3].textContent).toBe('D')
      expect(child.shadowRoot.childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.b,
        child.childNodes[3],
      ])
      expect(child.shadowRoot.childNodes[1].childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.c,
      ])
      expect(child.shadowRoot.childNodes[2].getComposedChildren()).toStrictEqual([elem.$.a])
      matchElementWithDom(elem)
    })

    it('should support non-slot components', function () {
      var elem = root.shadowRoot.createComponent('component-slot-d')
      var child = elem.$.child
      var elem2 = root.shadowRoot.createComponent('component-slot-a')
      var elem3 = root.shadowRoot.createComponent('component-slot-a')
      elem3.slot = 'new2'
      elem.appendChild(elem2)
      elem.appendChild(elem3)

      var newSlot = elem.shadowRoot.createNativeNode('div')
      glassEasel.Element.setSlotName(newSlot)
      newSlot.slot = 1
      child.appendChild(newSlot)
      expect(newSlot.getComposedChildren()).toStrictEqual([elem2])
      expect(child.shadowRoot.childNodes[1].childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.b,
        newSlot,
      ])
      matchElementWithDom(elem)

      var newSlot2 = elem.shadowRoot.createNativeNode('div')
      glassEasel.Element.setSlotName(newSlot2, 'new2')
      child.appendChild(newSlot2)
      expect(newSlot2.getComposedChildren()).toStrictEqual([elem3])
      expect(child.childNodes[3].textContent).toBe('D')
      expect(child.shadowRoot.childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.a,
        child.childNodes[3],
        newSlot2,
      ])
      matchElementWithDom(elem)

      glassEasel.Element.setSlotName(newSlot, 'new2')
      expect(newSlot.getComposedChildren()).toStrictEqual([elem3])
      expect(newSlot2.getComposedChildren()).toStrictEqual([])
      expect(child.childNodes[3].textContent).toBe('D')
      expect(child.shadowRoot.childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.a,
        child.childNodes[3],
        newSlot2,
      ])
      expect(child.shadowRoot.childNodes[1].childNodes[0].getComposedChildren()).toStrictEqual([
        elem.$.b,
        newSlot,
      ])
      matchElementWithDom(elem)

      child.removeChild(newSlot2)
      expect(newSlot.getComposedChildren()).toStrictEqual([elem3])
      expect(newSlot2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(elem)

      child.removeChild(newSlot)
      expect(newSlot.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(elem)
    })

    it('should support slot movement', function () {
      var elem = root.shadowRoot.createComponent('component-slot-d')
      var child = elem.$.child

      var slot1 = child.$.c.childNodes[0]
      child.shadowRoot.appendChild(slot1)
      expect(child.$.c.getComposedChildren()).toStrictEqual([])
      expect(slot1.getComposedParent()).toBe(child.shadowRoot)
      expect(slot1.getComposedChildren()).toStrictEqual([elem.$.b])
      matchElementWithDom(elem)
    })

    it('should support slot replacement, removal, and insertion', function () {
      var elem = root.shadowRoot.createComponent('component-slot-c')
      var elem2 = null
      var elem3 = null
      elem2 = root.shadowRoot.createComponent('component-slot-a')
      elem3 = root.shadowRoot.createComponent('component-slot-a')
      elem2.slot = '1'
      elem.appendChild(elem2)
      elem.appendChild(elem3)

      var slot0 = elem.shadowRoot.childNodes[0]
      var slot1 = elem.$.c.childNodes[0]
      expect(elem2.getComposedParent()).toBe(slot1)
      expect(elem3.getComposedParent()).toBe(slot0)

      var slot1dup = elem.shadowRoot.createNativeNode('span')
      glassEasel.Element.setSlotName(slot1dup, '1')
      slot1.cancelDestroyBackendElementOnDetach()
      slot1.parentNode.replaceChild(slot1dup, slot1)
      slot1.destroyBackendElementOnDetach()
      expect(slot1.getComposedParent()).toBe(null)
      expect(slot1.getComposedChildren()).toStrictEqual([])
      expect(elem2.getComposedParent()).toBe(slot1dup)
      expect(elem3.getComposedParent()).toBe(slot0)
      matchElementWithDom(elem)

      slot1dup.parentNode.removeChild(slot1dup)
      expect(slot1dup.getComposedParent()).toBe(null)
      expect(slot1dup.getComposedChildren()).toStrictEqual([])
      expect(elem2.getComposedParent()).toBe(null)
      expect(elem3.getComposedParent()).toBe(slot0)
      matchElementWithDom(elem)

      var elem4 = root.shadowRoot.createNativeNode('elem4')
      elem4.slot = '1'
      elem.appendChild(elem4)
      expect(elem4.getComposedParent()).toBe(null)
      matchElementWithDom(elem)

      elem.shadowRoot.appendChild(slot1)
      expect(slot1.getComposedParent()).toBe(elem.shadowRoot)
      expect(slot1.getComposedChildren()).toStrictEqual([elem2, elem4])
      expect(elem2.getComposedParent()).toBe(slot1)
      expect(elem3.getComposedParent()).toBe(slot0)
      expect(elem4.getComposedParent()).toBe(slot1)
      matchElementWithDom(elem)
    })

    it('should support slot children movement (multi-slotted)', function () {
      var parent1 = root.shadowRoot.createComponent('component-slot-e')
      var parent2 = root.shadowRoot.createComponent('component-slot-c')
      var virtual = root.shadowRoot.createVirtualNode('group')
      var elem1 = root.shadowRoot.createComponent('component-slot-e')
      var elem2 = root.shadowRoot.createComponent('component-slot-e')
      var slot1 = parent1.$.e.childNodes[0]
      var slot20 = parent2.shadowRoot.childNodes[0]
      // var slot21 = parent2.$.c.childNodes[0]
      elem1.slot = '1'
      virtual.appendChild(elem1)
      virtual.appendChild(elem2)

      parent1.appendChild(virtual)
      expect(virtual.getComposedParent()).toBe(slot1)
      expect(slot1.getComposedChildren()).toStrictEqual([virtual])
      matchElementWithDom(parent1)
      matchElementWithDom(parent2)

      parent2.appendChild(virtual)
      expect(virtual.getComposedParent()).toBe(slot20)
      expect(slot20.getComposedChildren()).toStrictEqual([virtual])
      matchElementWithDom(parent1)
      matchElementWithDom(parent2)

      parent1.appendChild(virtual)
      expect(virtual.getComposedParent()).toBe(slot1)
      expect(slot1.getComposedChildren()).toStrictEqual([virtual])
      matchElementWithDom(parent1)
      matchElementWithDom(parent2)

      parent2.appendChild(virtual)
      expect(virtual.getComposedParent()).toBe(slot20)
      expect(slot20.getComposedChildren()).toStrictEqual([virtual])
      matchElementWithDom(parent1)
      matchElementWithDom(parent2)
    })
  })

  describe('multi-slotted (with splitting insertion)', function () {
    it('should be able to insert to single slot', function () {
      var p1 = root.shadowRoot.createComponent('component-slot-e')
      var p2 = root.shadowRoot.createComponent('component-slot-e')
      var p1slot = p1.$.e.childNodes[0]
      var p2slot = p2.$.e.childNodes[0]
      var s1 = root.shadowRoot.createVirtualNode('s1')
      var s2 = root.shadowRoot.createVirtualNode('s2')
      var s3 = root.shadowRoot.createVirtualNode('s3')
      glassEasel.Element.setInheritSlots(s1)
      glassEasel.Element.setInheritSlots(s2)
      glassEasel.Element.setInheritSlots(s3)
      var c1 = root.shadowRoot.createVirtualNode()
      var c2 = root.shadowRoot.createNativeNode('span')
      var c3 = root.shadowRoot.createNativeNode('span')
      var c4 = root.shadowRoot.createNativeNode('span')
      s1.appendChild(s2)
      s1.appendChild(c1)
      s2.appendChild(c2)
      s2.appendChild(c3)
      s3.appendChild(c4)
      matchElementWithDom(s1)
      matchElementWithDom(s3)

      p1.appendChild(s1)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, c1])
      expect(s1.childNodes).toStrictEqual([s2, c1])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      s1.appendChild(s3)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, c1, s3, c4])
      expect(s1.childNodes).toStrictEqual([s2, c1, s3])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      p2.appendChild(s3)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, c1])
      expect(p2slot.getComposedChildren()).toStrictEqual([s3, c4])
      expect(s1.childNodes).toStrictEqual([s2, c1])
      matchElementWithDom(p1)
      matchElementWithDom(p2)

      p2.removeChild(s3)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, c1])
      expect(p2slot.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(p2)

      s1.insertBefore(s3, s2)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s3, c4, s2, c2, c3, c1])
      expect(p2slot.getComposedChildren()).toStrictEqual([])
      expect(s1.childNodes).toStrictEqual([s3, s2, c1])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      s1.insertBefore(s3, c1)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, s3, c4, c1])
      expect(p2slot.getComposedChildren()).toStrictEqual([])
      expect(s1.childNodes).toStrictEqual([s2, s3, c1])
      matchElementWithDom(p1)

      s1.removeChild(s2)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s3, c4, c1])
      expect(p2slot.getComposedChildren()).toStrictEqual([])
      expect(s1.childNodes).toStrictEqual([s3, c1])
      matchElementWithDom(p1)
      matchElementWithDom(s2)

      s1.replaceChild(s2, c1)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s3, c4, s2, c2, c3])
      expect(p2slot.getComposedChildren()).toStrictEqual([])
      expect(s1.childNodes).toStrictEqual([s3, s2])
      matchElementWithDom(p1)
      matchElementWithDom(c1)

      p1.removeChild(s1)
      expect(p1slot.getComposedChildren()).toStrictEqual([])
      expect(p2slot.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(s1)
    })

    it('should be able to insert to multiple slots', function () {
      var p1 = root.shadowRoot.createComponent('component-slot-c')
      var p2 = root.shadowRoot.createComponent('component-slot-c')
      var p1slot0 = p1.shadowRoot.childNodes[0]
      var p1slot1 = p1.shadowRoot.childNodes[1].childNodes[0]
      var p1slot2 = p1.shadowRoot.childNodes[2]
      var p2slot5 = p2.shadowRoot.childNodes[0]
      glassEasel.Element.setSlotName(p2slot5, '5')
      var p2slot1 = p2.shadowRoot.childNodes[1].childNodes[0]
      var p2slot2 = p2.shadowRoot.childNodes[2]
      var s1 = root.shadowRoot.createVirtualNode('s1')
      var s2 = root.shadowRoot.createVirtualNode('s2')
      var s3 = root.shadowRoot.createVirtualNode('s3')
      glassEasel.Element.setInheritSlots(s1)
      glassEasel.Element.setInheritSlots(s2)
      glassEasel.Element.setInheritSlots(s3)
      var c1 = root.shadowRoot.createVirtualNode()
      var c2 = root.shadowRoot.createNativeNode('span')
      var c3 = root.shadowRoot.createNativeNode('span')
      var c4 = root.shadowRoot.createNativeNode('span')
      var c5 = root.shadowRoot.createVirtualNode()
      c1.slot = '1'
      c2.slot = 2
      c5.slot = 5
      s1.appendChild(s2)
      s1.appendChild(c1)
      s2.appendChild(c2)
      // s2.appendChild(c3)
      s3.appendChild(c4)
      s3.appendChild(c5)
      expect(s3.getComposedChildren()).toStrictEqual([])
      expect(s3.childNodes).toStrictEqual([c4, c5])
      matchElementWithDom(s1)
      matchElementWithDom(s3)

      p1.appendChild(s1)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      s1.appendChild(s3)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, s3, c4])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      s2.appendChild(c3)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, c3, s3, c4])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      p2.appendChild(s3)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, c3])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(p2slot1.getComposedChildren()).toStrictEqual([])
      expect(p2slot2.getComposedChildren()).toStrictEqual([])
      expect(p2slot5.getComposedChildren()).toStrictEqual([c5])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(p2)
      matchElementWithDom(s3)

      p2.removeChild(s3)
      expect(p2slot1.getComposedChildren()).toStrictEqual([])
      expect(p2slot2.getComposedChildren()).toStrictEqual([])
      expect(p2slot5.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p2)
      matchElementWithDom(s3)

      s1.insertBefore(s3, s2)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s3, c4, s2, c3])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(s3)

      s1.appendChild(s3)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, c3, s3, c4])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      s1.insertBefore(s3, s2)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s3, c4, s2, c3])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      s1.insertBefore(s3, s2)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s3, c4, s2, c3])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      s1.replaceChild(s3, s2)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s3, c4])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1])
      expect(p1slot2.getComposedChildren()).toStrictEqual([])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(s2)

      p1.removeChild(s1)
      expect(p1slot0.getComposedChildren()).toStrictEqual([])
      expect(p1slot1.getComposedChildren()).toStrictEqual([])
      expect(p1slot2.getComposedChildren()).toStrictEqual([])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(s1)
    })

    it('should be able to move between single and multiple slots', function () {
      var p1 = root.shadowRoot.createComponent('component-slot-e')
      var p2 = root.shadowRoot.createComponent('component-slot-c')
      var p1slot = p1.$.e.childNodes[0]
      var p2slot0 = p2.shadowRoot.childNodes[0]
      var p2slot1 = p2.shadowRoot.childNodes[1].childNodes[0]
      var p2slot2 = p2.shadowRoot.childNodes[2]
      var s1 = root.shadowRoot.createVirtualNode('s1')
      var s2 = root.shadowRoot.createVirtualNode('s2')
      var s3 = root.shadowRoot.createVirtualNode('s3')
      glassEasel.Element.setInheritSlots(s1)
      glassEasel.Element.setInheritSlots(s2)
      glassEasel.Element.setInheritSlots(s3)
      var c1 = root.shadowRoot.createVirtualNode()
      var c2 = root.shadowRoot.createNativeNode('span')
      var c3 = root.shadowRoot.createNativeNode('span')
      var c4 = root.shadowRoot.createNativeNode('span')
      var c5 = root.shadowRoot.createVirtualNode()
      c1.slot = '1'
      c2.slot = 2
      c5.slot = 1
      s1.appendChild(s2)
      s1.appendChild(c1)
      s2.appendChild(c2)
      s2.appendChild(c3)
      s3.appendChild(c4)
      s3.appendChild(c5)
      matchElementWithDom(s1)
      matchElementWithDom(s3)

      p1.appendChild(s3)
      expect(p1slot.getComposedChildren()).toStrictEqual([s3, c4, c5])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      p1.insertBefore(s1, s3)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, c1, s3, c4, c5])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      s1.appendChild(s3)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, c1, s3, c4, c5])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      p2.appendChild(s1)
      expect(p1slot.getComposedChildren()).toStrictEqual([])
      expect(p2slot0.getComposedChildren()).toStrictEqual([s1, s2, c3, s3, c4])
      expect(p2slot1.getComposedChildren()).toStrictEqual([c1, c5])
      expect(p2slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(p2)

      p2.insertBefore(s3, s1)
      expect(p2slot0.getComposedChildren()).toStrictEqual([s3, c4, s1, s2, c3])
      expect(p2slot1.getComposedChildren()).toStrictEqual([c5, c1])
      expect(p2slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(p2)

      p1.insertBefore(s1)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, c1])
      expect(p2slot0.getComposedChildren()).toStrictEqual([s3, c4])
      expect(p2slot1.getComposedChildren()).toStrictEqual([c5])
      expect(p2slot2.getComposedChildren()).toStrictEqual([])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(p2)

      s1.insertBefore(s3, c1)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, s3, c4, c5, c1])
      expect(p2slot0.getComposedChildren()).toStrictEqual([])
      expect(p2slot1.getComposedChildren()).toStrictEqual([])
      expect(p2slot2.getComposedChildren()).toStrictEqual([])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(p2)

      p2.appendChild(s3)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, c1])
      expect(p2slot0.getComposedChildren()).toStrictEqual([s3, c4])
      expect(p2slot1.getComposedChildren()).toStrictEqual([c5])
      expect(p2slot2.getComposedChildren()).toStrictEqual([])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(p2)

      s3.insertBefore(s1, c5)
      expect(p2slot0.getComposedChildren()).toStrictEqual([s3, c4, s1, s2, c3])
      expect(p2slot1.getComposedChildren()).toStrictEqual([c1, c5])
      expect(p2slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(p2)
    })

    it('should be able to change slot attributes', function () {
      var p1 = root.shadowRoot.createComponent('component-slot-c')
      var p1slot0 = p1.shadowRoot.childNodes[0]
      var p1slot1 = p1.shadowRoot.childNodes[1].childNodes[0]
      var p1slot2 = p1.shadowRoot.childNodes[2]
      var s1 = root.shadowRoot.createVirtualNode('s1')
      var s2 = root.shadowRoot.createVirtualNode('s2')
      var s3 = root.shadowRoot.createVirtualNode('s3')
      glassEasel.Element.setInheritSlots(s1)
      glassEasel.Element.setInheritSlots(s2)
      glassEasel.Element.setInheritSlots(s3)
      var c1 = root.shadowRoot.createVirtualNode()
      var c2 = root.shadowRoot.createNativeNode('span')
      var c3 = root.shadowRoot.createNativeNode('span')
      var c4 = root.shadowRoot.createNativeNode('span')
      var c5 = root.shadowRoot.createVirtualNode()
      c1.slot = '1'
      c2.slot = 2
      c5.slot = 1
      s1.appendChild(s2)
      s1.appendChild(c1)
      s2.appendChild(c2)
      s2.appendChild(c3)
      s3.appendChild(c4)
      s3.appendChild(c5)
      s1.appendChild(s3)
      matchElementWithDom(s1)

      p1.appendChild(s1)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, c3, s3, c4])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1, c5])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      c1.slot = '2'
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, c3, s3, c4])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c5])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2, c1])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      c3.slot = '1'
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, s3, c4])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c3, c5])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2, c1])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      c5.slot = ''
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, s3, c4, c5])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c3])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2, c1])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      c2.slot = ''
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, c2, s3, c4, c5])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c3])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c1])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
    })

    it('should be able to reassign slots in single slot', function () {
      var p1 = root.shadowRoot.createComponent('component-slot-e')
      var p1slot = p1.$.e.childNodes[0]
      var s1 = root.shadowRoot.createVirtualNode('s1')
      var s2 = root.shadowRoot.createVirtualNode('s2')
      var s3 = root.shadowRoot.createVirtualNode('s3')
      glassEasel.Element.setInheritSlots(s1)
      glassEasel.Element.setInheritSlots(s2)
      glassEasel.Element.setInheritSlots(s3)
      var c1 = root.shadowRoot.createVirtualNode()
      var c2 = root.shadowRoot.createNativeNode('span')
      var c3 = root.shadowRoot.createNativeNode('span')
      var c4 = root.shadowRoot.createNativeNode('span')
      var c5 = root.shadowRoot.createVirtualNode()
      c1.slot = '1'
      c2.slot = 2
      c5.slot = 1
      s1.appendChild(s2)
      s1.appendChild(c1)
      s2.appendChild(c2)
      s2.appendChild(c3)
      s3.appendChild(c4)
      s3.appendChild(c5)
      s1.appendChild(s3)
      matchElementWithDom(s1)

      p1.appendChild(s1)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, c1, s3, c4, c5])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      p1slot.cancelDestroyBackendElementOnDetach()
      p1.$.e.removeChild(p1slot)
      p1slot.destroyBackendElementOnDetach()
      expect(p1slot.getComposedChildren()).toStrictEqual([])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(s1)

      p1.shadowRoot.appendChild(p1slot)
      expect(p1slot.getComposedChildren()).toStrictEqual([s1, s2, c2, c3, c1, s3, c4, c5])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      expect(s3.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
      matchElementWithDom(s1)
    })

    it('should be able to reassign slots in multiple slots', function () {
      var p1 = root.shadowRoot.createComponent('component-slot-c')
      var p1slot0 = p1.shadowRoot.childNodes[0]
      var p1slot1 = p1.shadowRoot.childNodes[1].childNodes[0]
      var p1slot2 = p1.shadowRoot.childNodes[2]
      var s1 = root.shadowRoot.createVirtualNode('s1')
      var s2 = root.shadowRoot.createVirtualNode('s2')
      var s3 = root.shadowRoot.createVirtualNode('s3')
      glassEasel.Element.setInheritSlots(s1)
      glassEasel.Element.setInheritSlots(s2)
      glassEasel.Element.setInheritSlots(s3)
      var c1 = root.shadowRoot.createVirtualNode()
      var c2 = root.shadowRoot.createNativeNode('span')
      var c3 = root.shadowRoot.createNativeNode('span')
      var c4 = root.shadowRoot.createNativeNode('span')
      var c5 = root.shadowRoot.createVirtualNode()
      c1.slot = '1'
      c2.slot = 2
      c5.slot = 1
      s1.appendChild(s2)
      s1.appendChild(c1)
      s2.appendChild(c2)
      s2.appendChild(c3)
      s3.appendChild(c4)
      s3.appendChild(c5)
      s1.appendChild(s3)
      matchElementWithDom(s1)

      p1.appendChild(s1)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, c3, s3, c4])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1, c5])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      glassEasel.Element.setSlotName(p1slot1, '2')
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, c3, s3, c4])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c2])
      expect(p1slot2.getComposedChildren()).toStrictEqual([])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      p1slot0.cancelDestroyBackendElementOnDetach()
      p1slot0.parentNode.removeChild(p1slot0)
      p1slot0.destroyBackendElementOnDetach()
      expect(p1slot0.getComposedChildren()).toStrictEqual([])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c2])
      expect(p1slot2.getComposedChildren()).toStrictEqual([])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      glassEasel.Element.setSlotName(p1slot1, '')
      expect(p1slot0.getComposedChildren()).toStrictEqual([])
      expect(p1slot1.getComposedChildren()).toStrictEqual([s1, s2, c3, s3, c4])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      glassEasel.Element.setSlotName(p1slot1, '1')
      expect(p1slot0.getComposedChildren()).toStrictEqual([])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1, c5])
      expect(p1slot2.getComposedChildren()).toStrictEqual([c2])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      p1slot2.parentNode.removeChild(p1slot2)
      expect(p1slot0.getComposedChildren()).toStrictEqual([])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1, c5])
      expect(p1slot2.getComposedChildren()).toStrictEqual([])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)

      p1.shadowRoot.appendChild(p1slot0)
      expect(p1slot0.getComposedChildren()).toStrictEqual([s1, s2, c3, s3, c4])
      expect(p1slot1.getComposedChildren()).toStrictEqual([c1, c5])
      expect(p1slot2.getComposedChildren()).toStrictEqual([])
      expect(s1.getComposedChildren()).toStrictEqual([])
      expect(s2.getComposedChildren()).toStrictEqual([])
      matchElementWithDom(p1)
    })
  })
}

describe('VirtualNode (DOM backend)', function () {
  testCases(domBackend)
})
describe('VirtualNode (shadow backend)', function () {
  testCases(shadowBackend)
})
describe('VirtualNode (composed backend)', function () {
  testCases(composedBackend)
})
