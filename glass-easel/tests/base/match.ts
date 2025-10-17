import {
  Component,
  type GeneralComponent,
  type ExternalShadowRoot,
  ShadowRoot,
  Element,
  type domlikeBackend,
  type backend,
  TextNode,
  BackendMode,
} from '../../src'
import { type DoubleLinkedList } from '../../src/element'

// check internal structure of an external component (with its child nodes given)
export const native = (structure: {
  element: GeneralComponent
  childNodes?: { element: GeneralComponent }[]
}) => {
  const elem = structure.element
  const expectChildNodes = structure.childNodes || []
  const slot = (elem.shadowRoot as ExternalShadowRoot).slot as unknown as HTMLElement
  expectChildNodes.forEach((expectItem, i) => {
    expect(elem.childNodes[i]).toBe(expectItem.element)
    expect(expectItem.element.parentNode).toBe(elem)
    expect(slot.childNodes[i]).toBe(expectItem.element.$$)
    expect(elem.getComposedChildren()[i]).toBe(expectItem.element)
    native(expectItem)
  })
  expect(elem.childNodes[expectChildNodes.length]).toBe(undefined)
  expect(slot.childNodes[expectChildNodes.length]).toBe(undefined)
}

// check the structure of a backend element
const testBackend = (elem: GeneralComponent): void => {
  const testDom = (be: domlikeBackend.Element) => {
    if (elem.getBackendMode() === BackendMode.Domlike) {
      expect(be).toBeInstanceOf(HTMLElement)
    }
    let sr = be
    let host = sr.__wxElement as GeneralComponent | undefined
    while (!host) {
      sr = sr.parentNode!
      host = sr.__wxElement as GeneralComponent | undefined
    }
    const slot = (host.shadowRoot as ExternalShadowRoot).slot as domlikeBackend.Element
    if (be === slot) {
      host.childNodes.forEach((child, i) => {
        if (child instanceof TextNode) {
          expect(child.textContent).toBe(be.childNodes[i]!.textContent)
        } else {
          // eslint-disable-next-line no-use-before-define
          virtual(child)
        }
      })
    } else {
      for (let i = 0; i < be.childNodes.length; i += 1) {
        const domChild = be.childNodes[i]! as Node & domlikeBackend.Element
        if (domChild.nodeType === domChild.TEXT_NODE) {
          if (elem.getBackendMode() === BackendMode.Domlike) {
            expect(domChild).toBeInstanceOf(Text)
          }
        } else {
          testDom(domChild)
        }
      }
    }
  }
  if (elem.getBackendMode() === BackendMode.Shadow && !elem.isExternal()) {
    testDom(
      (
        elem.getBackendElement() as backend.Element
      ).getShadowRoot() as unknown as domlikeBackend.Element,
    )
  } else {
    testDom(elem.getBackendElement() as domlikeBackend.Element)
  }
}

