/* eslint-disable @typescript-eslint/no-unsafe-return */

import * as backend from './backend/backend_protocol'
import * as composedBackend from './backend/composed_backend_protocol'
import * as domlikeBackend from './backend/domlike_backend_protocol'
import { FuncArr, GeneralFuncType, safeCallback, triggerWarning } from './func_arr'
import { Element } from './element'
import {
  globalOptions,
  normalizeComponentOptions,
  NormalizedComponentOptions,
  getDefaultComponentSpace,
  getDefaultBackendContext,
} from './global_options'
import { ShadowRoot } from './shadow_root'
import {
  ComponentInstance,
  ComponentParams,
  DataList,
  PropertyList,
  MethodList,
  DataWithPropertyValues,
  RelationParams,
  TraitRelationParams,
  ComponentMethod,
  TaggedMethod,
  METHOD_TAG,
  DeepReadonly,
  GetFromDataPath,
  SetDataSetter,
} from './component_params'
import {
  Behavior,
  GeneralBehavior,
  ComponentDefinitionWithPlaceholder,
  RelationHandler,
  normalizeRelation,
  BuilderContext,
  NativeNodeDefinition,
} from './behavior'
import { ComponentSpace } from './component_space'
import { simpleDeepCopy } from './data_utils'
import {
  DataGroup,
  DataGroupObserverTree,
  DataValue,
  DeepCopyStrategy,
  getDeepCopyStrategy,
} from './data_proxy'
import { Relation, generateRelationDefinitionGroup, RelationDefinitionGroup } from './relation'
import { Template, TemplateEngine, TemplateInstance } from './template_engine'
import { ClassList } from './class_list'
import { GeneralBackendContext, GeneralBackendElement } from './node'
import { DataPath, parseSinglePath, parseMultiPaths } from './data_path'
import { ExternalShadowRoot } from './external_shadow_tree'
import { BM, BackendMode } from './backend/mode'
import { EventListener, EventListenerOptions } from './event'
import { TraitBehavior, TraitGroup } from './trait_behaviors'

export const convertGenerics = (
  compDef: GeneralComponentDefinition,
  sourceBehavior: GeneralBehavior,
  owner?: GeneralComponent,
  genericTargets?: { [key: string]: string | ComponentDefinitionWithPlaceholder },
): { [key: string]: ComponentDefinitionWithPlaceholder } | null => {
  const space = sourceBehavior.ownerSpace
  const hostUsing = owner?._$behavior._$using
  const hostGenericImpls = owner?._$genericImpls
  if (!compDef._$detail) compDef.prepare()
  const childBeh = compDef.behavior
  let genericImpls: { [key: string]: ComponentDefinitionWithPlaceholder } | null
  const generics = childBeh._$generics
  if (generics) {
    const genericDefaults = childBeh._$genericDefaults!
    genericImpls = Object.create(null) as { [key: string]: ComponentDefinitionWithPlaceholder }
    for (let i = 0; i < generics.length; i += 1) {
      const key = generics[i]!
      if (genericTargets && Object.prototype.hasOwnProperty.call(genericTargets, key)) {
        const target = genericTargets[key]!
        if (typeof target === 'string') {
          if (hostUsing?.[target]) {
            genericImpls[key] = hostUsing[target]!
          } else if (hostGenericImpls && hostGenericImpls[target]) {
            genericImpls[key] = hostGenericImpls[target]!
          } else {
            const comp = space.getGlobalUsingComponent(target)
            if (typeof comp === 'string') {
              genericImpls[key] = comp
            } else if (comp) {
              genericImpls[key] = {
                final: comp,
                source: sourceBehavior,
                placeholder: null,
                waiting: null,
              }
            } else {
              triggerWarning(
                `Generic "${key}" value "${target}" is not valid (on component "${compDef.is}").`,
              )
              const defaultComp = space.getDefaultComponent()
              if (!defaultComp) {
                throw new Error(
                  `Cannot find default component for generic "${key}" (on component "${compDef.is}")`,
                )
              }
              genericImpls[key] = {
                final: defaultComp,
                source: sourceBehavior,
                placeholder: null,
                waiting: null,
              }
            }
          }
        } else {
          genericImpls[key] = target
        }
      } else {
        const defaultComp = genericDefaults[key] || space.getDefaultComponent()
        if (!defaultComp) {
          throw new Error(
            `Cannot find default component for generic "${key}" (on component "${compDef.is}")`,
          )
        }
        genericImpls[key] =
          typeof defaultComp === 'string'
            ? defaultComp
            : {
                final: defaultComp,
                source: sourceBehavior,
                placeholder: null,
                waiting: null,
              }
      }
    }
  } else {
    genericImpls = null
  }
  return genericImpls
}

export const resolvePlaceholder = (
  placeholder: string,
  space: ComponentSpace,
  behavior: GeneralBehavior,
  genericImpls: { [key: string]: ComponentDefinitionWithPlaceholder } | null,
): GeneralComponentDefinition | NativeNodeDefinition => {
  const using = behavior._$using
  const usingTarget = using[placeholder] || (genericImpls && genericImpls[placeholder])
  let ret: GeneralComponentDefinition | NativeNodeDefinition | null = null
  if (usingTarget) {
    if (typeof usingTarget === 'string') {
      ret = usingTarget
    } else if (usingTarget.placeholder === null) {
      ret = usingTarget.final
    } else {
      triggerWarning(
        `Placeholder on generic implementation is not valid (on component "${behavior.is}")`,
      )
    }
  }
  if (ret) return ret
  const comp = space.getGlobalUsingComponent(placeholder) ?? space.getDefaultComponent()
  if (!comp) {
    throw new Error(
      `Cannot find default component for placeholder target "${placeholder}" (on component "${behavior.is}")`,
    )
  }
  return comp
}

