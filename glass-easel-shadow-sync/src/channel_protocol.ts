/*
 * Wire vocabulary shared by both sides of a shadow-sync channel.
 *
 * Every operation that can cross the channel has an opcode in
 * `ChannelEventType`. The data side issues DOM operations and requests, the view
 * side answers with callbacks and events; `ChannelEventTypeDataSide` and
 * `ChannelEventTypeViewSide` pin down which side may send what.
 *
 * `ChannelEventHandlers` is the single source of truth for the arguments of an
 * operation: the publishing side derives its typed `publish(OP, ...args)` from
 * it, the receiving side has to implement every entry of it, and `ARITY` is
 * checked against it by `satisfies`. Adding or changing an operation therefore
 * fails to compile until every place is updated.
 */

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
  CREATE_RESIZE_OBSERVER,
  RESIZE_OBSERVER_CALLBACK,
  DISCONNECT_OBSERVER,
  ELEMENT_FROM_POINT,
  ELEMENT_FROM_POINT_CALLBACK,

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
  GET_PARTIAL_COMPUTED_STYLES,
  GET_PSEUDO_COMPUTED_STYLES,
  GET_PARTIAL_PSEUDO_COMPUTED_STYLES,
  GET_COMPUTED_STYLES_CALLBACK,
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
  TRIGGER_NATIVE_EVENT,
  MANIPULATE_NATIVE_NODE,
  MANIPULATE_NATIVE_NODE_CALLBACK,
  GET_ACTIVE_ELEMENT,
  GET_ACTIVE_ELEMENT_CALLBACK,

  PERFORMANCE_START_TRACE,
  PERFORMANCE_END_TRACE,
  PERFORMANCE_STATS_CALLBACK,

  INSERT_DYNAMIC_SLOT,
  UPDATE_DYNAMIC_SLOT,
  REMOVE_DYNAMIC_SLOT,

  CUSTOM_METHOD,
}

/** Operations sent by the view side: callbacks, events and view-initiated requests. */
export type ChannelEventTypeViewSide =
  | ChannelEventType.CREATE_CALLBACK
  | ChannelEventType.ON_WINDOW_RESIZE_CALLBACK
  | ChannelEventType.ON_THEME_CHANGE_CALLBACK
  | ChannelEventType.RENDER_CALLBACK
  | ChannelEventType.MEDIA_QUERY_OBSERVER_CALLBACK
  | ChannelEventType.INTERSECTION_OBSERVER_CALLBACK
  | ChannelEventType.RESIZE_OBSERVER_CALLBACK
  | ChannelEventType.ELEMENT_FROM_POINT_CALLBACK
  | ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK
  | ChannelEventType.GET_COMPUTED_STYLES_CALLBACK
  | ChannelEventType.GET_INHERITED_RULES_CALLBACK
  | ChannelEventType.GET_MATCHED_RULES_CALLBACK
  | ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES_CALLBACK
  | ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK
  | ChannelEventType.GET_SCROLL_OFFSET_CALLBACK
  | ChannelEventType.GET_BOX_MODEL_CALLBACK
  | ChannelEventType.GET_PSEUDO_TYPES_CALLBACK
  | ChannelEventType.START_OVERLAY_INSPECT_CALLBACK
  | ChannelEventType.MANIPULATE_NATIVE_NODE_CALLBACK
  | ChannelEventType.GET_ACTIVE_ELEMENT_CALLBACK
  | ChannelEventType.GET_CONTEXT_CALLBACK
  | ChannelEventType.ON_CREATE_EVENT
  | ChannelEventType.ON_EVENT
  | ChannelEventType.ON_RELEASE_EVENT
  | ChannelEventType.PERFORMANCE_STATS_CALLBACK
  | ChannelEventType.INSERT_DYNAMIC_SLOT
  | ChannelEventType.UPDATE_DYNAMIC_SLOT
  | ChannelEventType.REMOVE_DYNAMIC_SLOT
  | ChannelEventType.CUSTOM_METHOD

/** Operations sent by the logic side. */
export type ChannelEventTypeDataSide =
  | Exclude<ChannelEventType, ChannelEventTypeViewSide>
  | ChannelEventType.CUSTOM_METHOD

