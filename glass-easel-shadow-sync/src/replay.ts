import type { Element, EventMutLevel, Node, backend as ShadowBackend } from 'glass-easel'

export interface ReplayHandler {
  createElement?(
    ownerShadowRoot: ShadowBackend.ShadowRootContext,
    elem: Node,
  ): ShadowBackend.Element
  afterReplayElement?(
    ownerShadowRoot: ShadowBackend.ShadowRootContext,
    elem: Node,
    be: ShadowBackend.Element,
  ): void
}

export function replayShadowBackend(
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  glassEasel: typeof import('glass-easel'),
  context: ShadowBackend.Context,
  element: Node,
  handlers: ReplayHandler,
) {
  const createChildren = (elem: Element, ownerShadowRoot: ShadowBackend.ShadowRootContext) =>
    elem.childNodes.map((child) => recv(child, ownerShadowRoot))

  const insertChildren = (be: ShadowBackend.Element, children: ShadowBackend.Element[]): void => {
    if (children.length >= 5) {
      const frag = context.createFragment()

      children.forEach((child) => {
        frag.appendChild(child)
      })

      be.spliceAppend(frag)
      frag.release()
    } else {
      children.forEach((child) => {
        be.appendChild(child)
      })
    }
  }

  const setAttributes = (elem: Element, be: ShadowBackend.Element): void => {
    if (elem.id) be.setId(elem.id)
    if (elem.classList) {
      const classNames = elem.classList.getClassNames()
      if (classNames) classNames.split(' ').forEach((className) => be.addClass(className))
    }
    elem.getNodeStyleSegments().forEach((style, index) => {
      if (style) be.setStyle(style, index)
    })
    elem.attributes.forEach(({ name, value }) => {
      be.setAttribute(name, value)
    })
    const dataset = elem.dataset
    Object.keys(dataset).forEach((key) => {
      be.setDataset(key, dataset[key])
    })
    const listeners = elem.getListeners()
    Object.keys(listeners).forEach((name) => {
      let mutLevel: EventMutLevel | undefined
      let captureMutLevel: EventMutLevel | undefined
      listeners[name]!.forEach(({ mutated, final, capture }) => {
        // eslint-disable-next-line no-nested-ternary
        const currentMutLevel = final
          ? glassEasel.EventMutLevel.Final
          : mutated
          ? glassEasel.EventMutLevel.Mut
          : glassEasel.EventMutLevel.None
        if (capture) {
          captureMutLevel =
            captureMutLevel !== undefined && currentMutLevel < captureMutLevel
              ? captureMutLevel
              : currentMutLevel
        } else {
          mutLevel =
            mutLevel !== undefined && currentMutLevel < mutLevel ? mutLevel : currentMutLevel
        }
      })
      if (mutLevel !== undefined) be.setListenerStats(name, false, mutLevel)
      if (captureMutLevel !== undefined) be.setListenerStats(name, true, captureMutLevel)
    })
    const slotName = elem.slot
    if (slotName) be.setSlot(slotName)
  }

  const setSlotName = (node: Node, be: ShadowBackend.Element): void => {
    if (glassEasel.Element.isElement(node)) {
      const slotName = glassEasel.Element.getSlotName(node)
      if (slotName !== undefined) be.setSlotName(slotName)
    }
    const slotElement = glassEasel.Element.getSlotElement(node)
    if (slotElement) be.setSlotElement(backendElementMap.get(slotElement)!)
  }

  const backendElementMap = new Map<Node, ShadowBackend.Element>()

  const recv = (
    elem: Node,
    ownerShadowRoot: ShadowBackend.ShadowRootContext,
  ): ShadowBackend.Element => {
    let be: ShadowBackend.Element
    if (glassEasel.TextNode.isTextNode(elem)) {
      be =
        handlers.createElement?.(ownerShadowRoot, elem) ||
        ownerShadowRoot.createTextNode(elem.textContent)
      setSlotName(elem, be)
    } else if (glassEasel.NativeNode.isNativeNode(elem)) {
      be =
        handlers.createElement?.(ownerShadowRoot, elem) ||
        ownerShadowRoot.createElement(elem.is, elem.stylingName)
      be.__wxElement = elem
      be.associateValue(elem)
      setAttributes(elem, be)
      const listeners = elem.getModelBindingListeners()
      Object.keys(listeners).forEach((name) => {
        be.setModelBindingStat(name, listeners[name]!)
      })
      insertChildren(be, createChildren(elem, ownerShadowRoot))
      setSlotName(elem, be)
    } else if (glassEasel.ShadowRoot.isShadowRoot(elem)) {
      be = ownerShadowRoot
      be.__wxElement = elem
      be.associateValue(elem)
      setAttributes(elem, be)
      insertChildren(be, createChildren(elem, ownerShadowRoot))
    } else if (glassEasel.VirtualNode.isVirtualNode(elem)) {
      be =
        handlers.createElement?.(ownerShadowRoot, elem) ||
        ownerShadowRoot.createVirtualNode(elem.is)
      be.__wxElement = elem
      be.associateValue(elem)
      if (elem.isInheritSlots()) {
        be.setInheritSlots()
      }
      setAttributes(elem, be)
      insertChildren(be, createChildren(elem, ownerShadowRoot))
      setSlotName(elem, be)
    } else if (glassEasel.Component.isComponent(elem)) {
      const options = elem.getComponentOptions()
      be =
        handlers.createElement?.(ownerShadowRoot, elem) ||
        ownerShadowRoot.createComponent(
          elem.tagName,
          elem.isExternal(),
          elem.isVirtual(),
          options.styleScope ?? glassEasel.StyleScopeManager.globalScope(),
          options.extraStyleScope,
          Object.keys(elem.getExternalClasses()),
          elem.getShadowRoot()?.getSlotMode() ?? null,
          options.writeIdToDOM,
        )
      be.__wxElement = elem
      be.associateValue(elem)
      setAttributes(elem, be)
      const externalClasses = elem.getExternalClasses()
      if (externalClasses) {
        Object.entries(externalClasses).forEach(([key, value]) => {
          if (value) be.setClassAlias(key, value)
        })
      }
      const shadowRoot = elem.getShadowRoot()
      if (shadowRoot) {
        const shadowRootBe = be.getShadowRoot()
        if (shadowRootBe) {
          backendElementMap.set(shadowRoot, recv(shadowRoot, shadowRootBe))
        }
      }
      insertChildren(be, createChildren(elem, ownerShadowRoot))
      setSlotName(elem, be)
    } else {
      throw new Error(`Unknown elem type ${elem.constructor.name}`)
    }
    handlers.afterReplayElement?.(ownerShadowRoot, elem, be)
    backendElementMap.set(elem, be)
    return be
  }

  const result = recv(element, context.getRootNode())
  backendElementMap.clear()
  return result
}