export type Lifetimes = {
  created: () => void
  attached: () => void
  moved: () => void
  detached: () => void
  ready: () => void
  listenerChange: (
    isAdd: boolean,
    name: string,
    func: EventListener<unknown>,
    options: EventListenerOptions | undefined,
  ) => void
  workletChange: (name: string, value: unknown) => void
}

export type LifetimeFuncs = {
  [name in keyof Lifetimes]?: FuncArr<Lifetimes[name]>
} & Record<string, FuncArr<GeneralFuncType>>

export type PageLifetimeFuncs = {
  [name: string]: FuncArr<GeneralFuncType>
}

type ComponentDefinitionDetail<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
> = {
  proto: ComponentInstProto<TData, TProperty, TMethod>
  template: Template
  dataGroupObserverTree: DataGroupObserverTree
  dataDeepCopy: DeepCopyStrategy
  propertyPassingDeepCopy: DeepCopyStrategy
  relationDefinitionGroup: RelationDefinitionGroup | null
}

export class ComponentDefinition<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
> {
  is: string
  behavior: Behavior<TData, TProperty, TMethod, any>
  /** @internal */
  _$detail: ComponentDefinitionDetail<TData, TProperty, TMethod> | null
  /** @internal */
  _$options: NormalizedComponentOptions
  /** @internal */
  private _$templateEngine: TemplateEngine

  /** @internal */
  constructor(behavior: Behavior<TData, TProperty, TMethod, any>) {
    this.behavior = behavior
    this.is = this.behavior.is
    this._$detail = null
    this._$options = normalizeComponentOptions(
      behavior._$options,
      behavior.ownerSpace.getComponentOptions(),
    )
    const templateEngine = this._$options.templateEngine
    this._$templateEngine = templateEngine
  }

  general(): GeneralComponentDefinition {
    return this as unknown as GeneralComponentDefinition
  }

  /** Get the normalized component options */
  getComponentOptions(): NormalizedComponentOptions {
    return this._$options
  }

  /**
   * List all component dependencies (recursively)
   *
   * This method will prepare the underlying behavior.
   * The caller component is not included in the result.
   */
  getComponentDependencies(): Set<GeneralComponentDefinition> {
    return this.behavior.getComponentDependencies()
  }

  /**
   * Update the template field
   *
   * This method has no effect if the template engine does not support template update.
   */
  updateTemplate(template: { [key: string]: unknown }) {
    this.behavior._$updateTemplate(template)
    if (this._$detail?.template.updateTemplate) {
      this._$detail.template.updateTemplate(this.behavior as unknown as GeneralBehavior)
    } else {
      triggerWarning(
        `The template engine of component "${this.is}" does not support template update`,
      )
    }
  }

  isPrepared(): boolean {
    return !!this._$detail
  }

  prepare() {
    if (this._$detail) return
    this.behavior.prepare()
    const behavior = this.behavior
    const options = this._$options
    const propSetters = {} as {
      constructor: {
        writable: true
        value: () => void
      }
      [key: string]:
        | {
            enumerable: boolean
            get: (this: Component<TData, TProperty, TMethod>) => unknown
            set: (this: Component<TData, TProperty, TMethod>, v: unknown) => void
          }
        | {
            enumerable: boolean
            value: (...args: unknown[]) => unknown
          }
        | {
            writable: true
            value: () => void
          }
    }

    // add properties to component prototype if needed
    if (options.writeFieldsToNode) {
      const keys = Object.keys(behavior._$propertyMap)
      for (let i = 0; i < keys.length; i += 1) {
        const propName = keys[i]!
        propSetters[propName] = {
          enumerable: true,
          get() {
            return this._$dataGroup.data[propName]
          },
          set(v: DataValue) {
            const dataGroup = this._$dataGroup
            dataGroup.replaceDataOnPath([propName], v)
            dataGroup.applyDataUpdates()
          },
        }
      }
      const methodKeys = Object.keys(behavior._$methodMap)
      for (let i = 0; i < methodKeys.length; i += 1) {
        const methodName = methodKeys[i]!
        propSetters[methodName] = {
          enumerable: true,
          value: behavior._$methodMap[methodName]!,
        }
      }
    }

    // create prototype
    const protoFunc = function ComponentInst() {
      /* a component */
    }
    propSetters.constructor = {
      value: protoFunc,
      writable: true,
    }
    protoFunc.prototype = Object.create(Component.prototype, propSetters) as ComponentInstProto<
      TData,
      TProperty,
      TMethod
    >
    const proto = protoFunc.prototype
    proto._$behavior = behavior
    proto._$definition = this
    proto._$methodMap = behavior._$methodMap

    // init other helpers
    const dataGroupObserverTree = behavior._$generateObserverTree()
    proto._$lifetimeFuncs = behavior._$getAllLifetimeFuncs()
    proto._$pageLifetimeFuncs = behavior._$getAllPageLifetimeFuncs()
    const relationDefinitionGroup = generateRelationDefinitionGroup(behavior._$relationMap)
    const dataDeepCopy = getDeepCopyStrategy(options.dataDeepCopy)
    const propertyPassingDeepCopy = getDeepCopyStrategy(options.propertyPassingDeepCopy)

    // call template engine
    const template = this._$templateEngine.create(behavior as unknown as GeneralBehavior, options)

    this._$detail = {
      proto,
      template,
      dataGroupObserverTree,
      dataDeepCopy,
      propertyPassingDeepCopy,
      relationDefinitionGroup,
    }
  }
}