/**
 * A string argument in the compact stream form.
 *
 * The transport replaces every string argument with a reference into its
 * per-channel string table, encoded as the negative number `-1 - id`. The type
 * is branded so a reference cannot be mixed up with a node / callback id at a
 * call site; handlers decode it back with `TransportBridge.decodeString`.
 */
export type StringRef = number & { _: symbol }

/**
 * Argument signatures of every operation, as seen by the receiving side.
 *
 * The publishing side asks for the subset it may send (`Publisher` turns an
 * entry into `publish(OP, ...args)`) and the receiving side implements the
 * whole subset it may receive (`SideHandlers`). Both therefore agree on the
 * order of the arguments, which is also the order they occupy in the stream.
 */
export type ChannelEventHandlers = {
  [ChannelEventType.CREATE]: (callbackId: number) => void
  [ChannelEventType.CREATE_CALLBACK]: (
    callbackId: number,
    width: number,
    height: number,
    devicePixelRatio: number,
    theme: string,
  ) => void
  [ChannelEventType.DESTROY]: () => void

  [ChannelEventType.ON_WINDOW_RESIZE]: (callbackId: number) => void
  [ChannelEventType.ON_WINDOW_RESIZE_CALLBACK]: (
    callbackId: number,
    width: number,
    height: number,
    devicePixelRatio: number,
  ) => void
  [ChannelEventType.ON_THEME_CHANGE]: (callbackId: number) => void
  [ChannelEventType.ON_THEME_CHANGE_CALLBACK]: (callbackId: number, theme: string) => void
  [ChannelEventType.RENDER]: (callbackId: number) => void
  [ChannelEventType.RENDER_CALLBACK]: (callbackId: number, errMessage: string | null) => void
  [ChannelEventType.CREATE_MEDIA_QUERY_OBSERVER]: (status: string, callbackId: number) => void
  [ChannelEventType.MEDIA_QUERY_OBSERVER_CALLBACK]: (callbackId: number, status: string) => void
  [ChannelEventType.CREATE_INTERSECTION_OBSERVER]: (
    targetId: number,
    relativeElementId: number | null,
    relativeElementMargin: string,
    thresholds: number[],
    callbackId: number,
  ) => void
  [ChannelEventType.INTERSECTION_OBSERVER_CALLBACK]: (callbackId: number, status: string) => void
  [ChannelEventType.CREATE_RESIZE_OBSERVER]: (
    targetId: number,
    mode: number,
    callbackId: number,
  ) => void
  [ChannelEventType.RESIZE_OBSERVER_CALLBACK]: (callbackId: number, status: string) => void
  [ChannelEventType.DISCONNECT_OBSERVER]: (callbackId: number) => void
  [ChannelEventType.ELEMENT_FROM_POINT]: (x: number, y: number, callbackId: number) => void
  [ChannelEventType.ELEMENT_FROM_POINT_CALLBACK]: (
    callbackId: number,
    elementId: number | null,
  ) => void

  [ChannelEventType.CREATE_ELEMENT]: (
    id: number,
    logicalName: StringRef,
    stylingName: StringRef,
    ownerShadowRootId: number,
  ) => void
  [ChannelEventType.CREATE_COMPONENT]: (
    id: number,
    shadowRootId: number,
    tagName: StringRef,
    virtualHost: boolean,
    styleScope: number,
    extraStyleScope: number | null,
    externalClasses: StringRef[] | undefined,
    slotMode: number | null,
    writeIdToDOM: boolean,
    ownerShadowRootId: number,
  ) => void
  [ChannelEventType.CREATE_TEXT_NODE]: (
    id: number,
    textContent: string,
    ownerShadowRootId: number,
  ) => void
  [ChannelEventType.CREATE_VIRTUAL_NODE]: (
    id: number,
    virtualName: StringRef,
    ownerShadowRootId: number,
  ) => void
  [ChannelEventType.CREATE_FRAGMENT]: (id: number) => void
  [ChannelEventType.RELEASE]: (id: number) => void

  [ChannelEventType.APPEND_CHILD]: (parentId: number, childId: number) => void
  [ChannelEventType.REMOVE_CHILD]: (parentId: number, childId: number) => void
  [ChannelEventType.INSERT_BEFORE]: (parentId: number, childId: number, beforeId: number) => void
  [ChannelEventType.REPLACE_CHILD]: (parentId: number, childId: number, oldChildId: number) => void
  [ChannelEventType.SPLICE_BEFORE]: (
    parentId: number,
    beforeId: number,
    deleteCount: number,
    fragmentId: number,
  ) => void
  [ChannelEventType.SPLICE_APPEND]: (parentId: number, fragmentId: number) => void
  [ChannelEventType.SPLICE_REMOVE]: (parentId: number, startId: number, deleteCount: number) => void

  [ChannelEventType.SET_ID]: (elementId: number, id: StringRef) => void
  [ChannelEventType.SET_SLOT]: (elementId: number, name: StringRef) => void
  [ChannelEventType.SET_SLOT_NAME]: (elementId: number, name: StringRef) => void
  [ChannelEventType.SET_SLOT_ELEMENT]: (nodeId: number, slotId: number | null) => void
  [ChannelEventType.SET_INHERIT_SLOTS]: (elementId: number) => void
  [ChannelEventType.REGISTER_STYLE_SCOPE]: (
    scopeId: number,
    stylePrefix: string | undefined,
  ) => void
  [ChannelEventType.SET_STYLE]: (
    elementId: number,
    styleText: string,
    styleSegmentIndex: number,
  ) => void
  [ChannelEventType.ADD_CLASS]: (elementId: number, className: StringRef) => void
  [ChannelEventType.REMOVE_CLASS]: (elementId: number, className: StringRef) => void
  [ChannelEventType.SET_CLASS_ALIAS]: (
    elementId: number,
    className: StringRef,
    target: StringRef[],
  ) => void
  [ChannelEventType.SET_ATTRIBUTE]: (elementId: number, name: StringRef, value: unknown) => void
  [ChannelEventType.REMOVE_ATTRIBUTE]: (elementId: number, name: StringRef) => void
  [ChannelEventType.SET_DATASET]: (elementId: number, name: StringRef, value: unknown) => void
  [ChannelEventType.SET_TEXT]: (textNodeId: number, textContent: string) => void
  [ChannelEventType.SET_LISTENER_STATS]: (
    elementId: number,
    eventName: StringRef,
    capture: boolean,
    mutLevel: number,
  ) => void

  [ChannelEventType.SET_MODEL_BINDING_STAT]: (
    elementId: number,
    attributeName: StringRef,
    listenerId: number | null,
  ) => void
  [ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK]: (callbackId: number, value: string) => void
  [ChannelEventType.GET_CONTEXT]: (elementId: number, callbackId: number) => void
  [ChannelEventType.GET_CONTEXT_CALLBACK]: (callbackId: number, res: string) => void

  [ChannelEventType.ON_CREATE_EVENT]: (
    eventId: number,
    eventName: StringRef,
    detail: string,
    options: string,
    currentTargetId: number,
    mark: string,
    targetId: number,
    capture: boolean,
  ) => void
  [ChannelEventType.ON_EVENT]: (
    eventId: number,
    currentTargetId: number,
    mark: string,
    targetId: number,
    capture: boolean,
  ) => void
  [ChannelEventType.ON_RELEASE_EVENT]: (eventId: number) => void

  [ChannelEventType.ASSOCIATE_VALUE]: (nodeId: number, data: StringRef) => void

  [ChannelEventType.INIT_VALUES]: (elementId: number, values: string) => void
  [ChannelEventType.UPDATE_VALUES]: (elementId: number, values: string) => void

  [ChannelEventType.REGISTER_STYLE_SHEET_CONTENT]: (path: string, content: string) => void
  [ChannelEventType.APPEND_STYLE_SHEET_PATH]: (
    index: number,
    path: string,
    styleScope: number | undefined,
  ) => void
  [ChannelEventType.DISABLE_STYLE_SHEET]: (index: number) => void

  [ChannelEventType.PERFORMANCE_START_TRACE]: (index: number) => void
  [ChannelEventType.PERFORMANCE_END_TRACE]: (index: number, callbackId: number) => void
  [ChannelEventType.PERFORMANCE_STATS_CALLBACK]: (
    callbackId: number,
    startTimestamp: number,
    endTimestamp: number,
  ) => void

  [ChannelEventType.GET_ALL_COMPUTED_STYLES]: (elementId: number, callbackId: number) => void
  [ChannelEventType.GET_PARTIAL_COMPUTED_STYLES]: (
    elementId: number,
    properties: string[],
    callbackId: number,
  ) => void
  [ChannelEventType.GET_PSEUDO_COMPUTED_STYLES]: (
    elementId: number,
    pseudoType: string,
    callbackId: number,
  ) => void
  [ChannelEventType.GET_PARTIAL_PSEUDO_COMPUTED_STYLES]: (
    elementId: number,
    pseudoType: string,
    properties: string[],
    callbackId: number,
  ) => void
  [ChannelEventType.GET_COMPUTED_STYLES_CALLBACK]: (callbackId: number, styles: string) => void
  [ChannelEventType.GET_INHERITED_RULES]: (elementId: number, callbackId: number) => void
  [ChannelEventType.GET_INHERITED_RULES_CALLBACK]: (callbackId: number, rules: string) => void
  [ChannelEventType.GET_MATCHED_RULES]: (elementId: number, callbackId: number) => void
  [ChannelEventType.GET_MATCHED_RULES_CALLBACK]: (callbackId: number, rules: string) => void
  [ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES]: (
    sheetIndex: number,
    ruleIndex: number,
    inlineStyle: string,
    callbackId: number,
  ) => void
  [ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES_CALLBACK]: (
    callbackId: number,
    propertyIndex: number | null,
  ) => void
  [ChannelEventType.GET_BOUNDING_CLIENT_RECT]: (elementId: number, callbackId: number) => void
  [ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK]: (
    callbackId: number,
    left: number,
    top: number,
    width: number,
    height: number,
  ) => void
  [ChannelEventType.GET_SCROLL_OFFSET]: (elementId: number, callbackId: number) => void
  [ChannelEventType.GET_SCROLL_OFFSET_CALLBACK]: (
    callbackId: number,
    scrollLeft: number,
    scrollTop: number,
    scrollWidth: number,
    scrollHeight: number,
  ) => void
  [ChannelEventType.SET_SCROLL_POSITION]: (
    elementId: number,
    scrollLeft: number,
    scrollTop: number,
    duration: number,
  ) => void
  [ChannelEventType.GET_BOX_MODEL]: (elementId: number, callbackId: number) => void
  [ChannelEventType.GET_BOX_MODEL_CALLBACK]: (callbackId: number, boxModel: string) => void
  [ChannelEventType.GET_PSEUDO_TYPES]: (elementId: number, callbackId: number) => void
  [ChannelEventType.GET_PSEUDO_TYPES_CALLBACK]: (callbackId: number, pseudoTypes: string[]) => void
  [ChannelEventType.START_OVERLAY_INSPECT]: (callbackId: number) => void
  [ChannelEventType.START_OVERLAY_INSPECT_CALLBACK]: (
    callbackId: number,
    event: string,
    elementId: number | null,
  ) => void
  [ChannelEventType.STOP_OVERLAY_INSPECT]: () => void
  [ChannelEventType.TRIGGER_NATIVE_EVENT]: (
    elementId: number,
    event: string,
    detail: string,
  ) => void
  [ChannelEventType.MANIPULATE_NATIVE_NODE]: (
    elementId: number,
    action: string,
    args: string,
    callbackId: number,
  ) => void
  [ChannelEventType.MANIPULATE_NATIVE_NODE_CALLBACK]: (callbackId: number, res: string) => void
  [ChannelEventType.GET_ACTIVE_ELEMENT]: (callbackId: number) => void
  [ChannelEventType.GET_ACTIVE_ELEMENT_CALLBACK]: (
    callbackId: number,
    elementId: number | null,
  ) => void

  [ChannelEventType.INSERT_DYNAMIC_SLOT]: (
    elementId: number,
    slots: [number, StringRef, string][],
  ) => void
  [ChannelEventType.UPDATE_DYNAMIC_SLOT]: (
    slotId: number,
    slotValues: string,
    changedNames: StringRef[],
  ) => void
  [ChannelEventType.REMOVE_DYNAMIC_SLOT]: (slotIds: number[]) => void

  [ChannelEventType.CUSTOM_METHOD]: (elementId: number | null, options: unknown) => void
}

