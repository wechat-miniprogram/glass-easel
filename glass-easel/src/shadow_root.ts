import * as backend from './backend/backend_protocol'
import { VirtualNode } from './virtual_node'
import {
  Component,
  GeneralComponentDefinition,
  GeneralComponent,
  convertGenerics,
  resolvePlaceholder,
} from './component'
import { TextNode } from './text_node'
import { NativeNode } from './native_node'
import { Element } from './element'
import { Node } from './node'
import { ComponentDefinitionWithPlaceholder } from './behavior'
import { BM, BackendMode } from './backend/mode'
import { DeepCopyStrategy, getDeepCopyStrategy } from './data_proxy'
import { deepCopy, simpleDeepCopy } from './data_utils'

const enum SlotMode {
  Single,
  Multiple,
  Dynamic,
}

type AppliedSlotMeta = {
  slotName: string
  updatePathTree: { [key: string]: true } | undefined
}

const wrapPlaceholderCallback = (
  f: (c: GeneralComponentDefinition) => void,
  cwp: Exclude<ComponentDefinitionWithPlaceholder, string>,
  owner: GeneralComponent,
) => {
  const waiting = cwp.waiting
  if (waiting) {
    waiting.add(f)
    waiting.hintUsed(owner)
    return () => {
      waiting.remove(f)
    }
  }
  return undefined
}

export class ShadowRoot extends VirtualNode {
  private _$host: GeneralComponent
  /** @internal */
  _$backendShadowRoot: backend.ShadowRootContext | null
  private _$idMap: { [id: string]: Element } | null
  private _$slotCacheDirty: boolean
  private _$appliedSlotCacheDirty: boolean
  private _$singleSlot?: Element | null
  private _$appliedSingleSlot?: Element | null
  private _$slots?: { [name: string]: Element }
  private _$appliedSlots?: { [name: string]: Element }
  private _$dynamicSlotSet?: Set<Element>
  private _$appliedDynamicSlots?: Map<Element, AppliedSlotMeta>
  private _$requiredSlotValueNames?: string[]
  private _$propertyPassingDeepCopy?: DeepCopyStrategy
  private _$insertDynamicSlotHandler?: (
    slot: Element,
    name: string,
    slotValues: { [name: string]: unknown },
  ) => void
  private _$removeDynamicSlotHandler?: (slot: Element) => void
  private _$updateDynamicSlotHandler?: (
    slot: Element,
    slotValues: { [name: string]: unknown },
    updatePathTree: { [name: string]: true },
  ) => void

  constructor() {
    throw new Error('Element cannot be constructed directly')
    // eslint-disable-next-line no-unreachable
    super()
  }

  static createShadowRoot(host: GeneralComponent): ShadowRoot {
    const node = Object.create(ShadowRoot.prototype) as ShadowRoot
    node._$initializeVirtual('shadow', null, host._$nodeTreeContext)
    node._$idMap = null
    let slotMode = SlotMode.Single
    if (host._$definition._$options.multipleSlots) slotMode = SlotMode.Multiple
    else if (host._$definition._$options.dynamicSlots) slotMode = SlotMode.Dynamic
    node._$slotCacheDirty = false
    node._$appliedSlotCacheDirty = false
    if (slotMode === SlotMode.Single) {
      node._$singleSlot = null
      node._$appliedSingleSlot = null
    } else if (slotMode === SlotMode.Multiple) {
      node._$slots = node._$appliedSlots = Object.create(null) as { [name: string]: Element }
    } else if (slotMode === SlotMode.Dynamic) {
      node._$dynamicSlotSet = new Set()
      node._$appliedDynamicSlots = undefined
      node._$requiredSlotValueNames = []
      node._$propertyPassingDeepCopy = getDeepCopyStrategy(
        host.getComponentOptions().propertyPassingDeepCopy,
      )
      node._$insertDynamicSlotHandler = undefined
      node._$removeDynamicSlotHandler = undefined
      node._$updateDynamicSlotHandler = undefined
    }
    const sr =
      BM.SHADOW || (BM.DYNAMIC && host.getBackendMode() === BackendMode.Shadow)
        ? (host.getBackendElement() as backend.Element | null)?.getShadowRoot() || null
        : null
    node._$backendShadowRoot = sr
    const backendElement = node._$backendShadowRoot?.getRootNode() || null
    node._$initialize(true, backendElement, node, host._$nodeTreeContext)
    node._$host = host
    host.shadowRoot = node
    return node
  }

