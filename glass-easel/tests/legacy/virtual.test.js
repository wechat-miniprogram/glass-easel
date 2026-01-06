/* eslint-disable */

const {
  tmpl,
  domBackend,
  shadowBackend,
  composedBackend,
  getCustomExternalTemplateEngine,
} = require('../base/env')
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

  describe('#appendChild', function () {
    it('should convert to correct DOM appendChild (directly)', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      v1.appendChild(e2)
      v1.appendChild(v2)
      v2.appendChild(e3)
      e1.appendChild(v1)
      matchElementWithDom(e1)
    })

    it('should convert to correct DOM appendChild (with more convertion)', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v3 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      e1.appendChild(v1)
      v1.appendChild(v2)
      v1.appendChild(v3)
      v2.appendChild(e2)
      v3.appendChild(e3)
      matchElementWithDom(e1)
    })

    it('should convert to correct DOM insertBefore', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual1', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual2', root.shadowRoot)
      var v3 = glassEasel.VirtualNode.create('virtual3', root.shadowRoot)
      e1.appendChild(v1)
      v1.appendChild(v2)
      v1.appendChild(v3)
      v3.appendChild(e3)
      v2.appendChild(e2)
      matchElementWithDom(e1)
    })

    it('should work in a virtual root', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      v1.appendChild(e1)
      e1.appendChild(v2)
      v2.appendChild(e2)
      v2.appendChild(e3)
      matchElementWithDom(e1)
    })

    if (testBackend !== shadowBackend) it('should work in a native-rendered root', function () {
      regElem({
        is: 'virtual-node-a',
        options: {
          externalComponent: true,
          templateEngine:
            testBackend === domBackend
              ? undefined
              : getCustomExternalTemplateEngine((comp) => {
                  var root = comp.getBackendElement()
                  var slot = testBackend.createElement('div', 'div')
                  root.appendChild(slot)
                  return {
                    root,
                    slot,
                    getIdMap: () => ({}),
                    handleEvent() {},
                    setListener() {},
                  }
                }),
        },
        template: '<div><slot></slot></div>',
      })
      var e1 = root.shadowRoot.createComponent('virtual-node-a')
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      v1.appendChild(e2)
      v1.appendChild(e3)
      e2.appendChild(v2)
      e1.appendChild(v1)
      matchElementWithDom(e1, e1.shadowRoot.root)
    })
  })

  describe('#insertBefore', function () {
    it('should convert to correct DOM insertBefore (directly)', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      e1.appendChild(v1)
      v1.appendChild(e3)
      e1.appendChild(v1)
      v1.appendChild(e3)
      v2.appendChild(e2)
      v1.insertBefore(v2, e3)
      v1.insertBefore(v2, v2)
      matchElementWithDom(e1)
    })

    it('should convert to correct DOM insertBefore (with more convertion)', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v3 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      e1.appendChild(v1)
      v1.appendChild(v3)
      v2.appendChild(e2)
      v3.appendChild(e3)
      v1.insertBefore(v2, v3)
      matchElementWithDom(e1)
    })

    it('should convert to correct DOM appendChild', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v3 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v4 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      e1.appendChild(v1)
      v1.appendChild(v4)
      v1.insertBefore(v2, v4)
      v1.insertBefore(v2, v4)
      v2.appendChild(v3)
      v3.insertBefore(e2)
      matchElementWithDom(e1)
    })
  })

  describe('#removeChild', function () {
    it('should convert to correct DOM removeChild (directly)', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var e4 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      e1.appendChild(v1)
      v1.appendChild(e2)
      v1.appendChild(e4)
      v1.appendChild(e3)
      v1.removeChild(e4)
      matchElementWithDom(e1)
      matchElementWithDom(e4)
      expect(e4.parentNode).toBe(null)
    })

    it('should convert to correct DOM removeChild (with more convertion)', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var e4 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      e1.appendChild(v1)
      v1.appendChild(e2)
      v1.appendChild(v2)
      v2.appendChild(e4)
      v1.appendChild(e3)
      e1.removeChild(v1)
      matchElementWithDom(e1)
      matchElementWithDom(v1)
      expect(v1.parentNode).toBe(null)
    })
  })

  describe('#replaceChild', function () {
    it('should convert to correct DOM replaceChild (replacing directly at the end)', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v3 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v4 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      e1.appendChild(v1)
      v1.appendChild(v3)
      v1.appendChild(v4)
      v2.appendChild(e2)
      v3.appendChild(e3)
      v1.replaceChild(v2, v3)
      matchElementWithDom(e1)
      matchElementWithDom(v3)
      expect(v3.parentNode).toBe(null)
      v1.replaceChild(v2, v2)
      matchElementWithDom(e1)
    })

    it('should convert to correct DOM replaceChild (replacing indirectly at the end)', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v3 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v4 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      e1.appendChild(v1)
      v1.appendChild(v3)
      v1.appendChild(v4)
      v2.appendChild(e2)
      v3.appendChild(e3)
      v1.replaceChild(v2, v3)
      matchElementWithDom(e1)
      matchElementWithDom(v3)
      expect(v3.parentNode).toBe(null)
    })

    it('should convert to correct DOM replaceChild (replacing not at the end)', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v3 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v4 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      e1.appendChild(v1)
      v1.appendChild(v3)
      v1.appendChild(v4)
      v2.appendChild(e2)
      v3.appendChild(e3)
      v4.appendChild(e3)
      v1.replaceChild(v2, v3)
      matchElementWithDom(e1)
      matchElementWithDom(v3)
      expect(v3.parentNode).toBe(null)
    })
  })

  describe('#insertChildren #removeChildren', function () {
    it('should able to do batch-insertion', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      var v3 = glassEasel.VirtualNode.create('virtual', root.shadowRoot)
      v1.insertChildren([e2], 0)
      v1.insertChildren([v2], 1)
      v1.insertChildren([v3], 1)
      e1.insertChildren([v1, e3], 0)
      matchElementWithDom(e1)
    })

    it('should able to do batch-removal', function () {
      var e1 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('span', root.shadowRoot)
      var e3 = glassEasel.TextNode.create('text', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('v1', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('v2', root.shadowRoot)
      var v3 = glassEasel.VirtualNode.create('v3', root.shadowRoot)
      v1.insertChildren([e2], 0)
      v1.insertChildren([v2], 1)
      e1.insertChildren([e3, v3, v1], 0)
      e1.removeChildren(1, 2)
      matchElementWithDom(e1)
      matchElementWithDom(v3)
      expect(v3.parentNode).toBe(null)
      matchElementWithDom(v1)
      expect(v1.parentNode).toBe(null)
    })
  })

  describe('#selfReplaceWith', function () {
    it('should replace native node with children', function () {
      var e1 = glassEasel.NativeNode.create('e1', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('e2', root.shadowRoot)
      var e3 = glassEasel.NativeNode.create('e3', root.shadowRoot)
      var e4 = glassEasel.NativeNode.create('e4', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('v1', root.shadowRoot)
      var t1 = glassEasel.TextNode.create('t1', root.shadowRoot)
      var t2 = glassEasel.TextNode.create('t2', root.shadowRoot)
      e1.appendChild(e2)
      e2.appendChild(e3)
      e2.appendChild(v1)
      v1.appendChild(t1)
      e2.appendChild(t2)

      e2.selfReplaceWith(e4)
      matchElementWithDom(e1)
      matchElementWithDom(e2)
      expect(e2.parentNode).toBe(null)
      expect(e2.childNodes.length).toBe(0)
    })

    it('should replace virtual node with children', function () {
      var e1 = glassEasel.NativeNode.create('e1', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('e2', root.shadowRoot)
      var e3 = glassEasel.NativeNode.create('e3', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('v1', root.shadowRoot)
      var v2 = glassEasel.VirtualNode.create('v2', root.shadowRoot)
      var v3 = glassEasel.VirtualNode.create('v3', root.shadowRoot)
      var t1 = glassEasel.TextNode.create('t1', root.shadowRoot)
      var t2 = glassEasel.TextNode.create('t2', root.shadowRoot)
      e1.appendChild(e2)
      e2.appendChild(e3)
      e2.appendChild(v1)
      v1.appendChild(t1)
      e2.appendChild(t2)

      e2.selfReplaceWith(v2)
      matchElementWithDom(e1)
      matchElementWithDom(e2)
      expect(e2.parentNode).toBe(null)
      expect(e2.childNodes.length).toBe(0)

      v2.selfReplaceWith(v3)
      matchElementWithDom(e1)
      matchElementWithDom(v2)
      expect(v2.parentNode).toBe(null)
      expect(v2.childNodes.length).toBe(0)

      v3.selfReplaceWith(e2)
      matchElementWithDom(e1)
      matchElementWithDom(v3)
      expect(v3.parentNode).toBe(null)
      expect(v3.childNodes.length).toBe(0)
    })

    it('should replace component with children', function () {
      regElem({
        is: 'comp1',
        template: '<div><slot /></div>',
      })
      regElem({
        is: 'comp2',
        options: { multipleSlots: true },
        template: '<div><slot name="b"/></div><slot name="a" />',
      })
      var e1 = glassEasel.NativeNode.create('e1', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('e2', root.shadowRoot)
      var e3 = glassEasel.NativeNode.create('e3', root.shadowRoot)
      var e4 = glassEasel.NativeNode.create('e4', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('v1', root.shadowRoot)
      var t1 = glassEasel.TextNode.create('t1', root.shadowRoot)
      var c1 = root.shadowRoot.createComponent('comp1')
      var c2 = root.shadowRoot.createComponent('comp2')
      e1.appendChild(e2)
      e2.appendChild(e3)
      e2.appendChild(v1)
      v1.appendChild(t1)
      e2.appendChild(e4)
      e4.slot = 'b'

      e2.selfReplaceWith(c1)
      matchElementWithDom(e1)
      expect(e2.parentNode).toBe(null)
      expect(e2.childNodes.length).toBe(0)

      c1.selfReplaceWith(c2)
      matchElementWithDom(e1)
      expect(c1.parentNode).toBe(null)
      expect(c1.childNodes.length).toBe(0)

      c2.selfReplaceWith(c1)
      matchElementWithDom(e1)
      expect(c2.parentNode).toBe(null)
      expect(c2.childNodes.length).toBe(0)
    })

    it('should replace virtualHost component with children', function () {
      regElem({
        is: 'virtual-comp1',
        options: { virtualHost: true },
        template: '<div>virtual</div><slot />',
      })
      regElem({
        is: 'comp1',
        template: '<div>actual</div><slot />',
      })
      regElem({
        is: 'virtual-comp2',
        options: { multipleSlots: true, virtualHost: true },
        template: '<slot name="a" /><div>virtual</div><slot name="b"/>',
      })
      regElem({
        is: 'comp2',
        options: { multipleSlots: true },
        template: '<div><slot name="b"/>actual</div><slot name="a" />',
      })
      var e1 = glassEasel.NativeNode.create('e1', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('e2', root.shadowRoot)
      var e3 = glassEasel.NativeNode.create('e3', root.shadowRoot)
      var e4 = glassEasel.NativeNode.create('e4', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('v1', root.shadowRoot)
      var t1 = glassEasel.TextNode.create('t1', root.shadowRoot)
      var c1 = root.shadowRoot.createComponent('comp1')
      var vc1 = root.shadowRoot.createComponent('virtual-comp1')
      var c2 = root.shadowRoot.createComponent('comp2')
      var vc2 = root.shadowRoot.createComponent('virtual-comp2')
      e1.appendChild(e2)
      e2.appendChild(e3)
      e2.appendChild(v1)
      v1.appendChild(t1)
      e2.appendChild(e4)
      e4.slot = 'b'

      e2.selfReplaceWith(vc1)
      matchElementWithDom(e1)
      expect(e2.parentNode).toBe(null)
      expect(e2.childNodes.length).toBe(0)

      vc1.selfReplaceWith(vc2)
      matchElementWithDom(e1)
      expect(vc1.parentNode).toBe(null)
      expect(vc1.childNodes.length).toBe(0)

      vc2.selfReplaceWith(c2)
      matchElementWithDom(e1)
      expect(vc2.parentNode).toBe(null)
      expect(vc2.childNodes.length).toBe(0)
    })

    it('should replace nested virtualHost component with children', function () {
      regElem({
        is: 'virtual-comp1',
        options: { virtualHost: true },
        template: '<slot />',
      })
      regElem({
        is: 'comp1',
        template: '<div><slot /></div>',
      })
      regElem({
        is: 'virtual-comp2',
        options: { multipleSlots: true, virtualHost: true },
        template: '<slot name="a" /><slot name="b"/>',
      })
      regElem({
        is: 'comp2',
        options: { multipleSlots: true },
        template: '<div><slot name="b"/></div><slot name="a" />',
      })
      var e1 = glassEasel.NativeNode.create('e1', root.shadowRoot)
      var e2 = glassEasel.NativeNode.create('e2', root.shadowRoot)
      var e3 = glassEasel.NativeNode.create('e3', root.shadowRoot)
      var e4 = glassEasel.NativeNode.create('e4', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('v1', root.shadowRoot)
      var t1 = glassEasel.TextNode.create('t1', root.shadowRoot)
      var c1 = root.shadowRoot.createComponent('comp1')
      var vc1 = root.shadowRoot.createComponent('virtual-comp1')
      var c2 = root.shadowRoot.createComponent('comp2')
      var vc2 = root.shadowRoot.createComponent('virtual-comp2')
      e1.appendChild(e2)
      e2.appendChild(e3)
      e2.appendChild(v1)
      v1.appendChild(t1)
      e2.appendChild(e4)
      e4.slot = 'b'

      e2.selfReplaceWith(vc1)
      matchElementWithDom(e1)
      expect(e2.parentNode).toBe(null)
      expect(e2.childNodes.length).toBe(0)

      vc1.selfReplaceWith(c1)
      matchElementWithDom(e1)
      expect(vc1.parentNode).toBe(null)
      expect(vc1.childNodes.length).toBe(0)

      c1.selfReplaceWith(vc2)
      matchElementWithDom(e1)
      expect(c1.parentNode).toBe(null)
      expect(c1.childNodes.length).toBe(0)

      vc2.selfReplaceWith(c2)
      matchElementWithDom(e1)
      expect(vc2.parentNode).toBe(null)
      expect(vc2.childNodes.length).toBe(0)

      c2.selfReplaceWith(vc2)
      matchElementWithDom(e1)
      expect(c2.parentNode).toBe(null)
      expect(c2.childNodes.length).toBe(0)

      vc2.selfReplaceWith(vc1)
      matchElementWithDom(e1)
      expect(vc2.parentNode).toBe(null)
      expect(vc2.childNodes.length).toBe(0)

      vc1.selfReplaceWith(vc2)
      matchElementWithDom(e1)
      expect(vc1.parentNode).toBe(null)
      expect(vc1.childNodes.length).toBe(0)
    })

    it('should replace slot contents with children', function () {
      regElem({
        is: 'wrapper',
        template: '<div><slot /></div>',
      })
      regElem({
        is: 'comp1',
        template: '<div><slot /></div>',
      })
      regElem({
        is: 'comp2',
        options: { multipleSlots: true },
        template: '<div><slot name="b"/></div><slot name="a" />',
      })
      var e1 = root.shadowRoot.createComponent('wrapper')
      var e2 = glassEasel.NativeNode.create('e2', root.shadowRoot)
      var e3 = glassEasel.NativeNode.create('e3', root.shadowRoot)
      var e4 = glassEasel.NativeNode.create('e4', root.shadowRoot)
      var v1 = glassEasel.VirtualNode.create('v1', root.shadowRoot)
      var t1 = glassEasel.TextNode.create('t1', root.shadowRoot)
      var c1 = root.shadowRoot.createComponent('comp1')
      var c2 = root.shadowRoot.createComponent('comp2')
      e1.appendChild(e2)
      e2.appendChild(e3)
      e2.appendChild(v1)
      v1.appendChild(t1)
      e2.appendChild(e4)
      e4.slot = 'b'

      e2.selfReplaceWith(c1)
      matchElementWithDom(e1)
      expect(e2.parentNode).toBe(null)
      expect(e2.childNodes.length).toBe(0)

      c1.selfReplaceWith(c2)
      matchElementWithDom(e1)
      expect(c1.parentNode).toBe(null)
      expect(c1.childNodes.length).toBe(0)

      c2.selfReplaceWith(c1)
      matchElementWithDom(e1)
      expect(c2.parentNode).toBe(null)
      expect(c2.childNodes.length).toBe(0)
    })

    it('should trigger lifetimes correctly', function () {
      const lifetimeCalls = []
      const createElement = (name) => {
        const def = componentSpace.defineComponent({
          is: `self-replace-with-${name}`,
          lifetimes: {
            attached() {
              lifetimeCalls.push(`${name}#attached`)
            },
            moved() {
              lifetimeCalls.push(`${name}#moved`)
            },
            detached() {
              lifetimeCalls.push(`${name}#detached`)
            },
          },
        })
        return glassEasel.Component.createWithContext(name, def, testBackend)
      }

      const parent = createElement('parent')
      const elem = createElement('elem')
      const child1 = createElement('child1')
      const child2 = createElement('child2')
      const childOfChild = createElement('child-of-child')

      parent.appendChild(elem)
      elem.appendChild(child1)
      elem.appendChild(child2)
      child1.appendChild(childOfChild)

      glassEasel.Element.pretendAttached(parent)

      matchElementWithDom(parent)
      expect(lifetimeCalls).toEqual([
        'parent#attached',
        'elem#attached',
        'child1#attached',
        'child-of-child#attached',
        'child2#attached',
      ])
      lifetimeCalls.length = 0

      const replacer = createElement('replacer')
      elem.selfReplaceWith(replacer)

      matchElementWithDom(parent)
      expect(lifetimeCalls).toEqual([
        'elem#detached',
        'replacer#attached',
        'child-of-child#moved',
        'child1#moved',
        'child2#moved',
      ])
    })
  })

  describe('component virtualHost', function () {
    it('should create virtualized host node', function () {
      regElem({
        is: 'virtual-host-a',
        options: {
          virtualHost: true,
        },
        template: '<div><slot /></div>',
      })
      regElem({
        is: 'virtual-host-b',
        options: {
          virtualHost: true,
        },
        template:
          '<span><virtual-host-a><slot /></virtual-host-a></span><virtual-host-a></virtual-host-a>',
      })
      var parent = glassEasel.NativeNode.create('span', root.shadowRoot)
      var elem = root.shadowRoot.createComponent('virtual-host-b')
      parent.appendChild(elem)
      matchElementWithDom(parent)
    })

    if (testBackend !== shadowBackend) {
      it('should handles tree manipulations', function () {
        regElem({
          is: 'virtual-host-c',
          options: {
            virtualHost: true,
          },
          template: '<slot />',
        })
        regElem({
          is: 'virtual-host-d',
          options: {
            virtualHost: true,
          },
          template: '<div id="v"><span id="s"><slot /></span></div>',
        })
        regElem({
          is: 'virtual-host-e',
          template:
            '<virtual-host-c id="c"><virtual-host-d /></virtual-host-c><virtual-host-d id="d"><virtual-host-c /></virtual-host-d>',
        })
        var elem = createElem('virtual-host-e')
        expect(elem.$$.childNodes[0]).toBe(elem.$.c.childNodes[0].$.v.$$)
        expect(elem.$$.childNodes[1]).toBe(elem.$.d.$.v.$$)
        matchElementWithDom(elem)
        elem.$.d.shadowRoot.insertBefore(elem.$.d.$.s, elem.$.d.$.v)
        expect(elem.$$.childNodes[1]).toBe(elem.$.d.$.s.$$)
        matchElementWithDom(elem)
        elem.$.c.replaceChild(elem.$.d, elem.$.c.childNodes[0])
        expect(elem.$$.childNodes[0]).toBe(elem.$.d.$.s.$$)
        expect(elem.$$.childNodes.length).toBe(2)
        matchElementWithDom(elem)
        elem.$.c.removeChild(elem.$.c.childNodes[0])
        expect(elem.$$.childNodes.length).toBe(0)
        matchElementWithDom(elem)
      })
    }

    it('should handles wx-if update', function () {
      regElem({
        is: 'list-view',
        options: {
          virtualHost: true,
        },
        template: '<listview><slot /></listview>',
      })
      regElem({
        is: 'virtual-host-b',
        options: {
          virtualHost: true,
        },
        data: {
          a: false,
          b: false,
        },
        template: '<a wx:if="{{a}}" /><b wx:if="{{b}}" />',
      })
      regElem({
        is: 'c',
        options: {},
        template: '<list-view><virtual-host-b id="b" /></list-view><span />',
      })
      var parent = glassEasel.NativeNode.create('span', root.shadowRoot)
      var elem = root.shadowRoot.createComponent('c')
      parent.appendChild(elem)
      matchElementWithDom(parent)

      elem.$.b.setData({ a: true })
      matchElementWithDom(parent)

      elem.$.b.setData({ a: false, b: true })
      matchElementWithDom(parent)

      elem.$.b.setData({ b: false })
      matchElementWithDom(parent)
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
