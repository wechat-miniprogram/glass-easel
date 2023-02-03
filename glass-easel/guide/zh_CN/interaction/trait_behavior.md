# Trait Behaviors

## 定义和实现 trait behavior

trait behaviors 是一种组件间共享接口的机制，也可以用于给组件归类（类似于一些编程语言的 trait ）。

在 TypeScript 下，通过 trait behaviors ，可以定义一组接口方法，若干组件都可以实现这组接口方法。这样，在外部访问这些组件时，可以不关注组件具体是什么，只需要关心组件提供的接口。例如，在 TypeScript 中定义并实现一个 trait behavior ：

```ts
// 定义一个 trait behavior
interface AddMinus {
  add(a: number, b: number): number
  minus(a: number, b: number): number
}
const addMinusTrait = componentSpace.defineTraitBehavior<AddMinus>()

// 使用 Chaining API 实现 trait behavior
const childComponent = componentSpace.define()
  .implement(addMinusTrait, {
    add(a, b) {
      return a + b
    },
    minus(a, b) {
      return a - b
    },
  })
  .defineComponent()
// 或在 init 中实现 trait behavior
const childComponent = componentSpace.define()
  .init(function ({ implement }) {
    implement(addMinusTrait, {
      add(a, b) {
        return a + b
      },
      minus(a, b) {
        return a - b
      },
    })
  })
  .defineComponent()
```

在从组件外访问这个组件时，可以使用 trait behavior ：

```ts
const myComponent = componentSpace.define()
  .usingComponents({
    child: childComponent,
  })
  .template(compileTemplate(`
    <child id="c" />
  `))
  .lifetime('attached', function () {
    // 获取到子组件对应的节点
    const child = this.shadowRoot.querySelector('#c')!
    // 获得它对应的 addMinusTrait 的实现
    const impl = child.traitBehavior(addMinusTrait)!
    // 调用其中方法
    impl.add(1, 2) === 3 // true
    impl.minus(5, 3) === 2 // true
  })
```

这样，在使用组件时就不需要关心组件具体实现，只需要关心组件提供的 trait behavior ，利于代码解耦。

## 含接口转换的 trait behavior

trait behavior 本身可以做一些接口转换，使得提供的接口比需要实现的接口更丰富。

例如， `addMinusTrait` 提供 `add` 和 `minus` 两个接口方法，但可以只要求实现者实现 `add` 接口方法：

```ts
interface Add {
  add(a: number, b: number): number
}
interface AddMinus {
  add(a: number, b: number): number
  minus(a: number, b: number): number
}
// 这个 trait behavior 要求实现 add 接口方法，但可以提供 add 和 minus 两个接口方法
const addMinusTrait = componentSpace.defineTraitBehavior<Add, AddMinus>((impl) => ({
  // 具体而言：
  // 入参中的 impl 是对 interface Add 的实现
  // 这里需要返回对 interface AddMinus 的实现
  add(a: number, b: number): number {
    return impl.add(a, b)
  },
  // 需要额外实现 minus 接口方法
  minus(a: number, b: number): number {
    return impl.add(a, -b)
  },
}))

const childComponent = componentSpace.define()
  .implement(addMinusTrait, {
    // 对于实现者，只需要实现 add 接口方法
    add(a, b) {
      return a + b
    }
  })
  .defineComponent()

const myComponent = componentSpace.define()
  .usingComponents({
    child: childComponent,
  })
  .template(compileTemplate(`
    <child id="c" />
  `))
  .lifetime('attached', function () {
    const child = this.shadowRoot.querySelector('#c')!
    const impl = child.traitBehavior(addMinusTrait)!
    // 可以调用 add 和 minus 两个接口
    impl.add(1, 2) === 3 // true
    impl.minus(5, 3) === 2 // true
  })
```
