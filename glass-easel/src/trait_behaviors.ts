import { ComponentSpace } from '.'

/**
 * Interface that can be implement dynamically
 *
 * A `TraitBehavior` is like a TypeScript interface, but can be implemented dynamically.
 * It requires the implementors to implement `TIn` .
 * Also, it can provide do a transform from `TIn` to `TOut` as common logic of the trait.
 */
export class TraitBehavior<
  TIn extends { [key: string]: unknown },
  TOut extends { [key: string]: unknown } = TIn,
> {
  /** @internal */
  private _$trans?: (impl: TIn) => TOut
  ownerSpace: ComponentSpace

  /** @internal */
  // eslint-disable-next-line no-useless-constructor
  constructor(ownerSpace: ComponentSpace, trans?: (impl: TIn) => TOut) {
    this.ownerSpace = ownerSpace
    this._$trans = trans
  }

  /** @internal */
  _$implement(impl: TIn): TOut {
    return this._$trans?.(impl) || (impl as unknown as TOut)
  }
}

/**
 * A manager that can implement multiple different trait behaviors
 */
export class TraitGroup {
  private _$traits: WeakMap<TraitBehavior<any, any>, unknown> = new WeakMap()

  implement<
    TIn extends { [key: string]: unknown },
    TOut extends { [key: string]: unknown }
  >(traitBehavior: TraitBehavior<TIn, TOut>, impl: TIn) {
    const traitImpl = traitBehavior._$implement(impl)
    this._$traits.set(traitBehavior, traitImpl)
  }

  get<
    TIn extends { [key: string]: unknown },
    TOut extends { [key: string]: unknown }
  >(traitBehavior: TraitBehavior<TIn, TOut>): TOut | undefined {
    return this._$traits.get(traitBehavior) as TOut | undefined
  }
}
