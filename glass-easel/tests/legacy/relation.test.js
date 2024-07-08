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

describe('Component Relations', function () {
  describe('#relations', function () {
    beforeAll(function () {
      regElem({
        is: 'relation-empty',
      })
    })

    it('should link immediate parent and children', function () {
      regElem({
        is: 'relation-parent-common-node-a',
        relations: {
          'relation-child-common-node-a': {
            type: 'child-common-node',
            linked: function (target) {
              expect(expectStatus).toBe('linked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            linkChanged: function (target) {
              expect(expectStatus).toBe('linkChanged')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            unlinked: function (target) {
              expect(expectStatus).toBe('unlinked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
          },
        },
      })
      regElem({
        is: 'relation-child-common-node-a',
        relations: {
          'relation-parent-common-node-a': {
            type: 'parent-common-node',
            linked: function (target) {
              expect(expectStatus).toBe('linked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            linkChanged: function (target) {
              expect(expectStatus).toBe('linkChanged')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            unlinked: function (target) {
              expect(expectStatus).toBe('unlinked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
          },
        },
      })
      regElem({
        is: 'relation-parent-child-common-node',
        template:
          '<relation-parent-common-node-a id="p"> <relation-child-common-node-a id="c1"> <relation-child-common-node-a id="c2"></relation-child-common-node-a> </relation-child-common-node-a> <block wx:if="1"> <relation-child-common-node-a id="c3"></relation-child-common-node-a> <relation-child-common-node-a id="c4"></relation-child-common-node-a> </block> </relation-parent-common-node-a>',
      })
      var elem = createElem('relation-parent-child-common-node')
      var p = elem.$.p
      var c1 = elem.$.c1
      var c2 = elem.$.c2
      var c3 = elem.$.c3
      var c4 = elem.$.c4

      var expectStatus = 'linked'
      var expectCallerOrder = [p, c1, p, c3, p, c4]
      var expectTargetOrder = [c1, p, c3, p, c4, p]
      glassEasel.Element.pretendAttached(elem)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-child-common-node-a')).toStrictEqual([c1, c3, c4])
      expect(c1.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([p])
      expect(c3.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([p])
      expect(c4.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([p])
      expect(c2.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([])

      expectStatus = 'linkChanged'
      expectCallerOrder = [p, c3, p, c4]
      expectTargetOrder = [c3, p, c4, p]
      p.insertBefore(c3.parentNode, c1)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-child-common-node-a')).toStrictEqual([c3, c4, c1])
      expect(c1.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([p])
      expect(c3.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([p])
      expect(c4.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([p])
      expect(c2.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([])

      expectStatus = 'unlinked'
      expectCallerOrder = [p, c3, p, c4]
      expectTargetOrder = [c3, p, c4, p]
      c1.appendChild(c3.parentNode)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-child-common-node-a')).toStrictEqual([c1])
      expect(c3.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([])
      expect(c4.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([])

      expectStatus = 'linked'
      expectCallerOrder = [p, c2]
      expectTargetOrder = [c2, p]
      p.insertBefore(c2, c1)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-child-common-node-a')).toStrictEqual([c2, c1])
      expect(c2.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([p])

      expectStatus = 'unlinked'
      expectCallerOrder = [p, c2, p, c1]
      expectTargetOrder = [c2, p, c1, p]
      glassEasel.Element.pretendDetached(elem)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-child-common-node-a')).toStrictEqual([])
      expect(c1.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([])
      expect(c2.getRelationNodes('relation-parent-common-node-a')).toStrictEqual([])
    })

    it('should link parent and children component', function () {
      regElem({
        is: 'relation-parent-a',
        relations: {
          'relation-child-a': {
            type: 'child',
            linked: function (target) {
              expect(expectStatus).toBe('linked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            linkChanged: function (target) {
              expect(expectStatus).toBe('linkChanged')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            unlinked: function (target) {
              expect(expectStatus).toBe('unlinked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
          },
        },
      })
      regElem({
        is: 'relation-child-a',
        relations: {
          'relation-parent-a': {
            type: 'parent',
            linked: function (target) {
              expect(expectStatus).toBe('linked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            linkChanged: function (target) {
              expect(expectStatus).toBe('linkChanged')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            unlinked: function (target) {
              expect(expectStatus).toBe('unlinked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
          },
        },
      })
      regElem({
        is: 'relation-parent-child',
        template:
          '<relation-parent-a id="p"> <div> <relation-child-a id="c1"> <relation-child-a id="c2"></relation-child-a> </relation-child-a> <block wx:if="1"> <relation-child-a id="c3"></relation-child-a> <relation-child-a id="c4"></relation-child-a> </block> </div> </relation-parent-a>',
      })
      var elem = createElem('relation-parent-child')
      var p = elem.$.p
      var c1 = elem.$.c1
      var c2 = elem.$.c2
      var c3 = elem.$.c3
      var c4 = elem.$.c4

      var expectStatus = 'linked'
      var expectCallerOrder = [p, c1, p, c3, p, c4]
      var expectTargetOrder = [c1, p, c3, p, c4, p]
      glassEasel.Element.pretendAttached(elem)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-child-a')).toStrictEqual([c1, c3, c4])
      expect(c1.getRelationNodes('relation-parent-a')).toStrictEqual([p])
      expect(c3.getRelationNodes('relation-parent-a')).toStrictEqual([p])
      expect(c4.getRelationNodes('relation-parent-a')).toStrictEqual([p])
      expect(c2.getRelationNodes('relation-parent-a')).toStrictEqual([])

      expectStatus = 'linkChanged'
      expectCallerOrder = [p, c3, p, c4]
      expectTargetOrder = [c3, p, c4, p]
      p.insertBefore(c3.parentNode, c1.parentNode)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-child-a')).toStrictEqual([c3, c4, c1])
      expect(c1.getRelationNodes('relation-parent-a')).toStrictEqual([p])
      expect(c3.getRelationNodes('relation-parent-a')).toStrictEqual([p])
      expect(c4.getRelationNodes('relation-parent-a')).toStrictEqual([p])
      expect(c2.getRelationNodes('relation-parent-a')).toStrictEqual([])

      expectStatus = 'unlinked'
      expectCallerOrder = [p, c3, p, c4]
      expectTargetOrder = [c3, p, c4, p]
      c1.appendChild(c3.parentNode)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-child-a')).toStrictEqual([c1])
      expect(c3.getRelationNodes('relation-parent-a')).toStrictEqual([])
      expect(c4.getRelationNodes('relation-parent-a')).toStrictEqual([])

      expectStatus = 'linked'
      expectCallerOrder = [p, c2]
      expectTargetOrder = [c2, p]
      p.insertBefore(c2, c1.parentNode)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-child-a')).toStrictEqual([c2, c1])
      expect(c2.getRelationNodes('relation-parent-a')).toStrictEqual([p])

      expectStatus = 'unlinked'
      expectCallerOrder = [p, c2, p, c1]
      expectTargetOrder = [c2, p, c1, p]
      glassEasel.Element.pretendDetached(elem)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-child-a')).toStrictEqual([])
      expect(c1.getRelationNodes('relation-parent-a')).toStrictEqual([])
      expect(c2.getRelationNodes('relation-parent-a')).toStrictEqual([])
    })

    it('should link ancestors and descendants', function () {
      var commonBeh = regBeh({})
      var ancestorBeh = regBeh({})
      var descendantBeh = regBeh({})
      regElem({
        is: 'relation-ancestor-a',
        behaviors: [commonBeh, ancestorBeh],
        relations: {
          'relation-descendant-a': {
            target: descendantBeh,
            type: 'descendant',
            linked: function (target) {
              expect(expectStatus).toBe('linked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            linkChanged: function (target) {
              expect(expectStatus).toBe('linkChanged')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            unlinked: function (target) {
              expect(expectStatus).toBe('unlinked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
          },
        },
      })
      regElem({
        is: 'relation-descendant-a',
        behaviors: [descendantBeh, commonBeh],
        relations: {
          '': {
            target: ancestorBeh,
            type: 'ancestor',
            linked: function (target) {
              expect(expectStatus).toBe('linked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            linkChanged: function (target) {
              expect(expectStatus).toBe('linkChanged')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
            unlinked: function (target) {
              expect(expectStatus).toBe('unlinked')
              expect(this).toBe(expectCallerOrder.shift())
              expect(target).toBe(expectTargetOrder.shift())
            },
          },
        },
      })
      regElem({
        is: 'relation-ancestor-descendant',
        template:
          '<relation-ancestor-a id="p"> <virtual> <relation-descendant-a id="c1"></relation-descendant-a> <relation-descendant-a id="c2"></relation-descendant-a> </virtual> <relation-descendant-a id="c3"> <relation-descendant-a id="c4"></relation-descendant-a> </relation-descendant-a> </relation-ancestor-a>',
      })
      var elem = createElem('relation-ancestor-descendant')
      var elem2 = createElem('relation-ancestor-descendant')
      var p = elem.$.p
      var c1 = elem.$.c1
      var c2 = elem.$.c2
      var c3 = elem.$.c3
      var c4 = elem.$.c4
      var p2 = elem2.$.p
      var c21 = elem2.$.c1
      var c22 = elem2.$.c2
      var c23 = elem2.$.c3
      var c24 = elem2.$.c4

      var expectStatus = 'linked'
      var nextExpectStatus = ''
      var expectCallerOrder = [p, c1, p, c2, p, c3, p, c4]
      var expectTargetOrder = [c1, p, c2, p, c3, p, c4, p]
      glassEasel.Element.pretendAttached(elem)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-descendant-a')).toStrictEqual([c1, c2, c3, c4])
      expect(c1.getRelationNodes('')).toStrictEqual([p])
      expect(c2.getRelationNodes('')).toStrictEqual([p])
      expect(c3.getRelationNodes('')).toStrictEqual([p])
      expect(c4.getRelationNodes('')).toStrictEqual([p])

      expectStatus = 'linkChanged'
      expectCallerOrder = [p, c4, p, c3]
      expectTargetOrder = [c4, p, c3, p]
      c1.appendChild(c3)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-descendant-a')).toStrictEqual([c1, c3, c4, c2])
      expect(c1.getRelationNodes('')).toStrictEqual([p])
      expect(c2.getRelationNodes('')).toStrictEqual([p])
      expect(c3.getRelationNodes('')).toStrictEqual([p])
      expect(c4.getRelationNodes('')).toStrictEqual([p])

      expectStatus = 'linked'
      expectCallerOrder = [p2, c21, p2, c22, p2, c23, p2, c24]
      expectTargetOrder = [c21, p2, c22, p2, c23, p2, c24, p2]
      glassEasel.Element.pretendAttached(elem2)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p2.getRelationNodes('relation-descendant-a')).toStrictEqual([c21, c22, c23, c24])
      expect(c21.getRelationNodes('')).toStrictEqual([p2])
      expect(c22.getRelationNodes('')).toStrictEqual([p2])
      expect(c23.getRelationNodes('')).toStrictEqual([p2])
      expect(c24.getRelationNodes('')).toStrictEqual([p2])

      expectStatus = 'unlinked'
      expectCallerOrder = [p2, c24]
      expectTargetOrder = [c24, p2]
      c23.removeChild(c24)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p2.getRelationNodes('relation-descendant-a')).toStrictEqual([c21, c22, c23])
      expect(c24.getRelationNodes('')).toStrictEqual([])

      expectStatus = 'unlinked'
      expectCallerOrder = [p, c4, p, c3, p, c1, p, c2]
      expectTargetOrder = [c4, p, c3, p, c1, p, c2, p]
      glassEasel.Element.pretendDetached(elem)
      expect(expectCallerOrder.length).toBe(0)
      expect(expectTargetOrder.length).toBe(0)
      expect(p.getRelationNodes('relation-descendant-a')).toStrictEqual([])
      expect(c4.getRelationNodes('')).toStrictEqual([])
      expect(c1.getRelationNodes('')).toStrictEqual([])
      expect(c2.getRelationNodes('')).toStrictEqual([])
      expect(c3.getRelationNodes('')).toStrictEqual([])
    })

    it('should link cascade ancestors and descendants', function () {
      var ancestorBeh = regBeh({})
      var descendantBeh = regBeh({})
      regElem({
        is: 'relation-ancestor-b',
        behaviors: [ancestorBeh],
        relations: {
          'relation-b': {
            target: descendantBeh,
            type: 'descendant',
            linked: function (target) {
              expect(this).toBe(target.parentNode)
              callOrder.push(this.id)
            },
          },
        },
      })
      regElem({
        is: 'relation-descendant-b',
        behaviors: [descendantBeh],
        relations: {
          'relation-b': {
            target: ancestorBeh,
            type: 'ancestor',
            linked: function (target) {
              expect(target).toBe(this.parentNode)
              callOrder.push(this.id)
            },
          },
        },
      })
      regElem({
        is: 'relation-ancestor-descendant',
        template: `
          <relation-ancestor-b id="p1">
            <relation-descendant-b id="c1">
              <relation-ancestor-b id="p2">
                <relation-descendant-b id="c2" />
              </relation-ancestor-b>
            </relation-descendant-b>
          </relation-ancestor-b>
        `,
      })
      var elem = createElem('relation-ancestor-descendant')
      var callOrder = []
      glassEasel.Element.pretendAttached(elem)
      expect(callOrder).toStrictEqual(['p1', 'c1', 'p2', 'c2'])
      expect(elem.$.p1.getRelationNodes('relation-b')).toStrictEqual([elem.$.c1])
      expect(elem.$.c1.getRelationNodes('relation-b')).toStrictEqual([elem.$.p1])
      expect(elem.$.p2.getRelationNodes('relation-b')).toStrictEqual([elem.$.c2])
      expect(elem.$.c2.getRelationNodes('relation-b')).toStrictEqual([elem.$.p2])
    })

    it('should trigger linkFailed handler when cannot link two nodes', function () {
      regElem({
        is: 'relation-cnt-failed',
        template: '<div><slot></slot></div>',
      })

      regElem({
        is: 'relation-child-failed',
        template: '<div><slot></slot></div>',
        relations: {
          'relation-parent-failed': {
            type: 'parent',
            linkFailed: function () {
              expect(expectStatus).toBe('linkFailed')
              expect(this).toBe(expectCallerOrder.shift())
            },
          },
        },
      })
      regElem({
        is: 'relation-parent-failed',
        relations: {
          'relation-child-failed': {
            type: 'child',
          },
        },
        template: '<div><slot></slot></div>',
      })

      regElem({
        is: 'relation-descendant-failed',
        template: '<div><slot></slot></div>',
        relations: {
          'relation-ancestor-failed': {
            type: 'ancestor',
            linkFailed: function () {
              expect(expectStatus).toBe('linkFailed')
              expect(this).toBe(expectCallerOrder.shift())
            },
          },
        },
      })
      regElem({
        is: 'relation-ancestor-failed',
        relations: {
          'relation-descendant-failed': {
            type: 'descendant',
          },
        },
        template: '<div><slot></slot></div>',
      })

      regElem({
        is: 'relation-parent-child-failed-a',
        template:
          '<relation-parent-failed><relation-child-failed id="q"></relation-child-failed><relation-child-failed id="z"></relation-child-failed></relation-parent-failed><relation-cnt-failed><relation-child-failed id="p"></relation-child-failed></relation-cnt-failed>',
      })
      regElem({
        is: 'relation-parent-child-failed-b',
        template:
          '<relation-ancestor-failed><div><relation-descendant-failed id="q"></relation-descendant-failed></div><div><div><relation-descendant-failed id="z"></relation-descendant-failed></div></div></relation-ancestor-failed><relation-cnt-failed><div><relation-descendant-failed id="p"></relation-descendant-failed></div></relation-cnt-failed>',
      })
      var elem1 = createElem('relation-parent-child-failed-a')
      var elem2 = createElem('relation-parent-child-failed-b')
      var p1 = elem1.$.p
      var p2 = elem2.$.p
      var q1 = elem1.$.q
      var q2 = elem2.$.q
      var z1 = elem1.$.z
      var z2 = elem2.$.z

      var expectStatus = 'linkFailed'
      var expectCallerOrder = [p1, p2, q1, q2]
      glassEasel.Element.pretendAttached(elem1)
      glassEasel.Element.pretendAttached(elem2)
      z1.parentNode.removeChild(z1) // expected not trigger linkFialed
      z2.parentNode.parentNode.removeChild(z2.parentNode) // expected not trigger linkFialed
      p1.appendChild(q1)
      p2.appendChild(q2)
      expect(expectCallerOrder.length).toBe(0)
    })

    it('should link virtual-host components', function () {
      var expectOrder = [1, 2]
      regElem({
        is: 'relation-virtual-host-a',
        options: {
          virtualHost: true,
        },
        template: '<slot />',
        relations: {
          'relation-virtual-host-b': {
            type: 'descendant',
            linked: function (target) {
              expect(expectOrder.shift()).toBe(1)
            },
          },
        },
      })
      regElem({
        is: 'relation-virtual-host-b',
        options: {
          virtualHost: true,
        },
        relations: {
          'relation-virtual-host-a': {
            type: 'ancestor',
            linked: function (target) {
              expect(expectOrder.shift()).toBe(2)
            },
          },
        },
      })
      regElem({
        is: 'relation-virtual-host',
        template:
          '<relation-virtual-host-a id="a"> <relation-virtual-host-b id="b" /> </relation-virtual-host-a>',
      })
      var elem = createElem('relation-virtual-host')
      glassEasel.Element.pretendAttached(elem)
      expect(expectOrder.length).toBe(0)
      expect(elem.$.a.getRelationNodes('relation-virtual-host-b')[0]).toBe(elem.$.b)
      expect(elem.$.b.getRelationNodes('relation-virtual-host-a')[0]).toBe(elem.$.a)
    })

    it('should support relative paths', function () {
      var expectOrder = [1, 2]
      regElem({
        is: 'relation/path/a',
        options: {
          lazyRegistration: true,
        },
        template: '<slot />',
        relations: {
          './b': {
            type: 'descendant',
            linked: function (target) {
              expect(expectOrder.shift()).toBe(1)
            },
          },
        },
      })
      regElem({
        is: 'relation/path/b',
        options: {
          lazyRegistration: true,
        },
        relations: {
          '../path/a': {
            type: 'ancestor',
            linked: function (target) {
              expect(expectOrder.shift()).toBe(2)
            },
          },
        },
      })
      var def = regElem({
        is: 'relation/path',
        using: {
          a: './path/a',
          b: 'path/b',
        },
        template: '<a id="a"> <b id="b" /> </a>',
      })
      var elem = glassEasel.Component.createWithContext('test', def, domBackend)
      glassEasel.Element.pretendAttached(elem)
      expect(expectOrder.length).toBe(0)
      expect(elem.$.a.getRelationNodes('./b')[0]).toBe(elem.$.b)
      expect(elem.$.b.getRelationNodes('../path/a')[0]).toBe(elem.$.a)
    })
  })
})