  getHostNode(): GeneralComponent {
    return this._$host
  }

  createTextNode(text = ''): TextNode {
    return new TextNode(text, this)
  }

  createNativeNode(tagName: string): NativeNode {
    return NativeNode.create(tagName, this)
  }

  createVirtualNode(virtualName = 'virtual'): VirtualNode {
    return VirtualNode.create(virtualName, this)
  }

  createNativeNodeWithInit(
    tagName: string,
    stylingName: string,
    initPropValues?: (comp: NativeNode) => void,
  ): NativeNode {
    const extendedDef = this._$host._$behavior.ownerSpace.getExtendedNativeNode(tagName)
    const ret = NativeNode.create(tagName, this, stylingName, extendedDef)
    initPropValues?.(ret)
    return ret
  }

  /**
   * Create a component if possible
   *
   * Placeholding status should be checked with `checkComponentPlaceholder` .
   * This function may create a native node if the using target is native node.
   */
  createComponent(
    tagName: string,
    usingKey?: string,
    genericTargets?: { [key: string]: string },
    placeholderCallback?: (c: GeneralComponentDefinition) => void,
    initPropValues?: (comp: GeneralComponent | NativeNode) => void,
  ): GeneralComponent | NativeNode {
    const host = this._$host
    const beh = host._$behavior
    const hostGenericImpls = host._$genericImpls
    const space = beh.ownerSpace
    const compName = usingKey === undefined ? tagName : usingKey

    // if the target is in using list, then use the one in using list
    const using = beh._$using[compName]
    if (typeof using === 'string') {
      return this.createNativeNodeWithInit(using, tagName, initPropValues)
    }
    if (using) {
      let usingTarget: GeneralComponentDefinition | undefined
      if (using.final) {
        usingTarget = using.final
      } else if (using.placeholder !== null) {
        const target = resolvePlaceholder(using.placeholder, space, using.source, hostGenericImpls)
        if (typeof target === 'string') {
          return this.createNativeNodeWithInit(target, tagName, initPropValues)
        }
        usingTarget = target
      }
      const placeholderHandler = placeholderCallback
        ? wrapPlaceholderCallback(placeholderCallback, using, host)
        : undefined
      if (usingTarget) {
        const comp = Component._$advancedCreate(
          tagName,
          usingTarget,
          this,
          null,
          convertGenerics(usingTarget, beh, host, genericTargets),
          placeholderHandler,
          initPropValues,
        )
        return comp
      }
    }

    // if the target is in generics list, then use the one
    const g = hostGenericImpls && hostGenericImpls[compName]
    if (typeof g === 'string') {
      return this.createNativeNodeWithInit(g, tagName, initPropValues)
    }
    if (g) {
      let genImpl: GeneralComponentDefinition | undefined
      if (g.final) {
        genImpl = g.final
      } else if (g.placeholder !== null) {
        const target = resolvePlaceholder(g.placeholder, space, g.source, hostGenericImpls)
        if (typeof target === 'string') {
          return this.createNativeNodeWithInit(target, tagName, initPropValues)
        }
        genImpl = target
      }
      const placeholderHandler = placeholderCallback
        ? wrapPlaceholderCallback(placeholderCallback, g, host)
        : undefined
      if (genImpl) {
        return Component._$advancedCreate(
          tagName,
          genImpl,
          this,
          null,
          convertGenerics(genImpl, beh, host, genericTargets),
          placeholderHandler,
          initPropValues,
        )
      }
    }

    // find in the space otherwise
    const comp = space.getGlobalUsingComponent(compName) ?? space.getDefaultComponent()
    if (!comp) {
      throw new Error(`Cannot find component "${compName}"`)
    }
    if (typeof comp === 'string') {
      return this.createNativeNodeWithInit(comp, tagName, initPropValues)
    }
    return Component._$advancedCreate(
      tagName,
      comp,
      this,
      null,
      convertGenerics(comp, beh, host, genericTargets),
      undefined,
      initPropValues,
    )
  }