let componentInstanceIdInc = 1

/**
 * A node that has a shadow tree attached to it
 */
export class Component<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
> extends Element {
  /** @internal */
  _$behavior: Behavior<TData, TProperty, TMethod, any>
  /** @internal */
  _$definition: ComponentDefinition<TData, TProperty, TMethod>
  /** @internal */
  _$lifetimeFuncs: LifetimeFuncs
  /** @internal */
  _$pageLifetimeFuncs: PageLifetimeFuncs
  /** @internal */
  _$methodMap: MethodList
  /** @internal */
  _$genericImpls: { [name: string]: ComponentDefinitionWithPlaceholder } | null
  /** @internal */
  _$dataGroup: DataGroup<TData, TProperty, TMethod>
  /** @internal */
  _$external: boolean
  shadowRoot: ShadowRoot | ExternalShadowRoot
  /** @internal */
  _$tmplInst: TemplateInstance | undefined
  /** @internal */
  _$relation: Relation | null
  /** @internal */
  _$idPrefix: string
  /** @internal */
  _$componentInstanceId: number | undefined
  tagName: string
  /** @internal */
  private _$traitGroup: TraitGroup
  /** @internal */
  private _$methodCaller: ComponentInstance<TData, TProperty, TMethod>

  constructor() {
    throw new Error('Element cannot be constructed directly')
    // eslint-disable-next-line no-unreachable
    super()
  }

  general(): GeneralComponent {
    return this as unknown as GeneralComponent
  }

  /**
   * Cast a general component node to the instance of the specified component
   *
   * Returns `null` if the component node is not the instance of the specified component.
   */
  override asInstanceOf<
    UData extends DataList,
    UProperty extends PropertyList,
    UMethod extends MethodList,
  >(
    componentDefinition: ComponentDefinition<UData, UProperty, UMethod>,
  ): ComponentInstance<UData, UProperty, UMethod> | null {
    if ((this._$behavior as any) !== componentDefinition.behavior) {
      return null
    }
    return this as unknown as ComponentInstance<UData, UProperty, UMethod>
  }

  static register<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(
    def: ComponentParams<TData, TProperty, TMethod> &
      ThisType<ComponentInstance<TData, TProperty, TMethod>>,
    space?: ComponentSpace,
  ): ComponentDefinition<TData, TProperty, TMethod> {
    return (space || getDefaultComponentSpace()).defineComponent(def)
  }

  /** @internal */
  static _$tagMethod<Fn extends ComponentMethod>(func: Fn): TaggedMethod<Fn> {
    const taggedMethod = func as unknown as TaggedMethod<Fn>
    ;(taggedMethod as unknown as { [tag: symbol]: true })[METHOD_TAG] = true
    return taggedMethod
  }

  /** @internal */
  static _$isTaggedMethod(func: unknown): func is TaggedMethod<ComponentMethod> {
    return typeof func === 'function' && !!(func as unknown as { [tag: symbol]: true })[METHOD_TAG]
  }

  /** @internal */
  static _$advancedCreate<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(
    tagName: string,
    def: ComponentDefinition<TData, TProperty, TMethod>,
    owner: ShadowRoot | null,
    backendContext: GeneralBackendContext | null,
    genericImpls: { [name: string]: ComponentDefinitionWithPlaceholder } | null,
    placeholderHandler: (() => void) | undefined,
    initPropValues?: (comp: ComponentInstance<TData, TProperty, TMethod>) => void,
  ): ComponentInstance<TData, TProperty, TMethod> {
    if (!def._$detail) def.prepare()
    const { proto, template, dataDeepCopy, propertyPassingDeepCopy, relationDefinitionGroup } =
      def._$detail!
    let dataGroupObserverTree = def._$detail!.dataGroupObserverTree
    const options = def._$options
    const behavior = def.behavior
    const nodeTreeContext: GeneralBackendContext = owner
      ? owner._$nodeTreeContext
      : backendContext || globalOptions.backendContext || getDefaultBackendContext()
    const external = options.externalComponent
    const propEarlyInit = options.propertyEarlyInit
    const writeExtraInfoToAttr = globalOptions.writeExtraInfoToAttr
    const virtualHost = options.virtualHost

    // initialize component instance object
    const comp = Object.create(proto) as ComponentInstance<TData, TProperty, TMethod>
    comp._$genericImpls = genericImpls
    comp._$placeholderHandler = placeholderHandler
    comp._$external = external
    comp.tagName = tagName
    comp._$methodCaller = comp

    // create backend element
    let backendElement: GeneralBackendElement | null = null
    if (owner) {
      if (
        !virtualHost &&
        (BM.DOMLIKE || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Domlike))
      ) {
        backendElement = (owner._$nodeTreeContext as domlikeBackend.Context).document.createElement(
          tagName,
        )
      } else if (
        !virtualHost &&
        (BM.COMPOSED || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Composed))
      ) {
        const backend = owner._$nodeTreeContext as composedBackend.Context
        backendElement = backend.createElement(options.hostNodeTagName, tagName)
      } else if (BM.SHADOW || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Shadow)) {
        const backend = owner._$backendShadowRoot
        backendElement = backend?.createComponent(tagName) || null
      }
    } else {
      if (
        !virtualHost &&
        (BM.DOMLIKE || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Domlike))
      ) {
        backendElement = (nodeTreeContext as domlikeBackend.Context).document.createElement(tagName)
      } else if (
        !virtualHost &&
        (BM.COMPOSED || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Composed))
      ) {
        backendElement =
          (nodeTreeContext as composedBackend.Context).createElement(
            options.hostNodeTagName,
            tagName,
          ) || null
      } else if (BM.SHADOW || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Shadow)) {
        const sr = (nodeTreeContext as backend.Context).getRootNode()
        if (!sr) throw new Error('Failed getting backend shadow tree')
        backendElement = sr.createComponent(tagName) || null
      }
    }
    comp._$initialize(virtualHost, backendElement, owner, nodeTreeContext)

    // init class list
    const externalClassAlias = {} as { [externalName: string]: string[] | null }
    if (behavior._$externalClasses) {
      const externalClasses = behavior._$externalClasses
      for (let i = 0; i < externalClasses.length; i += 1) {
        externalClassAlias[externalClasses[i]!] = null
      }
    }
    comp.classList = new ClassList(comp, externalClassAlias)
    if (backendElement) {
      const styleScope = owner
        ? owner.getHostNode()._$definition._$options.styleScope
        : options.styleScope
      if (styleScope) {
        if (!(BM.DOMLIKE || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Domlike))) {
          // FIXME: backend two param compat
          ;(backendElement as backend.Element | composedBackend.Element).setStyleScope(styleScope)
          // ;(backendElement as backend.Element | composedBackend.Element).setStyleScope(
          //   styleScope,
          //   options.styleScope,
          // )
        }
      }
      if (owner && writeExtraInfoToAttr) {
        const prefix = owner
          .getHostNode()
          ._$behavior.ownerSpace?.styleScopeManager.queryName(styleScope)
        if (prefix) {
          backendElement.setAttribute('exparser:info-class-prefix', `${prefix}--`)
        }
      }
    }

    // associate in backend
    if (backendElement) {
      if (!(BM.DOMLIKE || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Domlike))) {
        // ;(backendElement as backend.Element | composedBackend.Element).associateValue?.(comp)
        ;(backendElement as unknown as { __wxElement: typeof comp }).__wxElement = comp
      } else {
        ;(nodeTreeContext as domlikeBackend.Context).associateValue(
          backendElement as domlikeBackend.Element,
          comp,
        )
      }
    }

    // write attr
    if (writeExtraInfoToAttr && backendElement) {
      const componentInstanceId = componentInstanceIdInc
      componentInstanceIdInc += 1
      comp._$componentInstanceId = componentInstanceId
      backendElement.setAttribute('exparser:info-component-id', componentInstanceId)
    }
    comp._$idPrefix = options.idPrefixGenerator
      ? options.idPrefixGenerator.call(comp as unknown as GeneralComponent)
      : ''

    // combine initial data
    const staticData = behavior._$staticData
    const dataGenFuncs = behavior._$data
    let data: DataList
    if (staticData === undefined) {
      if (dataGenFuncs.length === 1) {
        const f = dataGenFuncs[0]!
        data = f()
      } else {
        data = {}
        for (let i = 0; i < dataGenFuncs.length; i += 1) {
          const f = dataGenFuncs[i]!
          Object.assign(data, f())
        }
      }
    } else {
      data = simpleDeepCopy(staticData)
      for (let i = 0; i < dataGenFuncs.length; i += 1) {
        const f = dataGenFuncs[i]!
        Object.assign(data, f())
      }
    }

    // init relations
    const relation = (comp._$relation = new Relation(
      comp as unknown as GeneralComponent,
      relationDefinitionGroup,
    ))

    // init trait group
    comp._$traitGroup = new TraitGroup()
    const traitBehaviors = behavior._$traitBehaviors
    if (traitBehaviors !== undefined) {
      for (let i = 0; i < traitBehaviors.length; i += 1) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { traitBehavior, impl } = traitBehaviors[i]!
        comp._$traitGroup.implement(traitBehavior, impl)
      }
    }

    // call method caller init
    if (behavior._$methodCallerInit) {
      const methodCaller = behavior._$methodCallerInit.call(comp)
      comp._$methodCaller = methodCaller
    }

    // call init functions
    let initDone = false
    function relationInit(relationDef: RelationParams): RelationHandler<unknown, never>
    function relationInit<TOut extends { [x: string]: unknown }>(
      relationDef: TraitRelationParams<TOut>,
    ): RelationHandler<unknown, TOut>
    function relationInit<TOut extends { [x: string]: unknown }>(
      relationDef: RelationParams | TraitRelationParams<TOut>,
    ): RelationHandler<unknown, unknown> {
      if (initDone) throw new Error('Cannot execute init-time functions after initialization')
      const target = relationDef.target
      const normalizedRel = normalizeRelation(
        behavior.ownerSpace,
        behavior.is,
        'undefined',
        relationDef,
      )
      let key: symbol
      if (normalizedRel) {
        key = relation.add(normalizedRel)
      } else {
        key = Symbol('invalid')
      }
      const list = () => {
        const targetNodes = relation.getLinkedTargets(key)
        return targetNodes.map((x) => x.getMethodCaller())
      }
      const listAsTrait =
        target instanceof TraitBehavior
          ? () => {
              const targetNodes = relation.getLinkedTargets(key)
              return targetNodes.map((x: GeneralComponent) => x.traitBehavior(target))
            }
          : undefined
      return { list, listAsTrait } as any
    }
    if (behavior._$init.length > 0) {
      let cowObserver = true
      let cowLifetime = true
      let cowPageLifetime = true
      let cowMethodMap = true
      const methodCaller = comp.getMethodCaller()
      const builderContext: BuilderContext<any, any, any> = {
        self: methodCaller,
        data,
        setData: comp.setData.bind(comp) as (newData?: { [x: string]: unknown }) => void,
        implement: <TIn extends { [x: string]: unknown }>(
          traitBehavior: TraitBehavior<TIn, { [x: string]: unknown }>,
          impl: TIn,
        ): void => {
          if (initDone) throw new Error('Cannot execute init-time functions after initialization')
          comp._$traitGroup.implement(traitBehavior, impl)
        },
        relation: relationInit,
        observer: (dataPaths: string | readonly string[], func: (...args: any[]) => void): void => {
          if (initDone) throw new Error('Cannot execute init-time functions after initialization')
          if (cowObserver) {
            cowObserver = false
            dataGroupObserverTree = dataGroupObserverTree.cloneSub()
          }
          dataGroupObserverTree.addObserver(func, parseMultiPaths(dataPaths as string | string[]))
        },
        lifetime: <T extends keyof Lifetimes>(name: T, func: Lifetimes[T]): void => {
          if (initDone) throw new Error('Cannot execute init-time functions after initialization')
          if (cowLifetime) {
            cowLifetime = false
            comp._$lifetimeFuncs = behavior._$getAllLifetimeFuncs()
          }
          const fag = comp._$lifetimeFuncs
          if (fag[name]) {
            fag[name]!.add(func as GeneralFuncType)
          } else {
            const fa = (fag[name] = new FuncArr() as LifetimeFuncs[T])
            fa!.add(func as GeneralFuncType)
          }
        },
        pageLifetime: (name: string, func: (...args: unknown[]) => void): void => {
          if (initDone) throw new Error('Cannot execute init-time functions after initialization')
          if (cowPageLifetime) {
            cowPageLifetime = false
            comp._$pageLifetimeFuncs = behavior._$getAllPageLifetimeFuncs()
          }
          const fag = comp._$pageLifetimeFuncs
          if (fag[name]) {
            fag[name]!.add(func)
          } else {
            const fa = (fag[name] = new FuncArr())
            fa.add(func)
          }
        },
        method: <Fn extends ComponentMethod>(func: Fn) => Component._$tagMethod(func),
        listener: <T>(func: EventListener<T>) => Component._$tagMethod(func),
      }
      const initFuncs = behavior._$init
      for (let i = 0; i < initFuncs.length; i += 1) {
        const init = initFuncs[i]!
        const exported = safeCallback(
          'Component Init',
          init,
          methodCaller,
          [builderContext],
          undefined,
        ) as { [x: string]: unknown } | undefined
        if (exported) {
          const exportedKeys = Object.keys(exported)
          for (let j = 0; j < exportedKeys.length; j += 1) {
            const exportedKey = exportedKeys[j]!
            const exportItem: unknown = exported[exportedKey]
            if (Component._$isTaggedMethod(exportItem)) {
              if (cowMethodMap) {
                cowMethodMap = false
                comp._$methodMap = Object.create(comp._$methodMap) as MethodList
              }
              comp._$methodMap[exportedKey] = exportItem
              if (options.writeFieldsToNode) {
                ;(comp as { [key: string]: GeneralFuncType })[exportedKey] = exportItem
              }
            }
          }
        }
      }
    }
    initDone = true

    // init data
    const tmplInst = template.createInstance(comp as unknown as GeneralComponent)
    const shadowRoot = tmplInst.shadowRoot
    comp.shadowRoot = shadowRoot
    const dataGroup = new DataGroup(
      comp,
      data as DataWithPropertyValues<TData, TProperty>,
      options.pureDataPattern || null,
      dataDeepCopy,
      propertyPassingDeepCopy,
      options.reflectToAttributes,
      dataGroupObserverTree,
    )
    comp._$dataGroup = dataGroup

    // init template with init data
    if (propEarlyInit && initPropValues !== undefined) initPropValues(comp)
    tmplInst.initValues(dataGroup.innerData || dataGroup.data)
    comp._$tmplInst = tmplInst
    dataGroup.setUpdateListener(tmplInst.updateValues.bind(tmplInst))

    // bind behavior listeners
    const listeners = behavior._$listeners
    if (listeners !== undefined) {
      for (let i = 0; i < listeners.length; i += 1) {
        const { id, ev, listener: gf } = listeners[i]!
        const listener = gf as EventListener<any>
        if (id === 'this') {
          comp.addListener(ev, (ev) => listener.call(comp._$methodCaller, ev))
        } else if (!external) {
          const sr = shadowRoot as ShadowRoot
          const elem = id ? sr.getElementById(id) : sr
          if (elem) {
            elem.addListener(ev, (ev) => listener.call(comp._$methodCaller, ev))
          }
        } else {
          const sr = shadowRoot as ExternalShadowRoot
          const elem = id ? sr.getIdMap()[id] : sr.root
          if (elem) {
            sr.setListener(elem, ev, (ev) => listener.call(comp._$methodCaller, ev))
          }
        }
      }
    }

    // trigger created lifetimes
    comp._$lifetimeFuncs.created?.call(
      comp._$methodCaller as any,
      [],
      comp as unknown as GeneralComponent,
    )
    if (!propEarlyInit && initPropValues !== undefined) initPropValues(comp)

    return comp
  }

  static createWithGenericsAndContext<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(
    tagName: string | ComponentDefinition<TData, TProperty, TMethod>,
    componentDefinition: ComponentDefinition<TData, TProperty, TMethod> | null,
    genericTargets: { [name: string]: GeneralComponentDefinition } | null,
    backendContext: GeneralBackendContext | null,
    initPropValues?: (comp: ComponentInstance<TData, TProperty, TMethod>) => void,
  ): ComponentInstance<TData, TProperty, TMethod> {
    const collectGenericImpls = (def: GeneralComponentDefinition) => {
      let genericImpls: { [key: string]: ComponentDefinitionWithPlaceholder } | undefined
      if (genericTargets) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        genericImpls = Object.create(null)
        Object.entries(genericTargets).forEach(([key, g]) => {
          genericImpls![key] = {
            final: g,
            source: def.behavior,
            placeholder: null,
            waiting: null,
          }
        })
      }
      return convertGenerics(def, def.behavior, undefined, genericImpls)
    }
    if (componentDefinition) {
      return Component._$advancedCreate(
        String(tagName),
        componentDefinition,
        null,
        backendContext,
        collectGenericImpls(componentDefinition as unknown as GeneralComponentDefinition),
        undefined,
        initPropValues,
      )
    }
    if (tagName instanceof ComponentDefinition) {
      return Component._$advancedCreate(
        tagName.is,
        tagName,
        null,
        backendContext,
        collectGenericImpls(tagName as unknown as GeneralComponentDefinition),
        undefined,
      )
    }
    const compDef = getDefaultComponentSpace().getComponentByUrl(tagName, '')
    return Component._$advancedCreate(
      tagName,
      compDef,
      null,
      backendContext,
      collectGenericImpls(compDef),
      undefined,
    ) as unknown as ComponentInstance<TData, TProperty, TMethod>
  }

  static createWithGenerics<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(
    tagName: string | ComponentDefinition<TData, TProperty, TMethod>,
    componentDefinition: ComponentDefinition<TData, TProperty, TMethod> | null,
    genericImpls: { [name: string]: GeneralComponentDefinition } | null,
    initPropValues?: (comp: ComponentInstance<TData, TProperty, TMethod>) => void,
  ): ComponentInstance<TData, TProperty, TMethod> {
    return Component.createWithGenericsAndContext(
      tagName,
      componentDefinition,
      genericImpls,
      null,
      initPropValues,
    )
  }

  static createWithContext<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(
    tagName: string | ComponentDefinition<TData, TProperty, TMethod>,
    componentDefinition: ComponentDefinition<TData, TProperty, TMethod> | null,
    backendContext: GeneralBackendContext | null,
    initPropValues?: (comp: ComponentInstance<TData, TProperty, TMethod>) => void,
  ): ComponentInstance<TData, TProperty, TMethod> {
    return Component.createWithGenericsAndContext(
      tagName,
      componentDefinition,
      null,
      backendContext,
      initPropValues,
    )
  }

  static create<TData extends DataList, TProperty extends PropertyList, TMethod extends MethodList>(
    tagName: string | ComponentDefinition<TData, TProperty, TMethod>,
    componentDefinition: ComponentDefinition<TData, TProperty, TMethod> | null,
    initPropValues?: (comp: ComponentInstance<TData, TProperty, TMethod>) => void,
  ): ComponentInstance<TData, TProperty, TMethod> {
    return Component.createWithGenericsAndContext(
      tagName,
      componentDefinition,
      null,
      null,
      initPropValues,
    )
  }

  get is(): string {
    return this._$definition.is
  }

  get properties(): DeepReadonly<DataWithPropertyValues<TData, TProperty>> {
    return this._$dataGroup.data as any
  }

  get data(): DeepReadonly<DataWithPropertyValues<TData, TProperty>> {
    return this._$dataGroup.data as any
  }

  set data(newData: Partial<DataWithPropertyValues<TData, TProperty>>) {
    const dataGroup = this._$dataGroup
    Object.entries(newData).forEach(([key, value]) => dataGroup.replaceDataOnPath([key], value))
    dataGroup.applyDataUpdates()
  }

  get $(): { [id: string]: Element } | { [id: string]: GeneralBackendElement } {
    if (this._$external) {
      return (this.shadowRoot as ExternalShadowRoot).getIdMap()
    }
    return (this.shadowRoot as ShadowRoot)._$getIdMap()
  }

  /**
   * Returns the shadow root element
   *
   * Returns `null` for external components.
   */
  getShadowRoot(): ShadowRoot | null {
    if (this._$external) {
      return null
    }
    return this.shadowRoot as ShadowRoot
  }

  /**
   * Apply the template updates to this component instance
   *
   * This method has no effect if the template engine does not support template update.
   */
  applyTemplateUpdates(): void {
    if (this._$tmplInst?.updateTemplate) {
      const dataGroup = this._$dataGroup
      this._$tmplInst.updateTemplate(
        this._$definition._$detail!.template,
        dataGroup.innerData || dataGroup.data,
      )
    } else {
      triggerWarning(
        `The template engine of component "${this.is}" does not support template update`,
      )
    }
  }

  static listProperties<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(comp: ComponentInstance<TData, TProperty, TMethod>): string[] {
    return Object.keys(comp._$behavior._$propertyMap)
  }

  static hasProperty<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(comp: Component<TData, TProperty, TMethod>, propName: string): boolean {
    return !!comp._$behavior._$propertyMap[propName]
  }

  /** List methods by the component definition (backward compatibility) */
  static getMethodsFromDef<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(compDef: ComponentDefinition<TData, TProperty, TMethod>): { [name: string]: GeneralFuncType } {
    return compDef.behavior._$methodMap
  }

  /**
   * Get a method
   *
   * If `useMethodCallerListeners` option is set for this component,
   * this method will use the corresponding fields in the `methodCaller` .
   */
  static getMethod<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(comp: Component<TData, TProperty, TMethod>, methodName: string): GeneralFuncType | undefined {
    if (comp._$definition._$options.useMethodCallerListeners) {
      const method = comp._$methodCaller[methodName]
      return typeof method === 'function' ? method : undefined
    }
    return comp._$methodMap[methodName]
  }

  /**
   * Call a method
   *
   * If `useMethodCallerListeners` option is set for this component,
   * this method will use the corresponding fields in the `methodCaller` .
   * Returns `undefined` if there is no such method.
   */
  callMethod<T extends string>(
    methodName: T,
    ...args: Parameters<MethodList[T]>
  ): ReturnType<MethodList[T]> | undefined {
    const func = Component.getMethod(this, methodName)
    return func?.call(this, ...args)
  }

  /**
   * Get the corresponding component definition
   */
  getComponentDefinition(): ComponentDefinition<TData, TProperty, TMethod> {
    return this._$definition
  }

  /**
   * Get the options of the component
   */
  getComponentOptions(): NormalizedComponentOptions {
    return this._$definition._$options
  }

  /**
   * Check whether the `other` behavior is a dependent behavior or a implemented trait behavior
   */
  hasBehavior(other: string | GeneralBehavior | TraitBehavior<any, any>): boolean {
    if (other instanceof TraitBehavior) {
      return this._$traitGroup.get(other) !== undefined
    }
    return this._$behavior.hasBehavior(other)
  }

  /** Get the root behavior of the component */
  getRootBehavior(): Behavior<TData, TProperty, TMethod, any> {
    return this._$behavior
  }

  /**
   * Get the trait behavior implementation of the component
   *
   * Returns `undefined` if the specified trait behavior is not implemented.
   */
  traitBehavior<TOut extends { [x: string]: any }>(
    traitBehavior: TraitBehavior<any, TOut>,
  ): TOut | undefined {
    return this._$traitGroup.get(traitBehavior)
  }

  /**
   * Set the caller (a.k.a. `this` ) of event callbacks and life-time callbacks
   *
   * By default, the caller is the component instance itself.
   * Use this method to override this behavior.
   */
  setMethodCaller(caller: ComponentInstance<TData, TProperty, TMethod>) {
    this._$methodCaller = caller
  }

  /**
   * Get the current caller set by `setMethodCaller`
   */
  getMethodCaller(): ComponentInstance<TData, TProperty, TMethod> {
    return this._$methodCaller
  }

  /**
   * Triggers a life-time callback on an element
   *
   * Normally external life-times should only be triggered by template engine.
   * Most cases should take a common method instead.
   */
  triggerLifetime(name: string, args: Parameters<GeneralFuncType>) {
    const f = this._$lifetimeFuncs[name]
    if (f) f.call(this._$methodCaller as any, args)
  }

  /**
   * @internal
   * @deprecated Rename to `triggerLifetime`
   */
  triggerLifeTime(name: string, args: Parameters<GeneralFuncType>) {
    return this.triggerLifetime(name, args)
  }

  /**
   * Triggers a page-life-time callback on an element
   */
  triggerPageLifetime(name: string, args: Parameters<GeneralFuncType>) {
    const rec = (node: Element) => {
      if (node instanceof Component) {
        if (node._$pageLifetimeFuncs) {
          const f = node._$pageLifetimeFuncs[name]
          if (f) f.call(node._$methodCaller, args)
        }
        if (!node._$external) rec(node.shadowRoot as ShadowRoot)
      }
      const children = node.childNodes
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i]
        if (child instanceof Element) {
          rec(child)
        }
      }
    }
    rec(this)
  }

  /**
   * @internal
   * @deprecated Rename to `triggerPageLifetime`
   */
  triggerPageLifeTime(name: string, args: Parameters<GeneralFuncType>) {
    return this.triggerPageLifetime(name, args)
  }

  /**
   * Get the target elements of a relation
   */
  getRelationNodes(relationKey: string): GeneralComponent[] {
    return this._$relation?.getLinkedTargets(relationKey) || ([] as GeneralComponent[])
  }

  /** Check the existence of an external class */
  hasExternalClass(name: string): boolean {
    return (this.classList as ClassList)._$hasAlias(name)
  }

  /** Update an external class value */
  setExternalClass(name: string, target: string) {
    const cl = this.classList as ClassList
    cl._$setAlias(name, target)
    cl._$spreadAliasUpdate()
  }

  /** Schedule an update for an external class value */
  scheduleExternalClassChange(name: string, target: string) {
    const cl = this.classList as ClassList
    cl._$setAlias(name, target)
  }

  /** Update multiple external class values */
  applyExternalClassChanges() {
    ;(this.classList as ClassList)._$spreadAliasUpdate()
  }

  /** Triggers a worklet change lifetime */
  triggerWorkletChangeLifetime(name: string, value: unknown) {
    this.triggerLifetime('workletChange', [name, value])
  }

  /** Check a field is excluded by pureDataPattern or not */
  isInnerDataExcluded(fieldName: string): boolean {
    return this._$definition._$options.pureDataPattern?.test(fieldName) || false
  }

  static getInnerData<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(comp: Component<TData, TProperty, TMethod>): { [key: string]: DataValue } | null {
    return comp._$dataGroup.innerData
  }

  static getDataProxy<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(comp: Component<TData, TProperty, TMethod>): DataGroup<TData, TProperty, TMethod> {
    return comp._$dataGroup
  }

  static replaceWholeData<
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
  >(comp: Component<TData, TProperty, TMethod>, newData: DataWithPropertyValues<TData, TProperty>) {
    comp._$dataGroup.replaceWholeData(newData)
  }

  /**
   * Schedule a data update on a single specified path
   *
   * The data update will not be applied until next `setData` or `applyDataUpdates` call.
   * All data observers will not be triggered immediately before applied.
   * Reads of the data will get the unchanged value before applied.
   */
  replaceDataOnPath<T extends DataPath>(
    path: readonly [...T],
    data: GetFromDataPath<DataWithPropertyValues<TData, TProperty>, T>,
  ): void
  replaceDataOnPath(path: DataPath, data: unknown) {
    const dataProxy = this._$dataGroup
    if (dataProxy === undefined) {
      throw new Error('Cannot update data before component created')
    }
    dataProxy.replaceDataOnPath(path, data)
  }

  /**
   * Schedule an array update
   *
   * The behavior is like `Array.prototype.slice` .
   * Break the array before the `index`-th item, delete `del` items, and insert some items here.
   * If `index` is undefined, negative, or larger than the length of the array,
   * no items will be deleted and new items will be appended to the end of the array.
   * The data update will not be applied until next `setData` or `applyDataUpdates` call.
   * All data observers will not be triggered immediately before applied.
   * Reads of the data will get the unchanged value before applied.
   */
  spliceArrayDataOnPath<T extends DataPath>(
    path: readonly [...T],
    index: GetFromDataPath<DataWithPropertyValues<TData, TProperty>, T> extends any[]
      ? number | undefined
      : never,
    del: GetFromDataPath<DataWithPropertyValues<TData, TProperty>, T> extends any[]
      ? number | undefined
      : never,
    inserts: GetFromDataPath<DataWithPropertyValues<TData, TProperty>, T> extends (infer I)[]
      ? I[]
      : never,
  ): void
  spliceArrayDataOnPath(
    path: DataPath,
    index: number | undefined,
    del: number | undefined,
    inserts: unknown[],
  ) {
    const dataProxy = this._$dataGroup
    if (dataProxy === undefined) {
      throw new Error('Cannot update data before component created')
    }
    dataProxy.spliceArrayDataOnPath(path, index, del, inserts)
  }

  /**
   * Check whether there are pending changes or not
   */
  hasPendingChanges(): boolean {
    const dataProxy = this._$dataGroup
    if (dataProxy === undefined) return false
    return dataProxy.getChanges().length > 0
  }

  /**
   * Apply all scheduled updates immediately
   *
   * Inside observers, it is generally not .
   */
  applyDataUpdates() {
    const dataProxy = this._$dataGroup
    if (dataProxy === undefined) {
      throw new Error('Cannot update data before component created')
    }
    dataProxy.applyDataUpdates()
  }

  /**
   * Pending all data updates in the callback, and apply updates after callback returns
   *
   * This function helps grouping several `replaceDataOnPath` or `spliceArrayDataOnPath` calls,
   * and then apply them at the end of the callback.
   * `setData` and `applyDataUpdates` calls inside the callback still apply updates immediately.
   */
  groupUpdates<T>(callback: () => T): T {
    const dataProxy = this._$dataGroup
    if (dataProxy === undefined) {
      throw new Error('Cannot update data before component created')
    }
    const ret = callback()
    dataProxy.applyDataUpdates()
    return ret
  }

  /**
   * Schedule a classic data updates
   *
   * The data update will not be applied until next `setData` or `applyDataUpdates` call.
   * When called inside observers, the data update will be applied when observer ends.
   * All data observers will not be triggered immediately before applied.
   * Reads of the data will get the unchanged value before applied.
   */
  updateData(newData?: Partial<SetDataSetter<DataWithPropertyValues<TData, TProperty>>>): void
  updateData(newData?: Record<string, any>): void {
    const dataProxy = this._$dataGroup
    if (dataProxy === undefined) {
      throw new Error('Cannot update data before component created')
    }
    if (typeof newData === 'object' && newData !== null) {
      const keys = Object.keys(newData)
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]!
        const p = parseSinglePath(key)
        if (p) {
          dataProxy.replaceDataOnPath(p, newData[key])
        }
      }
    }
  }

  /**
   * Do a classic data updates
   *
   * This method apply updates immediately, so there is no async callback.
   * When called inside observers, the data update will not be applied to templates.
   * Inside observers, it is recommended to use `updateData` instead.
   */
  setData(newData?: Partial<SetDataSetter<DataWithPropertyValues<TData, TProperty>>>): void
  setData(newData?: Record<string, any> | undefined): void {
    const dataProxy = this._$dataGroup
    if (dataProxy === undefined) {
      throw new Error('Cannot update data before component created')
    }
    if (typeof newData === 'object' && newData !== null) {
      const keys = Object.keys(newData)
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]!
        const p = parseSinglePath(key)
        if (p) {
          dataProxy.replaceDataOnPath(p, newData[key])
        }
      }
    }
    dataProxy.applyDataUpdates()
  }
}

export type GeneralComponentDefinition = ComponentDefinition<
  Record<string, any>,
  Record<string, any>,
  Record<string, any>
>

export type GeneralComponent = Component<
  Record<string, any>,
  Record<string, any>,
  Record<string, any>
>

type ComponentInstProto<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
> = Component<TData, TProperty, TMethod> & {
  _$behavior: Behavior<TData, TProperty, TMethod, any>
  _$definition: ComponentDefinition<TData, TProperty, TMethod>
  _$lifetimeFuncs: LifetimeFuncs
  _$pageLifetimeFuncs: PageLifetimeFuncs
  _$methodMap: MethodList
} & {
  [key: string]: any
}
