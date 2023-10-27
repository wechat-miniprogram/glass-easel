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
import { DoubleLinkedList, Element } from './element'
import { Node } from './node'
import { ComponentDefinitionWithPlaceholder } from './behavior'
import { BM, BackendMode } from './backend/mode'
import { DeepCopyStrategy, getDeepCopyStrategy } from './data_proxy'
import { deepCopy, simpleDeepCopy } from './data_utils'
import { triggerWarning } from './func_arr'

export const enum SlotMode {
  Direct = 0,
  Single,
  Multiple,
  Dynamic,
}

type AppliedSlotMeta = {
  updatePathTree: { [key: string]: true } | undefined
}

export class ShadowRoot extends VirtualNode {
  private _$host: GeneralComponent
  /** @internal */
  _$backendShadowRoot: backend.ShadowRootContext | null
  private _$slotMode: SlotMode
  private _$idMap: { [id: string]: Element } | null
  private _$singleSlot?: Element | null
  private _$slots?: Record<string, Element>
  private _$slotsList?: Record<string, DoubleLinkedList<Element>>
  private _$dynamicSlotsInserted?: boolean
  private _$dynamicSlots?: Map<Element, AppliedSlotMeta>
  private _$requiredSlotValueNames?: string[]
  private _$propertyPassingDeepCopy?: DeepCopyStrategy
  private _$insertDynamicSlotHandler?: (
    slots: {
      slot: Element
      name: string
      slotValues: { [name: string]: unknown }
    }[],
  ) => void
  private _$removeDynamicSlotHandler?: (slots: Element[]) => void
  private _$updateDynamicSlotHandler?: (
    slot: Element,
    slotValues: { [name: string]: unknown },
    updatePathTree: { [name: string]: true },
  ) => void

  constructor() {
    throw new Error('Element cannot be constructed directly')
    // eslint-disable-next-line no-unreachable
    /* istanbul ignore next */
    super()
  }