  /**
   * Create a component if the given tag name is a component in the space, or a native node if not
   *
   * The component `using` map is not used.
   * The tag name is not a relative path to the host component, but an absolute path.
   */
  createComponentOrNativeNode(
    tagName: string,
    genericTargets?: { [key: string]: string },
    initPropValues?: (comp: GeneralComponent | NativeNode) => void,
  ): GeneralComponent | NativeNode {
    const host = this._$host
    const beh = host._$behavior
    const space = beh.ownerSpace

    // find in the space otherwise
    const comp = space.getGlobalUsingComponent(tagName)
    if (typeof comp === 'string') {
      return this.createNativeNodeWithInit(comp, tagName, initPropValues)
    }
    if (comp) {
      return Component._$advancedCreate(
        tagName,
        comp,
        this,
        null,
        convertGenerics(comp, beh, host, genericTargets),
        undefined,
        initPropValues,
      )
    }
    throw new Error(`unknown tag name: ${tagName}`)
  }

  /**
   * Find whether this component is placeholding or not
   *
   * This method will only find in the component `using` list and `generics` list.
   * If not found, returns `undefined` .
   * If the placeholder will be used, returns `true` ; `false` otherwise.
   */
  checkComponentPlaceholder(usingKey: string): boolean | undefined {
    const beh = this._$host._$behavior
    let compDef: ComponentDefinitionWithPlaceholder
    const using = beh._$using[usingKey]
    if (using !== undefined) {
      compDef = using
    } else {
      const g = this._$host._$genericImpls?.[usingKey]
      if (g) compDef = g
      else return undefined
    }
    if (typeof compDef === 'string') return false
    if (compDef.final) return false
    if (compDef.placeholder !== null) return true
    return false
  }

  getElementById(id: string): Element | undefined {
    return this._$getIdMap()[id]
  }

  /** @internal */
  _$markIdCacheDirty() {
    this._$idMap = null
  }

  /** @internal */
  _$getIdMap(): { [id: string]: Element } {
    if (this._$idMap) return this._$idMap
    const idMap = Element._$generateIdMap(this)
    this._$idMap = idMap
    return idMap
  }

  /** Get the slot element if the component is in single-slot mode, or `undefined` if not */
  getSingleSlotElement(): Element | null | undefined {
    return this._$singleSlot
  }

  /** Get the slot element with the specified name */
  getSlotElementFromName(name: string): Element | Element[] | null {
    if (this._$singleSlot !== undefined) return this._$singleSlot
    if (this._$slots) {
      return this._$slots[name] || null
    }
    if (this._$dynamicSlotSet) {
      const slots: Element[] = []
      const iterator = this._$dynamicSlotSet.values()
      for (let it = iterator.next(); !it.done; it = iterator.next()) {
        const slot = it.value
        const slotName = slot._$slotName || ''
        if (slotName === name) slots.push(slot)
      }
      return slots
    }
    return null
  }

  /**
   * Get the slot element for the slot content
   *
   * The provided node must be a valid child node of the host of this shadow root.
   * Otherwise the behavior is undefined.
   */
  getContainingSlot(elem: Node | null): Element | null {
    if (this._$singleSlot !== undefined) return this._$singleSlot
    if (this._$dynamicSlotSet) {
      if (!elem) return null
      let subTreeRoot = elem
      while (subTreeRoot.parentNode?._$inheritSlots) {
        subTreeRoot = subTreeRoot.parentNode
      }
      const slotElement = subTreeRoot._$nodeSlotElement
      if (slotElement?.ownerShadowRoot === this) {
        return slotElement
      }
    }
    if (this._$slots) {
      let name: string
      if (elem instanceof Element) {
        name = elem._$nodeSlot
      } else {
        name = ''
      }
      return this._$slots[name] || null
    }
    return null
  }

  /**
   * Get the elements that should be composed in specified slot
   *
   * This method always returns a new array (or null if the specified slot is invalid).
   * It is convinient but less performant.
   * For better performance, consider using `forEachNodeInSpecifiedSlot` .
   */
  getSlotContentArray(slot: Element): Node[] | null {
    if (slot._$slotName === null) return null
    const ret: Node[] = []
    this.forEachNodeInSpecifiedSlot(slot, (node) => {
      ret.push(node)
    })
    return ret
  }

