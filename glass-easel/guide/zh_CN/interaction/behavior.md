# 普通 Behaviors

behaviors 是一种简单的组件间代码共享机制。通过 behaviors ，可以将几个组件间共享的部分逻辑抽离出来，然后在多个组件中引用，避免重复代码。

## 定义和使用 behavior

可以使用 `componentSpace.define()` 定义一个 behavior ，在其中声明属性、数据、方法等，最后通过 `.registerBehavior()` 注册。组件通过 `.behavior()` 引入后， behavior 中声明的内容会被合并到组件中。

```js
// 定义一个 behavior ，声明共享的属性
export const sharedBehavior = componentSpace.define()
  .property('a', Number)
  .registerBehavior()

// 引入 behavior ，其属性会与组件自身的属性合并
export const myComponent = componentSpace.define()
  .behavior(sharedBehavior)
  .property('b', String)
  .template(wxml(`
    <div>{{a}}</div>
    <div>{{b}}</div>
  `))
  .registerComponent()
```

上面的例子中， `sharedBehavior` 声明了属性 `a` ，而 `myComponent` 自身声明了属性 `b` 。由于引入了 `sharedBehavior` ，组件最终会同时拥有 `a` 和 `b` 两个属性，因而模板中可以同时引用它们。

## behavior 中的字段限制

需要注意，有些内容不能写在 behavior 中（会被忽略）：

* `.template()` —— 模板无法很好地合并，所以不能写在 behavior 中。
* `.usingComponents()` `.generics()` `.placeholder()` —— 由于涉及模板中的节点信息，也不能写在 behavior 中。
* `.options()` —— 是针对组件的配置，不能写在 behavior 中。

除此以外的属性、数据、方法、生命周期等均可在 behavior 中声明。

## 引入多个 behaviors

一个组件可以同时引入多个 behaviors ，它们的字段会依次合并：

```js
export const behaviorA = componentSpace.define()
  .property('a', Number)
  .registerBehavior()

export const behaviorB = componentSpace.define()
  .property('b', String)
  .registerBehavior()

export const myComponent = componentSpace.define()
  .behavior(behaviorA)
  .behavior(behaviorB)
  .property('c', Boolean)
  .template(wxml(`
    <div>{{a}}</div>
    <div>{{b}}</div>
    <div>{{c}}</div>
  `))
  .registerComponent()
```

## 菱形继承

当多个 behavior 之间存在共同的祖先 behavior 时，会出现菱形继承的情况。例如：

```
       base
      /    \
  behaviorB  behaviorC
      \    /
    myComponent
```

glass-easel 在合并 behaviors 时，对**生命周期**、**页面生命周期**、**数据监听器**和 **init 函数**的去重行为取决于 `once` 参数：

* 当 `once` 为 `true` 时，如果同一个回调函数实例已经被合并过，就不会重复添加。
* 当 `once` 为 `false`（默认）时，即使是同一个回调函数实例在菱形继承中被多个 behavior 引入，也会被重复添加。

通过 `.lifetime()` 、 `.pageLifetime()` 、 `.observer()` 和 `.init()` 注册的回调都支持传入 `once` 参数（默认为 `false`）；而通过 `.definition()` 经典 API 注册的回调则默认 `once` 为 `true` 。

```js
// 公共祖先 behavior
const base = componentSpace.define()
  // once 为 true ，菱形继承时只会执行一次
  .lifetime('attached', function () {
    console.log('base attached (once)')
  }, true)
  // once 为 false （默认），菱形继承时会执行多次
  .lifetime('attached', function () {
    console.log('base attached (not once)')
  })
  .registerBehavior()

const behaviorB = componentSpace.define()
  .behavior(base)
  .registerBehavior()

const behaviorC = componentSpace.define()
  .behavior(base)
  .registerBehavior()

const myComponent = componentSpace.define()
  .behavior(behaviorB)
  .behavior(behaviorC)
  .template(wxml(`<div />`)
  .registerComponent()
// 'base attached (once)' 只输出一次（被自动去重）
// 'base attached (not once)' 输出两次（分别从 behaviorB 和 behaviorC 引入）
```

在上面的菱形继承例子中， `base` 中标记了 `once` 为 `true` 的 `attached` 回调只会执行一次；而默认 `once` 为 `false` 的回调则会因为被 `behaviorB` 和 `behaviorC` 各引入一次而执行两次。

## 字段冲突时的覆盖规则

当多个 behavior 中存在同名字段时，不同类型的字段有不同的合并策略：

* **属性 (property)** 和 **方法 (method)** —— 后引入的覆盖先引入的。如果组件自身也声明了同名字段，则以组件自身为准。
* **数据 (data)** —— 对象类型的数据会进行浅合并（递归一层合并子字段），非对象类型则后者覆盖前者。
* **生命周期 (lifetime)** 、**页面生命周期 (pageLifetime)** 和**数据监听器 (observer)** —— 不会互相覆盖，而是按引入顺序依次执行。

```js
const behaviorX = componentSpace.define()
  .property('val', { type: Number, value: 1 })
  .method('greet', function () { return 'hello from X' })
  .lifetime('attached', function () { console.log('X attached') })
  .registerBehavior()

const behaviorY = componentSpace.define()
  .property('val', { type: Number, value: 2 })
  .method('greet', function () { return 'hello from Y' })
  .lifetime('attached', function () { console.log('Y attached') })
  .registerBehavior()

const myComponent = componentSpace.define()
  .behavior(behaviorX)
  .behavior(behaviorY)
  .template(wxml(`
    <div>{{val}}</div>
  `))
  .registerComponent()
// property `val` 的默认值为 2（behaviorY 覆盖了 behaviorX）
// method `greet` 返回 'hello from Y'（behaviorY 覆盖了 behaviorX）
// 但两个 attached 生命周期都会执行，先输出 'X attached' 再输出 'Y attached'
```

> ⚠️ 普通 behavior 在 TypeScript 下的类型推导支持较弱。如果需要更好的类型支持和接口约束，建议使用 [Trait Behaviors](./trait_behavior.md) 来实现组件间的接口共享。
