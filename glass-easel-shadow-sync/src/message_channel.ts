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

export const enum ChannelEventType {
  CREATE = 1,
  CREATE_CALLBACK,
  DESTROY,

  ON_WINDOW_RESIZE,
  ON_WINDOW_RESIZE_CALLBACK,
  ON_THEME_CHANGE,
  ON_THEME_CHANGE_CALLBACK,
  RENDER,
  RENDER_CALLBACK,
  CREATE_MEDIA_QUERY_OBSERVER,
  MEDIA_QUERY_OBSERVER_CALLBACK,
  CREATE_INTERSECTION_OBSERVER,
  INTERSECTION_OBSERVER_CALLBACK,
  DISCONNECT_OBSERVER,

  CREATE_ELEMENT,
  CREATE_COMPONENT,
  CREATE_TEXT_NODE,
  CREATE_VIRTUAL_NODE,
  CREATE_FRAGMENT,
  RELEASE,

  APPEND_CHILD,
  REMOVE_CHILD,
  INSERT_BEFORE,
  REPLACE_CHILD,
  SPLICE_BEFORE,
  SPLICE_APPEND,
  SPLICE_REMOVE,

  SET_ID,
  SET_SLOT,
  SET_SLOT_NAME,
  SET_SLOT_ELEMENT,
  SET_INHERIT_SLOTS,
  REGISTER_STYLE_SCOPE,
  SET_STYLE,
  ADD_CLASS,
  REMOVE_CLASS,
  CLEAR_CLASSES,
  SET_CLASS_ALIAS,
  SET_ATTRIBUTE,
  REMOVE_ATTRIBUTE,
  SET_DATASET,
  SET_TEXT,
  SET_LISTENER_STATS,

  ON_CREATE_EVENT,
  ON_EVENT,
  ON_RELEASE_EVENT,

  SET_MODEL_BINDING_STAT,
  SET_MODEL_BINDING_STAT_CALLBACK,
  GET_CONTEXT,
  GET_CONTEXT_CALLBACK,

  ASSOCIATE_VALUE,

  INIT_VALUES,
  UPDATE_VALUES,

  REGISTER_STYLE_SHEET_CONTENT,
  APPEND_STYLE_SHEET_PATH,
  DISABLE_STYLE_SHEET,

  GET_ALL_COMPUTED_STYLES,
  GET_ALL_COMPUTED_STYLES_CALLBACK,
  GET_PSEUDO_COMPUTED_STYLES,
  GET_PSEUDO_COMPUTED_STYLES_CALLBACK,
  GET_INHERITED_RULES,
  GET_INHERITED_RULES_CALLBACK,
  GET_MATCHED_RULES,
  GET_MATCHED_RULES_CALLBACK,
  REPLACE_STYLE_SHEET_ALL_PROPERTIES,
  REPLACE_STYLE_SHEET_ALL_PROPERTIES_CALLBACK,
  GET_BOUNDING_CLIENT_RECT,
  GET_BOUNDING_CLIENT_RECT_CALLBACK,
  GET_SCROLL_OFFSET,
  GET_SCROLL_OFFSET_CALLBACK,
  SET_SCROLL_POSITION,
  GET_BOX_MODEL,
  GET_BOX_MODEL_CALLBACK,
  GET_PSEUDO_TYPES,
  GET_PSEUDO_TYPES_CALLBACK,
  START_OVERLAY_INSPECT,
  START_OVERLAY_INSPECT_CALLBACK,
  STOP_OVERLAY_INSPECT,

  PERFORMANCE_START_TRACE,
  PERFORMANCE_END_TRACE,
  PERFORMANCE_STATS_CALLBACK,

  INSERT_DYNAMIC_SLOT,
  UPDATE_DYNAMIC_SLOT,
  REMOVE_DYNAMIC_SLOT,

  CUSTOM_METHOD,
}

export type ChannelEventTypeViewSide =
  | ChannelEventType.CREATE_CALLBACK
  | ChannelEventType.ON_WINDOW_RESIZE_CALLBACK
  | ChannelEventType.ON_THEME_CHANGE_CALLBACK
  | ChannelEventType.RENDER_CALLBACK
  | ChannelEventType.MEDIA_QUERY_OBSERVER_CALLBACK
  | ChannelEventType.INTERSECTION_OBSERVER_CALLBACK
  | ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK
  | ChannelEventType.GET_ALL_COMPUTED_STYLES_CALLBACK
  | ChannelEventType.GET_PSEUDO_COMPUTED_STYLES_CALLBACK
  | ChannelEventType.GET_INHERITED_RULES_CALLBACK
  | ChannelEventType.GET_MATCHED_RULES_CALLBACK
  | ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES_CALLBACK
  | ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK
  | ChannelEventType.GET_SCROLL_OFFSET_CALLBACK
  | ChannelEventType.GET_BOX_MODEL_CALLBACK
  | ChannelEventType.GET_PSEUDO_TYPES_CALLBACK
  | ChannelEventType.START_OVERLAY_INSPECT_CALLBACK
  | ChannelEventType.GET_CONTEXT_CALLBACK
  | ChannelEventType.ON_CREATE_EVENT
  | ChannelEventType.ON_EVENT
  | ChannelEventType.ON_RELEASE_EVENT
  | ChannelEventType.PERFORMANCE_STATS_CALLBACK
  | ChannelEventType.INSERT_DYNAMIC_SLOT
  | ChannelEventType.UPDATE_DYNAMIC_SLOT
  | ChannelEventType.REMOVE_DYNAMIC_SLOT
  | ChannelEventType.CUSTOM_METHOD

export type ChannelEventTypeDataSide =
  | Exclude<ChannelEventType, ChannelEventTypeViewSide>
  | ChannelEventType.CUSTOM_METHOD

type ExhaustiveChannelEvent<T extends Record<ChannelEventType, any>> = T

