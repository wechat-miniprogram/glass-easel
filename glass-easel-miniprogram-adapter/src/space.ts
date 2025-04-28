/* eslint-disable @typescript-eslint/no-unsafe-return */

import * as glassEasel from 'glass-easel'
import { StyleIsolation } from './types'
import { guid } from './utils'
import { TraitBehavior } from './behavior'
import { BehaviorBuilder, ComponentBuilder } from './builder'
import type { MiniProgramEnv } from '.'
import type {
  ComponentStaticConfig,
  ComponentDefinitionOptions,
  BehaviorDefinition,
  ComponentDefinition,
  PageDefinition,
  utils as typeUtils,
} from './types'
import type { DefaultBehaviorBuilder, DefaultComponentBuilder } from './builder'
import type { Behavior, ComponentType } from './behavior'
import type { Component } from './component'

// The page constructor
export interface PageConstructor {
  <TData extends DataList, TNewExtraFields extends { [k: PropertyKey]: any }>(
    definition: PageDefinition<TData, TNewExtraFields> &
      ThisType<
        Component<
          /* TData */ TData,
          /* TProperty */ Empty,
          /* TMethod */ TNewExtraFields,
          /* TComponentExport */ never,
          /* TExtraThisFields */ Empty
        >
      >,
  ): void
}

// The component constructor
export interface ComponentConstructor {
  (): DefaultComponentBuilder
  <
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
    TComponentExport,
  >(
    definition: ComponentDefinition<TData, TProperty, TMethod, TComponentExport> &
      ThisType<
        Component<
          /* TData */ TData,
          /* TProperty */ TProperty,
          /* TMethod */ TMethod,
          /* TComponentExport */ TComponentExport,
          /* TExtraThisFields */ Empty
        >
      >,
  ): ComponentType<
    /* TData */ TData,
    /* TProperty */ TProperty,
    /* TMethod */ TMethod,
    /* TComponentExport */ TComponentExport,
    /* TExtraThisFields */ Empty
  >
}

// The behavior constructor
export interface BehaviorConstructor {
  (): DefaultBehaviorBuilder
  <
    TData extends DataList,
    TProperty extends PropertyList,
    TMethod extends MethodList,
    TComponentExport,
  >(
    definition: BehaviorDefinition<TData, TProperty, TMethod, TComponentExport> &
      ThisType<
        Component<
          /* TData */ TData,
          /* TProperty */ TProperty,
          /* TMethod */ TMethod,
          /* TComponentExport */ TComponentExport,
          /* TExtraThisFields */ Empty
        >
      >,
  ): Behavior<
    /* TData */ TData,
    /* TProperty */ TProperty,
    /* TMethod */ TMethod,
    /* TChainingFilter */ never,
    /* TComponentExport */ TComponentExport,
    /* TExtraThisFields */ Empty
  >
  trait<TIn extends { [key: string]: any }>(): TraitBehavior<TIn, TIn>
  trait<TIn extends { [key: string]: any }, TOut extends { [key: string]: any }>(
    trans: (impl: TIn) => TOut,
  ): TraitBehavior<TIn, TOut>
}

/* The component registration environment */
export interface ComponentEnv {
  Page: PageConstructor
  Component: ComponentConstructor
  Behavior: BehaviorConstructor
}

type Empty = typeUtils.Empty
type DataList = typeUtils.DataList
type PropertyList = typeUtils.PropertyList
type MethodList = typeUtils.MethodList

/**
 * A component space with mini-program code manager
 */
export class CodeSpace {
  /** @internal */
  _$env: MiniProgramEnv
  private _$isMainSpace: boolean
  private space: glassEasel.ComponentSpace
  private styleScopeManager: glassEasel.StyleScopeManager
  private staticConfigMap: { [path: string]: ComponentStaticConfig }
  private styleSheetMap: {
    [path: string]: { url: string | undefined; styleScopeName: string | undefined }
  }
  private compiledTemplateMap: { [path: string]: glassEasel.template.ComponentTemplate }
  private waitingAliasMap: { [is: string]: string[] }
  /** @internal */
  _$sharedStyleScope: glassEasel.StyleScopeId
  /** @internal */
  _$styleIsolationMap: { [path: string]: StyleIsolation }
  /** @internal */
  _$overallBehavior: glassEasel.GeneralBehavior | null = null

