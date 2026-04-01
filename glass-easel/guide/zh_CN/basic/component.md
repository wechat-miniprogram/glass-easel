# 组件定义

本文档介绍组件定义中常用的各项配置。关于 API 风格的选择请参阅 [组件定义风格](./definition_style.md) 。关于各项配置的完整 API 参考请参阅 [组件定义 API 参考](../api/definition.md) 。

## template 模板

模板是组件的外观描述，它决定了组件渲染到页面上的结构。每个组件都应该指定一个编译后的模板对象：

```js
export const myComponent = componentSpace
  .define()
  .template(
    wxml(`
    <div>Hello world!</div>
  `),
  )
  .registerComponent()
```

> 📖 更多模板相关的用法请参阅 [模板](./template.md) 文档。

## data 数据

`data` 是组件内部的数据字段，用于驱动模板渲染。当数据发生变化时，模板会自动更新。

```js
export const myComponent = componentSpace
  .define()
  .template(
    wxml(`
    <div>{{ message }}</div>
  `),
  )
  .data(() => ({
    message: 'Hello world!',
  }))
  .registerComponent()
```

`data` 接受一个返回数据对象的**函数**，这样每个组件实例都能获得独立的数据副本。

## staticData 静态数据

`staticData` 是 `data` 的简化替代方案，直接传入一个数据对象而非函数。每次创建组件实例时，该对象会被自动深拷贝一份：

```js
export const myComponent = componentSpace
  .define()
  .template(
    wxml(`
    <div>{{ message }}</div>
  `),
  )
  .staticData({
    message: 'Hello world!',
  })
  .registerComponent()
```

> ⚠️ 如果多次调用 `staticData` ，后续的调用会**覆盖**而非合并之前的静态数据。如果需要多次添加数据字段，请使用 `data` 方法。

> 💡 `staticData` 在组件创建时需要进行一次深拷贝，因此对于包含复杂对象的场景，推荐使用 `data(() => ({ ... }))` 代替。 `data` 和 `staticData` 可以同时使用，`data` 中的字段会覆盖 `staticData` 中的同名字段。

## properties 属性

属性是组件对外暴露的数据字段，组件的使用者可以通过模板来指定属性值。属性值也可以在模板中直接引用。

最简单的写法是直接传一个类型构造器（如 `String` 、 `Number` 、 `Boolean` 、 `Array` 、 `Object` 、 `Function` 或 `null`）：

```js
export const add = componentSpace
  .define()
  .template(
    wxml(`
    <div>{{a}} + {{b}} = {{ a + b }}</div>
  `),
  )
  .property('a', Number)
  .property('b', Number)
  .registerComponent()
```

使用组件时可以指定属性值：

```xml
<add a="1" b="2" />
```

如果需要指定初始值，可以传入配置对象：

```js
export const myComponent = componentSpace
  .define()
  .property('b', {
    type: Number,
    value: 1,
  })
  .registerComponent()
```

也可以使用 `default` 工厂函数来生成初始值（推荐用于对象/数组类型）：

```js
property('list', {
  type: Array,
  default: () => [{ id: 1, name: 'item' }],
})
```

> 📖 关于属性类型构造器一览、类型转换规则、配置对象完整字段（`optionalTypes`、`observer`、`comparer`、`reflectIdPrefix` 等）的详细说明，请参阅 [组件定义 API 参考 — property](../api/definition.md#property-属性) 。

## init 函数

`init` 函数是实例初始化函数，每次创建组件实例时会执行一次。它是定义私有变量、注册生命周期、方法、数据监听器等逻辑的核心入口：

```js
export const helloWorld = componentSpace
  .define()
  .template(
    wxml(`
      <div>{{ hello }}</div>
    `),
  )
  .data(() => ({
    hello: 'Hello world!',
  }))
  .init(function ({ setData, lifetime, method }) {
    // 私有变量（不暴露到模板）
    let count = 0

    // 生命周期
    lifetime('attached', () => {
      count += 1
    })

    // 方法
    const greet = method(() => {
      setData({ hello: `Hello #${count}!` })
    })

    return { greet }
  })
  .registerComponent()