export type ChannelArgs = ExhaustiveChannelEvent<{
  [ChannelEventType.CREATE]: [number]
  [ChannelEventType.CREATE_CALLBACK]: [number, number, number, number, string]
  [ChannelEventType.DESTROY]: []

  [ChannelEventType.ON_WINDOW_RESIZE]: [number]
  [ChannelEventType.ON_WINDOW_RESIZE_CALLBACK]: [number, number, number, number]
  [ChannelEventType.ON_THEME_CHANGE]: [number]
  [ChannelEventType.ON_THEME_CHANGE_CALLBACK]: [number, string]
  [ChannelEventType.RENDER]: [number]
  [ChannelEventType.RENDER_CALLBACK]: [number, string | null]
  [ChannelEventType.CREATE_MEDIA_QUERY_OBSERVER]: [string, number]
  [ChannelEventType.MEDIA_QUERY_OBSERVER_CALLBACK]: [number, string]
  [ChannelEventType.CREATE_INTERSECTION_OBSERVER]: [number, number | null, string, number[], number]
  [ChannelEventType.INTERSECTION_OBSERVER_CALLBACK]: [number, string]
  [ChannelEventType.DISCONNECT_OBSERVER]: [number]

  [ChannelEventType.CREATE_ELEMENT]: [number, string, string, number]
  [ChannelEventType.CREATE_COMPONENT]: [
    number,
    number,
    string,
    boolean,
    number,
    number | null,
    string[] | undefined,
    number | null,
    boolean,
    number,
  ]
  [ChannelEventType.CREATE_TEXT_NODE]: [number, string, number]
  [ChannelEventType.CREATE_VIRTUAL_NODE]: [number, string, number]
  [ChannelEventType.CREATE_FRAGMENT]: [number]
  [ChannelEventType.RELEASE]: [number]

  [ChannelEventType.APPEND_CHILD]: [number, number]
  [ChannelEventType.REMOVE_CHILD]: [number, number]
  [ChannelEventType.INSERT_BEFORE]: [number, number, number]
  [ChannelEventType.REPLACE_CHILD]: [number, number, number]
  [ChannelEventType.SPLICE_BEFORE]: [number, number, number, number]
  [ChannelEventType.SPLICE_APPEND]: [number, number]
  [ChannelEventType.SPLICE_REMOVE]: [number, number, number]

  [ChannelEventType.SET_ID]: [number, string]
  [ChannelEventType.SET_SLOT]: [number, string]
  [ChannelEventType.SET_SLOT_NAME]: [number, string]
  [ChannelEventType.SET_SLOT_ELEMENT]: [number, number | null]
  [ChannelEventType.SET_INHERIT_SLOTS]: [number]
  [ChannelEventType.REGISTER_STYLE_SCOPE]: [number, string | undefined]
  [ChannelEventType.SET_STYLE]: [number, string, number]
  [ChannelEventType.ADD_CLASS]: [number, string]
  [ChannelEventType.REMOVE_CLASS]: [number, string]
  [ChannelEventType.CLEAR_CLASSES]: [number]
  [ChannelEventType.SET_CLASS_ALIAS]: [number, string, string[]]
  [ChannelEventType.SET_ATTRIBUTE]: [number, string, unknown]
  [ChannelEventType.REMOVE_ATTRIBUTE]: [number, string]
  [ChannelEventType.SET_DATASET]: [number, string, unknown]
  [ChannelEventType.SET_TEXT]: [number, string]
  [ChannelEventType.SET_LISTENER_STATS]: [number, string, boolean, number]

  [ChannelEventType.SET_MODEL_BINDING_STAT]: [number, string, number | null]
  [ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK]: [number, string]
  [ChannelEventType.GET_CONTEXT]: [number, number]
  [ChannelEventType.GET_CONTEXT_CALLBACK]: [number, string]

  [ChannelEventType.ON_CREATE_EVENT]: [
    number,
    string,
    string,
    string,
    number,
    string,
    number,
    boolean,
  ]
  [ChannelEventType.ON_EVENT]: [number, number, string, number, boolean]
  [ChannelEventType.ON_RELEASE_EVENT]: [number]

  [ChannelEventType.ASSOCIATE_VALUE]: [number, string]

  [ChannelEventType.INIT_VALUES]: [number, string]
  [ChannelEventType.UPDATE_VALUES]: [number, string]

  [ChannelEventType.REGISTER_STYLE_SHEET_CONTENT]: [string, string]
  [ChannelEventType.APPEND_STYLE_SHEET_PATH]: [number, string, number | undefined]
  [ChannelEventType.DISABLE_STYLE_SHEET]: [number]

  [ChannelEventType.PERFORMANCE_START_TRACE]: [number]
  [ChannelEventType.PERFORMANCE_END_TRACE]: [number, number]
  [ChannelEventType.PERFORMANCE_STATS_CALLBACK]: [number, number, number]

  [ChannelEventType.GET_ALL_COMPUTED_STYLES]: [number, number]
  [ChannelEventType.GET_ALL_COMPUTED_STYLES_CALLBACK]: [number, string]
  [ChannelEventType.GET_PSEUDO_COMPUTED_STYLES]: [number, string, number]
  [ChannelEventType.GET_PSEUDO_COMPUTED_STYLES_CALLBACK]: [number, string]
  [ChannelEventType.GET_INHERITED_RULES]: [number, number]
  [ChannelEventType.GET_INHERITED_RULES_CALLBACK]: [number, string]
  [ChannelEventType.GET_MATCHED_RULES]: [number, number]
  [ChannelEventType.GET_MATCHED_RULES_CALLBACK]: [number, string]
  [ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES]: [number, number, string, number]
  [ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES_CALLBACK]: [number, number | null]
  [ChannelEventType.GET_BOUNDING_CLIENT_RECT]: [number, number]
  [ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK]: [number, number, number, number, number]
  [ChannelEventType.GET_SCROLL_OFFSET]: [number, number]
  [ChannelEventType.GET_SCROLL_OFFSET_CALLBACK]: [number, number, number, number, number]
  [ChannelEventType.SET_SCROLL_POSITION]: [number, number, number, number]
  [ChannelEventType.GET_BOX_MODEL]: [number, number]
  [ChannelEventType.GET_BOX_MODEL_CALLBACK]: [number, string]
  [ChannelEventType.GET_PSEUDO_TYPES]: [number, number]
  [ChannelEventType.GET_PSEUDO_TYPES_CALLBACK]: [number, string[]]
  [ChannelEventType.START_OVERLAY_INSPECT]: [number]
  [ChannelEventType.START_OVERLAY_INSPECT_CALLBACK]: [number, string, number | null]
  [ChannelEventType.STOP_OVERLAY_INSPECT]: []

  [ChannelEventType.INSERT_DYNAMIC_SLOT]: [number, [number, string, string][]]
  [ChannelEventType.UPDATE_DYNAMIC_SLOT]: [number, string, string[]]
  [ChannelEventType.REMOVE_DYNAMIC_SLOT]: [number[]]

  [ChannelEventType.CUSTOM_METHOD]: [number | null, unknown]
}>

