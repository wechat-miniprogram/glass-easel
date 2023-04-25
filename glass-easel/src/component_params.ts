import {
  GeneralBehavior,
  Component,
  GeneralComponentDefinition,
  ComponentOptions,
  GeneralComponent,
  GeneralBehaviorBuilder,
} from '.'
import { TraitBehavior } from './trait_behaviors'

export type Empty = Record<never, never>

export type NewField<TObject, TField extends string, TValueType> = Extract<
  keyof TObject,
  TField
> extends never
  ? TValueType
  : never

export type NewFieldList<TObject, TNewObject> = Extract<
  keyof TObject,
  keyof TNewObject
> extends never
  ? TNewObject
  : never

export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
  ? true
  : false

/**
 * UnionToIntersection<'foo' | 42 | true> = 'foo' & 42 & true
 * UnionToIntersection<(() => 'foo') | ((i: 42) => true)> = (() => 'foo') & ((i: 42) => true)
 */
export type UnionToIntersection<T> = (T extends unknown ? (arg: T) => void : never) extends (
  args: infer Arg,
) => void
  ? Arg
  : never

/**
 * Merge<{ foo: string }, { bar: number }> = { foo: string, bar: number }
 */
export type Merge<U> = U extends infer T ? { [K in keyof T]: T[K] } : never

/**
 * IsAny<any> = true
 * IsAny<{}> = false
 */
export type IsAny<T> = (<S>(S: S) => S extends T ? 1 : 2) extends <R>(R: R) => R extends any ? 1 : 2
  ? true
  : false

/**
 * IsNever<never> = true
 * IsNever<unknown> = false
 * IsNever<any> = false
 */
export type IsNever<T> = [T] extends [never] ? true : false

type SetDataStringPath<K extends string | number, Prefix extends string> = [Prefix] extends [never]
  ? `${K}`
  : K extends number
  ? `${Prefix}[${K}]`
  : `${Prefix}.${K}`

/**
 * SetDataSetter<{ name: string; foo: { bar: number } }> = {
 *   name: string,
 *   foo: { bar: number },
 *   'foo.bar': number,
 * }
 * setDataSetter<{ list: number[], foo: { bar: number }[]}> = {
 *   list: number[],
 *   `list[${number}]`: number,
 *   foo: { bar: number }[],
 *   `foo[${number}]`: { bar: number }[],
 *   `foo[${number}].bar`: number,
 * }
 */
export type SetDataSetter<T, Prefix extends string = never> = IsAny<T> extends true
  ? Record<SetDataStringPath<any, Prefix>, T>
  : UnionToIntersection<
      T extends any[]
        ? {
            [P in keyof T & number]: SetDataSetter<T[P], SetDataStringPath<P, Prefix>> &
              Record<SetDataStringPath<P, Prefix>, T[P]>
          }[keyof T & number]
        : T extends Record<string | number, any>
        ? {
            [P in keyof T & (string | number)]: SetDataSetter<T[P], SetDataStringPath<P, Prefix>> &
              Record<SetDataStringPath<P, Prefix>, T[P]>
          }[keyof T & (string | number)]
        : never
    >

/**
 * DeepReadonly<{ foo: { bar: number } }> = {
 *   readonly foo: {
 *     readonly bar: number
 *   }
 * }
 */
