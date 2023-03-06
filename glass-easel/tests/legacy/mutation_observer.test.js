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

describe('Observer', function(){
  var root = null

  beforeAll(function(){
    regElem({
      is: 'observer-a',
      template: '<slot></slot>',
      properties: {
        a: {
          type: String,
          public: true
        },
        b: {
          type: Number,
          public: true
        }
      }
    })
  })

  it('should create an observer', function(){
    var elem = createElem('observer-a')
    var observer = glassEasel.Observer.create(function(){
      throw(new Error())
    })
    expect(observer).toBeInstanceOf(glassEasel.MutationObserver)
    observer.observe(elem)
    elem.a = 'TEST'
    elem.appendChild(createElem('observer-a'))
  })

  it('should be able to observe different types of changes', function(){
    var parent = createElem('observer-a')
    var elem = parent.shadowRoot.createComponent('observer-a')
    var child = parent.shadowRoot.createTextNode('text')
    var eventsLeft = 4
    var cb = function(e){
      expect(this).toBe(elem)
      if(eventsLeft === 4) {
        expect(e.type).toBe('properties')
        expect(e.target).toBe(elem)
        expect(e.propertyName).toBe('a')
      } else if(eventsLeft === 3) {
        expect(e.type).toBe('childList')
        expect(e.target).toBe(elem)
        expect(e.addedNodes[0]).toBe(child)
      } else if(eventsLeft === 1) {
        expect(e.type).toBe('childList')
        expect(e.target).toBe(elem)
        expect(e.removedNodes[0]).toBe(child)
      } else if(eventsLeft === 2) {
        expect(e.type).toBe('characterData')
        expect(e.target).toBe(child)
      }
      eventsLeft--
    }
    elem.b = 1
    elem.appendChild(child)
    elem.removeChild(child)
    var observer = glassEasel.MutationObserver.create(cb)
    observer.observe(elem, {properties: true, childList: true})
    child.textContent = 'old'
    var observer2 = glassEasel.MutationObserver.create(cb)
    observer2.observe(elem, {characterData: true, subtree: true})
    elem.a = 'a'
    elem.appendChild(child)
    child.textContent = 'new'
    elem.removeChild(child)
    expect(eventsLeft).toBe(0)
  })

  it('should be able to observe core property changes', function(){
    var elem = createElem('observer-a')
    var expectPropertyNameList = ['id', 'slot', 'class', 'class', 'class', 'class', 'style']
    var observer = glassEasel.MutationObserver.create(function(e){
      expect(this).toBe(e.target)
      expect(e.type).toBe('properties')
      expect(e.target).toBe(elem)
      expect(e.attributeName).toBe(expectPropertyNameList.shift())
    })
    observer.observe(elem, {properties: true})
    elem.id = 'a'
    elem.slot = 'b'
    elem.class = 'c'
    elem.classList.toggle('c')
    elem.classList.toggle('c')
    elem.classList.toggle('c', true)
    elem.classList.toggle('d', false)
    elem.classList.toggle('d', true)
    elem.style = 'd'
    expect(expectPropertyNameList.length).toBe(0)
  })

  it('should be able to disconnect', function(){
    var elem = createElem('observer-a')
    var eventsLeft = 1
    var observer = glassEasel.MutationObserver.create(function(){
      eventsLeft--
    })
    elem.a = 1
    observer.observe(elem, {properties: true})
    elem.a = 2
    observer.disconnect()
    elem.a = 3
    expect(eventsLeft).toBe(0)
  })

  it('should allow subtree observers', function(){
    var parent = createElem('observer-a')
    var elem1 = parent.shadowRoot.createComponent('observer-a')
    var elem2 = parent.shadowRoot.createComponent('observer-a')
    var elem3 = parent.shadowRoot.createComponent('observer-a')
    var elem4 = parent.shadowRoot.createTextNode('')
    var eventsLeft = 4
    var observer = glassEasel.MutationObserver.create(function(e){
      expect(this).toBe(elem1)
      if(eventsLeft === 2) {
        expect(e.type).toBe('characterData')
        expect(e.target).toBeInstanceOf(glassEasel.TextNode)
        expect(e.target.textContent).toBe('3')
      } else {
        expect(e.type).toBe('properties')
        expect(e.target).toBeInstanceOf(glassEasel.Element)
        expect(e.propertyName).toBe('a')
        expect(e.target.a <= 4).toBe(true)
      }
      eventsLeft--
    })
    expect(glassEasel.Element.hasSubtreeMutationObservers(elem1)).toBe(false)
    observer.observe(elem1, {properties: true, characterData: true, subtree: true})
    elem1.a = 1
    elem1.appendChild(elem2)
    elem3.appendChild(elem4)
    elem1.insertBefore(elem3, elem2)
    elem2.a = 2
    elem2.appendChild(elem3)
    elem4.textContent = 3
    expect(glassEasel.Element.hasSubtreeMutationObservers(elem1)).toBe(true)
    expect(glassEasel.Element.hasSubtreeMutationObservers(elem2)).toBe(true)
    expect(glassEasel.Element.hasSubtreeMutationObservers(elem3)).toBe(true)
    elem1.replaceChild(elem3, elem2)
    expect(glassEasel.Element.hasSubtreeMutationObservers(elem2)).toBe(false)
    expect(glassEasel.Element.hasSubtreeMutationObservers(elem3)).toBe(true)
    elem1.removeChild(elem3)
    expect(glassEasel.Element.hasSubtreeMutationObservers(elem3)).toBe(false)
    elem1.a = 4
    elem2.a = 5
    elem3.a = 6
    expect(eventsLeft).toBe(0)
  })

  it('should allow attach status observers', function(){
    var elem1 = createElem('observer-a')
    var elem2 = createElem('observer-a')
    var eventsLeft = 4
    var observer1 = glassEasel.MutationObserver.create(function(e){
      expect(this).toBe(elem1)
      expect(e.type).toBe('attachStatus')
      expect(e.target).toBe(elem1)
      if(eventsLeft > 2) {
        expect(e.status).toBe('attached')
      } else {
        expect(e.status).toBe('detached')
      }
      eventsLeft--
    })
    var observer2 = glassEasel.MutationObserver.create(function(e){
      expect(this).toBe(elem2)
      expect(e.type).toBe('attachStatus')
      expect(e.target).toBe(elem2)
      if(eventsLeft > 2) {
        expect(e.status).toBe('attached')
      } else {
        expect(e.status).toBe('detached')
      }
      eventsLeft--
    })
    observer1.observe(elem1, {attachStatus: true, subtree: true})
    observer2.observe(elem2, {attachStatus: true})
    elem1.appendChild(elem2)
    glassEasel.Element.pretendAttached(elem1)
    glassEasel.Element.pretendDetached(elem1)
    expect(eventsLeft).toBe(0)
  })

})