  /** @internal */
  constructor(
    env: MiniProgramEnv,
    isMainSpace: boolean,
    publicComponents: { [alias: string]: string },
    globalCodeSpace?: CodeSpace,
  ) {
    this._$env = env
    this._$isMainSpace = isMainSpace
    this.space = new glassEasel.ComponentSpace(
      '',
      globalCodeSpace?.space,
      globalCodeSpace?.space.styleScopeManager,
    )
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ;(this.space as any).__wxCodeSpace = this
    this.styleScopeManager = this.space.styleScopeManager
    this.staticConfigMap = Object.create(null) as { [path: string]: ComponentStaticConfig }
    this.styleSheetMap = Object.create(null) as {
      [path: string]: { url: string; styleScopeName: string }
    }
    this.compiledTemplateMap = Object.create(null) as {
      [path: string]: glassEasel.template.ComponentTemplate
    }
    this.waitingAliasMap = Object.create(null) as { [path: string]: string[] }
    Object.keys(publicComponents).forEach((alias) => {
      const is = publicComponents[alias]!
      if (this.waitingAliasMap[is]) this.waitingAliasMap[is]!.push(alias)
      else this.waitingAliasMap[is] = [alias]
    })
    this._$sharedStyleScope = this.styleScopeManager.register('')
    this.space.setSharedStyleScope(this._$sharedStyleScope)
    this._$styleIsolationMap = Object.create(null) as { [path: string]: StyleIsolation }
  }

  isMainSpace(): boolean {
    return this._$isMainSpace
  }

  /**
   * Get the underlying component space
   */
  getComponentSpace(): glassEasel.ComponentSpace {
    return this.space
  }

  /**
   * Add a behavior for all components
   *
   * Must be called before any component registration so that the component will use this behavior.
   * Set to `null` to disable this behavior.
   */
  setOverallBehavior(behavior: glassEasel.GeneralBehavior) {
    this._$overallBehavior = behavior
  }

  /**
   * Import another component space as a plugin (must be in the same environment)
   *
   * Components from the imported `codeSpace` can be used with URLs.
   * If `domainAlias` is provided, the URL format is `plugin://DOMAIN_ALIAS/COMPONENT_SPACE_EXPORT_ALIAS` .
   * If `privateImport` is enabled, another URL format is `plugin-private://DOMAIN/COMPONENT_IS` .
   */
  importCodeSpace(id: string, domainAlias?: string, privateImport = false) {
    const cs = this._$env.getCodeSpace(id)
    if (!cs) {
      throw new Error(`There is no space "${id}" in the environment`)
    }
    if (domainAlias) this.space.importSpace(`plugin://${domainAlias}`, cs.space, false)
    if (privateImport) this.space.importSpace(`plugin-private://${id}`, cs.space, true)
  }

  /**
   * Add a style sheet URL with style scope name
   *
   * The URL should be recognized by the target backend.
   * The `path` should not contain the `.wxss` suffix.
   */
  addStyleSheet(path: string, styleSheetUrl?: string, styleScopeName?: string) {
    this.styleSheetMap[path] = { url: styleSheetUrl, styleScopeName }
  }

  /**
   * Get a style sheet URL
   *
   * The URL should be recognized by the target backend.
   * The `path` should not contain the `.wxss` suffix.
   */
  getStyleSheet(path: string): string | undefined {
    return this.styleSheetMap[path]?.url
  }

  getStyleScopeName(path: string): string | undefined {
    return this.styleSheetMap[path]?.styleScopeName
  }

  /**
   * Add a compiled template
   *
   * The content is the execution result of the generated string of the template compiler.
   * The `path` should not contain the `.wxml` suffix.
   */
  addCompiledTemplate(path: string, content: glassEasel.template.ComponentTemplate) {
    this.compiledTemplateMap[path] = content
  }