export type DeepReadonly<T> = T extends Record<any, any>
  ? T extends (...args: any[]) => any
    ? T
    : { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T

export type PublicFields<T> = {
  [K in keyof T as K extends `_$${any}` ? never : K]: T[K]
}

/**
 * ObjectKeyPaths<{ name: string; age: number }> = 'name' | 'age'
 * ObjectKeyPaths<{
 *   refCount: number;
 *   person: { name: string; age: number };
 * }> = 'refCount' | 'person' | 'person.name' | 'person.age'
 * ObjectKeyPaths<{ books: [{ name: string; price: number }] }> =
 *   'books' | `books[${number}]` | `books[${number}].name` | `books[${number}].price`
 */
export type ObjectDataPathStrings<T, Prefix extends string = never> = IsAny<T> extends true
  ? SetDataStringPath<any, Prefix>
  : T extends any[]
  ? {
      [P in keyof T & number]:
        | SetDataStringPath<P, Prefix>
        | ObjectDataPathStrings<T[P], SetDataStringPath<P, Prefix>>
    }[keyof T & number]
  : T extends Record<string | number, any>
  ? {
      [P in keyof T & (string | number)]:
        | SetDataStringPath<P, Prefix>
        | ObjectDataPathStrings<T[P], SetDataStringPath<P, Prefix>>
    }[keyof T & (string | number)]
  : Prefix

export type ObserverDataPathStrings<T, S extends string = ObjectDataPathStrings<T>> =
  | '**'
  | S
  | `${S}.**`

/**
 * GetFromDataPathString<{ name: string; age: number }, 'name'> = string
 * GetFromDataPathString<{ person: { name: string; age: number } }, 'person.name'> = string
 * GetFromDataPathString<{ books: [{ name: string; price: number }] }, 'books[0].name'> = string
 */
export type GetFromDataPathString<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends ''
  ? T
  : P extends `[${infer K extends keyof T & number}].${infer R}`
  ? GetFromDataPathString<T[K], R>
  : P extends `[${infer K extends keyof T & number}]${infer R}`
  ? GetFromDataPathString<T[K], R>
  : P extends `${infer K extends keyof T & string}[${infer R}`
  ? GetFromDataPathString<T[K], `[${R}`>
  : P extends `${infer K extends keyof T & string}.${infer R}`
  ? GetFromDataPathString<T[K], R>
  : never

export type GetFromObserverPathString<T, P extends string> = P extends '**'
  ? GetFromDataPathString<T, ''>
  : P extends `${infer K}.**`
  ? GetFromDataPathString<T, K>
  : GetFromDataPathString<T, P>

/**
 * GetFromDataPath<{ foo: { bar: number } }, ['foo', 'bar']> = number
 * GetFromDataPath<{ list: { bar: number }[] }, ['list', 0, 'bar']> = number
 * GetFromDataPath<{ list: number }, ['nonExists']> = never
 */
export type GetFromDataPath<T, K extends readonly (string | number)[]> = K extends [
  infer F,
  ...infer R extends (string | number)[],
]
  ? F extends keyof T
    ? GetFromDataPath<T[F], R>
    : never
  : T

declare const TaggedSymbol: unique symbol
type Tagged = typeof TaggedSymbol

type IfNeverOrAny<T, Replacement> = [T] extends [never]
  ? Replacement
  : 1 extends T & 0
  ? Replacement
  : T

type GetTags<B> = B extends {
  readonly [Tag in Tagged]: infer Tags extends symbol[]
}
  ? Tags
  : []

type GetTagsWithout<B, T extends symbol, Tags = GetTags<B>> = Tags extends [infer F, ...infer R]
  ? Equal<T, F> extends true
    ? GetTagsWithout<B, T, R>
    : [F, ...GetTagsWithout<B, T, R>]
  : []

type UnTagAll<B> = Tagged extends keyof IfNeverOrAny<B, unknown>
  ? B extends infer Origin & { readonly [Tag in Tagged]: GetTags<B> }
    ? Origin
    : B
  : B

export type Tag<B, T extends symbol> = [IfNeverOrAny<B, unknown>] extends [null | undefined]
  ? B
  : UnTagAll<B> & { readonly [Tag in Tagged]: [...GetTags<B>, T] }

export type UnTag<
  B,
  T extends symbol,
  Tags = GetTagsWithout<B, T>,
> = Tagged extends keyof IfNeverOrAny<B, unknown>
  ? Tags extends []
    ? UnTagAll<B>
    : UnTagAll<B> & { readonly [Tag in Tagged]: Tags }
  : B

export type HasTag<B, T extends symbol> = T extends GetTags<B>[number] ? true : false

export type DataList = Record<string, unknown>
export type PropertyList = Record<string, PropertyListItem<any, unknown>>

export type PropertyType =
  | null
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ArrayConstructor
  | ObjectConstructor
  | FunctionConstructor

/**
 * PropertyTypeToValueType<null> = any
 * PropertyTypeToValueType<typeof String> = string
 * PropertyTypeToValueType<typeof Number> = number
 */
export type PropertyTypeToValueType<T extends PropertyType> = T extends null
  ? any
  : T extends StringConstructor
  ? string
  : T extends NumberConstructor
  ? number
  : T extends BooleanConstructor
  ? boolean
  : T extends ArrayConstructor
  ? any[]
  : T extends ObjectConstructor
  ? Record<string, any> | null
  : T extends FunctionConstructor
  ? (...args: any[]) => any
  : never

type Satisfy<T, V> = V extends T ? V : T

/**
 * PropertyTypeToSimpleValueType<typeof String, 'foo'> = 'foo'
 * PropertyTypeToSimpleValueType<typeof String, 123> = string
 */
type PropertyTypeToSimpleValueType<T extends PropertyType, V> = T extends StringConstructor
  ? Satisfy<string, V>
  : T extends NumberConstructor
  ? Satisfy<number, V>
  : T extends BooleanConstructor
  ? Satisfy<boolean, V>
  : T extends ArrayConstructor
  ? Satisfy<any[], V>
  : T extends ObjectConstructor
  ? Satisfy<Record<string, any> | null, V>
  : T extends FunctionConstructor
  ? Satisfy<(...args: any[]) => any, V>
  : never

/**
 * PropertyValueType<null> = any
 * PropertyValueType<typeof String> = string
 * PropertyValueType<typeof String | typeof Number> = string | number
 * PropertyValueType<{ type: typeof String }> = string
 * PropertyValueType<{ type: typeof String, optionalTypes: [typeof Number] }> = string | number
 * PropertyValueType<{ type: typeof String, value: 'foo' }> = 'foo'
 * PropertyValueType<{ type: typeof String, value: 123 }> = never
 * PropertyValueType<{ type: typeof String, optionalTypes: [typeof Number], value: 123 }> =
 *  string | 123
 */
type PropertyValueType<P extends PropertyListItem<PropertyType, any>> = P extends PropertyListItem<
  infer T,
  infer V
>
  ? unknown extends V
    ? PropertyTypeToValueType<T>
    : ((a: T) => void) extends (a: PropertyType) => void
    ? V
    : V extends PropertyTypeToValueType<T>
    ? PropertyTypeToSimpleValueType<T, V>
    : never
  : never

export type PropertyOption<T extends PropertyType, V> = {
  type?: T
  optionalTypes?: T[]
  value?: V
  default?: () => V
  observer?: ((newValue: DeepReadonly<V>, oldValue: DeepReadonly<V>) => void) | string
  comparer?: (newValue: DeepReadonly<V>, oldValue: DeepReadonly<V>) => boolean
  reflectIdPrefix?: boolean
}

export type PropertyListItem<T extends PropertyType, V> = T | PropertyOption<T, V>

export type PropertyValues<P extends PropertyList> = {
  [key in keyof P]: PropertyValueType<P[key]>
}

export type DataWithPropertyValues<TData extends DataList, TProperty extends PropertyList> = TData &
  PropertyValues<TProperty>

export type ComponentMethod = (...args: any[]) => any

export type MethodList = Record<string, ComponentMethod>

export const METHOD_TAG = Symbol('method')

export type TaggedMethod<Fn extends ComponentMethod> = Tag<Fn, typeof METHOD_TAG>

export type UnTaggedMethod<M extends TaggedMethod<any>> = UnTag<M, typeof METHOD_TAG>

export type RelationParams = {
  target?: string | GeneralComponentDefinition | GeneralBehavior | TraitBehavior<any>
  type: 'ancestor' | 'descendant' | 'parent' | 'child' | 'parent-common-node' | 'child-common-node'
  linked?: (target: GeneralComponent) => void
  linkChanged?: (target: GeneralComponent) => void
  unlinked?: (target: GeneralComponent) => void
  linkFailed?: (target: GeneralComponent) => void
}

export type RelationParamsWithKey = {
  [name: string]: RelationParams
}

export type TraitRelationParams<TOut extends { [key: string]: any }> = {
  target: TraitBehavior<any, TOut>
  type: 'ancestor' | 'descendant' | 'parent' | 'child' | 'parent-common-node' | 'child-common-node'
  linked?: (target: GeneralComponent) => void
  linkChanged?: (target: GeneralComponent) => void
  unlinked?: (target: GeneralComponent) => void
  linkFailed?: (target: GeneralComponent) => void
}

export type ChainingFilterFunc<
  TAddedFields extends { [key: string]: any },
  TRemovedFields extends string = never,
> = (chain: GeneralBehaviorBuilder) => Omit<GeneralBehaviorBuilder, TRemovedFields> & TAddedFields

export type ChainingFilterType = {
  add: { [key: string]: any }
  remove: string
}

export type ComponentInstance<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
> = Component<TData, TProperty, TMethod> & {
  data: DeepReadonly<DataWithPropertyValues<TData, TProperty>>
  properties: DeepReadonly<DataWithPropertyValues<TData, TProperty>>
} & TMethod

export type ComponentParams<
  TData extends DataList,
  TProperty extends PropertyList,
  TMethod extends MethodList,
> = {
  is?: string
  behaviors?: (string | GeneralBehavior)[]
  using?: { [name: string]: string | GeneralComponentDefinition }
  generics?: {
    [name: string]: { default: string | GeneralComponentDefinition } | true
  }
  placeholders?: { [name: string]: string }
  template?: { [key: string]: any } | null
  externalClasses?: string[]
  data?: TData | (() => TData)
  properties?: TProperty
  methods?: TMethod
  listeners?: { [name: string]: ComponentMethod | string }
  relations?: RelationParamsWithKey
  lifetimes?: { [name: string]: ComponentMethod }
  created?: () => any
  attached?: ComponentMethod
  moved?: ComponentMethod
  detached?: ComponentMethod
  ready?: ComponentMethod
  pageLifetimes?: { [name: string]: ComponentMethod }
  observers?:
    | {
        fields?: string
        observer: ComponentMethod | string
      }[]
    | { [fields: string]: ComponentMethod | string }
  options?: ComponentOptions
}

export type GeneralComponentInstance = ComponentInstance<
  Record<string, any>,
  Record<string, any>,
  Record<string, any>
>
