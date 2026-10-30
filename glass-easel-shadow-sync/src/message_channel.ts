/*
 * Semantics of a shadow-sync channel.
 *
 * `MessageChannelDataSide` runs next to the logic side: it maps glass-easel
 * backend calls to channel operations and routes callbacks back to the logic
 * code. `MessageChannelViewSide` runs next to the view side: it applies the
 * operations to a `ViewController` and reports callbacks and events back.
 *
 * The wire format (stream packing, string interning, batching) lives in
 * `transport_bridge.ts`; this module only decides what an operation means. A
 * side is created with a `TransportBridge` it publishes to and subscribes on.
 */
import type {
  DataChange,
  DataValue,
  Element,
  Event,
  EventListener,
  EventOptions,
  GeneralComponent,
  backend as GlassEaselBackend,
  Node,
  ShadowRoot,
  TextNode,
} from 'glass-easel'
import { type IDGenerator } from './utils'
import { type Fragment, type ViewController } from './view_controller'
import {
  ChannelEventType,
  type ChannelEventTypeDataSide,
  type ChannelEventTypeViewSide,
  type StringRef,
} from './channel_protocol'
import type { TransportBridge } from './transport_bridge'

export { ChannelEventType } from './channel_protocol'

export type Channel = ReturnType<typeof MessageChannelDataSide>

type GetCallback<ARGS extends any[]> = ARGS extends [...any[], infer CB]
  ? CB extends (...arg: infer ARGS) => any
    ? ARGS
    : never
  : never

/**
 * Map callbacks to the ids used on the wire.
 *
 * Callback ids are recycled through the channel id generator. A one-shot
 * callback is looked up with `id2callback(id)` (the default), which releases
 * the id immediately; a callback that fires more than once (observer / listener
 * style) must pass `false` to stay registered.
 */
const createCallbackManager = (idGenerator: () => IDGenerator) => {
  const callbackIdGen = idGenerator()

  const callbacks: ((...args: any[]) => void)[] = []

  const callback2id = (cb: (...args: any[]) => void) => {
    const id = callbackIdGen.gen()
    callbacks[id] = cb
    return id
  }

  const id2callback = <F extends (...args: any[]) => void>(
    id: number,
    release = true,
  ): ((...args: GetCallback<Parameters<F>>) => void) | undefined => {
    const cb = callbacks[id]
    if (release) releaseCallbackId(id)
    return cb
  }

  const releaseCallbackId = (id: number) => {
    delete callbacks[id]
    callbackIdGen.release(id)
  }

  return {
    callback2id,
    id2callback,
    releaseCallbackId,
  }
}

/**
 * Logic-side half of the channel.
 *
 * Operations published here are the ones the view side can apply to its own
 * tree; handler callbacks (`create`, observer listeners, requests, ...) are
 * published by the view side and dispatched back to the callback registered
 * here. Ids of callbacks and events are allocated per channel, so they never
 * clash with node ids.
 */