  /**
   * Iterate slots
   */
  forEachSlot(f: (slot: Element) => boolean | void) {
    if (this._$singleSlot) {
      f(this._$singleSlot)
    } else if (this._$slots) {
      const slots = Object.values(this._$slots)
      for (let i = 0; i < slots.length; i += 1) {
        if (f(slots[i]!) === false) break
      }
    } else if (this._$dynamicSlotSet) {
      const iterator = this._$dynamicSlotSet.values()
      for (let next = iterator.next(); !next.done; next = iterator.next()) {
        if (f(next.value) === false) break
      }
    }
  }

  /**
   * Iterate elements with their slots
   */
  forEachNodeInSlot(f: (node: Node, slot: Element | undefined) => boolean | void) {
    if (this._$singleSlot) {
      const slot = this._$singleSlot
      const rec = (child: Node): boolean => {
        if (f(child, slot) === false) {
          return false
        }
        if (child instanceof Element) {
          if (child._$inheritSlots) {
            if (child.childNodes.every(rec) === false) {
              return false
            }
          }
        }
        return true
      }
      this._$host.childNodes.every(rec)
    } else if (this._$dynamicSlotSet) {
      const rec = (child: Node) => {
        if (f(child, this.getContainingSlot(child) || undefined) === false) {
          return false
        }
        if (child instanceof Element && child._$inheritSlots) {
          if (child.childNodes.every((child) => rec(child)) === false) {
            return false
          }
        }
        return true
      }
      this._$host.childNodes.every(rec)
    } else if (this._$slots) {
      const slots = this._$slots
      const rec = (child: Node) => {
        if (child instanceof Element) {
          if (f(child, slots[child._$nodeSlot]) === false) {
            return false
          }
          if (child._$inheritSlots) {
            if (child.childNodes.every(rec) === false) {
              return false
            }
          }
        } else {
          if (f(child, slots['']) === false) {
            return false
          }
        }
        return true
      }
      this._$host.childNodes.every(rec)
    }
  }

  /**
   * Iterate elements in specified slot
   */
  forEachNodeInSpecifiedSlot(slot: Element | string, f: (node: Node, posIndex: number) => void) {
    if (this._$singleSlot) {
      if (slot !== '' && this._$singleSlot !== slot) return
      const rec = (child: Node, index: number) => {
        f(child, index)
        if (child instanceof Element) {
          if (child._$inheritSlots) {
            child.childNodes.forEach(rec)
          }
        }
      }
      this._$host.childNodes.forEach(rec)
    } else if (this._$dynamicSlotSet) {
      if (typeof slot === 'string') return
      const recInheritedSlot = (child: Node, index: number) => {
        f(child, index)
        if (child instanceof Element && child._$inheritSlots) {
          child.childNodes.forEach(recInheritedSlot)
        }
      }
      const rec = (child: Node, index: number) => {
        if (this.getContainingSlot(child) !== slot) return
        f(child, index)
        if (child instanceof Element && child._$inheritSlots) {
          child.childNodes.forEach(recInheritedSlot)
        }
      }
      this._$host.childNodes.forEach(rec)
    } else if (this._$slots) {
      if (typeof slot !== 'string' && this._$slots[slot._$slotName!] !== slot) return
      const name = typeof slot === 'string' ? slot : slot._$slotName
      const rec = (child: Node, index: number) => {
        if (child instanceof Element) {
          if (child._$nodeSlot === name) f(child, index)
          if (child._$inheritSlots) {
            child.childNodes.forEach(rec)
          }
        } else if (name === '') {
          f(child, index)
        }
      }
      this._$host.childNodes.forEach(rec)
    }
  }

  /** @internal */
  _$markSlotCacheDirty() {
    this._$slotCacheDirty = true
    this._$appliedSlotCacheDirty = true
  }