  /**
   * Get a compiled template
   *
   * The content is the execution result of the generated string of the template compiler.
   * The `path` should not contain the `.wxml` suffix.
   */
  getCompiledTemplate(path: string): glassEasel.template.ComponentTemplate | undefined {
    return this.compiledTemplateMap[path]
  }

  /**
   * Add a static JSON config
   *
   * The `path` should not contain the `.json` suffix.
   */
  addComponentStaticConfig(path: string, content: ComponentStaticConfig) {
    this.staticConfigMap[path] = content
  }

  /**
   * Get a static JSON config
   *
   * The `path` should not contain the `.json` suffix.
   */
  getComponentStaticConfig(path: string): ComponentStaticConfig | undefined {
    return this.staticConfigMap[path]
  }

  /** @internal */
  prepareComponentOptions(
    is: string,
    options?: ComponentDefinitionOptions,
  ): [glassEasel.ComponentOptions, StyleIsolation] {
    // accept some fields from static JSON config
    const staticConfig = this.staticConfigMap[is]
    const pureDataPatternString = staticConfig?.pureDataPattern
    const pureDataPattern = pureDataPatternString
      ? new RegExp(pureDataPatternString)
      : options?.pureDataPattern

    // calculate style scope
    const addGlobalClass = staticConfig?.addGlobalClass
    let styleIsolation = staticConfig?.styleIsolation
    if (styleIsolation === undefined) {
      if (staticConfig?.component) {
        styleIsolation = addGlobalClass ? StyleIsolation.ApplyShared : StyleIsolation.Isolated
      } else {
        styleIsolation = StyleIsolation.Shared
      }
    }
    let styleScope: glassEasel.StyleScopeId | undefined
    let extraStyleScope: glassEasel.StyleScopeId | undefined
    if (
      styleIsolation === StyleIsolation.ApplyShared ||
      styleIsolation === StyleIsolation.PageApplyShared
    ) {
      styleScope = this.styleScopeManager.register(this.getStyleScopeName(is) || `__${guid()}`)
      extraStyleScope = this._$sharedStyleScope
    } else if (
      (styleIsolation === StyleIsolation.Shared || styleIsolation === StyleIsolation.PageShared) &&
      this._$isMainSpace
    ) {
      styleScope = this._$sharedStyleScope
    } else {
      styleScope = this.styleScopeManager.register(this.getStyleScopeName(is) || `__${guid()}`)
    }

    // construct component options
    const ret: glassEasel.ComponentOptions = {
      idPrefixGenerator: guid,
      multipleSlots: options?.multipleSlots,
      dynamicSlots: options?.dynamicSlots,
      pureDataPattern,
      virtualHost: options?.virtualHost,
      styleScope,
      extraStyleScope,
      dataDeepCopy: options?.dataDeepCopy,
      propertyPassingDeepCopy: options?.propertyPassingDeepCopy,
      propertyEarlyInit: options?.propertyEarlyInit,
    }
    return [ret, styleIsolation]
  }

  /**
   * Create a component definition environment
   *
   * During the sync execution of `cb` , `Component` and `Behavior` global vars will be available.
   * `globalObject` should be the JavaScript global object, a.k.a. `window` in DOM.
   * Some global variables, a.k.a `Component` `Behavior` `Page` ,
   * will be written into `globalObject` .
   * `path` should be the component path (without ".js" extension).
   */
  globalComponentEnv<T>(globalObject: any, path: string, cb: () => T): T {
    return this.componentEnv(path, ({ Page, Component, Behavior }) => {
      /* eslint-disable @typescript-eslint/no-unsafe-member-access */
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      const oldPage = globalObject.Page
      const oldComponent = globalObject.Component
      const oldBehavior = globalObject.Behavior
      globalObject.Page = Page
      globalObject.Component = Component
      globalObject.Behavior = Behavior
      const ret = cb()
      globalObject.Page = oldPage
      globalObject.Component = oldComponent
      globalObject.Behavior = oldBehavior
      /* eslint-enable @typescript-eslint/no-unsafe-member-access */
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
      return ret
    })
  }

