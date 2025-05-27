import { type DeepCopyKind, type typeUtils as utils } from 'glass-easel'
import type { DefinitionFilter, GeneralBehavior } from './behavior'
import { type GeneralComponent } from './component'
import type { RelationParams } from './builder/type_utils'

export { typeUtils as utils } from 'glass-easel'

export const enum StyleIsolation {
  Isolated = 'isolated',
  ApplyShared = 'apply-shared',
  Shared = 'shared',
  PageIsolated = 'page-isolated',
  PageApplyShared = 'page-apply-shared',
  PageShared = 'page-shared',
}

export type ComponentStaticConfig = {
  component?: boolean
  usingComponents?: { [name: string]: string }
  componentGenerics?: {
    [name: string]: true | { default?: string }
  }
  componentPlaceholder?: { [name: string]: string }
  styleIsolation?: StyleIsolation
  /** @obsolete */
  addGlobalClass?: boolean
  pureDataPattern?: string
}

export type ComponentDefinitionOptions = {
  multipleSlots?: boolean
  dynamicSlots?: boolean
  pureDataPattern?: RegExp
  virtualHost?: boolean
  dataDeepCopy?: DeepCopyKind
  propertyPassingDeepCopy?: DeepCopyKind
  propertyEarlyInit?: boolean
}

type ComponentMethod = utils.ComponentMethod

export type BehaviorDefinition<
  TData extends utils.DataList,
  TProperty extends utils.PropertyList,
  TMethod extends utils.MethodList,
  TComponentExport,
> = {
  behaviors?: GeneralBehavior[]
  properties?: TProperty
  data?: TData | (() => TData)
  observers?:
    | {
        fields?: string
        observer: ComponentMethod
      }[]
    | { [fields: string]: ComponentMethod }
  methods?: TMethod
  created?: ComponentMethod
  attached?: ComponentMethod
  ready?: ComponentMethod
  moved?: ComponentMethod
  detached?: ComponentMethod
  lifetimes?: { [name: string]: ComponentMethod }
  pageLifetimes?: { [name: string]: ComponentMethod }
  relations?: Record<string, RelationParams>
  externalClasses?: string[]
  definitionFilter?: DefinitionFilter
  export?: (source: GeneralComponent | null) => TComponentExport
}

export type ComponentDefinition<
  TData extends utils.DataList,
  TProperty extends utils.PropertyList,
  TMethod extends utils.MethodList,
  TComponentExport,
> = {
  options?: ComponentDefinitionOptions
} & BehaviorDefinition<TData, TProperty, TMethod, TComponentExport>

export type GeneralComponentDefinition = ComponentDefinition<any, any, any, any>

export type PageDefinition<
  TData extends utils.DataList,
  TExtraFields extends { [k: PropertyKey]: any },
> = TExtraFields & {
  options?: ComponentDefinitionOptions
  behaviors?: GeneralBehavior[]
  data?: TData
}