/**
 * Fixed number of arguments of each operation (the opcode itself excluded).
 *
 * This table is the single source of truth for how many slots an operation
 * occupies in the flat stream. The transport dispatches by arity instead of by
 * opcode (see `StreamTransportBridge.subscribeHandler`), so the table is also
 * what keeps the unrolled dispatch switch in sync. It is tied to
 * `ChannelEventHandlers` by `satisfies`, so adding an operation or changing its
 * signature without updating the table is a compile-time error.
 */
export const ARITY = {
  [ChannelEventType.CREATE]: 1,
  [ChannelEventType.CREATE_CALLBACK]: 5,
  [ChannelEventType.DESTROY]: 0,

  [ChannelEventType.ON_WINDOW_RESIZE]: 1,
  [ChannelEventType.ON_WINDOW_RESIZE_CALLBACK]: 4,
  [ChannelEventType.ON_THEME_CHANGE]: 1,
  [ChannelEventType.ON_THEME_CHANGE_CALLBACK]: 2,
  [ChannelEventType.RENDER]: 1,
  [ChannelEventType.RENDER_CALLBACK]: 2,
  [ChannelEventType.CREATE_MEDIA_QUERY_OBSERVER]: 2,
  [ChannelEventType.MEDIA_QUERY_OBSERVER_CALLBACK]: 2,
  [ChannelEventType.CREATE_INTERSECTION_OBSERVER]: 5,
  [ChannelEventType.INTERSECTION_OBSERVER_CALLBACK]: 2,
  [ChannelEventType.CREATE_RESIZE_OBSERVER]: 3,
  [ChannelEventType.RESIZE_OBSERVER_CALLBACK]: 2,
  [ChannelEventType.DISCONNECT_OBSERVER]: 1,
  [ChannelEventType.ELEMENT_FROM_POINT]: 3,
  [ChannelEventType.ELEMENT_FROM_POINT_CALLBACK]: 2,

  [ChannelEventType.CREATE_ELEMENT]: 4,
  [ChannelEventType.CREATE_COMPONENT]: 10,
  [ChannelEventType.CREATE_TEXT_NODE]: 3,
  [ChannelEventType.CREATE_VIRTUAL_NODE]: 3,
  [ChannelEventType.CREATE_FRAGMENT]: 1,
  [ChannelEventType.RELEASE]: 1,

  [ChannelEventType.APPEND_CHILD]: 2,
  [ChannelEventType.REMOVE_CHILD]: 2,
  [ChannelEventType.INSERT_BEFORE]: 3,
  [ChannelEventType.REPLACE_CHILD]: 3,
  [ChannelEventType.SPLICE_BEFORE]: 4,
  [ChannelEventType.SPLICE_APPEND]: 2,
  [ChannelEventType.SPLICE_REMOVE]: 3,

  [ChannelEventType.SET_ID]: 2,
  [ChannelEventType.SET_SLOT]: 2,
  [ChannelEventType.SET_SLOT_NAME]: 2,
  [ChannelEventType.SET_SLOT_ELEMENT]: 2,
  [ChannelEventType.SET_INHERIT_SLOTS]: 1,
  [ChannelEventType.REGISTER_STYLE_SCOPE]: 2,
  [ChannelEventType.SET_STYLE]: 3,
  [ChannelEventType.ADD_CLASS]: 2,
  [ChannelEventType.REMOVE_CLASS]: 2,
  [ChannelEventType.SET_CLASS_ALIAS]: 3,
  [ChannelEventType.SET_ATTRIBUTE]: 3,
  [ChannelEventType.REMOVE_ATTRIBUTE]: 2,
  [ChannelEventType.SET_DATASET]: 3,
  [ChannelEventType.SET_TEXT]: 2,
  [ChannelEventType.SET_LISTENER_STATS]: 4,

  [ChannelEventType.SET_MODEL_BINDING_STAT]: 3,
  [ChannelEventType.SET_MODEL_BINDING_STAT_CALLBACK]: 2,
  [ChannelEventType.GET_CONTEXT]: 2,
  [ChannelEventType.GET_CONTEXT_CALLBACK]: 2,

  [ChannelEventType.ON_CREATE_EVENT]: 8,
  [ChannelEventType.ON_EVENT]: 5,
  [ChannelEventType.ON_RELEASE_EVENT]: 1,

  [ChannelEventType.ASSOCIATE_VALUE]: 2,

  [ChannelEventType.INIT_VALUES]: 2,
  [ChannelEventType.UPDATE_VALUES]: 2,

  [ChannelEventType.REGISTER_STYLE_SHEET_CONTENT]: 2,
  [ChannelEventType.APPEND_STYLE_SHEET_PATH]: 3,
  [ChannelEventType.DISABLE_STYLE_SHEET]: 1,

  [ChannelEventType.PERFORMANCE_START_TRACE]: 1,
  [ChannelEventType.PERFORMANCE_END_TRACE]: 2,
  [ChannelEventType.PERFORMANCE_STATS_CALLBACK]: 3,

  [ChannelEventType.GET_ALL_COMPUTED_STYLES]: 2,
  [ChannelEventType.GET_PARTIAL_COMPUTED_STYLES]: 3,
  [ChannelEventType.GET_PSEUDO_COMPUTED_STYLES]: 3,
  [ChannelEventType.GET_PARTIAL_PSEUDO_COMPUTED_STYLES]: 4,
  [ChannelEventType.GET_COMPUTED_STYLES_CALLBACK]: 2,
  [ChannelEventType.GET_INHERITED_RULES]: 2,
  [ChannelEventType.GET_INHERITED_RULES_CALLBACK]: 2,
  [ChannelEventType.GET_MATCHED_RULES]: 2,
  [ChannelEventType.GET_MATCHED_RULES_CALLBACK]: 2,
  [ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES]: 4,
  [ChannelEventType.REPLACE_STYLE_SHEET_ALL_PROPERTIES_CALLBACK]: 2,
  [ChannelEventType.GET_BOUNDING_CLIENT_RECT]: 2,
  [ChannelEventType.GET_BOUNDING_CLIENT_RECT_CALLBACK]: 5,
  [ChannelEventType.GET_SCROLL_OFFSET]: 2,
  [ChannelEventType.GET_SCROLL_OFFSET_CALLBACK]: 5,
  [ChannelEventType.SET_SCROLL_POSITION]: 4,
  [ChannelEventType.GET_BOX_MODEL]: 2,
  [ChannelEventType.GET_BOX_MODEL_CALLBACK]: 2,
  [ChannelEventType.GET_PSEUDO_TYPES]: 2,
  [ChannelEventType.GET_PSEUDO_TYPES_CALLBACK]: 2,
  [ChannelEventType.START_OVERLAY_INSPECT]: 1,
  [ChannelEventType.START_OVERLAY_INSPECT_CALLBACK]: 3,
  [ChannelEventType.STOP_OVERLAY_INSPECT]: 0,
  [ChannelEventType.TRIGGER_NATIVE_EVENT]: 3,
  [ChannelEventType.MANIPULATE_NATIVE_NODE]: 4,
  [ChannelEventType.MANIPULATE_NATIVE_NODE_CALLBACK]: 2,
  [ChannelEventType.GET_ACTIVE_ELEMENT]: 1,
  [ChannelEventType.GET_ACTIVE_ELEMENT_CALLBACK]: 2,

  [ChannelEventType.INSERT_DYNAMIC_SLOT]: 2,
  [ChannelEventType.UPDATE_DYNAMIC_SLOT]: 3,
  [ChannelEventType.REMOVE_DYNAMIC_SLOT]: 1,

  [ChannelEventType.CUSTOM_METHOD]: 2,
} as const satisfies {
  [K in ChannelEventType]: Parameters<ChannelEventHandlers[K]>['length']
}
