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
      var placeholder = backendRoot.getShadowRoot().createElement('div')
      backendRoot.getShadowRoot().getRootNode().appendChild(placeholder)
      glassEasel.Element.replaceDocumentElement(root, backendRoot, placeholder)
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

    if (testBackend === domBackend)
      it('should work in a native-rendered root', function () {
        regElem({
          is: 'virtual-node-a',
          options: {
            externalComponent: true,
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

    if (testBackend === domBackend)
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
