/* eslint-disable no-restricted-syntax */
import { tmpl, domBackend } from '../base/env'
import * as glassEasel from '../../src'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
})
componentSpace.defineComponent({
  is: '',
})

describe('MutationObserver', () => {
  const childDef = componentSpace.defineComponent({
    properties: {
      p: String,
    },
    externalClasses: ['e-class'],
    template: tmpl('<slot />'),
  })
  const parentDef = componentSpace.defineComponent({
    options: { dynamicSlots: true },
    using: { child: childDef.general() },
    template: tmpl(`
      <child>
        <child />
        <div />
        text
      </child>
      <slot />
    `),
  })

  it('observe id changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const child1 = elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(childDef)!
    const child2 = child1.childNodes[0]!.asInstanceOf(childDef)!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(child1, { properties: true })
    child1.id = 'a'
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'basic',
      attributeName: 'id',
    })
    child1.class = 'b'
    expect(callEv.pop()?.target).toBe(child1)
    child1.class = 'b'
    expect(callEv.pop()).toBeUndefined()
    child2.id = 'b'
    expect(callEv.pop()).toBeUndefined()
    observer.disconnect()
    child1.id = 'c'
    expect(callEv.pop()).toBeUndefined()
  })

  it('observe class changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const child1 = elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(childDef)!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(child1, { properties: true })
    child1.class = 'a'
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'basic',
      attributeName: 'class',
    })
    child1.class = 'b'
    expect(callEv.pop()?.target).toBe(child1)
    child1.class = 'b'
    expect(callEv.pop()).toBeUndefined()
  })

  it('observe style changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const child1 = elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(childDef)!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(child1, { properties: true })
    child1.style = 'color: red'
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'basic',
      attributeName: 'style',
    })
    child1.style = 'color: blue'
    expect(callEv.pop()?.target).toBe(child1)
    child1.style = 'color: blue'
    expect(callEv.pop()).toBeUndefined()
  })

  it('observe slot changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const child1 = elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(childDef)!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(child1, { properties: true })
    child1.slot = 'a'
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'basic',
      attributeName: 'slot',
    })
    child1.slot = 'b'
    expect(callEv.pop()?.target).toBe(child1)
    child1.slot = 'b'
    expect(callEv.pop()).toBeUndefined()
  })

  it('observe slot name changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const child1 = elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(childDef)!
    const child2 = child1.childNodes[0]!.asInstanceOf(childDef)!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(child2, { properties: true })
    glassEasel.Element.setSlotName(child2, 'a')
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'basic',
      attributeName: 'name',
    })
    glassEasel.Element.setSlotName(child2, '')
    expect(callEv.pop()?.target).toBe(child2)
    glassEasel.Element.setSlotName(child2, '')
    expect(callEv.pop()).toBeUndefined()
  })

  it('observe attribute changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const child1 = elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(childDef)!
    const div = child1.childNodes[1]!.asNativeNode()!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(div, { properties: true })
    div.setAttribute('hidden', '')
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'attribute',
      attributeName: 'hidden',
    })
    div.setAttribute('hidden', '')
    expect(callEv.pop()?.target).toBe(div)
    div.removeAttribute('hidden')
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'attribute',
      attributeName: 'hidden',
    })
    div.removeAttribute('hidden')
    expect(callEv.pop()?.target).toBe(div)
  })

  it('observe component-property changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const child1 = elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(childDef)!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(child1, { properties: true })
    child1.setData({ p: 'a' })
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'component-property',
      propertyName: 'p',
    })
    child1.setData({ p: 'b' })
    expect(callEv.pop()?.target).toBe(child1)
    child1.setData({ p: 'b' })
    expect(callEv.pop()).toBeUndefined()
  })

  it('observe slot-value changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const shadowRoot = elem.getShadowRoot()!
    const slot = shadowRoot.childNodes[1]!.asVirtualNode()!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer1 = glassEasel.MutationObserver.create(() => {
      throw new Error()
    })
    observer1.observe(slot, { properties: true })
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(slot, { properties: 'all' })
    shadowRoot.setDynamicSlotHandler(
      ['someValue'],
      () => {},
      () => {},
      () => {},
    )
    shadowRoot.replaceSlotValue(slot, 'someValue', 'a')
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'slot-value',
      propertyName: 'someValue',
    })
    shadowRoot.replaceSlotValue(slot, 'someValue', 'b')
    expect(callEv.pop()?.target).toBe(slot)
    shadowRoot.replaceSlotValue(slot, 'someValue', 'b')
    expect(callEv.pop()).toBeUndefined()
  })

  it('observe dataset changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const child1 = elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(childDef)!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer1 = glassEasel.MutationObserver.create(() => {
      throw new Error()
    })
    observer1.observe(child1, { properties: true })
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(child1, { properties: 'all' })
    child1.setDataset('someData', 1)
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'dataset',
      attributeName: 'data:someData',
    })
    child1.setDataset('someData', 1)
    expect(callEv.pop()?.target).toBe(child1)
  })

  it('observe mark changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const child1 = elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(childDef)!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer1 = glassEasel.MutationObserver.create(() => {
      throw new Error()
    })
    observer1.observe(child1, { properties: true })
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(child1, { properties: 'all' })
    child1.setMark('someData', 1)
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'mark',
      attributeName: 'mark:someData',
    })
    child1.setMark('someData', 1)
    expect(callEv.pop()?.target).toBe(child1)
  })

  it('observe external-classes changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const child1 = elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(childDef)!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer1 = glassEasel.MutationObserver.create(() => {
      throw new Error()
    })
    observer1.observe(child1, { properties: true })
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(child1, { properties: 'all' })
    child1.setExternalClass('p-class', 'a')
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'external-class',
      attributeName: 'p-class',
    })
    child1.setExternalClass('p-class', 'a')
    expect(callEv.pop()?.target).toBe(child1)
  })

  it('observe subtree property changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const child1 = elem.getShadowRoot()!.childNodes[0]!.asInstanceOf(childDef)!
    const child2 = child1.childNodes[0]!.asInstanceOf(childDef)!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(child1, { properties: true, subtree: true })
    child2.id = 'a'
    expect(callEv.pop()).toMatchObject({
      type: 'properties',
      nameType: 'basic',
      attributeName: 'id',
    })
    child2.id = 'b'
    expect(callEv.pop()?.target).toBe(child2)
    observer.disconnect()
    child1.id = 'c'
    expect(callEv.pop()).toBeUndefined()
  })

  it('observe childList changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const shadowRoot = elem.getShadowRoot()!
    const child1 = shadowRoot.childNodes[0]!.asInstanceOf(childDef)!
    const child2 = child1.childNodes[0]!.asInstanceOf(childDef)!
    child2.cancelDestroyBackendElementOnDetach()
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer1 = glassEasel.MutationObserver.create(() => {
      throw new Error()
    })
    observer1.observe(shadowRoot, { childList: true })
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(child1, { childList: true, subtree: true })
    child1.removeChild(child2)
    expect(callEv.pop()).toMatchObject({
      type: 'childList',
    })
    child1.appendChild(child2)
    expect(callEv.pop()?.target).toBe(child1)
    child1.removeChild(child2)
    expect(
      (callEv.pop() as glassEasel.mutationObserver.MutationObserverChildEvent).removedNodes![0],
    ).toBe(child2)
    child1.appendChild(child2)
    expect(
      (callEv.pop() as glassEasel.mutationObserver.MutationObserverChildEvent).addedNodes![0],
    ).toBe(child2)
    child2.destroyBackendElementOnDetach()
    child1.removeChild(child2)
  })

  it('observe subtree childList changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const shadowRoot = elem.getShadowRoot()!
    const child1 = shadowRoot.childNodes[0]!.asInstanceOf(childDef)!
    const child2 = child1.childNodes[0]!.asInstanceOf(childDef)!
    child2.cancelDestroyBackendElementOnDetach()
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(shadowRoot, { childList: true, subtree: true })
    child1.removeChild(child2)
    expect(callEv.pop()).toMatchObject({
      type: 'childList',
    })
    child1.appendChild(child2)
    expect(callEv.pop()?.target).toBe(child1)
    child1.removeChild(child2)
    expect(
      (callEv.pop() as glassEasel.mutationObserver.MutationObserverChildEvent).removedNodes![0],
    ).toBe(child2)
    child1.appendChild(child2)
    expect(
      (callEv.pop() as glassEasel.mutationObserver.MutationObserverChildEvent).addedNodes![0],
    ).toBe(child2)
    child2.destroyBackendElementOnDetach()
    child1.removeChild(child2)
  })

  it('observe text content changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const shadowRoot = elem.getShadowRoot()!
    const child1 = shadowRoot.childNodes[0]!.asInstanceOf(childDef)!
    const textNode = child1.childNodes[2]!.asTextNode()!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer1 = glassEasel.MutationObserver.create(() => {
      throw new Error()
    })
    observer1.observe(shadowRoot, { characterData: true })
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(textNode, { characterData: true })
    textNode.textContent = 'abc'
    expect(callEv.pop()).toMatchObject({
      type: 'characterData',
    })
    textNode.textContent = 'def'
    expect(callEv.pop()?.target).toBe(textNode)
    textNode.textContent = 'def'
    expect(callEv.pop()).toBeUndefined()
  })

  it('observe subtree text content changes', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const shadowRoot = elem.getShadowRoot()!
    const child1 = shadowRoot.childNodes[0]!.asInstanceOf(childDef)!
    const textNode = child1.childNodes[2]!.asTextNode()!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(shadowRoot, { characterData: true, subtree: true })
    textNode.textContent = 'abc'
    expect(callEv.pop()).toMatchObject({
      type: 'characterData',
    })
    textNode.textContent = 'def'
    expect(callEv.pop()?.target).toBe(textNode)
    textNode.textContent = 'def'
    expect(callEv.pop()).toBeUndefined()
  })

  it('observer native node attach status', () => {
    const elem = glassEasel.Component.createWithContext('root', parentDef, domBackend)
    const shadowRoot = elem.getShadowRoot()!
    const child1 = shadowRoot.childNodes[0]!.asInstanceOf(childDef)!
    const div = child1.childNodes[1]!.asNativeNode()!
    const callEv = [] as glassEasel.mutationObserver.MutationObserverEvent[]
    const observer = glassEasel.MutationObserver.create((ev) => {
      callEv.push(ev)
    })
    observer.observe(div, { attachStatus: true })
    glassEasel.Element.pretendAttached(elem)
    expect(callEv.pop()).toMatchObject({
      type: 'attachStatus',
      status: 'attached',
    })
    glassEasel.Element.pretendDetached(elem)
    expect(callEv.pop()).toMatchObject({
      type: 'attachStatus',
      status: 'detached',
    })
  })
})
