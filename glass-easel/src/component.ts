/* eslint-disable @typescript-eslint/no-unsafe-return */

import {
  BM,
  BackendMode,
  type GeneralBackendContext,
  type GeneralBackendElement,
  type backend,
  type composedBackend,
  type domlikeBackend,
} from './backend'
import { CurrentWindowBackendContext } from './backend/current_window_backend_context'
import { EmptyBackendContext } from './backend/empty_backend'
import { EmptyComposedBackendContext } from './backend/empty_composed_backend'
import {
  type Behavior,
  type BuilderContext,
  type ComponentDefinitionWithPlaceholder,
  type GeneralBehavior,
  type NativeNodeDefinition,
} from './behavior'
import { ClassList, StyleScopeManager } from './class_list'
import {
  METHOD_TAG,
  type ComponentInstance,
  type ComponentMethod,
  type ComponentParams,
  type DataList,
  type DataWithPropertyValues,
  type GetFromDataPath,
  type Merge,
  type MethodList,
  type PropertyList,
  type RelationParams,
  type SetDataSetter,
  type TaggedMethod,
  type TraitRelationParams,
} from './component_params'
import { getDefaultComponentSpace, type ComponentSpace } from './component_space'
import { parseMultiPaths, parseSinglePath, type DataPath } from './data_path'
import {
  DataGroup,
  getDeepCopyStrategy,
  type DataGroupObserverTree,
  type DataValue,
  type DeepCopyStrategy,
  type DataObserver,
} from './data_proxy'
import { simpleDeepCopy } from './data_utils'
import {
  performanceMeasureEnd,
  performanceMeasureRenderWaterfall,
  performanceMeasureStart,
} from './devtool'
import { Element } from './element'
import { type EventListener, type EventListenerOptions } from './event'
import { type ExternalShadowRoot } from './external_shadow_tree'
import { FuncArr, safeCallback, type GeneralFuncType } from './func_arr'
import {
  ENV,
  globalOptions,
  normalizeComponentOptions,
  type NormalizedComponentOptions,
} from './global_options'
import { type Node } from './node'
import {
  Relation,
  generateRelationDefinitionGroup,
  normalizeRelation,
  type RelationDefinitionGroup,
  type RelationHandler,
} from './relation'
import { ShadowRoot } from './shadow_root'
import { type Template, type TemplateEngine, type TemplateInstance } from './template_engine'
import { getDefaultTemplateEngine } from './tmpl'
import { TraitBehavior, TraitGroup } from './trait_behaviors'
import { COMPONENT_SYMBOL, isComponent, isElement } from './type_symbol'
import { ThirdError, dispatchError, triggerWarning } from './warning'

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
              triggerWarning(`Generic "${key}" value "${target}" is not valid`, compDef.is)
              const defaultComp = space.getDefaultComponent()
              if (!defaultComp) {
                throw new ThirdError(
                  `Cannot find default component for generic "${key}"`,
                  '[prepare]',
                  compDef.is,
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
          throw new ThirdError(
            `Cannot find default component for generic "${key}"`,
            '[prepare]',
            compDef.is,
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
      triggerWarning(`Placeholder on generic implementation is not valid`, behavior.is)
    }
  }
  if (ret) return ret
  let comp = space.getGlobalUsingComponent(placeholder)
  if (comp === null && space._$allowUnusedNativeNode && placeholder !== '') {
    comp = placeholder
  }
  if (!comp) {
    comp = space.getDefaultComponent()
    if (!comp) {
      throw new ThirdError(
        `Cannot find placeholder target "${placeholder}"`,
        '[prepare]',
        behavior.is,
      )
    }
    triggerWarning(
      `Cannot find placeholder target "${placeholder}", using default component.`,
      behavior.is,
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
  behavior: Behavior<TData, TProperty, TMethod, any, any>
  /** @internal */
  _$detail: ComponentDefinitionDetail<TData, TProperty, TMethod> | null
  /** @internal */
  _$options: NormalizedComponentOptions
  /** @internal */
  private _$templateEngine: TemplateEngine

  /** @internal */
  constructor(behavior: Behavior<TData, TProperty, TMethod, any, any>) {
    this.behavior = behavior
    this.is = this.behavior.is
    this._$detail = null
    this._$options = normalizeComponentOptions(
      behavior._$options,
      behavior.ownerSpace.getComponentOptions(),
    )
    const templateEngine = this._$options.templateEngine
    this._$templateEngine = templateEngine ?? getDefaultTemplateEngine()
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
   * This method throws error if the template engine does not support template update.
   */
  updateTemplate(template: { [key: string]: unknown }) {
    if (!this._$detail?.template.updateTemplate) {
      throw new Error(
        `The template engine of component "${this.is}" does not support template update`,
      )
    }
    this.behavior._$updateTemplate(template)
    this._$detail.template.updateTemplate(this.behavior as unknown as GeneralBehavior)
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
    proto._$dataGroupObserverTree = behavior._$generateObserverTree()
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
      dataDeepCopy,
      propertyPassingDeepCopy,
      relationDefinitionGroup,
    }
  }
}

let componentInstanceIdInc = 1

let defaultBackendContext: GeneralBackendContext | null = null

export const getDefaultBackendContext = (): GeneralBackendContext => {
  if (defaultBackendContext) return defaultBackendContext
  let c: GeneralBackendContext
  if (BM.DOMLIKE) {
    c = new CurrentWindowBackendContext()
  } else if (BM.COMPOSED) {
    c = new EmptyComposedBackendContext()
  } else {
    c = new EmptyBackendContext()
  }
  defaultBackendContext = c
  return c
}

/**
 * A node that has a shadow tree attached to it
 */
export class Component<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
> extends Element {
  [COMPONENT_SYMBOL]: true
  /** @internal */
  _$behavior: Behavior<TData, TProperty, TMethod, any, any>
  /** @internal */
  _$definition: ComponentDefinition<TData, TProperty, TMethod>
  /** @internal */
  _$dataGroupObserverTree: DataGroupObserverTree
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

  /* istanbul ignore next */
  constructor() {
    throw new Error('Element cannot be constructed directly')
    // eslint-disable-next-line no-unreachable
    super()
  }

  general(): GeneralComponent {
    return this as unknown as GeneralComponent
  }

  static isComponent = isComponent

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
    placeholderHandlerRemover: (() => void) | undefined,
    initPropValues?: (comp: ComponentInstance<TData, TProperty, TMethod>) => void,
  ): ComponentInstance<TData, TProperty, TMethod> {
    if (!def._$detail) {
      if (ENV.DEV) performanceMeasureStart('component.prepare')
      def.prepare()
      if (ENV.DEV) performanceMeasureEnd()
    }
    const { proto, template, dataDeepCopy, propertyPassingDeepCopy, relationDefinitionGroup } =
      def._$detail!
    const options = def._$options
    const behavior = def.behavior
    const nodeTreeContext: GeneralBackendContext | null = owner
      ? owner.getBackendContext()
      : backendContext || globalOptions.backendContext || getDefaultBackendContext()
    const external = options.externalComponent
    const propEarlyInit = options.propertyEarlyInit
    const writeExtraInfoToAttr = globalOptions.writeExtraInfoToAttr
    const virtualHost = options.virtualHost

    // initialize component instance object
    const comp = Object.create(proto) as ComponentInstance<TData, TProperty, TMethod>
    if (ENV.DEV) performanceMeasureStart('component.create', comp)
    comp._$genericImpls = genericImpls
    comp._$placeholderHandlerRemover = placeholderHandlerRemover
    comp._$external = external
    comp.tagName = tagName
    comp._$methodCaller = comp
    comp._$virtual = virtualHost

    // create backend element
    let backendElement: GeneralBackendElement | null = null
    if (nodeTreeContext) {
      if (BM.DOMLIKE || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Domlike)) {
        if (!virtualHost) {
          if (ENV.DEV) performanceMeasureStart('backend.createElement')
          backendElement = (nodeTreeContext as domlikeBackend.Context).document.createElement(
            tagName,
          )
          if (ENV.DEV) performanceMeasureEnd()
        }
      } else if (BM.COMPOSED || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Composed)) {
        if (!virtualHost) {
          if (ENV.DEV) performanceMeasureStart('backend.createElement')
          backendElement = (nodeTreeContext as composedBackend.Context).createElement(
            options.hostNodeTagName,
            tagName,
          )
          if (ENV.DEV) performanceMeasureEnd()
        }
      } else if (BM.SHADOW || (BM.DYNAMIC && nodeTreeContext.mode === BackendMode.Shadow)) {
        if (ENV.DEV) performanceMeasureStart('component.createComponent')
        const be = (
          owner ? owner._$backendShadowRoot! : (nodeTreeContext as backend.Context).getRootNode()
        ).createComponent(
          tagName,
          external,
          virtualHost,
          options.styleScope ?? StyleScopeManager.globalScope(),
          options.extraStyleScope,
          behavior._$externalClasses,
        )
        if (ENV.DEV) performanceMeasureEnd()
        backendElement = be
      }
    }
    comp._$initialize(
      virtualHost,
      backendElement,
      owner,
      owner ? owner._$nodeTreeContext : nodeTreeContext!,
    )

    const ownerHost = owner ? owner.getHostNode() : undefined
    const ownerComponentOptions = ownerHost?.getComponentOptions()

    // init class list
    const styleScope = ownerComponentOptions?.styleScope ?? StyleScopeManager.globalScope()
    const extraStyleScope = ownerComponentOptions?.extraStyleScope ?? undefined

    const styleScopeManager = ownerHost?._$behavior.ownerSpace.styleScopeManager
    comp.classList = new ClassList(
      comp,
      behavior._$externalClasses,
      ownerHost ? ownerHost.classList : null,
      styleScope,
      extraStyleScope,
      styleScopeManager,
    )
    if (backendElement) {
      if (BM.COMPOSED || (BM.DYNAMIC && nodeTreeContext!.mode === BackendMode.Composed)) {
        ;(backendElement as composedBackend.Element).setStyleScope(
          styleScope,
          extraStyleScope,
          options.styleScope ?? StyleScopeManager.globalScope(),
        )
      }
      if (styleScopeManager && writeExtraInfoToAttr) {
        const prefix = styleScopeManager.queryName(styleScope)
        if (prefix) {
          backendElement.setAttribute('exparser:info-class-prefix', `${prefix}--`)
        }
      }
    }

    // create template engine
    const tmplInst = template.createInstance(
      comp as GeneralComponent,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      ShadowRoot.createShadowRoot,
    )

    // associate in backend
    if (backendElement) {
      if (ENV.DEV) performanceMeasureStart('backend.associateValue')
      backendElement.__wxElement = comp
      if (!(BM.DOMLIKE || (BM.DYNAMIC && nodeTreeContext!.mode === BackendMode.Domlike))) {
        ;(backendElement as backend.Element | composedBackend.Element).associateValue(comp)
      } else {
        ;(nodeTreeContext as domlikeBackend.Context).associateValue(
          backendElement as domlikeBackend.Element,
          comp,
        )
      }
      if (ENV.DEV) performanceMeasureEnd()
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
      const methodCaller = behavior._$methodCallerInit.call(comp) as unknown as ComponentInstance<
        TData,
        TProperty,
        TMethod
      >
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
      if (initDone)
        throw new ThirdError(
          'Cannot execute init-time functions after initialization',
          '[implement]',
          behavior.is,
        )
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
          if (initDone)
            throw new ThirdError(
              'Cannot execute init-time functions after initialization',
              '[implement]',
              behavior.is,
            )
          comp._$traitGroup.implement(traitBehavior, impl)
        },
        relation: relationInit,
        observer: (dataPaths: string | readonly string[], func: (...args: any[]) => void): void => {
          if (initDone)
            throw new ThirdError(
              'Cannot execute init-time functions after initialization',
              '[implement]',
              behavior.is,
            )
          comp.dynamicAddObserver(func, dataPaths)
        },
        lifetime: <T extends keyof Lifetimes>(name: T, func: Lifetimes[T]): void => {
          if (initDone)
            throw new ThirdError(
              'Cannot execute init-time functions after initialization',
              '[implement]',
              behavior.is,
            )
          comp.addLifetimeListener(name, func)
        },
        pageLifetime: (name: string, func: (...args: unknown[]) => void): void => {
          if (initDone)
            throw new ThirdError(
              'Cannot execute init-time functions after initialization',
              '[implement]',
              behavior.is,
            )
          comp.addPageLifetimeListener(name, func)
        },
        method: <Fn extends ComponentMethod>(func: Fn) => Component._$tagMethod(func),
        listener: <T>(func: EventListener<T>) => Component._$tagMethod(func),
      }
      const initFuncs = behavior._$init
      for (let i = 0; i < initFuncs.length; i += 1) {
        const init = initFuncs[i]!
        if (ENV.DEV) performanceMeasureStart('component.init', comp)
        const exported = safeCallback(
          'Component Init',
          init,
          methodCaller,
          [builderContext],
          undefined,
        ) as { [x: string]: unknown } | undefined
        if (ENV.DEV) performanceMeasureEnd()
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
    const shadowRoot = tmplInst.shadowRoot
    comp.shadowRoot = shadowRoot
    const dataGroup = new DataGroup(
      comp,
      data as DataWithPropertyValues<TData, TProperty>,
      options.pureDataPattern || null,
      dataDeepCopy,
      propertyPassingDeepCopy,
      options.reflectToAttributes,
      comp._$dataGroupObserverTree,
    )
    comp._$dataGroup = dataGroup

    // init template with init data
    if (propEarlyInit && initPropValues !== undefined) initPropValues(comp)
    if (ENV.DEV) {
      performanceMeasureRenderWaterfall('component.render', 'backend.render', comp, () => {
        tmplInst.initValues(dataGroup.innerData || dataGroup.data)
      })
    } else {
      tmplInst.initValues(dataGroup.innerData || dataGroup.data)
    }
    comp._$tmplInst = tmplInst
    dataGroup.setUpdateListener((data, combinedChanges) => {
      if (ENV.DEV) {
        performanceMeasureRenderWaterfall('component.render', 'backend.render', comp, () => {
          tmplInst.updateValues(data, combinedChanges)
        })
      } else {
        tmplInst.updateValues(data, combinedChanges)
      }
    })

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
    comp.triggerLifetime('created', [])
    if (!propEarlyInit && initPropValues !== undefined) initPropValues(comp)

    if (ENV.DEV) performanceMeasureEnd()
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

  get properties(): Merge<DataWithPropertyValues<TData, TProperty>> {
    return this._$dataGroup.data as any
  }

  get data(): Merge<DataWithPropertyValues<TData, TProperty>> {
    return this._$dataGroup.data as any
  }

  set data(newData: Partial<DataWithPropertyValues<TData, TProperty>>) {
    const dataGroup = this._$dataGroup
    if (dataGroup === undefined) {
      throw new ThirdError('Cannot update data before component created', `data setter`, this)
    }
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
   * This method throws error if the template engine does not support template update.
   */
  applyTemplateUpdates(): void {
    if (!this._$tmplInst?.updateTemplate) {
      throw new Error(
        `The template engine of component "${this.is}" does not support template update`,
      )
    }
    const dataGroup = this._$dataGroup
    this._$tmplInst.updateTemplate(
      this._$definition._$detail!.template,
      dataGroup.innerData || dataGroup.data,
    )
  }

  /**
   * Returns the owner component space of this component
   */
  getOwnerSpace(): ComponentSpace {
    return this._$behavior.ownerSpace
  }

  /** Get whether the component is external or not */
  isExternal(): boolean {
    return this._$external
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
    if (
      comp._$definition._$options.useMethodCallerListeners &&
      Object.prototype.hasOwnProperty.call(comp._$methodCaller, methodName)
    ) {
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
  ): ReturnType<MethodList[T]> {
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
   * Add a lifetime event listener on the component
   */
  addLifetimeListener<N extends keyof Lifetimes>(name: N, func: Lifetimes[N]) {
    if (!Object.prototype.hasOwnProperty.call(this, '_$lifetimeFuncs')) {
      // copy on write
      this._$lifetimeFuncs = this._$behavior._$getAllLifetimeFuncs()
    }
    const fag = this._$lifetimeFuncs
    const fa = (fag[name] = fag[name] || (new FuncArr('lifetime') as LifetimeFuncs[N]))
    fa!.add(func as GeneralFuncType)
  }

  /**
   * remove a lifetime event listener on the component
   */
  removeLifetimeListener<N extends keyof Lifetimes>(name: N, func: Lifetimes[N]) {
    if (!Object.prototype.hasOwnProperty.call(this, '_$lifetimeFuncs')) {
      // copy on write
      this._$lifetimeFuncs = this._$behavior._$getAllLifetimeFuncs()
    }
    const fag = this._$lifetimeFuncs
    const fa = fag[name]
    fa?.remove(func as GeneralFuncType)
  }

  /**
   * Triggers a life-time callback on an element
   *
   * Normally external life-times should only be triggered by template engine.
   * Most cases should take a common method instead.
   */
  triggerLifetime(name: string, args: Parameters<GeneralFuncType>) {
    const f = this._$lifetimeFuncs[name]
    if (f) f.call(this._$methodCaller as any, args, this)
  }

  /**
   * @internal
   * @deprecated Rename to `triggerLifetime`
   */
  triggerLifeTime(name: string, args: Parameters<GeneralFuncType>) {
    return this.triggerLifetime(name, args)
  }

  /**
   * Add a page lifetime event listener on the component
   */
  addPageLifetimeListener(name: string, func: (...args: unknown[]) => void) {
    if (!Object.prototype.hasOwnProperty.call(this, '_$pageLifetimeFuncs')) {
      // copy on write
      this._$pageLifetimeFuncs = this._$behavior._$getAllPageLifetimeFuncs()
    }
    const fag = this._$pageLifetimeFuncs
    const fa = (fag[name] = fag[name] || new FuncArr('pageLifetime'))
    fa.add(func)
  }

  /**
   * remove a page lifetime event listener on the component
   */
  removePageLifetimeListener(name: string, func: (...args: unknown[]) => void) {
    if (!Object.prototype.hasOwnProperty.call(this, '_$pageLifetimeFuncs')) {
      // copy on write
      this._$pageLifetimeFuncs = this._$behavior._$getAllPageLifetimeFuncs()
    }
    const fag = this._$pageLifetimeFuncs
    const fa = fag[name]
    fa?.remove(func)
  }

  /**
   * Triggers a page-life-time callback on an element
   */
  triggerPageLifetime(name: string, args: Parameters<GeneralFuncType>) {
    const rec = (node: Element) => {
      if (isComponent(node)) {
        if (node._$pageLifetimeFuncs) {
          const f = node._$pageLifetimeFuncs[name]
          if (f) f.call(node._$methodCaller, args, this)
        }
        if (!node._$external) rec(node.shadowRoot as ShadowRoot)
      }
      const children = node.childNodes
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i]
        if (isElement(child)) {
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
   * Add an observer on the runtime
   * @note This method is for debug or inspect use only, do not use it in production.
   */
  dynamicAddObserver(func: DataObserver, dataPaths: string | readonly string[]) {
    if (!Object.prototype.hasOwnProperty.call(this, '_$dataGroupObserverTree')) {
      // copy on write
      this._$dataGroupObserverTree = this._$dataGroupObserverTree.cloneSub()
      if (this._$dataGroup) this._$dataGroup._$observerTree = this._$dataGroupObserverTree
    }
    const dataGroupObserverTree = this._$dataGroupObserverTree
    try {
      dataGroupObserverTree.addObserver(func, parseMultiPaths(dataPaths))
    } catch (e) {
      // parse multi paths may throw errors
      dispatchError(e, `observer`, this.is)
    }
  }

  /**
   * Get the target elements of a relation
   */
  getRelationNodes(relationKey: string): GeneralComponent[] {
    return this._$relation?.getLinkedTargets(relationKey) || ([] as GeneralComponent[])
  }

  /** Check the existence of an external class */
  hasExternalClass(name: string): boolean {
    return this.classList!._$hasAlias(name)
  }

  /** Update an external class value */
  setExternalClass(name: string, target: string | string[]) {
    this.scheduleExternalClassChange(name, target)
    this.applyExternalClassChanges()
  }

  /** Get all external classes */
  getExternalClasses(): string[] | undefined {
    return this.classList!._$getAlias()
  }

  /** Schedule an update for an external class value */
  scheduleExternalClassChange(name: string, target: string | string[]) {
    this.classList!._$setAlias(name, target)
  }

  /** Update multiple external class values */
  applyExternalClassChanges() {
    if (this._$external) return
    if (!this.classList!._$shouldUpdateExternalClass()) return
    const recv = (node: Node) => {
      if (!isElement(node)) return
      const classList = node.classList
      if (classList?._$spreadExternalClassUpdate() && isComponent(node)) {
        node.applyExternalClassChanges()
      }
      const childNodes = node.childNodes
      for (let i = 0, l = childNodes.length; i < l; i += 1) {
        recv(childNodes[i]!)
      }
      classList?._$markExternalClassUpdated()
    }
    recv(this.shadowRoot as ShadowRoot)
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
      throw new ThirdError('Cannot update data before component created', `replaceDataOnPath`, this)
    }
    if (ENV.DEV) performanceMeasureStart('component.replaceDataOnPath', this)
    dataProxy.replaceDataOnPath(path, data)
    if (ENV.DEV) performanceMeasureEnd()
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
      throw new ThirdError(
        'Cannot update data before component created',
        `spliceArrayDataOnPath`,
        this,
      )
    }
    if (ENV.DEV) performanceMeasureStart('component.spliceArrayDataOnPath', this)
    dataProxy.spliceArrayDataOnPath(path, index, del, inserts)
    if (ENV.DEV) performanceMeasureEnd()
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
      throw new ThirdError('Cannot update data before component created', `applyDataUpdates`, this)
    }
    if (ENV.DEV) performanceMeasureStart('component.applyDataUpdates', this)
    dataProxy.applyDataUpdates()
    if (ENV.DEV) performanceMeasureEnd()
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
      throw new ThirdError('Cannot update data before component created', `groupUpdates`, this)
    }
    if (ENV.DEV) performanceMeasureStart('component.groupUpdates', this)
    const ret = callback()
    dataProxy.applyDataUpdates()
    if (ENV.DEV) performanceMeasureEnd()
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
      throw new ThirdError('Cannot update data before component created', `updateData`, this)
    }
    if (ENV.DEV) performanceMeasureStart('component.updateData', this)
    if (typeof newData === 'object' && newData !== null) {
      const keys = Object.keys(newData)
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]!
        try {
          const p = parseSinglePath(key)
          dataProxy.replaceDataOnPath(p, newData[key])
        } catch (e) {
          // parse single path may throw errors
          dispatchError(e, `updateData`, this)
        }
      }
    }
    if (ENV.DEV) performanceMeasureEnd()
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
      throw new ThirdError('Cannot update data before component created', `setData`, this)
    }
    if (ENV.DEV) performanceMeasureStart('component.setData', this)
    if (typeof newData === 'object' && newData !== null) {
      const keys = Object.keys(newData)
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i]!
        try {
          const p = parseSinglePath(key)
          dataProxy.replaceDataOnPath(p, newData[key])
        } catch (e) {
          // parse single path may throw errors
          dispatchError(e, `setData`, this)
        }
      }
    }
    dataProxy.applyDataUpdates()
    if (ENV.DEV) performanceMeasureEnd()
  }
}

Component.prototype[COMPONENT_SYMBOL] = true

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

export type AnyComponent = Component<any, any, any>

type ComponentInstProto<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
> = Component<TData, TProperty, TMethod> & {
  _$behavior: Behavior<TData, TProperty, TMethod, any>
  _$definition: ComponentDefinition<TData, TProperty, TMethod>
  _$dataGroupObserverTree: DataGroupObserverTree
  _$lifetimeFuncs: LifetimeFuncs
  _$pageLifetimeFuncs: PageLifetimeFuncs
  _$methodMap: MethodList
} & {
  [key: string]: any
}