export const MessageChannelDataSide = (
  bridge: TransportBridge<ChannelEventTypeDataSide, ChannelEventTypeViewSide>,
  idGenerator: () => IDGenerator,
) => {
  let createEvent:
    | ((eventName: string, detail: any, options: EventOptions) => Event<unknown>)
    | null = null
  let triggerEvent:
    | ((
        event: Event<unknown>,
        currentTargetId: number,
        mark: Record<string, unknown> | null,
        targetId: number,
        isCapture: boolean,
      ) => void)
    | null = null

  let handleCustomMethod: ((elementId: number | null, options: any) => void) | null = null
  let overlayInspectCallbackId: number | null = null
  let insertSlotHandler:
    | ((
        elementId: number,
        slots: {
          slotId: number
          name: string
          slotValues: { [name: string]: unknown }
        }[],
      ) => void)
    | null = null
  let removeSlotHandler: ((slots: number[]) => void) | null = null
  let updateSlotHandler:
    | ((slot: number, slotValues: { [name: string]: unknown }, changedNames: string[]) => void)
    | null = null

  const { callback2id, id2callback, releaseCallbackId } = createCallbackManager(idGenerator)

  const eventIdMap = new Map<number, Event<unknown>>()

  /**
   * Consumer entry point for operations coming from the view side.
   *
   * Every operation has a handler, so the set is exhaustive at compile time and
   * each handler receives the arguments of its operation one by one (the same
   * shape the publishing side uses), without unpacking an array by hand. The
   * bridge has already unpacked the flat stream, so handlers run in stream
   * order.
   */
  bridge.subscribeHandler({
    [ChannelEventType.CREATE_CALLBACK]: (callbackId, width, height, devicePixelRatio, theme) => {
      id2callback<Channel['create']>(callbackId)!({
        windowInfo: {
          width,
          height,
          devicePixelRatio,
        },
        themeInfo: {
          theme,
        },
      })
    },
    [ChannelEventType.ON_WINDOW_RESIZE_CALLBACK]: (callbackId, width, height, devicePixelRatio) => {
      id2callback<Channel['onWindowResize']>(callbackId, false)!({
        width,
        height,
        devicePixelRatio,
      })
    },
    [ChannelEventType.ON_THEME_CHANGE_CALLBACK]: (callbackId, theme) => {
      id2callback<Channel['onThemeChange']>(callbackId, false)!({
        theme,
      })
    },
    [ChannelEventType.RENDER_CALLBACK]: (callbackId, errMessage) => {
      id2callback<Channel['render']>(callbackId)!(
        errMessage !== null ? new Error(errMessage) : null,
      )
    },
    [ChannelEventType.MEDIA_QUERY_OBSERVER_CALLBACK]: (callbackId, status) => {
      id2callback<Channel['createMediaQueryObserver']>(callbackId, false)?.(JSON.parse(status))
    },
    [ChannelEventType.INTERSECTION_OBSERVER_CALLBACK]: (callbackId, status) => {
      id2callback<Channel['createMediaQueryObserver']>(callbackId, false)?.(JSON.parse(status))
    },
    [ChannelEventType.RESIZE_OBSERVER_CALLBACK]: (callbackId, status) => {
      id2callback<Channel['createResizeObserver']>(callbackId, false)?.(JSON.parse(status))
    },
    [ChannelEventType.ELEMENT_FROM_POINT_CALLBACK]: (callbackId, elementId) => {
      id2callback<Channel['elementFromPoint']>(callbackId)!(elementId)
    },
    [ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK]: (callbackId, value) => {
      id2callback<Channel['setModelBindingStat']>(callbackId)!(JSON.parse(value))
    },
    [ChannelEventType.GET_CONTEXT_CALLBACK]: (callbackId, res) => {
      id2callback<Channel['getContext']>(callbackId)!(JSON.parse(res))
    },
    [ChannelEventType.ON_CREATE_EVENT]: (
      eventId,
      eventName,
      detail,
      options,
      currentTargetId,
      mark,
      targetId,
      capture,
    ) => {
      const event = createEvent!(
        bridge.decodeString(eventName),
        detail ? (JSON.parse(detail) as unknown) : detail,
        JSON.parse(options) as EventOptions,
      )
      eventIdMap.set(eventId, event)
      triggerEvent!(
        eventIdMap.get(eventId)!,
        currentTargetId,
        JSON.parse(mark) as Record<string, unknown> | null,
        targetId,
        capture,
      )
    },
    [ChannelEventType.ON_EVENT]: (eventId, currentTargetId, mark, targetId, capture) => {
      triggerEvent!(
        eventIdMap.get(eventId)!,
        currentTargetId,
        JSON.parse(mark) as Record<string, unknown> | null,
        targetId,
        capture,
      )
    },
    [ChannelEventType.ON_RELEASE_EVENT]: (eventId) => {
      eventIdMap.delete(eventId)
    },
    [ChannelEventType.GET_COMPUTED_STYLES_CALLBACK]: (callbackId, styles) => {
      id2callback<Channel['getAllComputedStyles']>(callbackId)!(JSON.parse(styles))
    },
    [ChannelEventType.GET_INHERITED_RULES_CALLBACK]: (callbackId, rules) => {
      id2callback<Channel['getInheritedRules']>(callbackId)!(JSON.parse(rules))
    },
    [ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES_CALLBACK]: (callbackId, propertyIndex) => {
      id2callback<Channel['replaceStyleSheetAllProperties']>(callbackId)!(propertyIndex)
    },
    [ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK]: (
      callbackId,
      left,
      top,
      width,
      height,
    ) => {
      id2callback<Channel['getBoundingClientRect']>(callbackId)!({
        left,
        top,
        width,
        height,
      })
    },
    [ChannelEventType.GET_BOX_MODEL_CALLBACK]: (callbackId, boxModel) => {
      id2callback<Channel['getBoxModel']>(callbackId)!(JSON.parse(boxModel))
    },
    [ChannelEventType.GET_MATCHED_RULES_CALLBACK]: (callbackId, rules) => {
      id2callback<Channel['getMatchedRules']>(callbackId)!(JSON.parse(rules))
    },
    [ChannelEventType.GET_SCROLL_OFFSET_CALLBACK]: (
      callbackId,
      scrollLeft,
      scrollTop,
      scrollWidth,
      scrollHeight,
    ) => {
      id2callback<Channel['getScrollOffset']>(callbackId)!({
        scrollLeft,
        scrollTop,
        scrollWidth,
        scrollHeight,
      })
    },
    [ChannelEventType.GET_PSEUDO_TYPES_CALLBACK]: (callbackId, pseudoTypes) => {
      id2callback<Channel['getPseudoTypes']>(callbackId)!(pseudoTypes)
    },
    [ChannelEventType.START_OVERLAY_INSPECT_CALLBACK]: (callbackId, event, elementId) => {
      id2callback<Channel['startOverlayInspect']>(callbackId, false)?.(event, elementId)
    },
    [ChannelEventType.MANIPULATE_NATIVE_NODE_CALLBACK]: (callbackId, res) => {
      id2callback<Channel['manipulateNativeNode']>(callbackId)!(JSON.parse(res))
    },
    [ChannelEventType.GET_ACTIVE_ELEMENT_CALLBACK]: (callbackId, elementId) => {
      id2callback<Channel['getActiveElement']>(callbackId)!(elementId)
    },
    [ChannelEventType.PERFORMANCE_STATS_CALLBACK]: (callbackId, startTimestamp, endTimestamp) => {
      id2callback<Channel['performanceEndTrace']>(callbackId)!({
        startTimestamp,
        endTimestamp,
      })
    },
    [ChannelEventType.INSERT_DYNAMIC_SLOT]: (elementId, slots) => {
      insertSlotHandler?.(
        elementId,
        slots.map(([slotId, name, slotValues]) => ({
          slotId,
          name: bridge.decodeString(name),
          slotValues: JSON.parse(slotValues) as Record<string, unknown>,
        })),
      )
    },
    [ChannelEventType.REMOVE_DYNAMIC_SLOT]: (slotIds) => {
      removeSlotHandler?.(slotIds)
    },
    [ChannelEventType.UPDATE_DYNAMIC_SLOT]: (slotId, slotValues, changedNames) => {
      updateSlotHandler?.(
        slotId,
        JSON.parse(slotValues),
        changedNames.map((name) => bridge.decodeString(name)),
      )
    },
    [ChannelEventType.CUSTOM_METHOD]: (elementId, options) => {
      handleCustomMethod?.(elementId, options)
    },
  })

  return {
    create: (
      init: (res: {
        windowInfo: { width: number; height: number; devicePixelRatio: number }
        themeInfo: { theme: string }
      }) => void,
    ) => bridge.publish(ChannelEventType.CREATE, callback2id(init)),
    destroy: () => bridge.publish(ChannelEventType.DESTROY),

    onWindowResize: (
      cb: (res: { width: number; height: number; devicePixelRatio: number }) => void,
    ) => bridge.publish(ChannelEventType.ON_WINDOW_RESIZE, callback2id(cb)),
    onThemeChange: (cb: (res: { theme: string }) => void) =>
      bridge.publish(ChannelEventType.ON_THEME_CHANGE, callback2id(cb)),
    render: (cb: (err: Error | null) => void) =>
      bridge.publish(ChannelEventType.RENDER, callback2id(cb)),
    onEvent: (
      _createEvent: (eventName: string, detail: any, options: EventOptions) => Event<unknown>,
      _triggerEvent: (
        event: Event<unknown>,
        currentTargetId: number,
        mark: Record<string, unknown> | null,
        targetId: number,
        isCapture: boolean,
      ) => void,
    ) => {
      createEvent = _createEvent
      triggerEvent = _triggerEvent
    },
    createMediaQueryObserver: (
      status: GlassEaselBackend.MediaQueryStatus,
      listener: (res: { matches: boolean }) => void,
    ) => {
      const id = callback2id(listener)
      bridge.publish(
        ChannelEventType.CREATE_MEDIA_QUERY_OBSERVER,
        JSON.stringify(status),
        callback2id(listener),
      )
      return id
    },
    createIntersectionObserver: (
      target: number,
      relativeElement: number | null,
      relativeElementMargin: string,
      thresholds: number[],
      listener: (res: GlassEaselBackend.IntersectionStatus) => void,
    ) => {
      const id = callback2id(listener)
      bridge.publish(
        ChannelEventType.CREATE_INTERSECTION_OBSERVER,
        target,
        relativeElement,
        relativeElementMargin,
        thresholds,
        id,
      )
      return id
    },
    createResizeObserver: (
      target: number,
      mode: GlassEaselBackend.ResizeObserverMode,
      listener: (res: GlassEaselBackend.ResizeStatus) => void,
    ) => {
      const id = callback2id(listener)
      bridge.publish(ChannelEventType.CREATE_RESIZE_OBSERVER, target, mode, id)
      return id
    },
    disconnectObserver: (id: number) => {
      bridge.publish(ChannelEventType.DISCONNECT_OBSERVER, id)
      releaseCallbackId(id)
    },
    elementFromPoint: (x: number, y: number, cb: (res: number | null) => void) =>
      bridge.publish(ChannelEventType.ELEMENT_FROM_POINT, x, y, callback2id(cb)),

    createElement: (
      id: number,
      logicalName: string,
      stylingName: string,
      ownerShadowRootId: number,
    ) =>
      bridge.publish(
        ChannelEventType.CREATE_ELEMENT,
        id,
        bridge.encodeString(logicalName),
        bridge.encodeString(stylingName),
        ownerShadowRootId,
      ),
    createComponent: (
      id: number,
      shadowRootId: number,
      tagName: string,
      virtualHost: boolean,
      styleScope: number,
      extraStyleScope: number | null,
      externalClasses: string[] | undefined,
      slotMode: number | null,
      writeIdToDOM: boolean,
      ownerShadowRootId: number,
    ) =>
      bridge.publish(
        ChannelEventType.CREATE_COMPONENT,
        id,
        shadowRootId,
        bridge.encodeString(tagName),
        virtualHost,
        styleScope,
        extraStyleScope,
        externalClasses?.map((className) => bridge.encodeString(className)),
        slotMode,
        writeIdToDOM,
        ownerShadowRootId,
      ),
    createTextNode: (id: number, textContent: string, ownerShadowRootId: number) =>
      bridge.publish(ChannelEventType.CREATE_TEXT_NODE, id, textContent, ownerShadowRootId),
    createVirtualNode: (id: number, virtualName: string, ownerShadowRootId: number) =>
      bridge.publish(
        ChannelEventType.CREATE_VIRTUAL_NODE,
        id,
        bridge.encodeString(virtualName),
        ownerShadowRootId,
      ),
    createFragment: (id: number) => bridge.publish(ChannelEventType.CREATE_FRAGMENT, id),
    release: (id: number) => bridge.publish(ChannelEventType.RELEASE, id),

    appendChild: (parentId: number, childId: number) =>
      bridge.publish(ChannelEventType.APPEND_CHILD, parentId, childId),
    removeChild: (parentId: number, childId: number) =>
      bridge.publish(ChannelEventType.REMOVE_CHILD, parentId, childId),
    insertBefore: (parentId: number, childId: number, beforeId: number) =>
      bridge.publish(ChannelEventType.INSERT_BEFORE, parentId, childId, beforeId),
    replaceChild: (parentId: number, childId: number, oldChildId: number) =>
      bridge.publish(ChannelEventType.REPLACE_CHILD, parentId, childId, oldChildId),
    spliceBefore: (parentId: number, beforeId: number, deleteCount: number, fragmentId: number) =>
      bridge.publish(ChannelEventType.SPLICE_BEFORE, parentId, beforeId, deleteCount, fragmentId),
    spliceAppend: (parentId: number, fragmentId: number) =>
      bridge.publish(ChannelEventType.SPLICE_APPEND, parentId, fragmentId),
    spliceRemove: (parentId: number, startId: number, deleteCount: number) =>
      bridge.publish(ChannelEventType.SPLICE_REMOVE, parentId, startId, deleteCount),

    associateValue: (componentId: number, data: Record<string, unknown>) =>
      bridge.publish(
        ChannelEventType.ASSOCIATE_VALUE,
        componentId,
        // the payload is the same for most components (`{"isReflect":false}`)
        bridge.encodeString(JSON.stringify(data)),
      ),

    setId: (elementId: number, id: string) =>
      bridge.publish(ChannelEventType.SET_ID, elementId, bridge.encodeString(id)),
    setSlot: (nodeId: number, name: string) =>
      bridge.publish(ChannelEventType.SET_SLOT, nodeId, bridge.encodeString(name)),
    setSlotName: (nodeId: number, name: string) =>
      bridge.publish(ChannelEventType.SET_SLOT_NAME, nodeId, bridge.encodeString(name)),
    setSlotElement: (nodeId: number, slot: number | null) =>
      bridge.publish(ChannelEventType.SET_SLOT_ELEMENT, nodeId, slot),
    setInheritSlots: (nodeId: number) => bridge.publish(ChannelEventType.SET_INHERIT_SLOTS, nodeId),
    registerStyleScope: (scopeId: number, stylePrefix: string | undefined) =>
      bridge.publish(ChannelEventType.REGISTER_STYLE_SCOPE, scopeId, stylePrefix),
    setStyle: (elementId: number, styleText: string, styleSegmentIndex: number) =>
      bridge.publish(ChannelEventType.SET_STYLE, elementId, styleText, styleSegmentIndex),
    addClass: (elementId: number, className: string) =>
      bridge.publish(ChannelEventType.ADD_CLASS, elementId, bridge.encodeString(className)),
    removeClass: (elementId: number, className: string) =>
      bridge.publish(ChannelEventType.REMOVE_CLASS, elementId, bridge.encodeString(className)),
    setClassAlias: (elementId: number, className: string, target: string[]) =>
      bridge.publish(
        ChannelEventType.SET_CLASS_ALIAS,
        elementId,
        bridge.encodeString(className),
        target.map((className) => bridge.encodeString(className)),
      ),
    setAttribute: (elementId: number, name: string, value: unknown) =>
      bridge.publish(ChannelEventType.SET_ATTRIBUTE, elementId, bridge.encodeString(name), value),
    removeAttribute: (elementId: number, name: string) =>
      bridge.publish(ChannelEventType.REMOVE_ATTRIBUTE, elementId, bridge.encodeString(name)),
    setDataset: (elementId: number, name: string, value: unknown) =>
      bridge.publish(ChannelEventType.SET_DATASET, elementId, bridge.encodeString(name), value),
    setText: (textNodeId: number, textContent: string) =>
      bridge.publish(ChannelEventType.SET_TEXT, textNodeId, textContent),
    setListenerStats: (node: number, eventName: string, capture: boolean, mutLevel: number) =>
      bridge.publish(
        ChannelEventType.SET_LISTENER_STATS,
        node,
        bridge.encodeString(eventName),
        capture,
        mutLevel,
      ),

    setModelBindingStat: (
      node: number,
      attributeName: string,
      listener: ((newValue: unknown) => void) | null,
    ) =>
      bridge.publish(
        ChannelEventType.SET_MODEL_BINDING_STAT,
        node,
        bridge.encodeString(attributeName),
        listener ? callback2id(listener) : null,
      ),
    getContext: (element: number, cb: (res: any) => void) =>
      bridge.publish(ChannelEventType.GET_CONTEXT, element, callback2id(cb)),

    initValues: (elementId: number, values: DataValue) =>
      bridge.publish(ChannelEventType.INIT_VALUES, elementId, JSON.stringify(values)),
    updateValues: (elementId: number, values: DataChange[]) =>
      bridge.publish(ChannelEventType.UPDATE_VALUES, elementId, JSON.stringify(values)),

    registerStyleSheetContent: (path: string, content: unknown) =>
      bridge.publish(ChannelEventType.REGISTER_STYLE_SHEET_CONTENT, path, JSON.stringify(content)),
    appendStyleSheetPath: (index: number, path: string, styleScope?: number) =>
      bridge.publish(ChannelEventType.APPEND_STYLE_SHEET_PATH, index, path, styleScope),
    disableStyleSheet: (index: number) =>
      bridge.publish(ChannelEventType.DISABLE_STYLE_SHEET, index),

    getAllComputedStyles: (
      elementId: number,
      cb: (res: GlassEaselBackend.GetAllComputedStylesResponses) => void,
    ) => bridge.publish(ChannelEventType.GET_ALL_COMPUTED_STYLES, elementId, callback2id(cb)),
    getPartialComputedStyles: (
      elementId: number,
      properties: string[],
      cb: (res: GlassEaselBackend.GetAllComputedStylesResponses) => void,
    ) =>
      bridge.publish(
        ChannelEventType.GET_PARTIAL_COMPUTED_STYLES,
        elementId,
        properties,
        callback2id(cb),
      ),
    getPseudoComputedStyles: (
      elementId: number,
      pseudoType: string,
      cb: (res: GlassEaselBackend.GetAllComputedStylesResponses) => void,
    ) =>
      bridge.publish(
        ChannelEventType.GET_PSEUDO_COMPUTED_STYLES,
        elementId,
        pseudoType,
        callback2id(cb),
      ),
    getPartialPseudoComputedStyles: (
      elementId: number,
      pseudoType: string,
      properties: string[],
      cb: (res: GlassEaselBackend.GetAllComputedStylesResponses) => void,
    ) =>
      bridge.publish(
        ChannelEventType.GET_PARTIAL_PSEUDO_COMPUTED_STYLES,
        elementId,
        pseudoType,
        properties,
        callback2id(cb),
      ),
    getInheritedRules: (
      elementId: number,
      cb: (res: GlassEaselBackend.GetInheritedRulesResponses) => void,
    ) => bridge.publish(ChannelEventType.GET_INHERITED_RULES, elementId, callback2id(cb)),
    replaceStyleSheetAllProperties: (
      sheetIndex: number,
      ruleIndex: number,
      inlineStyle: string,
      cb: (propertyIndex: number | null) => void,
    ) =>
      bridge.publish(
        ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES,
        sheetIndex,
        ruleIndex,
        inlineStyle,
        callback2id(cb),
      ),
    getBoundingClientRect: (
      parent: number,
      cb: (res: GlassEaselBackend.BoundingClientRect) => void,
    ) => bridge.publish(ChannelEventType.GET_BOUNDING_CLIENT_RECT, parent, callback2id(cb)),
    getBoxModel: (
      elementId: number,
      cb: (res: {
        margin: GlassEaselBackend.BoundingClientRect
        border: GlassEaselBackend.BoundingClientRect
        padding: GlassEaselBackend.BoundingClientRect
        content: GlassEaselBackend.BoundingClientRect
      }) => void,
    ) => bridge.publish(ChannelEventType.GET_BOX_MODEL, elementId, callback2id(cb)),
    getMatchedRules: (
      elementId: number,
      cb: (res: GlassEaselBackend.GetMatchedRulesResponses) => void,
    ) => bridge.publish(ChannelEventType.GET_MATCHED_RULES, elementId, callback2id(cb)),
    getScrollOffset: (elementId: number, cb: (res: GlassEaselBackend.ScrollOffset) => void) =>
      bridge.publish(ChannelEventType.GET_SCROLL_OFFSET, elementId, callback2id(cb)),
    setScrollPosition: (
      elementId: number,
      scrollLeft: number,
      scrollTop: number,
      duration: number,
    ) =>
      bridge.publish(
        ChannelEventType.SET_SCROLL_POSITION,
        elementId,
        scrollLeft,
        scrollTop,
        duration,
      ),
    getPseudoTypes: (elementId: number, cb: (res: string[]) => void) =>
      bridge.publish(ChannelEventType.GET_PSEUDO_TYPES, elementId, callback2id(cb)),
    startOverlayInspect: (cb: (event: string, elementId: number | null) => void) => {
      if (overlayInspectCallbackId !== null) return
      const callbackId = (overlayInspectCallbackId = callback2id(cb))
      bridge.publish(ChannelEventType.START_OVERLAY_INSPECT, callbackId)
    },
    stopOverlayInspect: () => {
      if (overlayInspectCallbackId === null) return
      releaseCallbackId(overlayInspectCallbackId)
      overlayInspectCallbackId = null
      bridge.publish(ChannelEventType.STOP_OVERLAY_INSPECT)
    },
    triggerNativeEvent: (elementId: number, eventName: string, detail: unknown) =>
      bridge.publish(
        ChannelEventType.TRIGGER_NATIVE_EVENT,
        elementId,
        eventName,
        JSON.stringify(detail),
      ),
    manipulateNativeNode: (
      elementId: number,
      action: string,
      args: unknown,
      cb: (res: unknown) => void,
    ) =>
      bridge.publish(
        ChannelEventType.MANIPULATE_NATIVE_NODE,
        elementId,
        action,
        JSON.stringify(args),
        callback2id(cb),
      ),
    getActiveElement: (cb: (elementId: number | null) => void) =>
      bridge.publish(ChannelEventType.GET_ACTIVE_ELEMENT, callback2id(cb)),

    performanceStartTrace: (index: number) =>
      bridge.publish(ChannelEventType.PERFORMANCE_START_TRACE, index),
    performanceEndTrace: (
      id: number,
      cb: (stats: { startTimestamp: number; endTimestamp: number }) => void,
    ) => bridge.publish(ChannelEventType.PERFORMANCE_END_TRACE, id, callback2id(cb)),

    setDynamicSlotHandler: (
      _insertSlotHandler: (
        elementId: number,
        slots: {
          slotId: number
          name: string
          slotValues: { [name: string]: unknown }
        }[],
      ) => void,
      _removeSlotHandler: (slots: number[]) => void,
      _updateSlotHandler: (
        slot: number,
        slotValues: { [name: string]: unknown },
        changedNames: string[],
      ) => void,
    ) => {
      insertSlotHandler = _insertSlotHandler
      removeSlotHandler = _removeSlotHandler
      updateSlotHandler = _updateSlotHandler
    },

    callCustomMethod: (elementId: number | null, options: any) =>
      bridge.publish(ChannelEventType.CUSTOM_METHOD, elementId, options),
    onCustenMethod: (handler: (elementId: number | null, options: any) => void) => {
      handleCustomMethod = handler
    },
  }
}

