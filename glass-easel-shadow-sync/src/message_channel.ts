import type {
  DataChange,
  DataValue,
  Element,
  Event,
  EventOptions,
  ExternalShadowRoot,
  GeneralComponent,
  NativeNode,
  Node,
  ShadowRoot,
  TextNode,
} from 'glass-easel'
import { IDGenerator } from './utils'
import { Fragment, ViewController } from './view_controller'

export enum ChannelEventType {
  CREATE = 1,
  CREATE_CALLBACK,
  DESTROY,
  INIT_DATA,

  ON_WINDOW_RESIZE,
  ON_WINDOW_RESIZE_CALLBACK,
  ON_THEME_CHANGE,
  ON_THEME_CHANGE_CALLBACK,
  RENDER,
  RENDER_CALLBACK,
  // CREATE_MEDIA_QUERY_OBSERVER,
  // MEDIA_QUERY_OBSERVER_CALLBACK,
  // CREATE_INTERSECTION_OBSERVER,
  // INTERSECTION_OBSERVER_CALLBACK,

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
  SET_SLOT_NAME,
  SET_CONTAINING_SLOT,
  REASSIGN_CONTAINING_SLOT,
  SPLICE_BEFORE_SLOT_NODES,
  SPLICE_APPEND_SLOT_NODES,
  SPLICE_REMOVE_SLOT_NODES,
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
  GET_BOUNDING_CLIENT_RECT,
  GET_BOUNDING_CLIENT_RECT_CALLBACK,
  GET_SCROLL_OFFSET,
  GET_SCROLL_OFFSET_CALLBACK,
  GET_CONTEXT,
  GET_CONTEXT_CALLBACK,

  ASSOCIATE_VALUE,

  INIT_VALUES,
  UPDATE_VALUES,

  REGISTER_STYLE_SHEET_CONTENT,
  APPEND_STYLE_SHEET_PATH,
  DISABLE_STYLE_SHEET,

  PERFORMANCE_START_TRACE,
  PERFORMANCE_END_TRACE,
  PERFORMANCE_STATS_CALLBACK,
}

export type ChannelEventTypeViewSide =
  | ChannelEventType.CREATE_CALLBACK
  | ChannelEventType.ON_WINDOW_RESIZE_CALLBACK
  | ChannelEventType.ON_THEME_CHANGE_CALLBACK
  | ChannelEventType.RENDER_CALLBACK
  // | ChannelEventType.MEDIA_QUERY_OBSERVER_CALLBACK
  // | ChannelEventType.INTERSECTION_OBSERVER_CALLBACK
  | ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK
  | ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK
  | ChannelEventType.GET_SCROLL_OFFSET_CALLBACK
  | ChannelEventType.GET_CONTEXT_CALLBACK
  | ChannelEventType.ON_CREATE_EVENT
  | ChannelEventType.ON_EVENT
  | ChannelEventType.ON_RELEASE_EVENT
  | ChannelEventType.PERFORMANCE_STATS_CALLBACK

export type ChannelEventTypeDataSide = Exclude<ChannelEventType, ChannelEventTypeViewSide>

type ExhaustiveChannelEvent<T extends Record<ChannelEventType, any>> = T