  /**
   * Create a component definition environment
   *
   * Like `globalComponentEnv` , but the global variables are given as callback arguments.
   */
  componentEnv<T>(path: string, cb: (env: ComponentEnv) => T): T {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    // The page constructor
    function pageConstructor<
      TData extends DataList,
      TNewExtraFields extends { [k: PropertyKey]: any },
    >(
      definition: PageDefinition<TData, TNewExtraFields> &
        ThisType<
          Component<
            /* TData */ TData,
            /* TProperty */ Empty,
            /* TMethod */ TNewExtraFields,
            /* TComponentExport */ never,
            /* TExtraThisFields */ Empty
          >
        >,
    ) {
      return self.component(path).pageDefinition(definition).register()
    }

    // The component constructor
    function componentConstructor(): DefaultComponentBuilder
    function componentConstructor<
      TData extends DataList,
      TProperty extends PropertyList,
      TMethod extends MethodList,
      TComponentExport,
    >(
      definition: ComponentDefinition<TData, TProperty, TMethod, TComponentExport>,
    ): ComponentType<
      /* TData */ TData,
      /* TProperty */ TProperty,
      /* TMethod */ TMethod,
      /* TComponentExport */ TComponentExport,
      /* TExtraThisFields */ Empty
    >
    function componentConstructor<
      TData extends DataList,
      TProperty extends PropertyList,
      TMethod extends MethodList,
      TComponentExport,
    >(definition?: ComponentDefinition<TData, TProperty, TMethod, TComponentExport>) {
      if (definition !== undefined) {
        return self.component(path).definition(definition).register()
      }
      return self.component(path)
    }

    // The behavior constructor
    function behaviorConstructor(): DefaultBehaviorBuilder
    function behaviorConstructor<
      TData extends DataList,
      TProperty extends PropertyList,
      TMethod extends MethodList,
      TComponentExport,
    >(
      definition: BehaviorDefinition<TData, TProperty, TMethod, TComponentExport>,
    ): Behavior<
      /* TData */ TData,
      /* TProperty */ TProperty,
      /* TMethod */ TMethod,
      /* TChainingFilter */ never,
      /* TComponentExport */ TComponentExport,
      /* TExtraThisFields */ Empty
    >
    function behaviorConstructor<
      TData extends DataList,
      TProperty extends PropertyList,
      TMethod extends MethodList,
      TComponentExport,
    >(definition?: BehaviorDefinition<TData, TProperty, TMethod, TComponentExport>) {
      if (definition !== undefined) {
        return self.behavior().definition(definition).register()
      }
      return self.behavior()
    }
    behaviorConstructor.trait = self.traitBehavior.bind(self)

    // prepare global vars and execute
    return cb({
      Page: pageConstructor,
      Component: componentConstructor,
      Behavior: behaviorConstructor,
    })
  }

  /**
   * Build a component outside of a definition environment
   *
   * The method do not need a definition environment, so the global object pollution is avoided.
   * `path` should be the component path (without ".js" extension).
   */
  component(path: string): DefaultComponentBuilder {
    return ComponentBuilder.create(this, path, this.waitingAliasMap[path])
  }

  /**
   * Build a behavior outside of a definition environment
   *
   * The method do not need a definition environment, so the global object pollution is avoided.
   */
  behavior(): DefaultBehaviorBuilder {
    return BehaviorBuilder.create(this)
  }

  /**
   * Define a trait behavior
   */
  traitBehavior<TIn extends { [key: string]: any }>(): TraitBehavior<TIn, TIn>
  traitBehavior<TIn extends { [key: string]: any }, TOut extends { [key: string]: any }>(
    trans: (impl: TIn) => TOut,
  ): TraitBehavior<TIn, TOut>
  traitBehavior<TIn extends { [key: string]: any }, TOut extends { [key: string]: any }>(
    trans?: (impl: TIn) => TOut,
  ): TraitBehavior<TIn, TOut> {
    if (trans === undefined) {
      return new TraitBehavior(this.space.defineTraitBehavior<TIn>())
    }
    return new TraitBehavior(this.space.defineTraitBehavior<TIn, TOut>(trans))
  }
}