const SYNC_ID_KEY = '_$sync_id'

/**
 * Channel node id, stored on the glass-easel object itself.
 *
 * Nodes, shadow roots and fragments share no interface that could expose an id,
 * and the id has to be readable from an arbitrary object in the view side's
 * event path, so every object created through the channel carries it as an own
 * property.
 */
function setNodeId(node: Node | Fragment, id: number): void {
  ;(node as unknown as { [SYNC_ID_KEY]: number })[SYNC_ID_KEY] = id
}

export function getNodeId(node: Node | Fragment): number | undefined {
  return (node as unknown as { [SYNC_ID_KEY]: number })[SYNC_ID_KEY]
}

/**
 * View-side half of the channel.
 *
 * Operations published here are callbacks, events and keyboard / overlay style
 * requests; they are consumed by `MessageChannelDataSide`. Everything the view
 * side creates is indexed by channel id in `nodeMap`, because the logic side
 * addresses its objects only by id.
 */
export const MessageChannelViewSide = (
  bridge: TransportBridge<ChannelEventTypeViewSide, ChannelEventTypeDataSide>,
  controller: ViewController,
  idGenerator: () => IDGenerator,
) => {
  /**
   * Objects created by this side, indexed by channel id.
   *
   * Ids come from a dense generator and are recycled, so a released entry is
   * set to `undefined` instead of being deleted (see `RELEASE`).
   */
  const nodeMap: Record<number, Node | Fragment | ShadowRoot | undefined> = []
  const eventIdGen = idGenerator()
  const eventIdMap = new WeakMap<Event<unknown>, number>()
  /**
   * Components that hand their listeners a separate method caller.
   *
   * An adapter may give a component its own method caller object, in which case
   * glass-easel reports the event target as that caller. The caller has no
   * channel id; creation registers it here so `getEventNodeId` can map it back
   * to the component node.
   */
  const methodCallerMap = new WeakMap<any, GeneralComponent>()

  const getEventNodeId = (node: Element | null): number | undefined =>
    node ? getNodeId(methodCallerMap.get(node) ?? node) : undefined

  const observersMap: Record<number, { disconnect(): void } | undefined> = []

  const slotIdGen = idGenerator()
  const slotMap: Record<number, Element> = []

  const eventHandler: EventListener<unknown> = (shadowedEvent) => {
    // A shadowed event is a fresh object created for every (listener, target)
    // pair, while the event itself is shared. Take the prototype so that the
    // shared event object can be used as the identity key below.
    const event = Object.getPrototypeOf(shadowedEvent) as Event<unknown>
    const targetId = getEventNodeId(shadowedEvent.target)
    const currentTargetId = getEventNodeId(shadowedEvent.currentTarget)
    const capture = shadowedEvent.isCapturePhase()
    if (typeof targetId !== 'number' || typeof currentTargetId !== 'number') return

    if (!eventIdMap.has(event)) {
      // First listener on this event: send the full description, keyed by a new
      // event id. Later listeners only send the id (see `ON_EVENT`).
      const eventId = eventIdGen.gen()
      bridge.publish(
        ChannelEventType.ON_CREATE_EVENT,
        eventId,
        bridge.encodeString(event.getEventName()),
        JSON.stringify(event.detail),
        JSON.stringify({
          bubbles: event.bubbles,
          composed: event.composed,
          extraFields: event.extraFields,
        }),
        currentTargetId,
        JSON.stringify(shadowedEvent.mark),
        targetId,
        capture,
      )
      eventIdMap.set(event, eventId)

      // the id (and the logic-side event object) is only needed while the
      // dispatch is running: release it once the current microtask is done
      // eslint-disable-next-line @typescript-eslint/no-floating-promises,promise/catch-or-return,promise/always-return
      Promise.resolve().then(() => {
        // eslint-disable-next-line promise/always-return
        bridge.publish(ChannelEventType.ON_RELEASE_EVENT, eventId)
        eventIdMap.delete(event)
      })
    } else {
      const eventId = eventIdMap.get(event)!

      bridge.publish(
        ChannelEventType.ON_EVENT,
        eventId,
        currentTargetId,
        JSON.stringify(shadowedEvent.mark),
        targetId,
        capture,
      )
    }
  }

  const sendCustomMethodHandler = (elem: Element | null, options: any) => {
    const elemId = elem ? getNodeId(elem)! : null
    bridge.publish(ChannelEventType.CUSTOM_METHOD, elemId, options)
  }

  controller.onCustomMethod(sendCustomMethodHandler)

  controller.setDynamicSlotHandler({
    insertSlotHandler: (component, slots) => {
      const componentId = getNodeId(component)!
      bridge.publish(
        ChannelEventType.INSERT_DYNAMIC_SLOT,
        componentId,
        slots.map(({ slot, name, slotValues }) => {
          const slotId = slotIdGen.gen()
          slotMap[slotId] = slot
          setNodeId(slot, slotId)
          return [slotId, bridge.encodeString(name), JSON.stringify(slotValues)] as [
            number,
            StringRef,
            string,
          ]
        }),
      )
    },
    removeSlotHandler: (slots) => {
      bridge.publish(
        ChannelEventType.REMOVE_DYNAMIC_SLOT,
        slots.map((slot) => {
          const slotId = getNodeId(slot)!
          slotIdGen.release(slotId)
          delete slotMap[slotId]
          return slotId
        }),
      )
    },
    updateSlotHandler: (slot, slotValue, changedNames) => {
      bridge.publish(
        ChannelEventType.UPDATE_DYNAMIC_SLOT,
        getNodeId(slot)!,
        JSON.stringify(slotValue),
        changedNames.map((name) => bridge.encodeString(name)),
      )
    },
  })

  /**
   * Consumer entry point for operations coming from the logic side.
   *
   * The bridge has already replayed the flat stream, so every handler sees the
   * arguments of its operation one by one and can assume that all earlier
   * operations have been applied: a `CREATE_ELEMENT` followed by `APPEND_CHILD`
   * in the same batch is delivered in exactly that order.
   */
  bridge.subscribeHandler({
    [ChannelEventType.CREATE]: (callbackId) => {
      controller.create(({ windowInfo, themeInfo }) => {
        bridge.publish(
          ChannelEventType.CREATE_CALLBACK,
          callbackId,
          windowInfo.width,
          windowInfo.height,
          windowInfo.devicePixelRatio,
          themeInfo.theme,
        )
      })
    },
    [ChannelEventType.DESTROY]: () => {
      controller.destroy()
    },
    [ChannelEventType.ON_WINDOW_RESIZE]: (callbackId) => {
      controller.onWindowResize(({ width, height, devicePixelRatio }) => {
        bridge.publish(
          ChannelEventType.ON_WINDOW_RESIZE_CALLBACK,
          callbackId,
          width,
          height,
          devicePixelRatio,
        )
      })
    },
    [ChannelEventType.ON_THEME_CHANGE]: (callbackId) => {
      controller.onThemeChange(({ theme }) => {
        bridge.publish(ChannelEventType.ON_THEME_CHANGE_CALLBACK, callbackId, theme)
      })
    },
    [ChannelEventType.RENDER]: (callbackId) => {
      controller.render((err) => {
        bridge.publish(ChannelEventType.RENDER_CALLBACK, callbackId, err ? err.message : null)
      })
    },
    [ChannelEventType.CREATE_MEDIA_QUERY_OBSERVER]: (status, callbackId) => {
      const observer = controller.createMediaQueryObserver(JSON.parse(status), (res) => {
        bridge.publish(
          ChannelEventType.MEDIA_QUERY_OBSERVER_CALLBACK,
          callbackId,
          JSON.stringify(res),
        )
      })
      observersMap[callbackId] = observer
    },
    [ChannelEventType.CREATE_INTERSECTION_OBSERVER]: (
      targetId,
      relativeElementId,
      relativeElementMargin,
      thresholds,
      callbackId,
    ) => {
      const target = nodeMap[targetId] as Element
      const relativeElement =
        typeof relativeElementId === 'number' ? (nodeMap[relativeElementId] as Element) : null
      const observer = controller.createIntersectionObserver(
        target,
        relativeElement,
        relativeElementMargin,
        thresholds,
        (res) => {
          bridge.publish(
            ChannelEventType.INTERSECTION_OBSERVER_CALLBACK,
            callbackId,
            JSON.stringify(res),
          )
        },
      )
      observersMap[callbackId] = observer
    },
    [ChannelEventType.CREATE_RESIZE_OBSERVER]: (targetId, mode, callbackId) => {
      const target = nodeMap[targetId] as Element
      const observer = controller.createResizeObserver(target, mode, (res) => {
        bridge.publish(ChannelEventType.RESIZE_OBSERVER_CALLBACK, callbackId, JSON.stringify(res))
      })
      observersMap[callbackId] = observer
    },
    [ChannelEventType.DISCONNECT_OBSERVER]: (callbackId) => {
      const observer = observersMap[callbackId]
      if (observer) {
        observer.disconnect()
        observersMap[callbackId] = undefined
      }
    },
    [ChannelEventType.ELEMENT_FROM_POINT]: (x, y, callbackId) => {
      controller.elementFromPoint(x, y, (res) => {
        const nodeId = res ? getNodeId(res)! : null
        bridge.publish(ChannelEventType.ELEMENT_FROM_POINT_CALLBACK, callbackId, nodeId)
      })
    },
    [ChannelEventType.CREATE_ELEMENT]: (id, logicalName, stylingName, ownerShadowRootId) => {
      const node = (nodeMap[id] = controller.createElementOrComponent(
        bridge.decodeString(logicalName),
        bridge.decodeString(stylingName),
        nodeMap[ownerShadowRootId] as ShadowRoot,
      ))
      const comp = node.asGeneralComponent()
      if (comp && comp.getMethodCaller() !== comp) {
        methodCallerMap.set(comp.getMethodCaller(), comp)
      }
      setNodeId(node, id)
    },
    [ChannelEventType.CREATE_COMPONENT]: (
      id,
      shadowRootId,
      tagName,
      virtualHost,
      styleScope,
      extraStyleScope,
      externalClasses,
      slotMode,
      writeIdToDOM,
      ownerShadowRootId,
    ) => {
      const ownerShadowRoot = nodeMap[ownerShadowRootId] as ShadowRoot | undefined
      controller.createSimpleComponent(
        bridge.decodeString(tagName),
        ownerShadowRoot,
        virtualHost,
        styleScope,
        extraStyleScope,
        externalClasses?.map((className) => bridge.decodeString(className)),
        slotMode,
        writeIdToDOM,
        undefined,
        (component) => {
          nodeMap[id] = component
          const shadowRoot = component.getShadowRoot()
          if (shadowRoot) {
            nodeMap[shadowRootId] = shadowRoot
            setNodeId(shadowRoot, shadowRootId)
          }
          if (component.getMethodCaller() !== component) {
            methodCallerMap.set(component.getMethodCaller(), component)
          }
          setNodeId(component, id)
        },
      )
    },
    [ChannelEventType.CREATE_TEXT_NODE]: (id, textContent, ownerShadowRootId) => {
      const ownerShadowRoot = nodeMap[ownerShadowRootId] as ShadowRoot
      const node = (nodeMap[id] = controller.createTextNode(textContent, ownerShadowRoot))
      setNodeId(node, id)
    },
    [ChannelEventType.CREATE_VIRTUAL_NODE]: (id, virtualName, ownerShadowRootId) => {
      const ownerShadowRoot = nodeMap[ownerShadowRootId] as ShadowRoot
      const node = (nodeMap[id] = controller.createVirtualNode(
        bridge.decodeString(virtualName),
        ownerShadowRoot,
      ))
      setNodeId(node, id)
    },
    [ChannelEventType.CREATE_FRAGMENT]: (id) => {
      const node = (nodeMap[id] = controller.createFragment())
      setNodeId(node, id)
    },
    [ChannelEventType.RELEASE]: (id) => {
      const node = nodeMap[id]! as Element
      // keep the backing array dense: ids are small and recycled, so leaving a hole is
      // cheaper than `delete`, which would turn the array into dictionary mode
      nodeMap[id] = undefined
      controller.release(node)
    },
    [ChannelEventType.APPEND_CHILD]: (parentId, childId) => {
      const parent = nodeMap[parentId] as Element | undefined
      const child = nodeMap[childId]! as Node
      controller.appendChild(parent, child)
    },
    [ChannelEventType.REMOVE_CHILD]: (parentId, childId) => {
      const parent = nodeMap[parentId] as Element | undefined
      const child = nodeMap[childId]! as Node
      controller.removeChild(parent, child)
    },
    [ChannelEventType.INSERT_BEFORE]: (parentId, childId, beforeId) => {
      const parent = nodeMap[parentId] as Element | undefined
      const child = nodeMap[childId]! as Node
      const before = nodeMap[beforeId]! as Node
      controller.insertBefore(parent, child, before)
    },
    [ChannelEventType.REPLACE_CHILD]: (parentId, childId, oldChildId) => {
      const parent = nodeMap[parentId] as Element | undefined
      const child = nodeMap[childId]! as Node
      const oldChild = nodeMap[oldChildId]! as Node
      controller.replaceChild(parent, child, oldChild)
    },
    [ChannelEventType.SPLICE_BEFORE]: (parentId, beforeId, deleteCount, fragmentId) => {
      const parent = nodeMap[parentId]! as Element
      const before = nodeMap[beforeId]! as Node
      const fragment = nodeMap[fragmentId]! as Fragment
      controller.spliceBefore(parent, before, deleteCount, fragment)
    },
    [ChannelEventType.SPLICE_APPEND]: (parentId, fragmentId) => {
      const parent = nodeMap[parentId]! as Element
      const fragment = nodeMap[fragmentId]! as Fragment
      controller.spliceAppend(parent, fragment)
    },
    [ChannelEventType.SPLICE_REMOVE]: (parentId, startId, deleteCount) => {
      const parent = nodeMap[parentId]! as Element
      const start = nodeMap[startId]! as Node
      controller.spliceRemove(parent, start, deleteCount)
    },
    [ChannelEventType.ASSOCIATE_VALUE]: (nodeId, data) => {
      const node = nodeMap[nodeId]! as Node
      controller.associateValue(node, bridge.decodeString(data))
    },
    [ChannelEventType.SET_ID]: (elementId, id) => {
      const element = nodeMap[elementId]! as Element
      controller.setId(element, bridge.decodeString(id))
    },
    [ChannelEventType.SET_SLOT]: (elementId, name) => {
      const element = nodeMap[elementId]! as Element
      controller.setSlot(element, bridge.decodeString(name))
    },
    [ChannelEventType.SET_SLOT_NAME]: (elementId, name) => {
      const element = nodeMap[elementId]! as Element
      controller.setSlotName(element, bridge.decodeString(name))
    },
    [ChannelEventType.SET_SLOT_ELEMENT]: (nodeId, slotId) => {
      const node = nodeMap[nodeId]! as Node
      const slot =
        typeof slotId === 'number' ? slotMap[slotId]! ?? (nodeMap[slotId]! as Element) : null
      controller.setSlotElement(node, slot)
    },
    [ChannelEventType.SET_INHERIT_SLOTS]: (elementId) => {
      const element = nodeMap[elementId]! as Element
      controller.setInheritSlots(element)
    },
    [ChannelEventType.REGISTER_STYLE_SCOPE]: (scopeId, stylePrefix) => {
      controller.registerStyleScope(scopeId, stylePrefix)
    },
    [ChannelEventType.SET_STYLE]: (elementId, styleText, styleSegmentIndex) => {
      const element = nodeMap[elementId]! as Element
      controller.setStyle(element, styleText, styleSegmentIndex)
    },
    [ChannelEventType.ADD_CLASS]: (elementId, className) => {
      const element = nodeMap[elementId]! as Element
      controller.addClass(element, bridge.decodeString(className))
    },
    [ChannelEventType.REMOVE_CLASS]: (elementId, className) => {
      const element = nodeMap[elementId]! as Element
      controller.removeClass(element, bridge.decodeString(className))
    },
    [ChannelEventType.SET_CLASS_ALIAS]: (elementId, className, target) => {
      const element = nodeMap[elementId]! as GeneralComponent
      controller.setClassAlias(
        element,
        bridge.decodeString(className),
        target.map((className) => bridge.decodeString(className)),
      )
    },
    [ChannelEventType.SET_ATTRIBUTE]: (elementId, name, value) => {
      const element = nodeMap[elementId]! as Element
      controller.setAttribute(element, bridge.decodeString(name), value)
    },
    [ChannelEventType.REMOVE_ATTRIBUTE]: (elementId, name) => {
      const element = nodeMap[elementId]! as Element
      controller.removeAttribute(element, bridge.decodeString(name))
    },
    [ChannelEventType.SET_DATASET]: (elementId, name, value) => {
      const element = nodeMap[elementId]! as Element
      controller.setDataset(element, bridge.decodeString(name), value)
    },
    [ChannelEventType.SET_TEXT]: (textNodeId, textContent) => {
      const textNode = nodeMap[textNodeId]! as TextNode
      controller.setText(textNode, textContent)
    },
    [ChannelEventType.SET_LISTENER_STATS]: (elementId, eventName, capture, mutLevel) => {
      const element = nodeMap[elementId]! as Element
      controller.setListenerStats(
        element,
        bridge.decodeString(eventName),
        capture,
        mutLevel,
        eventHandler,
      )
    },
    [ChannelEventType.SET_MODEL_BINDING_STAT]: (elementId, attributeName, listenerId) => {
      const element = nodeMap[elementId]! as Element
      if (!listenerId) {
        throw new Error('missing listenerId for setModelBindingStat')
      }
      controller.setModelBindingStat(element, bridge.decodeString(attributeName), (newValue) => {
        bridge.publish(
          ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK,
          listenerId,
          JSON.stringify(newValue),
        )
      })
    },
    [ChannelEventType.GET_CONTEXT]: (elementId, callbackId) => {
      const element = nodeMap[elementId]! as Element
      controller.getContext(element, (res) => {
        bridge.publish(ChannelEventType.GET_CONTEXT_CALLBACK, callbackId, JSON.stringify(res))
      })
    },
    [ChannelEventType.INIT_VALUES]: (elementId, values) => {
      const element = nodeMap[elementId]! as Element
      controller.initValues(element, JSON.parse(values))
    },
    [ChannelEventType.UPDATE_VALUES]: (elementId, values) => {
      const element = nodeMap[elementId]! as Element
      controller.updateValues(element, JSON.parse(values))
    },
    [ChannelEventType.REGISTER_STYLE_SHEET_CONTENT]: (path, content) => {
      controller.registerStyleSheetContent(path, JSON.parse(content))
    },
    [ChannelEventType.APPEND_STYLE_SHEET_PATH]: (index, path, styleScope) => {
      controller.appendStyleSheetPath(index, path, styleScope)
    },
    [ChannelEventType.DISABLE_STYLE_SHEET]: (index) => {
      controller.disableStyleSheet(index)
    },
    [ChannelEventType.GET_ALL_COMPUTED_STYLES]: (elementId, callbackId) => {
      const element = nodeMap[elementId]! as Element
      controller.getAllComputedStyles(element, (res) => {
        bridge.publish(
          ChannelEventType.GET_COMPUTED_STYLES_CALLBACK,
          callbackId,
          JSON.stringify(res),
        )
      })
    },
    [ChannelEventType.GET_PARTIAL_COMPUTED_STYLES]: (elementId, properties, callbackId) => {
      const element = nodeMap[elementId]! as Element
      controller.getPartialComputedStyles(element, properties, (res) => {
        bridge.publish(
          ChannelEventType.GET_COMPUTED_STYLES_CALLBACK,
          callbackId,
          JSON.stringify(res),
        )
      })
    },
    [ChannelEventType.GET_PSEUDO_COMPUTED_STYLES]: (elementId, pseudoType, callbackId) => {
      const element = nodeMap[elementId]! as Element
      controller.getPseudoComputedStyles(element, pseudoType, (res) => {
        bridge.publish(
          ChannelEventType.GET_COMPUTED_STYLES_CALLBACK,
          callbackId,
          JSON.stringify(res),
        )
      })
    },
    [ChannelEventType.GET_PARTIAL_PSEUDO_COMPUTED_STYLES]: (
      elementId,
      pseudoType,
      properties,
      callbackId,
    ) => {
      const element = nodeMap[elementId]! as Element
      controller.getPartialPseudoComputedStyles(element, pseudoType, properties, (res) => {
        bridge.publish(
          ChannelEventType.GET_COMPUTED_STYLES_CALLBACK,
          callbackId,
          JSON.stringify(res),
        )
      })
    },
    [ChannelEventType.GET_INHERITED_RULES]: (elementId, callbackId) => {
      const element = nodeMap[elementId]! as Element
      controller.getInheritedRules(element, (res) => {
        bridge.publish(
          ChannelEventType.GET_INHERITED_RULES_CALLBACK,
          callbackId,
          JSON.stringify(res),
        )
      })
    },
    [ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES]: (
      sheetIndex,
      ruleIndex,
      inlineStyle,
      callbackId,
    ) => {
      controller.replaceStyleSheetAllProperties(
        sheetIndex,
        ruleIndex,
        inlineStyle,
        (propertyIndex) => {
          bridge.publish(
            ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES_CALLBACK,
            callbackId,
            propertyIndex,
          )
        },
      )
    },
    [ChannelEventType.GET_MATCHED_RULES]: (elementId, callbackId) => {
      const element = nodeMap[elementId]! as Element
      controller.getMatchedRules(element, (res) => {
        bridge.publish(ChannelEventType.GET_MATCHED_RULES_CALLBACK, callbackId, JSON.stringify(res))
      })
    },
    [ChannelEventType.GET_BOUNDING_CLIENT_RECT]: (elementId, callbackId) => {
      const element = nodeMap[elementId]! as Element
      controller.getBoundingClientRect(element, (res) => {
        bridge.publish(
          ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK,
          callbackId,
          res.left,
          res.top,
          res.width,
          res.height,
        )
      })
    },
    [ChannelEventType.GET_SCROLL_OFFSET]: (elementId, callbackId) => {
      const element = nodeMap[elementId]! as Element
      controller.getScrollOffset(element, (res) => {
        bridge.publish(
          ChannelEventType.GET_SCROLL_OFFSET_CALLBACK,
          callbackId,
          res.scrollLeft,
          res.scrollTop,
          res.scrollWidth,
          res.scrollHeight,
        )
      })
    },
    [ChannelEventType.SET_SCROLL_POSITION]: (elementId, scrollLeft, scrollTop, duration) => {
      const element = nodeMap[elementId]! as Element
      controller.setScrollPosition(element, scrollLeft, scrollTop, duration)
    },
    [ChannelEventType.GET_BOX_MODEL]: (elementId, callbackId) => {
      const element = nodeMap[elementId]! as Element
      controller.getBoxModel(element, (res) => {
        bridge.publish(ChannelEventType.GET_BOX_MODEL_CALLBACK, callbackId, JSON.stringify(res))
      })
    },
    [ChannelEventType.GET_PSEUDO_TYPES]: (elementId, callbackId) => {
      const element = nodeMap[elementId]! as Element
      controller.getPseudoTypes(element, (res) => {
        bridge.publish(ChannelEventType.GET_PSEUDO_TYPES_CALLBACK, callbackId, res)
      })
    },
    [ChannelEventType.START_OVERLAY_INSPECT]: (callbackId) => {
      controller.startOverlayInspect((event, element) => {
        const elementId = element ? getNodeId(element)! : null
        bridge.publish(
          ChannelEventType.START_OVERLAY_INSPECT_CALLBACK,
          callbackId,
          event,
          elementId,
        )
      })
    },
    [ChannelEventType.STOP_OVERLAY_INSPECT]: () => {
      controller.stopOverlayInspect()
    },
    [ChannelEventType.TRIGGER_NATIVE_EVENT]: (elementId, event, detail) => {
      const element = nodeMap[elementId]! as Element
      controller.triggerNativeEvent(element, event, JSON.parse(detail))
    },
    [ChannelEventType.MANIPULATE_NATIVE_NODE]: (elementId, action, args, callbackId) => {
      const element = nodeMap[elementId]! as Element
      controller.manipulateNativeNode(element, action, JSON.parse(args), (res) => {
        bridge.publish(
          ChannelEventType.MANIPULATE_NATIVE_NODE_CALLBACK,
          callbackId,
          JSON.stringify(res),
        )
      })
    },
    [ChannelEventType.GET_ACTIVE_ELEMENT]: (callbackId) => {
      controller.getActiveElement((element) => {
        const elementId = element ? getNodeId(element)! : null
        bridge.publish(ChannelEventType.GET_ACTIVE_ELEMENT_CALLBACK, callbackId, elementId)
      })
    },
    [ChannelEventType.PERFORMANCE_START_TRACE]: (index) => {
      controller.performanceStartTrace(index)
    },
    [ChannelEventType.PERFORMANCE_END_TRACE]: (index, callbackId) => {
      controller.performanceEndTrace(index, (stats) => {
        bridge.publish(
          ChannelEventType.PERFORMANCE_STATS_CALLBACK,
          callbackId,
          stats.startTimestamp,
          stats.endTimestamp,
        )
      })
    },
    [ChannelEventType.CUSTOM_METHOD]: (elementId, options) => {
      const element = elementId ? (nodeMap[elementId]! as Element) : null
      controller.handleCustomMethod(element, options)
    },
  })

  return {
    getNode: (id: number) => nodeMap[id],
  }
}