export type Channel = ReturnType<typeof MessageChannelDataSide>

type GetCallback<ARGS extends any[]> = ARGS extends [...any[], infer CB]
  ? CB extends (...arg: infer ARGS) => any
    ? ARGS
    : never
  : never

function assertUnreachable(_x: never) {
  return new Error(`unexpected channel event ${_x as string}`)
}

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
  ): ((...args: GetCallback<Parameters<F>>) => void) => {
    const cb = callbacks[id]!
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

export const MessageChannelDataSide = (
  publish: <T extends ChannelEventTypeDataSide>(
    arg: readonly [T, ...(T extends keyof ChannelArgs ? ChannelArgs[T] : never)],
  ) => void,
  subscribe: (
    cb: (
      arg: {
        [T in ChannelEventTypeViewSide]: [
          T,
          ...(T extends keyof ChannelArgs ? ChannelArgs[T] : never),
        ]
      }[ChannelEventTypeViewSide],
    ) => void,
  ) => void,
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

  subscribe((arg) => {
    switch (arg[0]) {
      case ChannelEventType.CREATE_CALLBACK:
        id2callback<Channel['create']>(arg[1])({
          windowInfo: {
            width: arg[2],
            height: arg[3],
            devicePixelRatio: arg[4],
          },
          themeInfo: {
            theme: arg[5],
          },
        })
        break
      case ChannelEventType.ON_WINDOW_RESIZE_CALLBACK:
        id2callback<Channel['onWindowResize']>(
          arg[1],
          false,
        )({
          width: arg[2],
          height: arg[3],
          devicePixelRatio: arg[4],
        })
        break
      case ChannelEventType.ON_THEME_CHANGE_CALLBACK:
        id2callback<Channel['onThemeChange']>(
          arg[1],
          false,
        )({
          theme: arg[2],
        })
        break
      case ChannelEventType.RENDER_CALLBACK:
        id2callback<Channel['render']>(arg[1])(arg[2] !== null ? new Error(arg[2]) : null)
        break
      case ChannelEventType.MEDIA_QUERY_OBSERVER_CALLBACK:
        id2callback<Channel['createMediaQueryObserver']>(arg[1], false)(JSON.parse(arg[2]))
        break
      case ChannelEventType.INTERSECTION_OBSERVER_CALLBACK:
        id2callback<Channel['createMediaQueryObserver']>(arg[1], false)(JSON.parse(arg[2]))
        break
      case ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK:
        id2callback<Channel['setModelBindingStat']>(arg[1])(JSON.parse(arg[2]))
        break
      case ChannelEventType.GET_CONTEXT_CALLBACK:
        id2callback<Channel['getContext']>(arg[1])(JSON.parse(arg[2]))
        break
      case ChannelEventType.ON_CREATE_EVENT: {
        const [, eventId, eventName, detail, options, currentTargetId, mark, targetId, capture] =
          arg
        const event = createEvent!(
          eventName,
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
        break
      }
      case ChannelEventType.ON_EVENT: {
        const [, eventId, currentTargetId, mark, targetId, capture] = arg
        triggerEvent!(
          eventIdMap.get(eventId)!,
          currentTargetId,
          JSON.parse(mark) as Record<string, unknown> | null,
          targetId,
          capture,
        )
        break
      }
      case ChannelEventType.ON_RELEASE_EVENT: {
        const [, eventId] = arg
        eventIdMap.delete(eventId)
        break
      }
      case ChannelEventType.GET_ALL_COMPUTED_STYLES_CALLBACK:
        id2callback<Channel['getAllComputedStyles']>(arg[1])(JSON.parse(arg[2]))
        break
      case ChannelEventType.GET_PSEUDO_COMPUTED_STYLES_CALLBACK:
        id2callback<Channel['getPseudoComputedStyles']>(arg[1])(JSON.parse(arg[2]))
        break
      case ChannelEventType.GET_INHERITED_RULES_CALLBACK:
        id2callback<Channel['getInheritedRules']>(arg[1])(JSON.parse(arg[2]))
        break
      case ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES_CALLBACK:
        id2callback<Channel['replaceStyleSheetAllProperties']>(arg[1])(arg[2])
        break
      case ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK:
        id2callback<Channel['getBoundingClientRect']>(arg[1])({
          left: arg[2],
          top: arg[3],
          width: arg[4],
          height: arg[5],
        })
        break
      case ChannelEventType.GET_BOX_MODEL_CALLBACK:
        id2callback<Channel['getBoxModel']>(arg[1])(JSON.parse(arg[2]))
        break
      case ChannelEventType.GET_MATCHED_RULES_CALLBACK:
        id2callback<Channel['getMatchedRules']>(arg[1])(JSON.parse(arg[2]))
        break
      case ChannelEventType.GET_SCROLL_OFFSET_CALLBACK:
        id2callback<Channel['getScrollOffset']>(arg[1])({
          scrollLeft: arg[2],
          scrollTop: arg[3],
          scrollWidth: arg[4],
          scrollHeight: arg[5],
        })
        break
      case ChannelEventType.GET_PSEUDO_TYPES_CALLBACK:
        id2callback<Channel['getPseudoTypes']>(arg[1])(arg[2])
        break
      case ChannelEventType.START_OVERLAY_INSPECT_CALLBACK: {
        id2callback<Channel['startOverlayInspect']>(arg[1], false)(arg[2], arg[3])
        break
      }
      case ChannelEventType.PERFORMANCE_STATS_CALLBACK: {
        id2callback<Channel['performanceEndTrace']>(arg[1])({
          startTimestamp: arg[2],
          endTimestamp: arg[3],
        })
        break
      }
      case ChannelEventType.INSERT_DYNAMIC_SLOT: {
        const [, elementId, slots] = arg
        insertSlotHandler?.(
          elementId,
          slots.map(([slotId, name, slotValues]) => ({
            slotId,
            name,
            slotValues: JSON.parse(slotValues),
          })),
        )
        break
      }
      case ChannelEventType.REMOVE_DYNAMIC_SLOT: {
        const [, slotIds] = arg
        removeSlotHandler?.(slotIds)
        break
      }
      case ChannelEventType.UPDATE_DYNAMIC_SLOT: {
        const [, slotId, slotValues, changedNames] = arg
        updateSlotHandler?.(slotId, JSON.parse(slotValues), changedNames)
        break
      }
      case ChannelEventType.CUSTOM_METHOD: {
        const [, elementId, options] = arg
        handleCustomMethod?.(elementId, options)
        break
      }
      default:
        throw assertUnreachable(arg[0])
    }
  })

  // prettier-ignore
  return {
    create: (
      init: (res: {
        windowInfo: { width: number; height: number; devicePixelRatio: number }
        themeInfo: { theme: string }
      }) => void,
    ) => publish([ChannelEventType.CREATE, callback2id(init)]),
    destroy: () => publish([ChannelEventType.DESTROY]),

    onWindowResize: (
      cb: (res: { width: number; height: number; devicePixelRatio: number }) => void,
    ) => publish([ChannelEventType.ON_WINDOW_RESIZE, callback2id(cb)]),
    onThemeChange: (cb: (res: { theme: string }) => void) => publish([ChannelEventType.ON_THEME_CHANGE, callback2id(cb)]),
    render: (cb: (err: Error | null) => void) => publish([ChannelEventType.RENDER, callback2id(cb)]),
    onEvent: (
      _createEvent: (eventName: string, detail: any, options: EventOptions) => Event<unknown>,
      _triggerEvent: (
        event: Event<unknown>,
        currentTargetId: number,
        mark: Record<string, unknown> | null,
        targetId: number,
        isCapture: boolean,
      ) => void,
    ) => { createEvent = _createEvent; triggerEvent = _triggerEvent },
    createMediaQueryObserver: (
      status: GlassEaselBackend.MediaQueryStatus,
      listener: (res: { matches: boolean }) => void,
    ) => {
      const id = callback2id(listener)
      publish([ChannelEventType.CREATE_MEDIA_QUERY_OBSERVER, JSON.stringify(status), callback2id(listener)])
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
      publish([ChannelEventType.CREATE_INTERSECTION_OBSERVER, target, relativeElement, relativeElementMargin, thresholds, id])
      return id
    },
    disconnectObserver: (id: number) => {
      publish([ChannelEventType.DISCONNECT_OBSERVER, id])
      id2callback(id) // release callback
    },

    createElement: (id: number, logicalName: string, stylingName: string, ownerShadowRootId: number) => publish([ChannelEventType.CREATE_ELEMENT, id, logicalName, stylingName, ownerShadowRootId]),
    createComponent: (id: number, shadowRootId: number, tagName: string, virtualHost: boolean, styleScope: number, extraStyleScope: number | null, externalClasses: string[] | undefined, slotMode: number | null, writeIdToDOM: boolean, ownerShadowRootId: number) => publish([ChannelEventType.CREATE_COMPONENT, id, shadowRootId, tagName, virtualHost, styleScope, extraStyleScope, externalClasses, slotMode, writeIdToDOM, ownerShadowRootId]),
    createTextNode: (id: number, textContent: string, ownerShadowRootId: number) => publish([ChannelEventType.CREATE_TEXT_NODE, id, textContent, ownerShadowRootId]),
    createVirtualNode: (id: number, virtualName: string, ownerShadowRootId: number) => publish([ChannelEventType.CREATE_VIRTUAL_NODE, id, virtualName, ownerShadowRootId]),
    createFragment: (id: number) => publish([ChannelEventType.CREATE_FRAGMENT, id]),
    release: (id: number) => publish([ChannelEventType.RELEASE, id]),

    appendChild: (parentId: number, childId: number) => publish([ChannelEventType.APPEND_CHILD, parentId, childId]),
    removeChild: (parentId: number, childId: number) => publish([ChannelEventType.REMOVE_CHILD, parentId, childId]),
    insertBefore: (parentId: number, childId: number, beforeId: number) => publish([ChannelEventType.INSERT_BEFORE, parentId, childId, beforeId]),
    replaceChild: (parentId: number, childId: number, oldChildId: number) => publish([ChannelEventType.REPLACE_CHILD, parentId, childId, oldChildId]),
    spliceBefore: (parentId: number, beforeId: number, deleteCount: number, fragmentId: number) => publish([ChannelEventType.SPLICE_BEFORE, parentId, beforeId, deleteCount, fragmentId]),
    spliceAppend: (parentId: number, fragmentId: number) => publish([ChannelEventType.SPLICE_APPEND, parentId, fragmentId]),
    spliceRemove: (parentId: number, startId: number, deleteCount: number) => publish([ChannelEventType.SPLICE_REMOVE, parentId, startId, deleteCount]),

    associateValue: (componentId: number, data: Record<string, unknown>) => publish([ChannelEventType.ASSOCIATE_VALUE, componentId, JSON.stringify(data)]),

    setId: (elementId: number, id: string) => publish([ChannelEventType.SET_ID, elementId, id]),
    setSlot: (nodeId: number, name: string) => publish([ChannelEventType.SET_SLOT, nodeId, name]),
    setSlotName: (nodeId: number, name: string) => publish([ChannelEventType.SET_SLOT_NAME, nodeId, name]),
    setSlotElement: (nodeId: number, slot: number | null) => publish([ChannelEventType.SET_SLOT_ELEMENT, nodeId, slot]),
    setInheritSlots: (nodeId: number) => publish([ChannelEventType.SET_INHERIT_SLOTS, nodeId]),
    registerStyleScope: (scopeId: number, stylePrefix: string | undefined) => publish([ChannelEventType.REGISTER_STYLE_SCOPE, scopeId, stylePrefix]),
    setStyle: (elementId: number, styleText: string, styleSegmentIndex: number) => publish([ChannelEventType.SET_STYLE, elementId, styleText, styleSegmentIndex]),
    addClass: (elementId: number, className: string) => publish([ChannelEventType.ADD_CLASS, elementId, className]),
    removeClass: (elementId: number, className: string) => publish([ChannelEventType.REMOVE_CLASS, elementId, className]),
    clearClasses: (elementId: number) => publish([ChannelEventType.CLEAR_CLASSES, elementId]),
    setClassAlias: (elementId: number, className: string, target: string[]) => publish([ChannelEventType.SET_CLASS_ALIAS, elementId, className, target]),
    setAttribute: (elementId: number, name: string, value: unknown) => publish([ChannelEventType.SET_ATTRIBUTE, elementId, name, value]),
    removeAttribute: (elementId: number, name: string) => publish([ChannelEventType.REMOVE_ATTRIBUTE, elementId, name]),
    setDataset: (elementId: number, name: string, value: unknown) => publish([ChannelEventType.SET_DATASET, elementId, name, value]),
    setText: (textNodeId: number, textContent: string) => publish([ChannelEventType.SET_TEXT, textNodeId, textContent]),
    setListenerStats: (node: number, eventName: string, capture: boolean, mutLevel: number) => publish([ChannelEventType.SET_LISTENER_STATS, node, eventName, capture, mutLevel]),

    setModelBindingStat: (
      node: number,
      attributeName: string,
      listener: ((newValue: unknown) => void) | null,
    ) => publish([ChannelEventType.SET_MODEL_BINDING_STAT, node, attributeName, listener ? callback2id(listener) : null]),
    getContext: (
      element: number,
      cb: (res: any) => void,
    ) => publish([ChannelEventType.GET_CONTEXT, element, callback2id(cb)]),

    initValues: (elementId: number, values: DataValue) => publish([ChannelEventType.INIT_VALUES, elementId, JSON.stringify(values)]),
    updateValues: (elementId: number, values: DataChange[]) => publish([ChannelEventType.UPDATE_VALUES, elementId, JSON.stringify(values)]),

    registerStyleSheetContent: (path: string, content: unknown) => publish([ChannelEventType.REGISTER_STYLE_SHEET_CONTENT, path, JSON.stringify(content)]),
    appendStyleSheetPath: (index: number, path: string, styleScope?: number) => publish([ChannelEventType.APPEND_STYLE_SHEET_PATH, index, path, styleScope]),
    disableStyleSheet: (index: number) => publish([ChannelEventType.DISABLE_STYLE_SHEET, index]),

    getAllComputedStyles: (elementId: number, cb: (res: GlassEaselBackend.GetAllComputedStylesResponses) => void) => publish([ChannelEventType.GET_ALL_COMPUTED_STYLES, elementId, callback2id(cb)]),
    getPseudoComputedStyles: (
      elementId: number,
      pseudoType: string,
      cb: (res: GlassEaselBackend.GetAllComputedStylesResponses) => void,
    ) => publish([ChannelEventType.GET_PSEUDO_COMPUTED_STYLES, elementId, pseudoType, callback2id(cb)]),
    getInheritedRules: (elementId: number, cb: (res: GlassEaselBackend.GetInheritedRulesResponses) => void) => publish([ChannelEventType.GET_INHERITED_RULES, elementId, callback2id(cb)]),
    replaceStyleSheetAllProperties: (sheetIndex: number, ruleIndex: number, inlineStyle: string, cb: (propertyIndex: number | null) => void) => publish([ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES, sheetIndex, ruleIndex, inlineStyle, callback2id(cb)]),
    getBoundingClientRect: (parent: number, cb: (res: GlassEaselBackend.BoundingClientRect) => void) => publish([ChannelEventType.GET_BOUNDING_CLIENT_RECT, parent, callback2id(cb)]),
    getBoxModel:(
      elementId: number,
      cb: (res: {
        margin: GlassEaselBackend.BoundingClientRect
        border: GlassEaselBackend.BoundingClientRect
        padding: GlassEaselBackend.BoundingClientRect
        content: GlassEaselBackend.BoundingClientRect
      }) => void,
    ) => publish([ChannelEventType.GET_BOX_MODEL, elementId, callback2id(cb)]),
    getMatchedRules: (
      elementId: number,
      cb: (res: GlassEaselBackend.GetMatchedRulesResponses) => void,
    ) => publish([ChannelEventType.GET_MATCHED_RULES, elementId, callback2id(cb)]),
    getScrollOffset: (
      elementId: number,
      cb: (res: GlassEaselBackend.ScrollOffset) => void,
    ) => publish([ChannelEventType.GET_SCROLL_OFFSET, elementId, callback2id(cb)]),
    setScrollPosition: (
      elementId: number,
      scrollLeft: number,
      scrollTop: number,
      duration: number
    ) => publish([ChannelEventType.SET_SCROLL_POSITION, elementId, scrollLeft, scrollTop, duration]),
    getPseudoTypes: (elementId: number, cb: (res: string[]) => void) => publish([ChannelEventType.GET_PSEUDO_TYPES, elementId, callback2id(cb)]),
    startOverlayInspect: (cb: (event: string, elementId: number | null) => void) => {
      if (overlayInspectCallbackId !== null) return
      const callbackId = overlayInspectCallbackId = callback2id(cb)
      publish([ChannelEventType.START_OVERLAY_INSPECT, callbackId])
    },
    stopOverlayInspect: () => {
      if (overlayInspectCallbackId === null) return
      releaseCallbackId(overlayInspectCallbackId)
      overlayInspectCallbackId = null
      publish([ChannelEventType.STOP_OVERLAY_INSPECT])
    },

    performanceStartTrace: (index: number) => publish([ChannelEventType.PERFORMANCE_START_TRACE, index]),
    performanceEndTrace: (id: number, cb: (stats: { startTimestamp: number; endTimestamp: number }) => void,) => publish([ChannelEventType.PERFORMANCE_END_TRACE, id, callback2id(cb)]),

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

    callCustomMethod: (elementId: number | null, options: any) => publish([ChannelEventType.CUSTOM_METHOD, elementId, options]),
    onCustenMethod: (handler: (elementId: number | null, options: any) => void) => {
      handleCustomMethod = handler
    }
  }
}

const SYNC_ID_KEY = '_$sync_id'

function setNodeId(node: Node | Fragment, id: number): void {
  ;(node as unknown as { [SYNC_ID_KEY]: number })[SYNC_ID_KEY] = id
}

export function getNodeId(node: Node | Fragment): number | undefined {
  return (node as unknown as { [SYNC_ID_KEY]: number })[SYNC_ID_KEY]
}

export const MessageChannelViewSide = (
  publish: <T extends ChannelEventTypeViewSide>(
    arg: readonly [T, ...(T extends keyof ChannelArgs ? ChannelArgs[T] : never)],
  ) => void,
  subscribe: (
    cb: (
      arg: {
        [T in ChannelEventTypeDataSide]: [
          T,
          ...(T extends keyof ChannelArgs ? ChannelArgs[T] : never),
        ]
      }[ChannelEventTypeDataSide],
    ) => void,
  ) => void,
  controller: ViewController,
  idGenerator: () => IDGenerator,
) => {
  const nodeMap: Record<number, Node | Fragment | ShadowRoot | undefined> = []
  const eventIdGen = idGenerator()
  const eventIdMap = new WeakMap<Event<unknown>, number>()

  const observersMap: Record<number, { disconnect(): void } | undefined> = []

  const slotIdGen = idGenerator()
  const slotMap: Record<number, Element> = []

  const eventHandler: EventListener<unknown> = (shadowedEvent) => {
    // ShadowedEvent is fresh created for each target
    // We should check it's prototype
    const event = Object.getPrototypeOf(shadowedEvent) as Event<unknown>
    const targetId = getNodeId(shadowedEvent.target)
    const currentTargetId = getNodeId(shadowedEvent.currentTarget)
    const capture = shadowedEvent.isCapturePhase()
    if (typeof targetId !== 'number' || typeof currentTargetId !== 'number') return

    if (!eventIdMap.has(event)) {
      const eventId = eventIdGen.gen()
      publish([
        ChannelEventType.ON_CREATE_EVENT,
        eventId,
        event.getEventName(),
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
      ])
      eventIdMap.set(event, eventId)

      // eslint-disable-next-line @typescript-eslint/no-floating-promises,promise/catch-or-return,promise/always-return
      Promise.resolve().then(() => {
        // eslint-disable-next-line promise/always-return
        publish([ChannelEventType.ON_RELEASE_EVENT, eventId])
        eventIdMap.delete(event)
      })
    } else {
      const eventId = eventIdMap.get(event)!

      publish([
        ChannelEventType.ON_EVENT,
        eventId,
        currentTargetId,
        JSON.stringify(shadowedEvent.mark),
        targetId,
        capture,
      ])
    }
  }

  const sendCustomMethodHandler = (elem: Element | null, options: any) => {
    const elemId = elem ? getNodeId(elem)! : null
    publish([ChannelEventType.CUSTOM_METHOD, elemId, options])
  }

  controller.onCustomMethod(sendCustomMethodHandler)

  controller.setDynamicSlotHandler({
    insertSlotHandler: (component, slots) => {
      const componentId = getNodeId(component)!
      publish([
        ChannelEventType.INSERT_DYNAMIC_SLOT,
        componentId,
        slots.map(({ slot, name, slotValues }) => {
          const slotId = slotIdGen.gen()
          slotMap[slotId] = slot
          setNodeId(slot, slotId)
          return [slotId, name, JSON.stringify(slotValues)] as [number, string, string]
        }),
      ])
    },
    removeSlotHandler: (slots) => {
      publish([
        ChannelEventType.REMOVE_DYNAMIC_SLOT,
        slots.map((slot) => {
          const slotId = getNodeId(slot)!
          slotIdGen.release(slotId)
          delete slotMap[slotId]
          return slotId
        }),
      ])
    },
    updateSlotHandler: (slot, slotValue, changedNames) => {
      publish([
        ChannelEventType.UPDATE_DYNAMIC_SLOT,
        getNodeId(slot)!,
        JSON.stringify(slotValue),
        changedNames,
      ])
    },
  })

  // eslint-disable-next-line consistent-return
  subscribe((arg) => {
    switch (arg[0]) {
      case ChannelEventType.CREATE: {
        const [, callbackId] = arg
        controller.create(({ windowInfo, themeInfo }) => {
          publish([
            ChannelEventType.CREATE_CALLBACK,
            callbackId,
            windowInfo.width,
            windowInfo.height,
            windowInfo.devicePixelRatio,
            themeInfo.theme,
          ])
        })
        break
      }
      case ChannelEventType.DESTROY:
        controller.destroy()
        break
      case ChannelEventType.ON_WINDOW_RESIZE: {
        const [, callbackId] = arg
        controller.onWindowResize(({ width, height, devicePixelRatio }) => {
          publish([
            ChannelEventType.ON_WINDOW_RESIZE_CALLBACK,
            callbackId,
            width,
            height,
            devicePixelRatio,
          ])
        })
        break
      }
      case ChannelEventType.ON_THEME_CHANGE: {
        const [, callbackId] = arg
        controller.onThemeChange(({ theme }) => {
          publish([ChannelEventType.ON_THEME_CHANGE_CALLBACK, callbackId, theme])
        })
        break
      }
      case ChannelEventType.RENDER: {
        const [, callbackId] = arg
        controller.render((err) => {
          publish([ChannelEventType.RENDER_CALLBACK, callbackId, err ? err.message : null])
        })
        break
      }
      case ChannelEventType.CREATE_MEDIA_QUERY_OBSERVER: {
        const [, status, callbackId] = arg
        const observer = controller.createMediaQueryObserver(JSON.parse(status), (res) => {
          publish([ChannelEventType.MEDIA_QUERY_OBSERVER_CALLBACK, callbackId, JSON.stringify(res)])
        })
        observersMap[callbackId] = observer
        break
      }
      case ChannelEventType.CREATE_INTERSECTION_OBSERVER: {
        const [, targetId, relativeElementId, relativeElementMargin, thresholds, callbackId] = arg
        const target = nodeMap[targetId] as Element
        const relativeElement =
          typeof relativeElementId === 'number' ? (nodeMap[relativeElementId] as Element) : null
        const observer = controller.createIntersectionObserver(
          target,
          relativeElement,
          relativeElementMargin,
          thresholds,
          (res) => {
            publish([
              ChannelEventType.INTERSECTION_OBSERVER_CALLBACK,
              callbackId,
              JSON.stringify(res),
            ])
          },
        )
        observersMap[callbackId] = observer
        break
      }
      case ChannelEventType.DISCONNECT_OBSERVER: {
        const [, callbackId] = arg
        const observer = observersMap[callbackId]
        if (observer) {
          observer.disconnect()
          observersMap[callbackId] = undefined
        }
        break
      }
      case ChannelEventType.CREATE_ELEMENT: {
        const [, id, logicalName, stylingName, ownerShadowRootId] = arg
        const ownerShadowRoot = nodeMap[ownerShadowRootId] as ShadowRoot
        const node = (nodeMap[id] = controller.createElementOrComponent(
          logicalName,
          stylingName,
          ownerShadowRoot,
        ))
        setNodeId(node, id)
        break
      }
      case ChannelEventType.CREATE_COMPONENT: {
        const [
          ,
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
        ] = arg
        const ownerShadowRoot = nodeMap[ownerShadowRootId] as ShadowRoot | undefined
        controller.createSimpleComponent(
          tagName,
          ownerShadowRoot,
          virtualHost,
          styleScope,
          extraStyleScope,
          externalClasses,
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
            setNodeId(component, id)
          },
        )
        break
      }
      case ChannelEventType.CREATE_TEXT_NODE: {
        const [, id, textContent, ownerShadowRootId] = arg
        const ownerShadowRoot = nodeMap[ownerShadowRootId] as ShadowRoot
        const node = (nodeMap[id] = controller.createTextNode(textContent, ownerShadowRoot))
        setNodeId(node, id)
        break
      }
      case ChannelEventType.CREATE_VIRTUAL_NODE: {
        const [, id, virtualName, ownerShadowRootId] = arg
        const ownerShadowRoot = nodeMap[ownerShadowRootId] as ShadowRoot
        const node = (nodeMap[id] = controller.createVirtualNode(virtualName, ownerShadowRoot))
        setNodeId(node, id)
        break
      }
      case ChannelEventType.CREATE_FRAGMENT: {
        const [, id] = arg
        const node = (nodeMap[id] = controller.createFragment())
        setNodeId(node, id)
        break
      }
      case ChannelEventType.RELEASE: {
        const [, id] = arg
        const node = nodeMap[id]! as Element
        delete nodeMap[id]
        controller.release(node)
        break
      }
      case ChannelEventType.APPEND_CHILD: {
        const [, parentId, childId] = arg
        const parent = nodeMap[parentId] as Element | undefined
        const child = nodeMap[childId]! as Node
        controller.appendChild(parent, child)
        break
      }
      case ChannelEventType.REMOVE_CHILD: {
        const [, parentId, childId] = arg
        const parent = nodeMap[parentId] as Element | undefined
        const child = nodeMap[childId]! as Node
        controller.removeChild(parent, child)
        break
      }
      case ChannelEventType.INSERT_BEFORE: {
        const [, parentId, childId, beforeId] = arg
        const parent = nodeMap[parentId] as Element | undefined
        const child = nodeMap[childId]! as Node
        const before = nodeMap[beforeId]! as Node
        controller.insertBefore(parent, child, before)
        break
      }
      case ChannelEventType.REPLACE_CHILD: {
        const [, parentId, childId, oldChildId] = arg
        const parent = nodeMap[parentId] as Element | undefined
        const child = nodeMap[childId]! as Node
        const oldChild = nodeMap[oldChildId]! as Node
        controller.replaceChild(parent, child, oldChild)
        break
      }
      case ChannelEventType.SPLICE_BEFORE: {
        const [, parentId, beforeId, deleteCount, fragmentId] = arg
        const parent = nodeMap[parentId]! as Element
        const before = nodeMap[beforeId]! as Node
        const fragment = nodeMap[fragmentId]! as Fragment
        controller.spliceBefore(parent, before, deleteCount, fragment)
        break
      }
      case ChannelEventType.SPLICE_APPEND: {
        const [, parentId, fragmentId] = arg
        const parent = nodeMap[parentId]! as Element
        const fragment = nodeMap[fragmentId]! as Fragment
        controller.spliceAppend(parent, fragment)
        break
      }
      case ChannelEventType.SPLICE_REMOVE: {
        const [, parentId, startId, deleteCount] = arg
        const parent = nodeMap[parentId]! as Element
        const start = nodeMap[startId]! as Node
        controller.spliceRemove(parent, start, deleteCount)
        break
      }
      case ChannelEventType.ASSOCIATE_VALUE: {
        const [, nodeId, data] = arg
        const node = nodeMap[nodeId]! as Node
        controller.associateValue(node, JSON.parse(data))
        break
      }
      case ChannelEventType.SET_ID: {
        const [, elementId, id] = arg
        const element = nodeMap[elementId]! as Element
        controller.setId(element, id)
        break
      }
      case ChannelEventType.SET_SLOT: {
        const [, elementId, name] = arg
        const element = nodeMap[elementId]! as Element
        controller.setSlot(element, name)
        break
      }
      case ChannelEventType.SET_SLOT_NAME: {
        const [, elementId, name] = arg
        const element = nodeMap[elementId]! as Element
        controller.setSlotName(element, name)
        break
      }
      case ChannelEventType.SET_SLOT_ELEMENT: {
        const [, nodeId, slotId] = arg
        const node = nodeMap[nodeId]! as Node
        const slot =
          typeof slotId === 'number' ? slotMap[slotId]! ?? (nodeMap[slotId]! as Element) : null
        controller.setSlotElement(node, slot)
        break
      }
      case ChannelEventType.SET_INHERIT_SLOTS: {
        const [, elementId] = arg
        const element = nodeMap[elementId]! as Element
        controller.setInheritSlots(element)
        break
      }
      case ChannelEventType.REGISTER_STYLE_SCOPE: {
        const [, scopeId, stylePrefix] = arg
        controller.registerStyleScope(scopeId, stylePrefix)
        break
      }
      case ChannelEventType.SET_STYLE: {
        const [, elementId, styleText, styleSegmentIndex] = arg
        const element = nodeMap[elementId]! as Element
        controller.setStyle(element, styleText, styleSegmentIndex)
        break
      }
      case ChannelEventType.ADD_CLASS: {
        const [, elementId, className] = arg
        const element = nodeMap[elementId]! as Element
        controller.addClass(element, className)
        break
      }
      case ChannelEventType.REMOVE_CLASS: {
        const [, elementId, className] = arg
        const element = nodeMap[elementId]! as Element
        controller.removeClass(element, className)
        break
      }
      case ChannelEventType.CLEAR_CLASSES: {
        const [, elementId] = arg
        const element = nodeMap[elementId]! as Element
        controller.clearClasses(element)
        break
      }
      case ChannelEventType.SET_CLASS_ALIAS: {
        const [, elementId, className, target] = arg
        const element = nodeMap[elementId]! as GeneralComponent
        controller.setClassAlias(element, className, target)
        break
      }
      case ChannelEventType.SET_ATTRIBUTE: {
        const [, elementId, name, value] = arg
        const element = nodeMap[elementId]! as Element
        controller.setAttribute(element, name, value)
        break
      }
      case ChannelEventType.REMOVE_ATTRIBUTE: {
        const [, elementId, name] = arg
        const element = nodeMap[elementId]! as Element
        controller.removeAttribute(element, name)
        break
      }
      case ChannelEventType.SET_DATASET: {
        const [, elementId, name, value] = arg
        const element = nodeMap[elementId]! as Element
        controller.setDataset(element, name, value)
        break
      }
      case ChannelEventType.SET_TEXT: {
        const [, textNodeId, textContent] = arg
        const textNode = nodeMap[textNodeId]! as TextNode
        controller.setText(textNode, textContent)
        break
      }
      case ChannelEventType.SET_LISTENER_STATS: {
        const [, elementId, eventName, capture, mutLevel] = arg
        const element = nodeMap[elementId]! as Element
        controller.setListenerStats(element, eventName, capture, mutLevel, eventHandler)
        break
      }
      case ChannelEventType.SET_MODEL_BINDING_STAT: {
        const [, elementId, attributeName, listenerId] = arg
        const element = nodeMap[elementId]! as Element
        if (!listenerId) {
          throw new Error('missing listenerId for setModelBindingStat')
        }
        controller.setModelBindingStat(element, attributeName, (newValue) => {
          publish([
            ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK,
            listenerId,
            JSON.stringify(newValue),
          ])
        })
        break
      }
      case ChannelEventType.GET_CONTEXT: {
        const [, elementId, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        controller.getContext(element, (res) => {
          publish([ChannelEventType.GET_CONTEXT_CALLBACK, callbackId, JSON.stringify(res)])
        })
        break
      }
      case ChannelEventType.INIT_VALUES: {
        const [, elementId, values] = arg
        const element = nodeMap[elementId]! as Element
        controller.initValues(element, JSON.parse(values))
        break
      }
      case ChannelEventType.UPDATE_VALUES: {
        const [, elementId, values] = arg
        const element = nodeMap[elementId]! as Element
        controller.updateValues(element, JSON.parse(values))
        break
      }
      case ChannelEventType.REGISTER_STYLE_SHEET_CONTENT: {
        const [, path, content] = arg
        controller.registerStyleSheetContent(path, JSON.parse(content))
        break
      }
      case ChannelEventType.APPEND_STYLE_SHEET_PATH: {
        const [, index, path, styleScope] = arg
        controller.appendStyleSheetPath(index, path, styleScope)
        break
      }
      case ChannelEventType.DISABLE_STYLE_SHEET: {
        const [, index] = arg
        controller.disableStyleSheet(index)
        break
      }
      case ChannelEventType.GET_ALL_COMPUTED_STYLES: {
        const [, elementId, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        controller.getAllComputedStyles(element, (res) => {
          publish([
            ChannelEventType.GET_ALL_COMPUTED_STYLES_CALLBACK,
            callbackId,
            JSON.stringify(res),
          ])
        })
        break
      }
      case ChannelEventType.GET_PSEUDO_COMPUTED_STYLES: {
        const [, elementId, pseudoType, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        controller.getPseudoComputedStyles(element, pseudoType, (res) => {
          publish([
            ChannelEventType.GET_PSEUDO_COMPUTED_STYLES_CALLBACK,
            callbackId,
            JSON.stringify(res),
          ])
        })
        break
      }
      case ChannelEventType.GET_INHERITED_RULES: {
        const [, elementId, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        controller.getInheritedRules(element, (res) => {
          publish([ChannelEventType.GET_INHERITED_RULES_CALLBACK, callbackId, JSON.stringify(res)])
        })
        break
      }
      case ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES: {
        const [, sheetIndex, ruleIndex, inlineStyle, callbackId] = arg
        controller.replaceStyleSheetAllProperties(
          sheetIndex,
          ruleIndex,
          inlineStyle,
          (propertyIndex) => {
            publish([
              ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES_CALLBACK,
              callbackId,
              propertyIndex,
            ])
          },
        )
        break
      }
      case ChannelEventType.GET_MATCHED_RULES: {
        const [, elementId, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        controller.getMatchedRules(element, (res) => {
          publish([ChannelEventType.GET_MATCHED_RULES_CALLBACK, callbackId, JSON.stringify(res)])
        })
        break
      }
      case ChannelEventType.GET_BOUNDING_CLIENT_RECT: {
        const [, elementId, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        controller.getBoundingClientRect(element, (res) => {
          publish([
            ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK,
            callbackId,
            res.left,
            res.top,
            res.width,
            res.height,
          ])
        })
        break
      }
      case ChannelEventType.GET_SCROLL_OFFSET: {
        const [, elementId, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        controller.getScrollOffset(element, (res) => {
          publish([
            ChannelEventType.GET_SCROLL_OFFSET_CALLBACK,
            callbackId,
            res.scrollLeft,
            res.scrollTop,
            res.scrollWidth,
            res.scrollHeight,
          ])
        })
        break
      }
      case ChannelEventType.SET_SCROLL_POSITION: {
        const [, elementId, scrollLeft, scrollTop, duration] = arg
        const element = nodeMap[elementId]! as Element
        controller.setScrollPosition(element, scrollLeft, scrollTop, duration)
        break
      }
      case ChannelEventType.GET_BOX_MODEL: {
        const [, elementId, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        controller.getBoxModel(element, (res) => {
          publish([ChannelEventType.GET_BOX_MODEL_CALLBACK, callbackId, JSON.stringify(res)])
        })
        break
      }
      case ChannelEventType.GET_PSEUDO_TYPES: {
        const [, elementId, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        controller.getPseudoTypes(element, (res) => {
          publish([ChannelEventType.GET_PSEUDO_TYPES_CALLBACK, callbackId, res])
        })
        break
      }
      case ChannelEventType.START_OVERLAY_INSPECT: {
        const [, callbackId] = arg
        controller.startOverlayInspect((event, element) => {
          const elementId = element ? getNodeId(element)! : null
          publish([ChannelEventType.START_OVERLAY_INSPECT_CALLBACK, callbackId, event, elementId])
        })
        break
      }
      case ChannelEventType.STOP_OVERLAY_INSPECT: {
        controller.stopOverlayInspect()
        break
      }
      case ChannelEventType.PERFORMANCE_START_TRACE: {
        const [, index] = arg
        controller.performanceStartTrace(index)
        break
      }
      case ChannelEventType.PERFORMANCE_END_TRACE: {
        const [, index, callbackId] = arg
        controller.performanceEndTrace(index, (stats) => {
          publish([
            ChannelEventType.PERFORMANCE_STATS_CALLBACK,
            callbackId,
            stats.startTimestamp,
            stats.endTimestamp,
          ])
        })
        break
      }
      case ChannelEventType.CUSTOM_METHOD: {
        const [, elementId, options] = arg
        const element = elementId ? (nodeMap[elementId]! as Element) : null
        controller.handleCustomMethod(element, options)
        break
      }
      default:
        throw assertUnreachable(arg[0])
    }
  })

  return {
    getNode: (id: number) => nodeMap[id],
  }
}