  static createShadowRoot(host: GeneralComponent): ShadowRoot {
    const node = Object.create(ShadowRoot.prototype) as ShadowRoot
    const sr =
      BM.SHADOW || (BM.DYNAMIC && host.getBackendMode() === BackendMode.Shadow)
        ? (host.getBackendElement() as backend.Element | null)?.getShadowRoot() || null
        : null
    node._$initializeVirtual('shadow', node, host._$nodeTreeContext, sr)
    node._$idMap = null
    let slotMode = SlotMode.Single
    const hostComponentOptions = host.getComponentOptions()
    if (hostComponentOptions.multipleSlots) slotMode = SlotMode.Multiple
    else if (hostComponentOptions.dynamicSlots) slotMode = SlotMode.Dynamic
    else if (hostComponentOptions.directSlots) slotMode = SlotMode.Direct
    node._$slotMode = slotMode
    if (slotMode === SlotMode.Single) {
      node._$singleSlot = null
    } else if (slotMode === SlotMode.Multiple) {
      node._$slots = Object.create(null) as Record<string, Element>
      node._$slotsList = Object.create(null) as Record<string, DoubleLinkedList<Element>>
    } else if (slotMode === SlotMode.Dynamic) {
      node._$dynamicSlotsInserted = false
      node._$dynamicSlots = new Map()
      node._$requiredSlotValueNames = []
      node._$propertyPassingDeepCopy = getDeepCopyStrategy(
        hostComponentOptions.propertyPassingDeepCopy,
      )
      node._$insertDynamicSlotHandler = undefined
      node._$removeDynamicSlotHandler = undefined
      node._$updateDynamicSlotHandler = undefined
    }
    node._$backendShadowRoot = sr
    node._$initialize(true, sr, node, host._$nodeTreeContext)
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
    placeholderHandlerRemover: (() => void) | undefined,
    initPropValues?: (comp: NativeNode) => void,
  ): NativeNode {
    const extendedDef = this._$host._$behavior.ownerSpace.getExtendedNativeNode(tagName)
    const ret = NativeNode.create(
      tagName,
      this,
      stylingName,
      extendedDef,
      placeholderHandlerRemover,
    )
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

    const possibleComponentDefinitions = [
      // if the target is in using list, then use the one in using list
      beh._$using[compName],
      // if the target is in generics list, then use the one
      hostGenericImpls && hostGenericImpls[compName],
    ]

    for (let i = 0; i < possibleComponentDefinitions.length; i += 1) {
      const cwp = possibleComponentDefinitions[i]
      if (cwp === null || cwp === undefined) continue
      if (typeof cwp === 'string') {
        return this.createNativeNodeWithInit(cwp, tagName, undefined, initPropValues)
      }
      let usingTarget: GeneralComponentDefinition | string | undefined
      let placeholderHandlerRemover: (() => void) | undefined
      if (cwp.final) {
        usingTarget = cwp.final
      } else if (cwp.placeholder !== null) {
        usingTarget = resolvePlaceholder(cwp.placeholder, space, cwp.source, hostGenericImpls)
        const waiting = cwp.waiting
        if (placeholderCallback && waiting) {
          waiting.add(placeholderCallback)
          waiting.hintUsed(host)
          placeholderHandlerRemover = () => {
            waiting.remove(placeholderCallback)
          }
        }
      }
      if (typeof usingTarget === 'string') {
        return this.createNativeNodeWithInit(
          usingTarget,
          tagName,
          placeholderHandlerRemover,
          initPropValues,
        )
      }
      if (usingTarget) {
        return Component._$advancedCreate(
          tagName,
          usingTarget,
          this,
          null,
          convertGenerics(usingTarget, beh, host, genericTargets),
          placeholderHandlerRemover,
          initPropValues,
        )
      }
    }

    // find in the space otherwise
    let comp = space.getGlobalUsingComponent(compName)
    if (comp === null && space._$allowUnusedNativeNode && compName !== '') {
      comp = compName
    }
    /* istanbul ignore if */
    if (!comp) {
      comp = space.getDefaultComponent()
      if (!comp) {
        throw new Error(`Cannot find component "${compName}"`)
      } else {
        triggerWarning(
          `Cannot find using component "${compName}", using default component (on component "${beh.is}")`,
        )
      }
    }
    if (typeof comp === 'string') {
      return this.createNativeNodeWithInit(comp, tagName, undefined, initPropValues)
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
   * Consider using `checkComponentPlaceholder` to check if the tag name is in the `using` map.
   * The global using registered with `ComponentSpace.prototype.getGlobalUsingComponent` is still used.
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
      return this.createNativeNodeWithInit(comp, tagName, undefined, initPropValues)
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

    if (space._$allowUnusedNativeNode) {
      // use native node otherwise
      const node = NativeNode.create(tagName, this)
      initPropValues?.(node)
      return node
    }
    throw new Error(`Unknown tag name ${tagName}`)
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

  /** Get the slot element with the specified name */
  getSlotElementFromName(name: string): Element | Element[] | null {
    const slotMode = this._$slotMode
    /* istanbul ignore if */
    if (slotMode === SlotMode.Direct) throw new Error('cannot get slot element in directSlots')
    if (slotMode === SlotMode.Single) return this._$singleSlot!
    if (slotMode === SlotMode.Multiple) {
      return this._$slots![name] || null
    }
    if (slotMode === SlotMode.Dynamic) {
      const slots: Element[] = []
      for (let it = this._$subtreeSlotStart; it; it = it.next) {
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
    const slotMode = this._$slotMode
    if (slotMode === SlotMode.Direct) return elem?.containingSlot || null
    if (slotMode === SlotMode.Single) return this._$singleSlot as Element | null
    if (slotMode === SlotMode.Dynamic) {
      if (!elem) return null
      let subTreeRoot = elem
      while (subTreeRoot.parentNode?._$inheritSlots) {
        subTreeRoot = subTreeRoot.parentNode
      }
      const slotElement = subTreeRoot._$slotElement
      // FIXME is ownerShadowRoot check necessary?
      if (slotElement?.ownerShadowRoot === this) {
        return slotElement
      }
    }
    if (slotMode === SlotMode.Multiple) {
      let name: string
      if (elem instanceof Element) {
        name = elem._$nodeSlot
      } else {
        name = ''
      }
      return this._$slots![name] || null
    }
    return null
  }

  /**
   * Get the elements that should be composed in specified slot
   *
   * This method always returns a new array (or null if the specified slot is invalid).
   * It is convenient but less performant.
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
    const slotMode = this._$slotMode
    /* istanbul ignore if */
    if (slotMode === SlotMode.Direct) {
      throw new Error('Cannot iterate slots in directSlots')
    }
    if (slotMode === SlotMode.Single) {
      if (this._$singleSlot) f(this._$singleSlot)
    } else if (slotMode === SlotMode.Multiple) {
      const slots = Object.values(this._$slots!)
      for (let i = 0; i < slots.length; i += 1) {
        if (f(slots[i]!) === false) break
      }
    } else if (slotMode === SlotMode.Dynamic) {
      for (let it = this._$subtreeSlotStart; it; it = it.next) {
        if (f(it.value) === false) break
      }
    }
  }

  /**
   * Iterate through elements ahd their corresponding slots (including slots-inherited nodes)
   * @param f A function to execute for each element. Return false to break the iteration.
   * @returns A boolean indicating whether the iteration is complete.
   */
  forEachNodeInSlot(f: (node: Node, slot: Element | null | undefined) => boolean | void): boolean {
    const childNodes = this._$host.childNodes
    for (let i = 0; i < childNodes.length; i += 1) {
      if (!Element.forEachNodeInSlot(childNodes[i]!, f)) return false
    }
    return true
  }

  /**
   * Iterate through elements of a specified slot (including slots-inherited nodes)
   * @param f A function to execute for each element. Return false to break the iteration.
   * @returns A boolean indicating whether the iteration is complete.
   */
  forEachNodeInSpecifiedSlot(slot: Element | null, f: (node: Node) => boolean | void): boolean {
    if (slot) {
      const childNodes = slot.slotNodes!
      for (let i = 0; i < childNodes.length; i += 1) {
        const node = childNodes[i]!
        if (f(node) === false) return false
      }
      return true
    }
    return this.forEachNodeInSlot((node, slot) => (slot === null ? f(node) : true))
  }

  /**
   * Iterate through elements ahd their corresponding slots (NOT including slots-inherited nodes)
   * @param f A function to execute for each element. Return false to break the iteration.
   * @returns A boolean indicating whether the iteration is complete.
   */
  forEachSlotContentInSlot(
    f: (node: Node, slot: Element | null | undefined) => boolean | void,
  ): boolean {
    const childNodes = this._$host.childNodes
    for (let i = 0; i < childNodes.length; i += 1) {
      if (!Element.forEachSlotContentInSlot(childNodes[i]!, f)) return false
    }
    return true
  }

  /**
   * Iterate through elements of a specified slot (NOT including slots-inherited nodes)
   * @param f A function to execute for each element. Return false to break the iteration.
   * @returns A boolean indicating whether the iteration is complete.
   */
  forEachSlotContentInSpecifiedSlot(
    slot: Element | null,
    f: (node: Node) => boolean | void,
  ): boolean {
    if (slot) {
      const childNodes = slot.slotNodes!
      for (let i = 0; i < childNodes.length; i += 1) {
        const node = childNodes[i]!
        if (!node._$inheritSlots && f(node) === false) return false
      }
      return true
    }
    return this.forEachSlotContentInSlot((node, slot) => (slot === null ? f(node) : true))
  }

  /**
   * Check whether a node is connected to this shadow root
   */
  isConnected(node: Node): boolean {
    if (node.ownerShadowRoot !== this) return false
    for (let p: Node | null = node; p; p = p.parentNode) {
      if (p === this) return true
    }
    return false
  }

  /** @internal */
  private _$applyMultipleSlotInsertion(slot: Element, slotName: string, _move: boolean): void {
    const slotsList = this._$slotsList!
    const slots = this._$slots!

    // assuming that slot name duplication is very rare in practice,
    // the complexity without name duplication is priority guaranteed.
    if (slotsList[slotName]) {
      // with name duplication
      const firstSlot = slotsList[slotName]!
      let insertPos = { next: firstSlot } as DoubleLinkedList<Element> // this is a pointer to pointer
      let insertBeforeFirst = true
      for (let jt = this._$subtreeSlotStart; jt && insertPos.next; jt = jt.next) {
        if (jt.value === slot) break
        if (jt.value === insertPos.next.value) {
          insertBeforeFirst = false
          insertPos = insertPos.next
        }
      }
      if (insertBeforeFirst) {
        slotsList[slotName] = firstSlot.prev = { value: slot, prev: null, next: firstSlot }
      } else {
        const next = insertPos.next
        insertPos.next = { value: slot, prev: insertPos, next }
        if (next) next.prev = insertPos.next
      }
    } else {
      // without name duplication
      slotsList[slotName] = { value: slot, prev: null, next: null }
    }
    const oldSlot = slots[slotName]
    const newSlot = slotsList[slotName]!.value
    if (oldSlot === newSlot) return
    slots[slotName] = newSlot
    Element._$insertChildReassignSlot(this, slotName, oldSlot || null, newSlot)
  }

  /** @internal */
  private _$applyMultipleSlotsRemoval(slot: Element, slotName: string, move: boolean): void {
    const slotsList = this._$slotsList!
    const slots = this._$slots!

    let oldSlot = slotsList[slotName] || null
    for (; oldSlot; oldSlot = oldSlot.next) {
      if (oldSlot.value === slot) break
    }
    if (!oldSlot) return
    const prev = oldSlot.prev
    const next = oldSlot.next
    if (prev) prev.next = next
    if (next) next.prev = prev

    const firstSlotRemoved = !prev
    if (!firstSlotRemoved) return

    const newFirstSlot = next
    if (newFirstSlot) {
      const oldNameNewSlot = newFirstSlot.value
      slotsList[slotName] = newFirstSlot
      // only update slotsList if slots were moved
      if (!move) {
        slots[slotName] = oldNameNewSlot
        Element._$insertChildReassignSlot(this, slotName, slot, oldNameNewSlot)
      }
    } else {
      delete slotsList[slotName]
      // only update slotsList if slots were moved
      if (!move) {
        delete slots[slotName]
        Element._$insertChildReassignSlot(this, slotName, slot, null)
      }
    }
  }

  /** @internal */
  _$applySlotRename(slot: Element, newName: string, oldName: string): void {
    const slotMode = this._$slotMode

    // single slot does not care slot name
    if (slotMode === SlotMode.Single || slotMode === SlotMode.Direct) return

    // for multiple slots, reassign slot contents
    if (slotMode === SlotMode.Multiple) {
      this._$applyMultipleSlotsRemoval(slot, oldName, false)
      this._$applyMultipleSlotInsertion(slot, newName, false)
      return
    }

    // for dynamic slotting, destroy and re-insert slot
    if (slotMode === SlotMode.Dynamic) {
      // wait until applySlotUpdates
      if (!this._$dynamicSlotsInserted) return
      const insertDynamicSlot = this._$insertDynamicSlotHandler
      const removeDynamicSlot = this._$removeDynamicSlotHandler
      this._$dynamicSlots!.set(slot, { updatePathTree: undefined })
      removeDynamicSlot?.([slot])
      insertDynamicSlot?.([{ slot, name: newName, slotValues: slot._$slotValues! }])
    }
  }

  /** @internal */
  _$applySlotsInsertion(
    slotStart: DoubleLinkedList<Element>,
    slotEnd: DoubleLinkedList<Element>,
    move: boolean,
  ): void {
    const slotMode = this._$slotMode

    // for direct slotting, do nothing
    if (slotMode === SlotMode.Direct) return

    if (slotMode === SlotMode.Single) {
      const oldSlot = this._$singleSlot
      const newSlot = this._$subtreeSlotStart!.value
      if (oldSlot === newSlot) return

      this._$singleSlot = newSlot
      Element._$insertChildReassignSlot(this, null, oldSlot || null, newSlot)
      return
    }

    if (slotMode === SlotMode.Multiple) {
      for (
        let it: DoubleLinkedList<Element> | null = slotStart;
        it && it !== slotEnd.next;
        it = it.next
      ) {
        const slot = it.value
        const slotName = slot._$slotName!
        this._$applyMultipleSlotInsertion(slot, slotName, move)
      }
      return
    }

    if (slotMode === SlotMode.Dynamic) {
      // dynamic-slotting should do nothing about slot movement
      if (move) return
      // wait until applySlotUpdates
      if (!this._$dynamicSlotsInserted) return
      const insertDynamicSlot = this._$insertDynamicSlotHandler
      const slots: { slot: Element; name: string; slotValues: { [name: string]: unknown } }[] = []
      for (
        let it: DoubleLinkedList<Element> | null = slotStart;
        it && it !== slotEnd.next;
        it = it.next
      ) {
        const slot = it.value
        const slotName = slot._$slotName!
        this._$dynamicSlots!.set(slot, { updatePathTree: undefined })
        slots.push({ slot, name: slotName, slotValues: slot._$slotValues! })
      }
      insertDynamicSlot?.(slots)
    }
  }

  /** @internal */
  _$applySlotsRemoval(
    slotStart: DoubleLinkedList<Element>,
    slotEnd: DoubleLinkedList<Element>,
    move: boolean,
  ): void {
    const slotMode = this._$slotMode

    // for direct slotting, do nothing
    if (slotMode === SlotMode.Direct) return

    if (slotMode === SlotMode.Single) {
      // will call applySLotsInsertion after if slots were moved
      // no need to do anything here
      if (move) return
      const oldSlot = this._$singleSlot
      const newSlot = this._$subtreeSlotStart?.value
      if (oldSlot === newSlot) return

      this._$singleSlot = newSlot
      Element._$insertChildReassignSlot(this, null, oldSlot || null, newSlot || null)
      return
    }

    if (slotMode === SlotMode.Multiple) {
      for (
        let it: DoubleLinkedList<Element> | null = slotStart;
        it && it !== slotEnd.next;
        it = it.next
      ) {
        const slot = it.value
        const slotName = slot._$slotName!
        this._$applyMultipleSlotsRemoval(slot, slotName, move)
      }
      return
    }

    if (slotMode === SlotMode.Dynamic) {
      // dynamic-slotting should do nothing about slot movement
      if (move) return
      // wait until applySlotUpdates
      if (!this._$dynamicSlotsInserted) return
      const removeDynamicSlot = this._$removeDynamicSlotHandler
      const slots: Element[] = []
      for (
        let it: DoubleLinkedList<Element> | null = slotStart;
        it && it !== slotEnd.next;
        it = it.next
      ) {
        const slot = it.value
        this._$dynamicSlots!.delete(slot)
        slots.push(slot)
      }
      removeDynamicSlot?.(slots)
    }
  }

  /**
   * Set the dynamic slot handlers
   *
   * If the handlers have not been set yet,
   * the `insertSlotHandler` will be called for each slot that has been added to the shadow tree,
   * otherwise call `updateSlotHandler` for each slots.
   */
  setDynamicSlotHandler(
    requiredSlotValueNames: string[],
    insertSlotHandler: (
      slots: {
        slot: Element
        name: string
        slotValues: { [name: string]: unknown }
      }[],
    ) => void,
    removeSlotHandler: (slots: Element[]) => void,
    updateSlotHandler: (
      slot: Element,
      slotValues: { [name: string]: unknown },
      updatePathTree: { [name: string]: true },
    ) => void,
  ) {
    if (this._$slotMode !== SlotMode.Dynamic) return

    this._$requiredSlotValueNames = requiredSlotValueNames
    this._$insertDynamicSlotHandler = insertSlotHandler
    this._$removeDynamicSlotHandler = removeSlotHandler
    this._$updateDynamicSlotHandler = updateSlotHandler

    if (this._$dynamicSlotsInserted) {
      const iter = this._$dynamicSlots!.values()
      for (let it = iter.next(); !it.done; it = iter.next()) {
        const slotMeta = it.value
        slotMeta.updatePathTree =
          slotMeta.updatePathTree || (Object.create(null) as Record<string, true>)
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
    if (!slotValues) return
    const oldValue = slotValues[name]
    let newValue = value
    if (this._$propertyPassingDeepCopy !== DeepCopyStrategy.None) {
      if (this._$propertyPassingDeepCopy === DeepCopyStrategy.SimpleWithRecursion) {
        newValue = deepCopy(value, true)
      } else {
        newValue = simpleDeepCopy(value)
      }
    }
    if (oldValue === newValue) return
    slotValues[name] = newValue
    if (this._$requiredSlotValueNames!.indexOf(name) < 0) return
    const slotMeta = this._$dynamicSlots?.get(slot)
    if (!slotMeta) return
    if (!slotMeta.updatePathTree) {
      slotMeta.updatePathTree = Object.create(null) as { [key: string]: true }
    }
    slotMeta.updatePathTree[name] = true
  }

  /**
   * Apply slot value updates
   */
  applySlotValueUpdates(slot: Element) {
    const slotMeta = this._$dynamicSlots?.get(slot)
    const slotValueUpdatePathTree = slotMeta?.updatePathTree
    if (!slotValueUpdatePathTree) return
    slotMeta.updatePathTree = undefined
    this._$updateDynamicSlotHandler?.(slot, slot._$slotValues!, slotValueUpdatePathTree)
  }

  applySlotUpdates(): void {
    if (!this._$dynamicSlotsInserted) {
      this._$dynamicSlotsInserted = true
      const insertDynamicSlot = this._$insertDynamicSlotHandler
      const slots: { slot: Element; name: string; slotValues: { [name: string]: unknown } }[] = []
      for (let it = this._$subtreeSlotStart; it; it = it.next) {
        const slot = it.value
        const slotName = slot._$slotName!
        this._$dynamicSlots!.set(slot, { updatePathTree: undefined })
        slots.push({ slot, name: slotName, slotValues: slot._$slotValues! })
      }
      insertDynamicSlot?.(slots)
    } else {
      const iter = this._$dynamicSlots!.entries()
      for (let it = iter.next(); !it.done; it = iter.next()) {
        const [slot, slotMeta] = it.value
        const slotValueUpdatePathTree = slotMeta.updatePathTree
        if (slotValueUpdatePathTree) {
          slotMeta.updatePathTree = undefined
          this._$updateDynamicSlotHandler?.(slot, slot._$slotValues!, slotValueUpdatePathTree)
        }
      }
    }
  }

  /**
   * Get slot mode
   */
  getSlotMode(): SlotMode {
    return this._$slotMode
  }

  /** @internal */
  static _$updateSubtreeSlotNodes(
    parentNode: Element,
    elements: Node[],
    shadowRoot: ShadowRoot | null,
    oldShadowRoot: ShadowRoot | null,
    posIndex: number,
  ):
    | { updateContainingSlot: () => void; removeSlotNodes: () => void; insertSlotNodes: () => void }
    | undefined {
    if (!shadowRoot && !oldShadowRoot) return undefined

    const slotMode = shadowRoot?.getSlotMode()
    const oldSlotMode = oldShadowRoot?.getSlotMode()

    if (
      (slotMode === undefined || slotMode === SlotMode.Direct) &&
      (oldSlotMode === undefined || oldSlotMode === SlotMode.Direct)
    ) {
      return undefined
    }

    if (
      (slotMode === undefined || slotMode === SlotMode.Single) &&
      (oldSlotMode === undefined || oldSlotMode === SlotMode.Single)
    ) {
      let removeStart = -1
      let removeCount = 0
      let insertPos = -1
      const slotNodesToUpdate: Node[] = []
      const oldContainingSlot = elements[0]!.containingSlot
      const containingSlot = shadowRoot?.getContainingSlot(elements[0]!)

      for (let i = 0; i < elements.length; i += 1) {
        const elem = elements[i]!
        // eslint-disable-next-line no-loop-func
        Element.forEachNodeInSlot(elem, (node) => {
          if (oldContainingSlot) {
            if (removeCount) {
              removeCount += 1
            } else {
              removeStart = node.slotIndex!
              removeCount = 1
            }
          }

          slotNodesToUpdate.push(node)
        })
      }

      if (containingSlot && slotNodesToUpdate.length) {
        const firstSlotNode = slotNodesToUpdate[0]!
        insertPos = Element._$findSlotNodeInsertPosition(containingSlot, firstSlotNode, posIndex)
      }

      return {
        updateContainingSlot: () => {
          for (let i = slotNodesToUpdate.length - 1; i >= 0; i -= 1) {
            const node = slotNodesToUpdate[i]!
            Element._$updateContainingSlot(node, containingSlot)
          }
        },
        removeSlotNodes: () => {
          if (oldShadowRoot && oldContainingSlot && removeCount) {
            Element._$spliceSlotNodes(oldContainingSlot, removeStart, removeCount, undefined)
          }
        },
        insertSlotNodes: () => {
          if (shadowRoot && containingSlot && slotNodesToUpdate.length) {
            Element._$spliceSlotNodes(containingSlot, insertPos, 0, slotNodesToUpdate)
          }
        },
      }
    }
    const slotNodesToInsertMap = new Map<Element, { nodes: Node[]; insertPos: number }>()
    const slotNodesToRemoveMap = new Map<Element, { start: number; count: number }>()

    const slotNodesWithContainingSlot: [Node, Element | undefined | null][] = []

    for (let i = 0; i < elements.length; i += 1) {
      const elem = elements[i]!
      Element.forEachNodeInSlot(elem, (node, oldContainingSlot) => {
        const containingSlot =
          slotMode !== SlotMode.Direct ? shadowRoot?.getContainingSlot(node) : undefined

        if (oldContainingSlot) {
          const slotNodesToRemove = slotNodesToRemoveMap.get(oldContainingSlot)
          if (slotNodesToRemove) {
            slotNodesToRemove.count += 1
          } else {
            slotNodesToRemoveMap.set(oldContainingSlot, { start: node.slotIndex!, count: 1 })
          }
        }

        if (containingSlot) {
          const slotNodesToInsert = slotNodesToInsertMap.get(containingSlot)
          if (slotNodesToInsert) {
            slotNodesToInsert.nodes.push(node)
          } else {
            slotNodesToInsertMap.set(containingSlot, { nodes: [node], insertPos: -1 })
          }
        }

        slotNodesWithContainingSlot.push([node, containingSlot])
      })
    }

    if (shadowRoot && slotNodesToInsertMap.size) {
      const iter = slotNodesToInsertMap.entries()

      for (let it = iter.next(); !it.done; it = iter.next()) {
        const [slot, { nodes: slotNodesToInsert }] = it.value
        const firstSlotNodeToInsert = slotNodesToInsert[0]!
        it.value[1].insertPos = Element._$findSlotNodeInsertPosition(
          slot,
          firstSlotNodeToInsert,
          posIndex,
        )
      }
    }

    return {
      updateContainingSlot: () => {
        for (let i = slotNodesWithContainingSlot.length - 1; i >= 0; i -= 1) {
          const [node, containingSlot] = slotNodesWithContainingSlot[i]!
          Element._$updateContainingSlot(node, containingSlot)
        }
      },
      removeSlotNodes: () => {
        if (oldShadowRoot && slotNodesToRemoveMap.size) {
          const iter = slotNodesToRemoveMap.entries()
          for (let it = iter.next(); !it.done; it = iter.next()) {
            const [slot, { start, count }] = it.value
            Element._$spliceSlotNodes(slot, start, count, undefined)
          }
        }
      },
      insertSlotNodes: () => {
        if (shadowRoot && slotNodesToInsertMap.size) {
          const iter = slotNodesToInsertMap.entries()

          for (let it = iter.next(); !it.done; it = iter.next()) {
            const [slot, { nodes: slotNodesToInsert, insertPos }] = it.value
            Element._$spliceSlotNodes(slot, insertPos, 0, slotNodesToInsert)
          }
        }
      },
    }
  }
}