  /** @internal */
  _$checkSlotChanges(): void {
    if (!this._$appliedSlotCacheDirty) return
    this._$appliedSlotCacheDirty = false
    if (this._$slotCacheDirty) this._$updateSlotCache()
    if (BM.SHADOW || (BM.DYNAMIC && this.getBackendMode() === BackendMode.Shadow)) return

    // for dynamic slotting, invoke slot handlers
    if (this._$dynamicSlotSet) {
      const appliedDynamicSlots = this._$appliedDynamicSlots
      if (!appliedDynamicSlots) return
      const dynamicSlotSet = this._$dynamicSlotSet
      const insertDynamicSlot = this._$insertDynamicSlotHandler
      const removeDynamicSlot = this._$removeDynamicSlotHandler
      const removeIter = appliedDynamicSlots.keys()
      for (let it = removeIter.next(); !it.done; it = removeIter.next()) {
        const slot = it.value
        if (!dynamicSlotSet.has(slot)) {
          removeDynamicSlot?.(slot)
          appliedDynamicSlots.delete(slot)
        }
      }
      const iter = dynamicSlotSet.values()
      for (let it = iter.next(); !it.done; it = iter.next()) {
        const slot = it.value
        const slotName = slot._$slotName || ''
        const appliedSlot = appliedDynamicSlots.get(slot)
        if (appliedSlot !== undefined) {
          if (appliedSlot.slotName !== slotName) {
            removeDynamicSlot?.(slot)
            insertDynamicSlot?.(slot, slotName, slot._$slotValues!)
            appliedDynamicSlots.set(slot, { slotName, updatePathTree: undefined })
          }
        } else {
          insertDynamicSlot?.(slot, slotName, slot._$slotValues!)
          appliedDynamicSlots.set(slot, { slotName, updatePathTree: undefined })
        }
      }
      return
    }

    // in single slot mode, simply check changes
    if (this._$singleSlot !== undefined) {
      const oldSingleSlot = this._$appliedSingleSlot
      if (oldSingleSlot !== this._$singleSlot) {
        this._$appliedSingleSlot = this._$singleSlot
        Element._$insertChildReassignSlot(this, '', oldSingleSlot!, this._$singleSlot)
      }
      return
    }

    // for multiple slots, compare and find slot changes
    const oldSlots = this._$appliedSlots!
    const newSlots = this._$slots!
    this._$appliedSlots = newSlots
    const oldKeys = Object.keys(oldSlots)
    for (let i = 0; i < oldKeys.length; i += 1) {
      const key = oldKeys[i]!
      const oldSlot = oldSlots[key]!
      const newSlot = newSlots[key]
      if (oldSlot !== newSlot) {
        Element._$insertChildReassignSlot(this, key, oldSlot, newSlot || null)
      }
    }
    const newKeys = Object.keys(newSlots)
    for (let i = 0; i < newKeys.length; i += 1) {
      const key = newKeys[i]!
      const oldSlot = oldSlots[key]
      const newSlot = newSlots[key]!
      if (oldSlot === undefined) {
        Element._$insertChildReassignSlot(this, key, null, newSlot || null)
      }
    }
  }

  private _$updateSlotCache() {
    this._$slotCacheDirty = false

    // in single slot mode, find the slot
    if (this._$singleSlot !== undefined) {
      let slot: Element | undefined
      const rec = (child: Node): boolean => {
        if (child instanceof Element) {
          if (child._$slotName !== null) {
            slot = child
            return false
          }
          if (child.childNodes.every(rec) === false) {
            return false
          }
        }
        return true
      }
      this.childNodes.every(rec)
      this._$singleSlot = slot || null
      return
    }

    // for dynamic slotting, collect the slots
    if (this._$dynamicSlotSet) {
      const dynamicSlotSet = new Set<Element>()
      const rec = (child: Node): void => {
        if (child instanceof Element) {
          if (child._$slotName !== null) {
            dynamicSlotSet.add(child)
          }
          child.childNodes.forEach(rec)
        }
      }
      this.childNodes.forEach(rec)
      this._$dynamicSlotSet = dynamicSlotSet
      return
    }

    // for multiple slots, collect the slots
    const slots = Object.create(null) as { [name: string]: Element }
    const rec = (child: Node): void => {
      if (child instanceof Element) {
        if (child._$slotName !== null) {
          if (!slots[child._$slotName]) {
            slots[child._$slotName] = child
          }
        }
        child.childNodes.forEach(rec)
      }
    }
    this.childNodes.forEach(rec)
    this._$slots = slots
  }

  /**
   * Returns `true` if the component is in multiple-slot mode
   */
  isMultipleSlots(): boolean {
    return this._$slots !== undefined
  }