```

`init` 函数的第一个参数提供了一系列实用方法，常用的包括：

| 方法 | 说明 |
| --- | --- |
| `self` | 当前组件实例，等价于 `this` |
| `setData` | 更新数据，等价于 `this.setData` |
| `method` | 将函数标记为组件方法，可通过返回值导出 |
| `listener` | 将函数标记为事件监听器 |
| `lifetime` | 注册组件生命周期回调 |
| `pageLifetime` | 注册页面生命周期回调 |
| `observer` | 注册数据变化监听器 |
| `implement` | 实现一个 Trait Behavior |
| `relation` | 声明组件间关系 |

> 📖 关于 `init` 函数中每个方法的详细说明和示例，请参阅 [组件定义 API 参考 — init](../api/definition.md#init-函数) 。

## methods 方法

方法是定义在组件上的函数，可用于响应事件、执行逻辑等。

```js
export const myComponent = componentSpace
  .define()
  .template(
    wxml(`
    <div bind:tap="onTap">Click me</div>
  `),
  )
  .methods({
    onTap() {
      console.log('tapped')
      this.doSomething()
    },
    doSomething() {
      console.log('done')
    }
  })
  .registerComponent()
```

推荐在 `init` 函数中用 `method` 包裹方法，方法之间可以直接以函数变量的形式调用，无需通过 `this`。

> 📖 更多关于方法定义的详细用法请参阅 [方法](./method.md) 文档。

## using 引用其他组件

组件可以引用其他组件，在模板中使用它们。例如有另一个组件：

```js
export const childComponent = componentSpace
  .define()
  .template(
    wxml(`
      <div>Some text in child</div>
    `),
  )
  .registerComponent()
```

引用这个组件：

```js
export const helloWorld = componentSpace
  .define()
  .usingComponents({
    'my-child': childComponent,
  })
  .template(
    wxml(`
      <my-child />
    `),
  )
  .registerComponent()
```

`usingComponents` 的值可以是组件定义对象，也可以是组件的字符串路径名。

## lifetimes 生命周期

生命周期回调函数在组件的特定阶段自动触发。最常见的是 `attached` 生命周期，它在组件被添加到页面后触发：

```js
export const myComponent = componentSpace
  .define()
  .lifetime('attached', function () {
    console.log('component attached')
  })
  .lifetime('detached', function () {
    console.log('component detached')
  })
  .registerComponent()
```

> 📖 更多关于生命周期的详细说明请参阅 [生命周期](./lifetime.md) 文档。

## pageLifetimes 页面生命周期

页面生命周期是一种特殊的生命周期。 glass-easel 不会主动触发页面生命周期，只能通过调用组件实例的 `triggerPageLifetime` 来触发。触发时，页面生命周期会自动递归传播到所有子孙组件：

```js
export const myComponent = componentSpace
  .define()
  .pageLifetime('show', function () {
    console.log('page show')
  })
  .registerComponent()
```

> 📖 更多关于页面生命周期的说明请参阅 [生命周期](./lifetime.md) 文档。

## observers 数据监听器

数据监听器可以监听数据或属性字段的变化。当被监听的字段被 `setData` 设置时，监听器会被触发。

```js
export const myComponent = componentSpace
  .define()
  .data(() => ({
    a: 1,
    b: 2,
    sum: 3,
  }))
  .observer(['a', 'b'], function () {
    this.setData({
      sum: this.data.a + this.data.b,
    })
  })
  .registerComponent()
```

数据监听器支持监听子字段和使用通配符 `**` 监听所有子字段。

> 📖 更多关于数据监听器的详细说明请参阅 [数据监听器](../data_management/data_observer.md) 文档。

## behaviors 代码复用

behaviors 是一种组件间的代码共享机制，可以将共用的属性、方法、生命周期等逻辑抽离出来。

```js
// 定义一个 behavior
export const sharedBehavior = componentSpace
  .define()
  .property('shared', String)
  .lifetime('attached', function () {
    console.log('shared attached')
  })
  .registerBehavior()

// 引入 behavior
export const myComponent = componentSpace
  .define()
  .behavior(sharedBehavior)
  .template(
    wxml(`
    <div>{{ shared }}</div>
  `),
  )
  .registerComponent()
```

注意：一些字段不能写在 behaviors 中（会被忽略），包括 `template` 、 `using` 、 `generics` 、 `placeholders` 和 `options` 。

> ⚠️ 当多个 behavior 之间存在共同的祖先 behavior 时，会出现菱形继承的情况。glass-easel 在合并时会自动去重（同一个 behavior 实例只会被合并一次），但不同 behavior 中的同名字段仍可能互相覆盖。此外，普通 behavior 在 TypeScript 下的类型推导支持较弱。建议优先使用 [Trait Behaviors](../interaction/trait_behavior.md) 来实现组件间的接口共享。

> 📖 更多关于 behaviors 的详细说明请参阅 [普通 Behaviors](../interaction/behavior.md) 和 [Trait Behaviors](../interaction/trait_behavior.md) 文档。

## implement 实现 Trait Behavior

`implement` Chaining 方法用于在组件定义时静态地实现一个 [Trait Behavior](../interaction/trait_behavior.md) 。Trait Behavior 类似于 TypeScript 中的接口，它要求实现者提供一组方法：

```js
// 定义一个 trait behavior
const greetTrait = componentSpace.defineTraitBehavior()

