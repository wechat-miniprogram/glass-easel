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

const addListenerToElement = (elem, tagName, f, options) => {
  elem.addListener(tagName, f, options)
  return f
}

const removeListenerFromElement = (elem, tagName, f, options) => {
  elem.removeListener(tagName, f, options)
}

const setListenerToElementNative = (owner, elem, tagName, f, options) => {
  return owner.shadowRoot.setListener(elem, tagName, f, options)
}

describe('Events', function(){
  var root = null

  beforeAll(function(){
      root = createElem('root')
      root.$$.id = 'root'
      var backendRoot = domBackend.getRootNode()
      var placeholder = domBackend.document.createElement('div')
      backendRoot.appendChild(placeholder)
      glassEasel.Element.replaceDocumentElement(root, backendRoot, placeholder)
      regElem({
        is: 'events-full',
        template: '<div id="wrapper"><span id="inner"></span><slot></slot></div>'
      })
      regElem({
        is: 'events-native',
        options: {
          externalComponent: true,
        },
        template: '<div id="wrapper"><span id="inner"></span><slot></slot></div>'
      })
  })

  describe('#addListenerToElement', function(){

    it('should attach listeners to full-rendering elements', function(){
      var elem = createElem('events-full')
      var callOrder = []
      addListenerToElement(elem, 'customevent', function(e){
        callOrder.push(1)
        expect(e.target).toBe(this)
        expect(e.type).toBe('customevent')
        expect(e.detail).toStrictEqual({a: 1})
        expect(e.a).toBe(2)
      })
      addListenerToElement(elem.shadowRoot, 'customevent', function(e){
        callOrder.push(2)
        expect(e.target).toBe(elem.$.inner)
        expect(e.type).toBe('customevent')
        expect(e.detail).toStrictEqual({a: 1})
        expect(e.a).toBe(2)
      })
      addListenerToElement(elem.$.wrapper, 'customevent', function(e){
        callOrder.push(3)
        expect(e.target).toBe(elem.$.inner)
        expect(e.type).toBe('customevent')
        expect(e.detail).toStrictEqual({a: 1})
        expect(e.a).toBe(2)
      })
      addListenerToElement(elem.$.inner, 'customevent', function(e){
        callOrder.push(4)
        expect(e.target).toBe(this)
        expect(e.type).toBe('customevent')
        expect(e.detail).toStrictEqual({a: 1})
        expect(e.a).toBe(2)
      })
      glassEasel.triggerEvent(elem.$.inner, 'customevent', {a: 1}, {bubbles: true, composed: true, extraFields: {a: 2}})
      expect(callOrder).toStrictEqual([4, 3, 2, 1])
    })

    it('should attach listeners to native-rendering elements', function(){
      var elem = createElem('events-native')
      var callOrder = []
      addListenerToElement(elem, 'customevent', function(e){
        callOrder.push(1)
        expect(e.target).toBeInstanceOf(glassEasel.Element)
        expect(e.target).toBe(this)
        expect(e.type).toBe('customevent')
        expect(e.detail).toStrictEqual({a: 1})
        expect(e.a).toBe(2)
      })
      setListenerToElementNative(elem, elem.shadowRoot.root, 'customevent', function(e){
        callOrder.push(2)
        expect(e.target).toBeInstanceOf(window.HTMLSpanElement)
        expect(e.target).toBe(elem.$.inner)
        expect(e.type).toBe('customevent')
        expect(e.detail).toStrictEqual({a: 1})
        expect(e.a).toBe(2)
      })
      setListenerToElementNative(elem, elem.$.wrapper, 'customevent', function(e){
        callOrder.push(3)
        expect(e.target).toBe(elem.$.inner)
        expect(e.type).toBe('customevent')
        expect(e.detail).toStrictEqual({a: 1})
        expect(e.a).toBe(2)
      })
      setListenerToElementNative(elem, elem.$.inner, 'customevent', function(e){
        callOrder.push(4)
        expect(e.target).toBe(this)
        expect(e.type).toBe('customevent')
        expect(e.detail).toStrictEqual({a: 1})
        expect(e.a).toBe(2)
      })
      glassEasel.triggerExternalEvent(elem, elem.$.inner, 'customevent', {a: 1}, {bubbles: true, composed: true, extraFields: {a: 2}})
      expect(callOrder).toStrictEqual([4, 3, 2, 1])
    })

  })

  describe('#removeListenerFromElement', function(){

    it('should remove listeners', function(){
      var elem = createElem('events-full')
      var eventsLeft = 1
      var f = function(){
        eventsLeft--
      }
      addListenerToElement(elem, 'customevent', f)
      var b2 = function(){
        throw(new Error())
      }
      addListenerToElement(elem, 'customevent', b2)
      removeListenerFromElement(elem, 'customevent', b2)
      glassEasel.triggerEvent(elem, 'customevent', undefined, {bubbles: true, composed: true})
      removeListenerFromElement(elem, 'customevent', f)
      glassEasel.triggerEvent(elem, 'customevent', undefined, {bubbles: true, composed: true})
      expect(eventsLeft).toBe(0)
    })

  })

  describe('#triggerEvent', function(){

    it('should trigger global events', function(){
      var elem = createElem('events-full')
      var child = createElem('events-native')
      elem.appendChild(child)
      var callOrder = []
      addListenerToElement(elem, 'customevent', function(e){
        callOrder.push(1)
        expect(e.target).toBe(child)
      })
      addListenerToElement(elem.shadowRoot, 'customevent', function(e){
        callOrder.push(2)
        expect(e.target).toBe(elem.$.wrapper.childNodes[1])
      })
      addListenerToElement(elem.$.wrapper, 'customevent', function(e){
        callOrder.push(3)
        expect(e.target).toBe(elem.$.wrapper.childNodes[1])
      })
      addListenerToElement(elem.$.inner, 'customevent', function(e){
        callOrder.push(4)
        expect(e.target).toBe(elem.$.wrapper.childNodes[1])
      })
      addListenerToElement(child, 'customevent', function(e){
        callOrder.push(5)
        expect(e.target).toBe(this)
      })
      setListenerToElementNative(child, child.shadowRoot.root, 'customevent', function(e){
        callOrder.push(6)
        expect(e.target).toBe(child.$.inner)
      })
      setListenerToElementNative(child, child.$.wrapper, 'customevent', function(e){
        callOrder.push(7)
        expect(e.target).toBe(child.$.inner)
      })
      setListenerToElementNative(child, child.$.inner, 'customevent', function(e){
        callOrder.push(8)
        expect(e.target).toBe(this)
      })
      glassEasel.triggerExternalEvent(child, child.$.inner, 'customevent', undefined, {bubbles: true, composed: true})
      expect(callOrder).toStrictEqual([8, 7, 6, 5, 3, 2, 1])
    })

    it('should trigger non-global events', function(){
      var elem = createElem('events-full')
      var child = createElem('events-native')
      elem.appendChild(child)
      var callOrder = []
      addListenerToElement(elem, 'customevent', function(e){
        callOrder.push(1)
        expect(e.target).toBe(child)
      })
      addListenerToElement(elem.shadowRoot, 'customevent', function(e){
        callOrder.push(2)
        expect(e.target).toBe(elem.$.inner)
      })
      addListenerToElement(elem.$.wrapper, 'customevent', function(e){
        callOrder.push(3)
        expect(e.target).toBe(elem.$.inner)
      })
      addListenerToElement(elem.$.inner, 'customevent', function(e){
        callOrder.push(4)
        expect(e.target).toBe(elem.$.inner)
      })
      addListenerToElement(child, 'customevent', function(e){
        callOrder.push(5)
        expect(e.target).toBe(this)
      })
      setListenerToElementNative(child, child.shadowRoot.root, 'customevent', function(e){
        callOrder.push(6)
        expect(e.target).toBe(child.$.inner)
      })
      setListenerToElementNative(child, child.$.wrapper, 'customevent', function(e){
        callOrder.push(7)
        expect(e.target).toBe(child.$.inner)
      })
      setListenerToElementNative(child, child.$.inner, 'customevent', function(e){
        callOrder.push(8)
        expect(e.target).toBe(this)
      })
      glassEasel.triggerEvent(elem.$.inner, 'customevent', undefined, {bubbles: true})
      glassEasel.triggerExternalEvent(child, child.$.inner, 'customevent', undefined, {bubbles: true})
      glassEasel.triggerEvent(child, 'customevent', undefined, {bubbles: true})
      expect(callOrder).toStrictEqual([4, 3, 2, 8, 7, 6, 5, 1])
    })

    it('should trigger non-bubble events', function(){
      var elem = createElem('events-full')
      var child = createElem('events-native')
      elem.appendChild(child)
      var callOrder = []
      addListenerToElement(elem, 'customevent', function(e){
        callOrder.push(1)
      })
      addListenerToElement(elem.shadowRoot, 'customevent', function(e){
        callOrder.push(2)
        expect(e.target).toBe(this)
      })
      addListenerToElement(elem.$.wrapper, 'customevent', function(e){
        callOrder.push(3)
      })
      addListenerToElement(elem.$.inner, 'customevent', function(e){
        callOrder.push(4)
      })
      addListenerToElement(child, 'customevent', function(e){
        callOrder.push(5)
        expect(e.target).toBe(this)
      })
      setListenerToElementNative(child, child.shadowRoot.root, 'customevent', function(e){
        callOrder.push(6)
        expect(e.target).toBe(this)
      })
      setListenerToElementNative(child, child.$.wrapper, 'customevent', function(e){
        callOrder.push(7)
      })
      setListenerToElementNative(child, child.$.inner, 'customevent', function(e){
        callOrder.push(8)
      })
      glassEasel.triggerEvent(elem.shadowRoot, 'customevent')
      glassEasel.triggerExternalEvent(child, child.shadowRoot.root, 'customevent')
      glassEasel.triggerEvent(child, 'customevent')
      expect(callOrder).toStrictEqual([2, 6, 5])
    })

    it('should be able to interrupt bubble', function(){
      var elem = createElem('events-full')
      var child = createElem('events-full')
      elem.appendChild(child)
      var waitingEvents = 1
      addListenerToElement(child, 'customevent', function(){
        waitingEvents--
        return false
      })
      addListenerToElement(elem, 'customevent', function(){
        waitingEvents--
      })
      glassEasel.triggerEvent(child, 'customevent', undefined, {bubbles: true, composed: true})
      expect(waitingEvents).toBe(0)
    })

    it('should convert event target correctly (in full mode)', function(){
      var e1 = createElem('events-full')
      var e2 = createElem('events-full')
      var e3 = createElem('events-full')
      e1.appendChild(e2)
      e2.appendChild(e3)
      var callOrder = []
      addListenerToElement(e1, 'customevent', function(e){
        callOrder.push(1)
        expect(e.target).toBe(e3)
      })
      addListenerToElement(e2, 'customevent', function(e){
        callOrder.push(2)
        expect(e.target).toBe(e3)
      })
      addListenerToElement(e2.$.wrapper, 'customevent', function(e){
        callOrder.push(3)
        expect(e.target).toBe(e2.$.wrapper.childNodes[1])
      })
      addListenerToElement(e3, 'customevent', function(e){
        callOrder.push(4)
        expect(e.target).toBe(e3)
      })
      addListenerToElement(e3.$.wrapper, 'customevent', function(e){
        callOrder.push(5)
        expect(e.target).toBe(e3.$.inner)
      })
      glassEasel.triggerEvent(e3.$.inner, 'customevent', undefined, {bubbles: true, composed: true})
      expect(callOrder).toStrictEqual([5, 4, 3, 2, 1])
    })

    it('should convert event target correctly (in native mode)', function(){
      var e1 = createElem('events-native')
      var e2 = createElem('events-native')
      var e3 = createElem('events-native')
      e1.appendChild(e2)
      e2.appendChild(e3)
      var callOrder = []
      addListenerToElement(e1, 'customevent', function(e){
        callOrder.push(1)
        expect(e.target).toBe(e3)
      })
      addListenerToElement(e2, 'customevent', function(e){
        callOrder.push(2)
        expect(e.target).toBe(e3)
      })
      setListenerToElementNative(e2, e2.$.wrapper, 'customevent', function(e){
        callOrder.push(3)
        expect(e.target).toBe(e2.$.wrapper.childNodes[1])
      })
      addListenerToElement(e3, 'customevent', function(e){
        callOrder.push(4)
        expect(e.target).toBe(e3)
      })
      setListenerToElementNative(e3, e3.$.wrapper, 'customevent', function(e){
        callOrder.push(5)
        expect(e.target).toBe(e3.$.inner)
      })
      glassEasel.triggerExternalEvent(e3, e3.$.inner, 'customevent', undefined, {bubbles: true, composed: true})
      expect(callOrder).toStrictEqual([5, 4, 3, 2, 1])
    })

    it('should convert event target correctly (in full and native mode)', function(){
      regElem({
        is: 'events-target-a',
        options: {
          renderingMode: 'full'
        },
        template: '<events-native id="inner"> <slot /> </events-native>'
      })
      regElem({
        is: 'events-target-b',
        options: {
          renderingMode: 'full'
        },
        template: '<events-full id="inner"> <slot /> </events-full>'
      })
      regElem({
        is: 'events-target-all',
        options: {
          renderingMode: 'full'
        },
        template: '<events-target-a id="a"> <events-target-b id="b"></events-target-b> </events-target-a>'
      })
      var e = createElem('events-target-all')
      var es = e.shadowRoot
      var eA = e.$.a
      var eB = e.$.b
      var eAs = eA.shadowRoot
      var eASlot = eA.$.inner.childNodes[0]
      var eBs = eB.shadowRoot
      var eAi = eA.$.inner
      var eBi = eB.$.inner
      var eAw = eAi.$.wrapper
      var eAwSlot = eA.$.inner.$.wrapper.childNodes[1]
      var eBw = eBi.$.wrapper
      var events = []
      var targets = []

      addListenerToElement(e, 'customevent', function(e){
        expect('e').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(es, 'customevent', function(e){
        expect('es').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(eA, 'customevent', function(e){
        expect('eA').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(eB, 'customevent', function(e){
        expect('eB').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(eAs, 'customevent', function(e){
        expect('eAs').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(eBs, 'customevent', function(e){
        expect('eBs').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(eAi, 'customevent', function(e){
        expect('eAi').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(eBi, 'customevent', function(e){
        expect('eBi').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      setListenerToElementNative(eAi, eAw, 'customevent', function(e){
        expect('eAw').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(eBw, 'customevent', function(e){
        expect('eBw').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })

      events = ['eAw', 'eAi', 'eAs', 'eA', 'es', 'e']
      targets = [eAw, eAi, eAi, eA, eA, e]
      glassEasel.triggerExternalEvent(eAi, eAw, 'customevent', undefined, {bubbles: true, composed: true})
      expect(events.length + targets.length).toBe(0)

      events = ['eBw', 'eBi', 'eBs', 'eB', 'eAw', 'eAi', 'eAs', 'eA', 'es', 'e']
      targets = [eBw, eBi, eBi, eB, eAwSlot, eASlot, eASlot, eB, eB, e]
      glassEasel.triggerEvent(eBw, 'customevent', undefined, {bubbles: true, composed: true})
      expect(events.length + targets.length).toBe(0)
    })

    it('should bubble from shadowRoot', function(){
      var e1 = createElem('events-full')
      var e2 = createElem('events-full')
      var e3 = createElem('events-native')
      e1.appendChild(e2)
      e2.appendChild(e3)
      var events = []
      var targets = []
      addListenerToElement(e1, 'customevent', function(e){
        expect('e1').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(e1.shadowRoot, 'customevent', function(e){
        expect('e1s').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(e1.$.wrapper, 'customevent', function(e){
        expect('e1w').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(e2, 'customevent', function(e){
        expect('e2').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(e2.shadowRoot, 'customevent', function(e){
        expect('e2s').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(e2.$.wrapper, 'customevent', function(e){
        expect('e2w').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      addListenerToElement(e3, 'customevent', function(e){
        expect('e3').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      setListenerToElementNative(e3, e3.shadowRoot.root, 'customevent', function(e){
        expect('e3s').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })
      setListenerToElementNative(e3, e3.$.wrapper, 'customevent', function(e){
        expect('e3w').toBe(events.shift())
        expect(e.target).toBe(targets.shift())
      })

      events = ['e3s', 'e3', 'e2w', 'e2s', 'e2', 'e1w', 'e1s', 'e1']
      targets = [e3.shadowRoot.root, e3, e2.$.wrapper.childNodes[1], e2.$.wrapper.childNodes[1], e3, e1.$.wrapper.childNodes[1], e1.$.wrapper.childNodes[1], e3]
      glassEasel.triggerExternalEvent(e3, e3.shadowRoot.root, 'customevent', undefined, {bubbles: true, composed: true})
      expect(events.length + targets.length).toBe(0)

      events = ['e2s', 'e2', 'e1w', 'e1s', 'e1']
      targets = [e2.shadowRoot, e2, e1.$.wrapper.childNodes[1], e1.$.wrapper.childNodes[1], e2]
      glassEasel.triggerEvent(e2.shadowRoot, 'customevent', undefined, {bubbles: true, composed: true})
      expect(events.length + targets.length).toBe(0)
    })

    it('should support capture phase', function(){
      var e1 = createElem('events-full')
      e1.id = 'e1'
      var e2 = createElem('events-full')
      e2.id = 'e2'
      var e3 = createElem('events-full')
      e3.id = 'e3'
      e1.appendChild(e2)
      e2.appendChild(e3)
      var waitingEvents = 1
      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        if(e.target === e2) return false
        expect(e.target).toBe(e3)
      }, {useCapture: true})
      addListenerToElement(e2, 'customevent', function(e){
        waitingEvents--
        expect(e.target).toBe(e3)
      }, {useCapture: true})
      addListenerToElement(e2.$.wrapper, 'customevent', function(e){
        waitingEvents--
        expect(e.target).toBe(e2.$.wrapper.childNodes[1])
      }, {useCapture: true})
      addListenerToElement(e3.$.inner, 'customevent', function(e){
        expect(waitingEvents).toBe(2)
        waitingEvents--
        expect(e.target).toBe(this)
      }, {useCapture: true})
      addListenerToElement(e3.$.inner, 'customevent', function(e){
        expect(waitingEvents).toBe(1)
        waitingEvents--
        expect(e.target).toBe(this)
      })
      glassEasel.triggerEvent(e2.$.inner, 'customevent', undefined, {bubbles: true, capturePhase: true, composed: true})
      expect(waitingEvents).toBe(0)
      waitingEvents = 5
      glassEasel.triggerEvent(e3.$.inner, 'customevent', undefined, {bubbles: true, capturePhase: true, composed: true})
      expect(waitingEvents).toBe(0)
    })

    it('should contain marks', function(){
      var e1 = createElem('events-full')
      var e2 = createElem('events-full')
      var e3 = createElem('events-native')
      e1.appendChild(e2)
      e2.appendChild(e3)
      e1.$.wrapper.setMark('inner', 'in')
      e1.setMark('p', 1)
      e2.setMark('c', 2)
      e3.setMark('c', 3)
      var triggered = [false, false, false, false]
      e1.addListener('custom', function(e) {
        triggered[0] = true
        expect(e.mark).toStrictEqual({ p: 1, c: e.target === e2 ? 2 : 3 })
      })
      e2.addListener('custom', function(e) {
        triggered[1] = true
        expect(e.mark).toStrictEqual({ p: 1, c: e.target === e2 ? 2 : 3 })
      })
      e3.addListener('custom', function(e) {
        triggered[2] = true
        expect(e.mark).toStrictEqual({ p: 1, c: 3 })
      })
      e1.shadowRoot.addListener('custom', function(e) {
        triggered[3] = true
        expect(e.mark).toStrictEqual({ inner: 'in' })
      })
      e3.triggerEvent('custom', {})
      e2.triggerEvent('custom', {}, { bubbles: true })
      e3.triggerEvent('custom', {}, { bubbles: true, composed: true, capturePhase: true })
      expect(triggered).toStrictEqual([true, true, true, true])
    })
    
    it('should support mutated event', function(){
      // bubble
      var e1 = createElem('events-full')
      var e2 = createElem('events-full')
      var e3 = createElem('events-full')
      var waitingEvents = 4
      e1.appendChild(e2)
      e2.appendChild(e3)

      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      }, {useCapture: true})
      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      })
      addListenerToElement(e2, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
        e.markMutated()
        expect(e.mutatedMarked()).toBe(true)
      })
      addListenerToElement(e3, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      })
      glassEasel.triggerEvent(e3.$.inner, 'customevent', undefined, {bubbles: true, capturePhase: true, composed: true})
      expect(waitingEvents).toBe(0)

      // capture
      e1 = createElem('events-full')
      e2 = createElem('events-full')
      e3 = createElem('events-full')
      waitingEvents = 4
      e1.appendChild(e2)
      e2.appendChild(e3)

      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      })
      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      }, {useCapture: true})
      addListenerToElement(e2, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
        e.markMutated()
        expect(e.mutatedMarked()).toBe(true)
      }, {useCapture: true})
      addListenerToElement(e3, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      }, {useCapture: true})
      glassEasel.triggerEvent(e3.$.inner, 'customevent', undefined, {bubbles: true, capturePhase: true, composed: true})
      expect(waitingEvents).toBe(0)

      // bubble: pass mutated option
      e1 = createElem('events-full')
      e2 = createElem('events-full')
      e3 = createElem('events-full')
      var e4 = createElem('events-full')
      var e5 = createElem('events-full')
      var triggerCount = 0
      waitingEvents = 6
      e1.appendChild(e2)
      e2.appendChild(e3)
      e3.appendChild(e4)
      e4.appendChild(e5)
      var id1, id2

      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      }, {useCapture: true})
      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      })
      addListenerToElement(e2, 'customevent', function(e){
        waitingEvents--
        triggerCount++
        expect(e.mutatedMarked()).toBe(false)
      }, {mutated: true})
      id1 = addListenerToElement(e3, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      })
      id2 = addListenerToElement(e4, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      }, {mutated: true})
      addListenerToElement(e4, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      })
      addListenerToElement(e5, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      })
      glassEasel.triggerEvent(e5.$.inner, 'customevent', undefined, {bubbles: true, capturePhase: true, composed: true})
      expect(waitingEvents).toBe(0)
      expect(triggerCount).toBe(0)

      // bind: removeListener
      removeListenerFromElement(e3, 'customevent', id1)
      removeListenerFromElement(e4, 'customevent', id2)
      addListenerToElement(e3, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      })
      waitingEvents = 6
      triggerCount = 0
      glassEasel.triggerEvent(e5.$.inner, 'customevent', undefined, {bubbles: true, capturePhase: true, composed: true})
      expect(waitingEvents).toBe(0)
      expect(triggerCount).toBe(1)

      // capture: pass mutated option
      e1 = createElem('events-full')
      e2 = createElem('events-full')
      e3 = createElem('events-full')
      e4 = createElem('events-full')
      e5 = createElem('events-full')
      triggerCount = 0
      waitingEvents = 6
      e1.appendChild(e2)
      e2.appendChild(e3)
      e3.appendChild(e4)
      e4.appendChild(e5)

      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      })
      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      }, {useCapture: true})
      id1 = addListenerToElement(e2, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      }, {useCapture: true, mutated: true})
      addListenerToElement(e2, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      }, {useCapture: true})
      id2 = addListenerToElement(e3, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      }, {useCapture: true})
      addListenerToElement(e4, 'customevent', function(e){
        waitingEvents--
        triggerCount++
      }, {useCapture: true, mutated: true})
      addListenerToElement(e5, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      }, {useCapture: true})
      glassEasel.triggerEvent(e5.$.inner, 'customevent', undefined, {bubbles: true, capturePhase: true, composed: true})
      expect(waitingEvents).toBe(0)
      expect(triggerCount).toBe(0)

      // capture: removeListener
      removeListenerFromElement(e2, 'customevent', id1, {useCapture: true})
      removeListenerFromElement(e3, 'customevent', id2, {useCapture: true})
      addListenerToElement(e3, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      }, {useCapture: true})
      waitingEvents = 6
      triggerCount = 0
      glassEasel.triggerEvent(e5.$.inner, 'customevent', undefined, {bubbles: true, capturePhase: true, composed: true})
      expect(waitingEvents).toBe(0)
      expect(triggerCount).toBe(1)

      // bind: mixed api and mutated option
      e1 = createElem('events-full')
      e2 = createElem('events-full')
      e3 = createElem('events-full')
      e4 = createElem('events-full')
      e5 = createElem('events-full')
      triggerCount = 0
      waitingEvents = 5
      e1.appendChild(e2)
      e2.appendChild(e3)
      e3.appendChild(e4)
      e4.appendChild(e5)

      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      }, {useCapture: true})
      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      })
      addListenerToElement(e2, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      })
      addListenerToElement(e3, 'customevent', function(e){
        waitingEvents--
        triggerCount++
      }, {mutated: true})
      addListenerToElement(e4, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
        e.markMutated()
        expect(e.mutatedMarked()).toBe(true)
      })
      addListenerToElement(e5, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      })
      glassEasel.triggerEvent(e5.$.inner, 'customevent', undefined, {bubbles: true, capturePhase: true, composed: true})
      expect(waitingEvents).toBe(0)
      expect(triggerCount).toBe(0)

      // capture: mixed api and mutated option
      e1 = createElem('events-full')
      e2 = createElem('events-full')
      e3 = createElem('events-full')
      e4 = createElem('events-full')
      e5 = createElem('events-full')
      triggerCount = 0
      waitingEvents = 5
      e1.appendChild(e2)
      e2.appendChild(e3)
      e3.appendChild(e4)
      e4.appendChild(e5)

      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      })
      addListenerToElement(e1, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
      }, {useCapture: true})
      addListenerToElement(e2, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(false)
        e.markMutated()
        expect(e.mutatedMarked()).toBe(true)
      }, {useCapture: true})
      addListenerToElement(e3, 'customevent', function(e){
        waitingEvents--
        triggerCount++
      }, {useCapture: true, mutated: true})
      addListenerToElement(e4, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      }, {useCapture: true})
      addListenerToElement(e5, 'customevent', function(e){
        waitingEvents--
        expect(e.mutatedMarked()).toBe(true)
      }, {useCapture: true})
      glassEasel.triggerEvent(e5.$.inner, 'customevent', undefined, {bubbles: true, capturePhase: true, composed: true})
      expect(waitingEvents).toBe(0)
      expect(triggerCount).toBe(0)
    })

  })

})
