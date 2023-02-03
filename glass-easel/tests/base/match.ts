import {
  Component,
  GeneralComponent,
  ExternalShadowRoot,
  ShadowRoot,
  Element,
  domlikeBackend,
  TextNode,
  VirtualNode,
  Node,
  BackendMode,
} from '../../src'

const getSingleSlotElement = (comp: GeneralComponent) => {
  if (comp._$external) {
    const sr = comp.shadowRoot as ExternalShadowRoot
    return sr.slot as unknown as HTMLElement
  }
  const sr = comp.shadowRoot as ShadowRoot
  return sr.getSingleSlotElement()
}

// check internal structure of an external component (with its child nodes given)
export const native = (
  structure: {
    element: GeneralComponent,
    childNodes?: { element: GeneralComponent }[],
  },
) => {
  const elem = structure.element
  const expectChildNodes = structure.childNodes || []
  expectChildNodes.forEach((expectItem, i) => {
    expect(elem.childNodes[i]).toBe(expectItem.element)
    expect(expectItem.element.parentNode).toBe(elem)
    expect((getSingleSlotElement(elem) as HTMLElement).childNodes[i]).toBe(expectItem.element.$$)
    expect(elem.getComposedChildren()[i]).toBe(expectItem.element)
    native(expectItem)
  })
  expect(elem.childNodes[expectChildNodes.length]).toBe(undefined)
  expect(
    (getSingleSlotElement(elem) as Element).childNodes[expectChildNodes.length],
  ).toBe(undefined)
}

// check the structure of a backend element
const testBackend = (elem: Element): void => {
  const testDom = (elem: HTMLElement) => {
    expect(elem).toBeInstanceOf(HTMLElement)
    let sr = elem
    let host = (sr as unknown as domlikeBackend.Element).__wxElement as
      GeneralComponent | undefined
    while (!host) {
      sr = sr.parentElement!
      host = (sr as unknown as domlikeBackend.Element).__wxElement as
        GeneralComponent | undefined
    }
    const slot = (host.shadowRoot as ExternalShadowRoot).slot as unknown as HTMLElement
    if (elem === slot) {
      host.childNodes.forEach((child, i) => {
        if (child instanceof TextNode) {
          expect(child.textContent).toBe(elem.childNodes[i]!.textContent)
        } else {
          // eslint-disable-next-line no-use-before-define
          virtual(child)
        }
      })
    } else {
      for (let i = 0; i < elem.childNodes.length; i += 1) {
        const domChild = elem.childNodes[i]
        if (domChild instanceof HTMLElement) testDom(domChild)
        else expect(domChild).toBeInstanceOf(Text)
      }
    }
  }
  if (elem.getBackendContext().mode === BackendMode.Domlike) {
    testDom(elem.getBackendElement() as unknown as HTMLElement)
  }
}

// check the structure of an element
export const virtual = (
  elem: Element,
  defDomElem?: HTMLElement,
  defIndex?: number,
): number => {
  // for a component, check its shadow children and its shadow root
  if (elem instanceof Component) {
    const slotIndex = new Map<Element | HTMLElement, number>()
    const dfsInherited = (parent: Element) => {
      parent.childNodes.forEach((child) => {
        let slot = getSingleSlotElement(elem as GeneralComponent)
        if (slot !== undefined) {
          // empty
        } else {
          slot = (elem.shadowRoot as ShadowRoot).getContainingSlot(child)
        }
        if (slot) {
          if (!slotIndex.has(slot)) slotIndex.set(slot, 0)
          const slotContent = elem._$external
            ? elem.getComposedChildren()
            : (elem.shadowRoot as ShadowRoot).getSlotContentArray(slot as Element)!
          const index = slotIndex.get(slot)!
          expect(child).toBe(slotContent[index])
          slotIndex.set(slot, index + 1)
        } else if (child instanceof Element) {
          virtual(child)
        } else if (child instanceof TextNode) {
          if (elem.getBackendContext().mode === BackendMode.Domlike) {
            expect(child.textContent).toBe(
              (child.getBackendElement() as unknown as HTMLElement).textContent,
            )
          }
        } else {
          throw new Error()
        }
        if (child instanceof Element && Element.getInheritSlots(child)) {
          dfsInherited(child)
        }
      })
    }
    dfsInherited(elem)
    if (elem._$external) {
      const sr = (elem.shadowRoot as ExternalShadowRoot).root
      expect(sr.__wxElement).toBe(elem)
      testBackend(elem)
    } else {
      expect(elem.getComposedChildren()).toStrictEqual([elem.shadowRoot])
      expect((elem.shadowRoot as ShadowRoot).getHostNode()).toBe(elem)
      expect((elem.shadowRoot as ShadowRoot).parentNode).toBe(null)
    }
  }

  // get the backend element if it is domlike backend
  let domElem: HTMLElement | undefined
  if (elem.getBackendContext().mode !== BackendMode.Domlike) {
    domElem = undefined
  } else if (elem instanceof Component && elem._$external) {
    domElem = (elem.shadowRoot as ExternalShadowRoot).slot as unknown as HTMLElement
  } else {
    domElem = defDomElem || (elem.getBackendElement() || undefined) as
      unknown as HTMLElement | undefined
  }

  // check the composed children recursively
  let index = defIndex || 0
  const isVirtualHost = (elem: Node) => {
    if (elem instanceof Component) {
      return elem.getComponentOptions().virtualHost
    }
    return false
  }
  const expectParentNode = Element.getSlotName(elem) === undefined
    ? elem
    : elem.ownerShadowRoot!.getHostNode()
  elem.forEachComposedChild((child) => {
    expect(child.getComposedParent()).toBe(elem)
    if (!(child instanceof ShadowRoot)) {
      let parentNode = child.parentNode
      while (parentNode && Element.getInheritSlots(parentNode)) {
        parentNode = parentNode.parentNode
      }
      expect(parentNode).toBe(expectParentNode)
    }
    if (child instanceof VirtualNode || isVirtualHost(child)) {
      index = virtual(child as Element, domElem, index)
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
  if (domElem && !(elem instanceof VirtualNode) && !isVirtualHost(elem)) {
    expect(domElem.childNodes[index]).toBe(undefined)
  }
  return index
}
