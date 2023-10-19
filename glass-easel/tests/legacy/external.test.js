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
  const ret = componentSpace.defineComponent(c)
  componentSpace.setGlobalUsingComponent(config.is, ret)
  return ret
}

const createElem = (is, backend) => {
  const def = componentSpace.getComponent(is)
  return glassEasel.Component.createWithContext(is || 'test', def, backend || domBackend)
}

var matchElementWithDom = require('../base/match').native

describe('Element', function () {
  var root = null

  beforeAll(function () {
    root = createElem('root')
    root.$$.id = 'root'
    var placeholder = document.createElement('div')
    document.body.appendChild(placeholder)
    glassEasel.Element.replaceDocumentElement(root, document.body, placeholder)

    regElem({
      is: 'element-a',
      options: {
        externalComponent: true,
        dataDeepCopy: glassEasel.DeepCopyKind.None,
      },
      template: '<p>{{s}}</p> <slot></slot>',
      properties: {
        s: {
          type: String,
          value: 'DEFAULT',
        },
      },
      created: function () {
        this._attached = false
        this._attachedTimes = 0
        this._movedTimes = 0
        this._detachedTimes = 0
      },
      attached: function () {
        expect(this._attached).toBe(false)
        this._attached = true
        this._attachedTimes++
      },
      moved: function () {
        expect(this._attached).toBe(true)
        this._movedTimes++
      },
      detached: function () {
        expect(this._attached).toBe(true)
        this._attached = false
        this._detachedTimes++
      },
    })
  })

  it('should be able to register and create element', function () {
    var elem = createElem('element-a')
    root.appendChild(elem)

    expect(elem).toBeInstanceOf(glassEasel.Element)
    expect(elem.parentNode).toBe(root)
    expect(elem.childNodes).toStrictEqual([])
    expect(elem.$$).toBeInstanceOf(window.HTMLElement)
    expect(elem.$$.childNodes[0].tagName).toBe('P')
    expect(elem.$$.childNodes[1].tagName).toBe('VIRTUAL')
    expect(elem.$$.childNodes[0].childNodes[0].textContent).toBe('DEFAULT')
  })

  it('should call attached, moved, and detached', function () {
    var e1 = createElem('element-a')
    var e2 = createElem('element-a')
    var e3 = createElem('element-a')
    var e4 = createElem('element-a')
    e1.id = 'e1'
    e2.id = 'e2'
    e3.id = 'e3'
    e4.id = 'e4'

    // attach to a detached parent
    e1.appendChild(e2)
    e2.appendChild(e3)
    e2.insertBefore(e4, e3)
    expect(e1._attached).toBe(false)
    expect(e2._attached).toBe(false)
    expect(e3._attached).toBe(false)
    expect(e4._attached).toBe(false)
    expect(e3._movedTimes).toBe(0)
    expect(e4._movedTimes).toBe(0)

    // attach to an attached parent
    root.appendChild(e1)
    expect(e1._attached).toBe(true)
    expect(e2._attached).toBe(true)
    expect(e3._attached).toBe(true)
    expect(e4._attached).toBe(true)
    expect(e1._attachedTimes).toBe(1)
    expect(e2._attachedTimes).toBe(1)
    expect(e3._attachedTimes).toBe(1)
    expect(e4._attachedTimes).toBe(1)

    // move a child
    e2.insertBefore(e3, e4)
    expect(e3._movedTimes).toBe(1)
    expect(e4._movedTimes).toBe(0)
    expect(e4._attached).toBe(true)
    e2.replaceChild(e3, e4)
    e2.replaceChild(e3, e3)
    expect(e2._movedTimes).toBe(0)
    expect(e3._movedTimes).toBe(3)
    expect(e4._movedTimes).toBe(0)
    expect(e4._attached).toBe(false)
    expect(e3._attachedTimes).toBe(1)
    expect(e3._detachedTimes).toBe(0)
    expect(e4._attachedTimes).toBe(1)
    expect(e4._detachedTimes).toBe(1)

    // detach from an attached parent
    e1.removeChild(e2)
    expect(e1._attached).toBe(true)
    expect(e2._attached).toBe(false)
    expect(e3._attached).toBe(false)
    expect(e1._attachedTimes).toBe(1)
    expect(e2._attachedTimes).toBe(1)
    expect(e3._attachedTimes).toBe(1)
    expect(e1._detachedTimes).toBe(0)
    expect(e2._detachedTimes).toBe(1)
    expect(e3._detachedTimes).toBe(1)

    // detech from an detached parent
    e2.removeChild(e3)
    expect(e1._attached).toBe(true)
    expect(e2._attached).toBe(false)
    expect(e3._attached).toBe(false)
    expect(e1._detachedTimes).toBe(0)
    expect(e2._detachedTimes).toBe(1)
    expect(e3._detachedTimes).toBe(1)
  })

  describe('#appendChild', function () {
    it('should work for detached child', function () {
      var parent = createElem('element-a')
      parent.id = 'p'
      root.appendChild(parent)
      var child1 = createElem('element-a')
      child1.id = 'c'
      parent.appendChild(child1)
      expect(child1._attached).toBe(true)
      matchElementWithDom({
        element: parent,
        childNodes: [
          {
            element: child1,
          },
        ],
      })
    })

    it('should work for appended child', function () {
      var parent = createElem('element-a')
      root.appendChild(parent)
      var child1 = createElem('element-a')
      child1.id = 'c1'
      var child2 = createElem('element-a')
      child2.id = 'c2'
      var waitingEvents = 4
      var observer = glassEasel.Observer.create(function (e) {
        if (waitingEvents > 2) {
          expect(e.addedNodes[0]._attached).toBe(true)
          expect(e.removedNodes).toBe(undefined)
        } else if (waitingEvents === 2) {
          expect(e.addedNodes[0]).toBe(e.removedNodes[0])
          expect(e.removedNodes[0]._attached).toBe(true)
        } else {
          expect(e.addedNodes).toBe(undefined)
          expect(e.removedNodes[0]._attached).toBe(true)
        }
        waitingEvents--
      })
      observer.observe(parent, { childList: true })

      parent.appendChild(child1)
      parent.appendChild(child2)
      matchElementWithDom({
        element: parent,
        childNodes: [
          {
            element: child1,
          },
          {
            element: child2,
          },
        ],
      })

      parent.insertBefore(child2, child1)
      matchElementWithDom({
        element: parent,
        childNodes: [
          {
            element: child2,
          },
          {
            element: child1,
          },
        ],
      })

      child2.appendChild(child1)
      matchElementWithDom({
        element: parent,
        childNodes: [
          {
            element: child2,
            childNodes: [
              {
                element: child1,
              },
            ],
          },
        ],
      })

      expect(waitingEvents).toBe(0)
    })
  })

  describe('#insertBefore', function () {
    it('should work for detached child', function () {
      var parent = createElem('element-a')
      root.appendChild(parent)
      var waitingEvents = 3
      var observer = glassEasel.Observer.create(function (e) {
        waitingEvents--
        expect(e.addedNodes[0]._attached).toBe(true)
      })
      observer.observe(parent, { childList: true })

      var child1 = createElem('element-a')
      var child2 = createElem('element-a')
      parent.insertBefore(child1, child2)
      parent.appendChild(child1)
      parent.insertBefore(child2, child1)
      matchElementWithDom({
        element: parent,
        childNodes: [
          {
            element: child2,
          },
          {
            element: child1,
          },
        ],
      })
      expect(waitingEvents).toBe(0)
    })

    it('should work for appended child', function () {
      var parent = createElem('element-a')
      root.appendChild(parent)
      var child1 = createElem('element-a')
      var child2 = createElem('element-a')
      var waitingEvents = 2
      var observer = glassEasel.Observer.create(function (e) {
        waitingEvents--
        expect(e.addedNodes[0]._attached).toBe(true)
      })
      observer.observe(parent, { childList: true })

      parent.appendChild(child1)
      child1.appendChild(child2)
      parent.insertBefore(child2, child1)
      matchElementWithDom({
        element: parent,
        childNodes: [
          {
            element: child2,
          },
          {
            element: child1,
          },
        ],
      })
      expect(waitingEvents).toBe(0)
    })

    it('should work for appended child (on the same parent element)', function () {
      var parent = createElem('element-a')
      root.appendChild(parent)
      var child1 = createElem('element-a')
      var child2 = createElem('element-a')
      var child3 = createElem('element-a')
      var child4 = createElem('element-a')
      var waitingEvents = 5
      var observer = glassEasel.Observer.create(function (e) {
        if (waitingEvents-- !== 1) {
          expect(e.addedNodes[0]._attached).toBe(true)
        } else {
          expect(e.addedNodes[0]).toBe(e.removedNodes[0])
          expect(e.removedNodes[0]._attached).toBe(true)
        }
      })
      observer.observe(parent, { childList: true })

      parent.insertBefore(child1)
      parent.insertBefore(child2)
      parent.insertBefore(child3)
      parent.insertBefore(child4)
      parent.insertBefore(child2, child4)
      matchElementWithDom({
        element: parent,
        childNodes: [
          {
            element: child1,
          },
          {
            element: child3,
          },
          {
            element: child2,
          },
          {
            element: child4,
          },
        ],
      })
      expect(waitingEvents).toBe(0)
    })
  })

  describe('#removeChild', function () {
    it('should work for appended child', function () {
      var parent = createElem('element-a')
      root.appendChild(parent)
      var waitingEvents = 2
      var observer = glassEasel.Observer.create(function (e) {
        if (waitingEvents-- === 2) {
          expect(e.addedNodes[0]._attached).toBe(true)
        } else {
          expect(e.removedNodes[0]._attached).toBe(false)
        }
      })
      observer.observe(parent, { childList: true })

      var child1 = createElem('element-a')
      parent.appendChild(child1)
      parent.removeChild(child1)
      matchElementWithDom({
        element: parent,
        childNodes: [],
      })
      expect(waitingEvents).toBe(0)
    })

    it('should work for detached child', function () {
      var parent = createElem('element-a')
      root.appendChild(parent)
      var child1 = createElem('element-a')
      parent.removeChild(child1)
      matchElementWithDom({
        element: parent,
        childNodes: [],
      })
    })
  })

  describe('#replaceChild', function () {
    it('should work for detached child', function () {
      var parent = createElem('element-a')
      root.appendChild(parent)
      var waitingEvents = 4
      var observer = glassEasel.Observer.create(function (e) {
        if (waitingEvents-- !== 2) {
          expect(e.addedNodes[0]._attached).toBe(true)
        } else {
          expect(e.removedNodes[0]._attached).toBe(false)
        }
      })
      observer.observe(parent, { childList: true })

      var child1 = createElem('element-a')
      var child2 = createElem('element-a')
      var child3 = createElem('element-a')
      parent.insertBefore(child1)
      parent.insertBefore(child2)
      parent.replaceChild(child3, child1)
      matchElementWithDom({
        element: parent,
        childNodes: [
          {
            element: child3,
          },
          {
            element: child2,
          },
        ],
      })
      expect(waitingEvents).toBe(0)
    })

    it('should work for appended child', function () {
      var parent = createElem('element-a')
      root.appendChild(parent)
      var child1 = createElem('element-a')
      var child2 = createElem('element-a')
      var child3 = createElem('element-a')
      var waitingEvents = 4
      var observer = glassEasel.Observer.create(function (e) {
        if (waitingEvents-- !== 2) {
          expect(e.addedNodes[0]._attached).toBe(true)
        } else {
          expect(e.removedNodes[0]._attached).toBe(false)
        }
      })
      observer.observe(parent, { childList: true })

      parent.appendChild(child1)
      parent.appendChild(child2)
      child2.appendChild(child3)
      parent.replaceChild(child3, child2)
      matchElementWithDom({
        element: parent,
        childNodes: [
          {
            element: child1,
          },
          {
            element: child3,
          },
        ],
      })
      expect(waitingEvents).toBe(0)
    })

    it('should work for appended child (child === oldChild)', function () {
      var parent = createElem('element-a')
      root.appendChild(parent)
      var child1 = createElem('element-a')
      var child2 = createElem('element-a')
      var waitingEvents = 3
      var observer = glassEasel.Observer.create(function (e) {
        if (waitingEvents-- !== 1) {
          expect(e.addedNodes[0]._attached).toBe(true)
        } else {
          expect(e.removedNodes[0]._attached).toBe(true)
        }
      })
      observer.observe(parent, { childList: true })

      parent.appendChild(child1)
      parent.appendChild(child2)
      parent.replaceChild(child1, child1)
      matchElementWithDom({
        element: parent,
        childNodes: [
          {
            element: child1,
          },
          {
            element: child2,
          },
        ],
      })
      expect(waitingEvents).toBe(0)
    })

    it('should work for appended child (on the same parent element)', function () {
      var parent = createElem('element-a')
      root.appendChild(parent)
      var child1 = createElem('element-a')
      var child2 = createElem('element-a')
      var child3 = createElem('element-a')
      var child4 = createElem('element-a')
      var waitingEvents = 6
      var observer = glassEasel.Observer.create(function (e) {
        if (waitingEvents > 2) {
          expect(e.addedNodes[0]._attached).toBe(true)
        } else if (waitingEvents === 2) {
          expect(e.removedNodes[0]._attached).toBe(false)
        } else {
          expect(e.addedNodes[0]).toBe(e.removedNodes[0])
          expect(e.removedNodes[0]._attached).toBe(true)
        }
        waitingEvents--
      })
      observer.observe(parent, { childList: true })

      parent.appendChild(child1)
      parent.appendChild(child2)
      parent.appendChild(child3)
      parent.appendChild(child4)
      parent.replaceChild(child2, child4)
      matchElementWithDom({
        element: parent,
        childNodes: [
          {
            element: child1,
          },
          {
            element: child3,
          },
          {
            element: child2,
          },
        ],
      })
      expect(waitingEvents).toBe(0)
    })
  })

  it('should support class segments', function () {
    var e = createElem('element-a')
    e.setNodeClass('c1 c2')
    expect(e.$$.classList.value).toBe('c1 c2')
    e.setNodeClass('e1 e2', 2)
    expect(e.$$.classList.value).toBe('c1 c2 e1 e2')
    e.setNodeClass('d1', 1)
    expect(e.$$.classList.value).toBe('c1 c2 e1 e2 d1')
    e.setNodeClass('')
    expect(e.$$.classList.value).toBe('e1 e2 d1')
    e.setNodeClass('c1 c2 c3')
    expect(e.$$.classList.value).toBe('e1 e2 d1 c1 c2 c3')
    e.setNodeClass('d1 d2', 1)
    expect(e.$$.classList.value).toBe('e1 e2 d1 c1 c2 c3 d2')
    e.setNodeClass('', 1)
    expect(e.$$.classList.value).toBe('e1 e2 c1 c2 c3')
    e.setNodeClass('e1', 2)
    expect(e.$$.classList.value).toBe('e1 c1 c2 c3')
    e.setNodeClass('d1 d2 d3', 1)
    expect(e.$$.classList.value).toBe('e1 c1 c2 c3 d1 d2 d3')
    e.setNodeClass('e1 e2', 2)
    expect(e.$$.classList.value).toBe('e1 c1 c2 c3 d1 d2 d3 e2')
    e.setNodeClass('', 2)
    expect(e.$$.classList.value).toBe('c1 c2 c3 d1 d2 d3')
  })

  it('should support style segments', function () {
    var e = createElem('element-a')
    e.setNodeStyle('color: red')
    expect(e.$$.style.color).toBe('red')
    e.setNodeStyle('font-size: 16px', 1)
    expect(e.$$.style.color).toBe('red')
    expect(e.$$.style.fontSize).toBe('16px')
    e.setNodeStyle('text-align: center', 3)
    expect(e.$$.getAttribute('style')).toBe('color: red;font-size: 16px;;text-align: center')
  })
})