// check the structure of an element
export const virtual = (elem: Element, defDomElem?: HTMLElement, defIndex?: number): number => {
  // for a component, check its shadow children and its shadow root
  if (elem instanceof Component) {
    const slotIndex = new Map<Element | HTMLElement, number>()
    const dfsChildren = (parent: Element) => {
      parent.childNodes.forEach((child, i) => {
        const slot = child.containingSlot
        expect(child.parentNode).toBe(parent)
        expect(child.parentIndex).toBe(i)
        if (slot) {
          if (!slotIndex.has(slot)) slotIndex.set(slot, 0)
          const slotContent = (elem.shadowRoot as ShadowRoot).getSlotContentArray(slot)!
          const index = slotIndex.get(slot)!
          expect(child).toBe(slotContent[index])
          expect(child).toBe(slot.slotNodes![index])
          expect(child.slotIndex).toBe(index)
          slotIndex.set(slot, index + 1)
        }
        if (child instanceof Element) {
          virtual(child)
        } else if (child instanceof TextNode) {
          expect(child.textContent).toBe(
            (child.getBackendElement() as unknown as HTMLElement).textContent,
          )
        } else {
          throw new Error()
        }
        if (child instanceof Element && Element.getInheritSlots(child)) {
          dfsChildren(child)
        }
      })
    }
    dfsChildren(elem)
    if (elem._$external) {
      const sr = (elem.shadowRoot as ExternalShadowRoot).root as domlikeBackend.Element
      expect(sr.__wxElement).toBe(elem)
      testBackend(elem)
    } else {
      const shadowRoot = elem.shadowRoot as ShadowRoot
      let subtreeSlotStart = null as DoubleLinkedList<Element> | null
      let subtreeSlotEnd = null as DoubleLinkedList<Element> | null

      // check subtree slot linked list in shadow tree
      const dfsShadow = (elem: Element) => {
        const prevSubtreeSlotStart = subtreeSlotStart
        const prevSubtreeSlotEnd = subtreeSlotEnd

        elem.childNodes.forEach((child) => {
          if (child instanceof Element) {
            dfsShadow(child)
          }
        })

        if (prevSubtreeSlotStart) {
          expect(prevSubtreeSlotStart).toBe(subtreeSlotStart)
        }
        if (subtreeSlotStart || subtreeSlotEnd) {
          expect(subtreeSlotStart).not.toBe(null)
          expect(subtreeSlotEnd).not.toBe(null)
        }

        if (elem._$slotName !== null) {
          const currentSlot = subtreeSlotEnd ? subtreeSlotEnd.next : shadowRoot._$subtreeSlotStart
          expect(currentSlot).not.toBe(null)
          expect(currentSlot!.value).toBe(elem)
          expect(currentSlot!.prev).toBe(subtreeSlotEnd)
          if (!subtreeSlotStart) subtreeSlotStart = currentSlot
          subtreeSlotEnd = currentSlot

          expect(elem._$subtreeSlotStart).toBe(currentSlot)
          expect(elem._$subtreeSlotEnd).toBe(currentSlot)
        } else {
          if (prevSubtreeSlotEnd !== subtreeSlotEnd) {
            expect(elem._$subtreeSlotStart).toBe(
              prevSubtreeSlotEnd ? prevSubtreeSlotEnd.next : subtreeSlotStart,
            )
            expect(elem._$subtreeSlotEnd).toBe(subtreeSlotEnd)
          } else {
            expect(elem._$subtreeSlotStart).toBe(null)
            expect(elem._$subtreeSlotEnd).toBe(null)
          }
        }
      }
      dfsShadow(shadowRoot)
      if (subtreeSlotEnd) expect(subtreeSlotEnd.next).toBe(null)
      expect(shadowRoot._$subtreeSlotStart).toBe(subtreeSlotStart)
      expect(shadowRoot._$subtreeSlotEnd).toBe(subtreeSlotEnd)
      expect(elem.getComposedChildren()).toStrictEqual([elem.shadowRoot])
      expect(shadowRoot.getHostNode()).toBe(elem)
      expect(shadowRoot.parentNode).toBe(null)
    }
  }

  // get the backend element if it is domlike backend
  let domElem: HTMLElement | undefined
  if (elem instanceof Component && elem._$external) {
    domElem = (elem.shadowRoot as ExternalShadowRoot).slot as unknown as HTMLElement
  } else {
    domElem =
      defDomElem || ((elem.getBackendElement() || undefined) as unknown as HTMLElement | undefined)
  }

  // check the composed children recursively
  let index = defIndex || 0
  const expectParentNode =
    Element.getSlotName(elem) === undefined ? elem : elem.ownerShadowRoot!.getHostNode()
  elem.forEachComposedChild((child) => {
    expect(child.getComposedParent()).toBe(elem)
    if (!(child instanceof ShadowRoot)) {
      let parentNode = child.parentNode
      while (parentNode && Element.getInheritSlots(parentNode)) {
        parentNode = parentNode.parentNode
      }
      expect(parentNode).toBe(expectParentNode)
    }
    if (elem.getBackendMode() === BackendMode.Shadow) {
      expect(child.getBackendElement()).not.toBe(null)
    } else {
      if (child instanceof Element && child.isVirtual()) {
        expect(child.getBackendElement()).toBe(null)
      } else {
        expect(child.getBackendElement()).not.toBe(null)
      }
    }
    if (child instanceof Element && child.isVirtual()) {
      index = virtual(child, domElem, index)
    } else if (child instanceof Element) {
      if (domElem) {
        expect(child.$$).toBe(domElem.childNodes[index])
        index += 1
      }
      virtual(child)
    } else if (child instanceof TextNode) {
      if (domElem) {
        expect(child.textContent).toBe(domElem.childNodes[index]!.textContent)
        index += 1
      }
    } else {
      throw new Error()
    }
  })
  if (domElem && !(elem instanceof Element && elem.isVirtual())) {
    expect(domElem.childNodes[index]).toBe(undefined)
  }
  return index
}