  /**
   * Returns `true` if the component is in dynamic-slot mode
   */
  isDynamicSlots(): boolean {
    return this._$dynamicSlotSet !== undefined
  }

  /**
   * Set the dynamic slot handlers
   *
   * The updated value should be applied with `applySlotUpdates` call.
   * If the handlers have not been set yet,
   * the `insertSlotHandler` will be called for each slot that has been added to the shadow tree.
   */
  setDynamicSlotHandler(
    requiredSlotValueNames: string[],
    insertSlotHandler: (
      slot: Element,
      name: string,
      slotValues: { [name: string]: unknown },
    ) => void,
    removeSlotHandler: (slot: Element) => void,
    updateSlotHandler: (
      slot: Element,
      slotValues: { [name: string]: unknown },
      updatePathTree: { [name: string]: true },
    ) => void,
  ) {
    this._$requiredSlotValueNames = requiredSlotValueNames
    this._$insertDynamicSlotHandler = insertSlotHandler
    this._$removeDynamicSlotHandler = removeSlotHandler
    this._$updateDynamicSlotHandler = updateSlotHandler
    if (this._$appliedDynamicSlots) {
      const iter = this._$appliedDynamicSlots.values()
      for (let it = iter.next(); !it.done; it = iter.next()) {
        const slotMeta = it.value
        if (!slotMeta.updatePathTree) {
          slotMeta.updatePathTree = Object.create(null) as { [key: string]: true }
        }
      }
    }
  }

  /**
   * Use the same dynamic slot handlers with the `source`
   */
  useDynamicSlotHandlerFrom(source: ShadowRoot) {
    if (source._$insertDynamicSlotHandler) {
      this.setDynamicSlotHandler(
        source._$requiredSlotValueNames!.slice(),
        source._$insertDynamicSlotHandler,
        source._$removeDynamicSlotHandler!,
        source._$updateDynamicSlotHandler!,
      )
    }
  }

  /**
   * Update a slot value
   *
   * The updated value should be applied with `applySlotValueUpdates` call.
   */
  replaceSlotValue(slot: Element, name: string, value: unknown): void {
    const slotValues = slot._$slotValues
    if (slotValues) {
      const oldValue = slotValues[name]
      let newValue = value
      if (this._$propertyPassingDeepCopy !== DeepCopyStrategy.None) {
        if (this._$propertyPassingDeepCopy === DeepCopyStrategy.SimpleWithRecursion) {
          newValue = deepCopy(value, true)
        } else {
          newValue = simpleDeepCopy(value)
        }
      }
      if (oldValue !== newValue) {
        slotValues[name] = newValue
        if (this._$requiredSlotValueNames!.indexOf(name) >= 0) {
          const slotMeta = this._$appliedDynamicSlots?.get(slot)
          if (slotMeta) {
            if (!slotMeta.updatePathTree) {
              slotMeta.updatePathTree = Object.create(null) as { [key: string]: true }
            }
            slotMeta.updatePathTree[name] = true
          }
        }
      }
    }
  }

  /**
   * Apply slot value updates
   */
  applySlotValueUpdates(slot: Element) {
    const slotMeta = this._$appliedDynamicSlots?.get(slot)
    const slotValueUpdatePathTree = slotMeta?.updatePathTree
    if (slotValueUpdatePathTree) {
      slotMeta.updatePathTree = undefined
      this._$updateDynamicSlotHandler?.(slot, slot._$slotValues!, slotValueUpdatePathTree)
    }
  }

  /**
   * Apply all pending slot updates
   */
  applySlotUpdates(): void {
    if (this._$appliedDynamicSlots) {
      // if slots has been initialized, mark all of them dirty
      const iter = this._$appliedDynamicSlots.entries()
      for (let it = iter.next(); !it.done; it = iter.next()) {
        const [slot, slotMeta] = it.value
        const slotValueUpdatePathTree = slotMeta?.updatePathTree
        if (slotValueUpdatePathTree) {
          slotMeta.updatePathTree = undefined
          this._$updateDynamicSlotHandler?.(slot, slot._$slotValues!, slotValueUpdatePathTree)
        }
      }
    } else {
      // if slots is not initialized, try initialize them
      this._$appliedDynamicSlots = new Map()
      this._$appliedSlotCacheDirty = true
      this._$checkSlotChanges()
    }
  }
}