export type ChannelArgs = ExhaustiveChannelEvent<{
  [ChannelEventType.CREATE]: [number]
  [ChannelEventType.CREATE_CALLBACK]: [number, number, number, number, string]
  [ChannelEventType.DESTROY]: []
  [ChannelEventType.INIT_DATA]: [string]

  [ChannelEventType.ON_WINDOW_RESIZE]: [number]
  [ChannelEventType.ON_WINDOW_RESIZE_CALLBACK]: [number, number, number, number]
  [ChannelEventType.ON_THEME_CHANGE]: [number]
  [ChannelEventType.ON_THEME_CHANGE_CALLBACK]: [number, string]
  [ChannelEventType.RENDER]: [number]
  [ChannelEventType.RENDER_CALLBACK]: [number, string | null]
  // [ChannelEventType.CREATE_MEDIA_QUERY_OBSERVER]: [number]
  // [ChannelEventType.MEDIA_QUERY_OBSERVER_CALLBACK]: [number]
  // [ChannelEventType.CREATE_INTERSECTION_OBSERVER]: [number]
  // [ChannelEventType.INTERSECTION_OBSERVER_CALLBACK]: [number]

  [ChannelEventType.CREATE_ELEMENT]: [number, string, string, number]
  [ChannelEventType.CREATE_COMPONENT]: [
    number,
    number,
    string,
    boolean,
    boolean,
    number,
    number | null,
    string[] | undefined,
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
  [ChannelEventType.SET_SLOT_NAME]: [number, string]
  [ChannelEventType.SET_CONTAINING_SLOT]: [number, number | undefined | null]
  [ChannelEventType.REASSIGN_CONTAINING_SLOT]: [number, number | null, number | null]
  [ChannelEventType.SPLICE_BEFORE_SLOT_NODES]: [number, number, number, number]
  [ChannelEventType.SPLICE_APPEND_SLOT_NODES]: [number, number]
  [ChannelEventType.SPLICE_REMOVE_SLOT_NODES]: [number, number, number]
  [ChannelEventType.SET_INHERIT_SLOTS]: [number]
  [ChannelEventType.REGISTER_STYLE_SCOPE]: [number, string | undefined]
  [ChannelEventType.SET_STYLE]: [number, string]
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
  [ChannelEventType.GET_BOUNDING_CLIENT_RECT]: [number, number]
  [ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK]: [number, number, number, number, number]
  [ChannelEventType.GET_SCROLL_OFFSET]: [number, number]
  [ChannelEventType.GET_SCROLL_OFFSET_CALLBACK]: [number, number, number, number, number]
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
  const callbackIdGen = idGenerator()

  const callbacks: ((...args: any[]) => void)[] = []
  let createEvent: ((type: string, detail: any, options: EventOptions) => Event<unknown>) | null =
    null
  let triggerEvent:
    | ((
        event: Event<unknown>,
        currentTargetId: number,
        mark: Record<string, unknown> | null,
        targetId: number,
        isCapture: boolean,
      ) => void)
    | null = null

  const callback2id = (cb: (...args: any[]) => void) => {
    const id = callbackIdGen.gen()
    callbacks[id] = cb
    return id
  }

  const id2callback = <F extends (...args: any[]) => void>(
    id: number,
  ): ((...args: GetCallback<Parameters<F>>) => void) => {
    const cb = callbacks[id]!
    callbackIdGen.release(id)
    return cb
  }

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
        id2callback<Channel['onWindowResize']>(arg[1])({
          width: arg[2],
          height: arg[3],
          devicePixelRatio: arg[4],
        })
        break
      case ChannelEventType.ON_THEME_CHANGE_CALLBACK:
        id2callback<Channel['onThemeChange']>(arg[1])({
          theme: arg[2],
        })
        break
      case ChannelEventType.RENDER_CALLBACK:
        id2callback<Channel['render']>(arg[1])(arg[2] !== null ? new Error(arg[2]) : null)
        break
      case ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK:
        id2callback<Channel['setModelBindingStat']>(arg[1])(JSON.parse(arg[2]))
        break
      case ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK:
        id2callback<Channel['getBoundingClientRect']>(arg[1])({
          left: arg[2],
          top: arg[3],
          width: arg[4],
          height: arg[5],
        })
        break
      case ChannelEventType.GET_SCROLL_OFFSET_CALLBACK:
        id2callback<Channel['getScrollOffset']>(arg[1])({
          scrollLeft: arg[2],
          scrollTop: arg[3],
          scrollWidth: arg[4],
          scrollHeight: arg[5],
        })
        break
      case ChannelEventType.GET_CONTEXT_CALLBACK:
        id2callback<Channel['getContext']>(arg[1])(JSON.parse(arg[2]))
        break
      case ChannelEventType.ON_CREATE_EVENT: {
        const [, eventId, type, detail, options, currentTargetId, mark, targetId, capture] = arg
        const event = createEvent!(
          type,
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
      case ChannelEventType.PERFORMANCE_STATS_CALLBACK: {
        id2callback<Channel['performanceEndTrace']>(arg[1])({
          startTimestamp: arg[2],
          endTimestamp: arg[3],
        })
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
    initData: (initData: Record<string, unknown>) => publish([ChannelEventType.INIT_DATA, JSON.stringify(initData)]),

    onWindowResize: (
      cb: (res: { width: number; height: number; devicePixelRatio: number }) => void,
    ) => publish([ChannelEventType.ON_WINDOW_RESIZE, callback2id(cb)]),
    onThemeChange: (cb: (res: { theme: string }) => void) => publish([ChannelEventType.ON_THEME_CHANGE, callback2id(cb)]),
    render: (cb: (err: Error | null) => void) => publish([ChannelEventType.RENDER, callback2id(cb)]),
    onEvent: (
      _createEvent: (type: string, detail: any, options: EventOptions) => Event<unknown>,
      _triggerEvent: (
        event: Event<unknown>,
        currentTargetId: number,
        mark: Record<string, unknown> | null,
        targetId: number,
        isCapture: boolean,
      ) => void,
    ) => { createEvent = _createEvent; triggerEvent = _triggerEvent },

    createElement: (id: number, logicalName: string, stylingName: string, ownerShadowRootId: number) => publish([ChannelEventType.CREATE_ELEMENT, id, logicalName, stylingName, ownerShadowRootId]),
    createComponent: (id: number, shadowRootId: number, tagName: string, external: boolean, virtualHost: boolean, styleScope: number, extraStyleScope: number | null, externalClasses: string[] | undefined, ownerShadowRootId: number) => publish([ChannelEventType.CREATE_COMPONENT, id, shadowRootId, tagName, external, virtualHost, styleScope, extraStyleScope, externalClasses, ownerShadowRootId]),
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
    setSlotName: (nodeId: number, name: string) => publish([ChannelEventType.SET_SLOT_NAME, nodeId, name]),
    setContainingSlot: (nodeId: number, slot: number | undefined | null) => publish([ChannelEventType.SET_CONTAINING_SLOT, nodeId, slot]),
    reassignContainingSlot: (nodeId: number, oldSlot: number | null, newSlot: number | null) => publish([ChannelEventType.REASSIGN_CONTAINING_SLOT, nodeId, oldSlot, newSlot]),
    spliceBeforeSlotNodes: (slotId: number, before: number, count: number, listId: number) => publish([ChannelEventType.SPLICE_BEFORE_SLOT_NODES, slotId, before, count, listId]),
    spliceAppendSlotNodes: (slotId: number, listId: number) => publish([ChannelEventType.SPLICE_APPEND_SLOT_NODES, slotId, listId]),
    spliceRemoveSlotNodes: (slotId: number, before: number, count: number) => publish([ChannelEventType.SPLICE_REMOVE_SLOT_NODES, slotId, before, count]),
    setInheritSlots: (nodeId: number) => publish([ChannelEventType.SET_INHERIT_SLOTS, nodeId]),
    registerStyleScope: (scopeId: number, stylePrefix: string | undefined) => publish([ChannelEventType.REGISTER_STYLE_SCOPE, scopeId, stylePrefix]),
    setStyle: (elementId: number, styleText: string) => publish([ChannelEventType.SET_STYLE, elementId, styleText]),
    addClass: (elementId: number, className: string) => publish([ChannelEventType.ADD_CLASS, elementId, className]),
    removeClass: (elementId: number, className: string) => publish([ChannelEventType.REMOVE_CLASS, elementId, className]),
    clearClasses: (elementId: number) => publish([ChannelEventType.CLEAR_CLASSES, elementId]),
    setClassAlias: (elementId: number, className: string, target: string[]) => publish([ChannelEventType.SET_CLASS_ALIAS, elementId, className, target]),
    setAttribute: (elementId: number, name: string, value: unknown) => publish([ChannelEventType.SET_ATTRIBUTE, elementId, name, value]),
    removeAttribute: (elementId: number, name: string) => publish([ChannelEventType.REMOVE_ATTRIBUTE, elementId, name]),
    setDataset: (elementId: number, name: string, value: unknown) => publish([ChannelEventType.SET_DATASET, elementId, name, value]),
    setText: (textNodeId: number, textContent: string) => publish([ChannelEventType.SET_TEXT, textNodeId, textContent]),
    setListenerStats: (node: number, type: string, capture: boolean, mutLevel: number) => publish([ChannelEventType.SET_LISTENER_STATS, node, type, capture, mutLevel]),

    setModelBindingStat: (
      node: number,
      attributeName: string,
      listener: ((newValue: unknown) => void) | null,
    ) => publish([ChannelEventType.SET_MODEL_BINDING_STAT, node, attributeName, listener ? callback2id(listener) : null]),
    getBoundingClientRect: (
      parent: number,
      cb: (res: { left: number; top: number; width: number; height: number }) => void,
    ) => publish([ChannelEventType.GET_BOUNDING_CLIENT_RECT, parent, callback2id(cb)]),
    getScrollOffset: (
      parent: number,
      cb: (res: {
        scrollLeft: number
        scrollTop: number
        scrollWidth: number
        scrollHeight: number
      }) => void,
    ) => publish([ChannelEventType.GET_SCROLL_OFFSET, parent, callback2id(cb)]),
    getContext: (
      element: number,
      cb: (res: any) => void,
    ) => publish([ChannelEventType.GET_CONTEXT, element, callback2id(cb)]),

    initValues: (elementId: number, values: DataValue) => publish([ChannelEventType.INIT_VALUES, elementId, JSON.stringify(values)]),
    updateValues: (elementId: number, values: DataChange[]) => publish([ChannelEventType.UPDATE_VALUES, elementId, JSON.stringify(values)]),

    registerStyleSheetContent: (path: string, content: unknown) => publish([ChannelEventType.REGISTER_STYLE_SHEET_CONTENT, path, JSON.stringify(content)]),
    appendStyleSheetPath: (index: number, path: string, styleScope?: number) => publish([ChannelEventType.APPEND_STYLE_SHEET_PATH, index, path, styleScope]),
    disableStyleSheet: (index: number) => publish([ChannelEventType.DISABLE_STYLE_SHEET, index]),

    performanceStartTrace: (index: number) => publish([ChannelEventType.PERFORMANCE_START_TRACE, index]),
    performanceEndTrace: (id: number, cb: (stats: { startTimestamp: number; endTimestamp: number }) => void,) => publish([ChannelEventType.PERFORMANCE_END_TRACE, id, callback2id(cb)])
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
    ) => boolean | void,
  ) => void,
  controller: ViewController,
  idGenerator: () => IDGenerator,
) => {
  const nodeMap: Record<number, Node | Fragment | ShadowRoot | undefined> = []
  const eventIdGen = idGenerator()
  const eventIdMap = new WeakMap<Event<unknown>, number>()

  // eslint-disable-next-line consistent-return
  subscribe((arg) => {
    switch (arg[0]) {
      case ChannelEventType.CREATE: {
        const [, callbackId] = arg
        return controller.create(({ windowInfo, themeInfo }) => {
          publish([
            ChannelEventType.CREATE_CALLBACK,
            callbackId,
            windowInfo.width,
            windowInfo.height,
            windowInfo.devicePixelRatio,
            themeInfo.theme,
          ])
        })
      }
      case ChannelEventType.DESTROY:
        return controller.destroy()
      case ChannelEventType.INIT_DATA: {
        const [, initData] = arg
        return controller.initData(JSON.parse(initData))
      }
      case ChannelEventType.ON_WINDOW_RESIZE: {
        const [, callbackId] = arg
        return controller.onWindowResize(({ width, height, devicePixelRatio }) => {
          publish([
            ChannelEventType.ON_WINDOW_RESIZE_CALLBACK,
            callbackId,
            width,
            height,
            devicePixelRatio,
          ])
        })
      }
      case ChannelEventType.ON_THEME_CHANGE: {
        const [, callbackId] = arg
        return controller.onThemeChange(({ theme }) => {
          publish([ChannelEventType.ON_THEME_CHANGE_CALLBACK, callbackId, theme])
        })
      }
      case ChannelEventType.RENDER: {
        const [, callbackId] = arg
        return controller.render((err) => {
          publish([ChannelEventType.RENDER_CALLBACK, callbackId, err ? err.message : null])
        })
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
          external,
          virtualHost,
          styleScope,
          extraStyleScope,
          externalClasses,
          ownerShadowRootId,
        ] = arg
        const ownerShadowRoot = nodeMap[ownerShadowRootId] as ShadowRoot | undefined
        controller.createSimpleComponent(
          tagName,
          external,
          ownerShadowRoot,
          virtualHost,
          styleScope,
          extraStyleScope,
          externalClasses,
          undefined,
          (component) => {
            nodeMap[id] = component
            const shadowRoot = component.getShadowRoot()
            if (shadowRoot) {
              nodeMap[shadowRootId] = shadowRoot
              setNodeId(shadowRoot, shadowRootId)
            } else {
              // TODO external shadow root
              // const externalShadowRoot = component.shadowRoot as ExternalShadowRoot
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
        const node = nodeMap[id]!
        delete nodeMap[id]
        return controller.release(node)
      }
      case ChannelEventType.APPEND_CHILD: {
        const [, parentId, childId] = arg
        const parent = nodeMap[parentId] as Element | undefined
        const child = nodeMap[childId]! as Node
        return controller.appendChild(parent, child)
      }
      case ChannelEventType.REMOVE_CHILD: {
        const [, parentId, childId] = arg
        const parent = nodeMap[parentId] as Element | undefined
        const child = nodeMap[childId]! as Node
        return controller.removeChild(parent, child)
      }
      case ChannelEventType.INSERT_BEFORE: {
        const [, parentId, childId, beforeId] = arg
        const parent = nodeMap[parentId] as Element | undefined
        const child = nodeMap[childId]! as Node
        const before = nodeMap[beforeId]! as Node
        return controller.insertBefore(parent, child, before)
      }
      case ChannelEventType.REPLACE_CHILD: {
        const [, parentId, childId, oldChildId] = arg
        const parent = nodeMap[parentId] as Element | undefined
        const child = nodeMap[childId]! as Node
        const oldChild = nodeMap[oldChildId]! as Node
        return controller.replaceChild(parent, child, oldChild)
      }
      case ChannelEventType.SPLICE_BEFORE: {
        const [, parentId, beforeId, deleteCount, fragmentId] = arg
        const parent = nodeMap[parentId]! as Element
        const before = nodeMap[beforeId]! as Node
        const fragment = nodeMap[fragmentId]! as Fragment
        return controller.spliceBefore(parent, before, deleteCount, fragment)
      }
      case ChannelEventType.SPLICE_APPEND: {
        const [, parentId, fragmentId] = arg
        const parent = nodeMap[parentId]! as Element
        const fragment = nodeMap[fragmentId]! as Fragment
        return controller.spliceAppend(parent, fragment)
      }
      case ChannelEventType.SPLICE_REMOVE: {
        const [, parentId, startId, deleteCount] = arg
        const parent = nodeMap[parentId]! as Element
        const start = nodeMap[startId]! as Node
        return controller.spliceRemove(parent, start, deleteCount)
      }
      case ChannelEventType.ASSOCIATE_VALUE: {
        const [, nodeId, data] = arg
        const node = nodeMap[nodeId]! as Node
        return controller.associateValue(node, JSON.parse(data))
      }
      case ChannelEventType.SET_ID: {
        const [, elementId, id] = arg
        const element = nodeMap[elementId]! as Element
        return controller.setId(element, id)
      }
      case ChannelEventType.SET_SLOT_NAME: {
        const [, elementId, name] = arg
        const element = nodeMap[elementId]! as Element
        return controller.setSlotName(element, name)
      }
      case ChannelEventType.SET_CONTAINING_SLOT: {
        const [, nodeId, slotId] = arg
        const node = nodeMap[nodeId]! as Node
        const slot = typeof slotId === 'number' ? (nodeMap[slotId]! as Element) : slotId
        return controller.setContainingSlot(node, slot)
      }
      case ChannelEventType.REASSIGN_CONTAINING_SLOT: {
        const [, nodeId, oldSlotId, newSlotId] = arg
        const node = nodeMap[nodeId]! as Node
        const oldSlot = typeof oldSlotId === 'number' ? (nodeMap[oldSlotId]! as Element) : oldSlotId
        const newSlot = typeof newSlotId === 'number' ? (nodeMap[newSlotId]! as Element) : newSlotId
        return controller.reassignContainingSlot(node, oldSlot, newSlot)
      }
      case ChannelEventType.SPLICE_BEFORE_SLOT_NODES: {
        const [, slotId, before, count, listId] = arg
        const slot = typeof slotId === 'number' ? (nodeMap[slotId]! as Element) : slotId
        const list = nodeMap[listId] as Fragment
        return controller.spliceBeforeSlotNodes(slot, before, count, list)
      }
      case ChannelEventType.SPLICE_APPEND_SLOT_NODES: {
        const [, slotId, listId] = arg
        const slot = typeof slotId === 'number' ? (nodeMap[slotId]! as Element) : slotId
        const list = nodeMap[listId] as Fragment
        return controller.spliceAppendSlotNodes(slot, list)
      }
      case ChannelEventType.SPLICE_REMOVE_SLOT_NODES: {
        const [, slotId, before, count] = arg
        const slot = typeof slotId === 'number' ? (nodeMap[slotId]! as Element) : slotId
        return controller.spliceRemoveSlotNodes(slot, before, count)
      }
      case ChannelEventType.SET_INHERIT_SLOTS: {
        const [, elementId] = arg
        const element = nodeMap[elementId]! as Element
        return controller.setInheritSlots(element)
      }
      case ChannelEventType.REGISTER_STYLE_SCOPE: {
        const [, scopeId, stylePrefix] = arg
        return controller.registerStyleScope(scopeId, stylePrefix)
      }
      case ChannelEventType.SET_STYLE: {
        const [, elementId, styleText] = arg
        const element = nodeMap[elementId]! as Element
        return controller.setStyle(element, styleText)
      }
      case ChannelEventType.ADD_CLASS: {
        const [, elementId, className] = arg
        const element = nodeMap[elementId]! as Element
        return controller.addClass(element, className)
      }
      case ChannelEventType.REMOVE_CLASS: {
        const [, elementId, className] = arg
        const element = nodeMap[elementId]! as Element
        return controller.removeClass(element, className)
      }
      case ChannelEventType.CLEAR_CLASSES: {
        const [, elementId] = arg
        const element = nodeMap[elementId]! as Element
        return controller.clearClasses(element)
      }
      case ChannelEventType.SET_CLASS_ALIAS: {
        const [, elementId, className, target] = arg
        const element = nodeMap[elementId]! as GeneralComponent
        return controller.setClassAlias(element, className, target)
      }
      case ChannelEventType.SET_ATTRIBUTE: {
        const [, elementId, name, value] = arg
        const element = nodeMap[elementId]! as Element
        return controller.setAttribute(element, name, value)
      }
      case ChannelEventType.REMOVE_ATTRIBUTE: {
        const [, elementId, name] = arg
        const element = nodeMap[elementId]! as Element
        return controller.removeAttribute(element, name)
      }
      case ChannelEventType.SET_DATASET: {
        const [, elementId, name, value] = arg
        const element = nodeMap[elementId]! as Element
        return controller.setDataset(element, name, value)
      }
      case ChannelEventType.SET_TEXT: {
        const [, textNodeId, textContent] = arg
        const textNode = nodeMap[textNodeId]! as TextNode
        return controller.setText(textNode, textContent)
      }
      case ChannelEventType.SET_LISTENER_STATS: {
        const [, elementId, type, capture, mutLevel] = arg
        const element = nodeMap[elementId]! as Element
        return controller.setListenerStats(element, type, capture, mutLevel, (shadowedEvent) => {
          // ShadowedEvent is fresh created for each target
          // We should check it's prototype
          const event = Object.getPrototypeOf(shadowedEvent) as Event<unknown>
          const targetId = getNodeId(shadowedEvent.target)
          const currentTargetId = getNodeId(shadowedEvent.currentTarget)
          if (typeof targetId !== 'number' || typeof currentTargetId !== 'number') return

          if (!eventIdMap.has(event)) {
            const eventId = eventIdGen.gen()
            publish([
              ChannelEventType.ON_CREATE_EVENT,
              eventId,
              event.type,
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
        })
      }
      case ChannelEventType.SET_MODEL_BINDING_STAT: {
        const [, elementId, attributeName, listenerId] = arg
        const element = nodeMap[elementId]! as NativeNode
        if (!listenerId) {
          throw new Error('missing listenerId for setModelBindingStat')
        }
        return controller.setModelBindingStat(element, attributeName, (newValue) => {
          publish([
            ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK,
            listenerId,
            JSON.stringify(newValue),
          ])
        })
      }
      case ChannelEventType.GET_BOUNDING_CLIENT_RECT: {
        const [, elementId, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        return controller.getBoundingClientRect(element, (res) => {
          publish([
            ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK,
            callbackId,
            res.left,
            res.top,
            res.width,
            res.height,
          ])
        })
      }
      case ChannelEventType.GET_SCROLL_OFFSET: {
        const [, elementId, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        return controller.getScrollOffset(element, (res) => {
          publish([
            ChannelEventType.GET_SCROLL_OFFSET_CALLBACK,
            callbackId,
            res.scrollLeft,
            res.scrollTop,
            res.scrollWidth,
            res.scrollHeight,
          ])
        })
      }
      case ChannelEventType.GET_CONTEXT: {
        const [, elementId, callbackId] = arg
        const element = nodeMap[elementId]! as Element
        return controller.getContext(element, (res) => {
          publish([ChannelEventType.GET_CONTEXT_CALLBACK, callbackId, JSON.stringify(res)])
        })
      }
      case ChannelEventType.INIT_VALUES: {
        const [, elementId, values] = arg
        const element = nodeMap[elementId]! as Element
        return controller.initValues(element, JSON.parse(values))
      }
      case ChannelEventType.UPDATE_VALUES: {
        const [, elementId, values] = arg
        const element = nodeMap[elementId]! as Element
        return controller.updateValues(element, JSON.parse(values))
      }
      case ChannelEventType.REGISTER_STYLE_SHEET_CONTENT: {
        const [, path, content] = arg
        return controller.registerStyleSheetContent(path, JSON.parse(content))
      }
      case ChannelEventType.APPEND_STYLE_SHEET_PATH: {
        const [, index, path, styleScope] = arg
        return controller.appendStyleSheetPath(index, path, styleScope)
      }
      case ChannelEventType.DISABLE_STYLE_SHEET: {
        const [, index] = arg
        return controller.disableStyleSheet(index)
      }
      case ChannelEventType.PERFORMANCE_START_TRACE: {
        const [, index] = arg
        return controller.performanceStartTrace(index)
      }
      case ChannelEventType.PERFORMANCE_END_TRACE: {
        const [, index, callbackId] = arg
        return controller.performanceEndTrace(index, (stats) => {
          publish([
            ChannelEventType.PERFORMANCE_STATS_CALLBACK,
            callbackId,
            stats.startTimestamp,
            stats.endTimestamp,
          ])
        })
      }
      default:
        throw assertUnreachable(arg[0])
    }
  })

  return {
    getNode: (id: number) => nodeMap[id],
  }
}