export const myComponent = componentSpace
  .define()
  .implement(greetTrait, {
    greet() {
      return 'hello'
    },
  })
  .registerComponent()
```

也可以在 `init` 函数中通过 `implement` 动态实现 Trait Behavior 。

> 📖 更多关于 Trait Behavior 的详细说明请参阅 [Trait Behaviors](../interaction/trait_behavior.md) 文档。

## relations 组件间关系

当组件之间存在紧密的逻辑联系时（例如 `<form>` 与 `<input>` ），可以使用 `relations` 使它们相互获取组件实例，并在关联、移动、解除关联时执行额外逻辑。

```js
export const parentComponent = componentSpace
  .define('my/parent')
  .relation('./child', {
    type: 'child',
    linked(target) {
      console.log('child linked', target)
    },
    unlinked(target) {
      console.log('child unlinked', target)
    },
  })
  .registerComponent()
```

relations 必须**成对使用**——父组件和子组件双方都需要声明对应的关联。

> 📖 更多关于组件间关系的详细说明请参阅 [组件间关系](../interaction/relation.md) 文档。

## generics 抽象节点

当组件模板中某些节点对应的具体组件不确定时，可以将它设置为**抽象节点**（generic），由父组件在使用时指定其实现：

```js
export const listComponent = componentSpace
  .define()
  .generics({
    item: true,
  })
  .template(
    wxml(`
    <item />
  `),
  )
  .registerComponent()
```

使用时通过 `generic:` 指定实现组件：

```xml
<list generic:item="my-item" />
```

也可以为抽象节点提供默认实现：

```js
export const listComponent = componentSpace
  .define()
  .generics({
    item: {
      default: defaultItemComponent,
    },
  })
  .template(
    wxml(`
    <item />
  `),
  )
  .registerComponent()
```

> 📖 更多关于抽象节点的详细说明请参阅 [抽象节点](../interaction/generic.md) 文档。

## placeholders 占位组件

当一些组件需要延迟加载时，可以先使用占位组件临时替代。等到组件被注册后，占位组件会被自动替换：

```js
export const myComponent = componentSpace
  .define()
  .usingComponents({
    child: 'lazy-components/child',
    placeholder: placeholderComponent,
  })
  .placeholders({
    child: 'placeholder',
  })
  .registerComponent()
```

> 📖 更多关于占位组件的详细说明请参阅 [占位组件](../interaction/placeholder.md) 文档。

## externalClasses 外部样式类

外部样式类允许组件的使用者从外部传入样式类名，从而自定义组件的部分样式：

```js
export const childComponent = componentSpace
  .define()
  .externalClasses(['my-class'])
  .template(
    wxml(`
      <div class="my-class" />
    `),
  )
  .registerComponent()
```

使用组件时传入样式类：

```xml
<child my-class="some-class" />
```

> 📖 更多关于外部样式类的详细说明请参阅 [外部样式类](../styling/external_class.md) 文档。

## options 组件选项

`options` 用于配置组件的各种行为选项，例如：

```js
export const myComponent = componentSpace
  .define()
  .options({
    virtualHost: true,
    multipleSlots: true,
    pureDataPattern: /^_/,
  })
  .registerComponent()
```

> 📖 关于所有可用选项的完整列表和说明，请参阅 [组件配置](../advanced/component_options.md) 文档。

## 更多高级配置

以下是一些不太常用的高级组件定义配置，详细说明请参阅 [组件定义 API 参考](../api/definition.md) ：

- **[`definition`](../api/definition.md#definition-混入经典风格定义)** — 在 Chaining API 中混入 Definition API 风格的配置对象
- **[`chainingFilter`](../api/definition.md#chainingfilter-chaining-过滤器)** — 定义 Chaining API 层面的中间件
- **[`methodCallerInit`](../api/definition.md#methodcallerinit-方法调用者初始化)** — 自定义方法调用者的 `this` 对象
- **[`extraThisFieldsType`](../api/definition.md#extrathistfieldstype-额外-this-字段类型)** — TypeScript 类型辅助，为 `this` 添加额外字段类型
