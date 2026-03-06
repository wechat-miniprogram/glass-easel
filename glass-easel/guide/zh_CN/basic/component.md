# 组件定义

本文档介绍组件定义中常用的各项配置。关于 API 风格的选择请参阅 [组件定义风格](./definition_style.md) 。

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

最简单的写法是直接传一个类型构造器：

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

### 类型构造器一览

声明 properties 属性时可使用的所有类型构造器：

| 类型构造器 | 对应值类型                    | 默认值          | 说明                   |
| ---------- | ----------------------------- | --------------- | ---------------------- |
| `String`   | `string`                      | `''`            | 字符串类型             |
| `Number`   | `number`                      | `0`             | 数值类型               |
| `Boolean`  | `boolean`                     | `false`         | 布尔类型               |
| `Array`    | `any[]`                       | `[]`            | 数组类型               |
| `Object`   | `Record<string, any> \| null` | `null`          | 对象类型               |
| `Function` | `(...args: any[]) => any`     | `function() {}` | 函数类型               |
| `null`     | `any`                         | `null`          | 任意类型，不做类型校验 |

> 💡 当属性未指定 `value` 或 `default` 时，会自动使用上表中对应类型的默认值作为初始值。

当传入的属性值与声明的类型不匹配时，glass-easel 会尝试进行类型转换或回退到默认值，具体规则如下：

| 声明类型           | 转换行为                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `String`           | 会被 `String()` 强制转换；`null` / `undefined` 回退为默认值 `''`                              |
| `Number`           | 仅接受 `typeof value === 'number'` 的值（包括 `NaN` 和 `Infinity`）; 非数字值回退为默认值 `0` |
| `Boolean`          | 任何值都会被 `!!` 强制转换为布尔值                                                            |
| `Array`            | 仅接受能通过 `Array.isArray` 检查的数组，非数组值回退为默认值 `[]`                            |
| `Object`           | 仅接受 `typeof value === 'object'` 的值（包括 `null`），非对象值回退为默认值 `null`           |
| `Function`         | 仅接受 `typeof value === 'function'` 的函数，非函数值回退为默认值                             |
| `null`（任意类型） | 接受除 `undefined` 以外的任何值；`undefined` 回退为默认值 `null`                              |

如果属性声明了 `optionalTypes` ，会先尝试匹配 `optionalTypes` 中的类型，如果匹配成功则直接使用原始值；否则再按照主类型 `type` 的规则进行转换。

除了使用 JavaScript 原生的构造器（如 `String` 、 `Number` 等）之外，也可以使用 `glassEasel.NormalizedPropertyType` 枚举值来声明类型：

```js
import * as glassEasel from 'glass-easel'

export const myComponent = componentSpace
  .define()
  .property('name', glassEasel.NormalizedPropertyType.String)
  .registerComponent()
```

`NormalizedPropertyType` 枚举值与构造器的对应关系如下：

| 构造器     | 枚举值                            |
| ---------- | --------------------------------- |
| `String`   | `NormalizedPropertyType.String`   |
| `Number`   | `NormalizedPropertyType.Number`   |
| `Boolean`  | `NormalizedPropertyType.Boolean`  |
| `Array`    | `NormalizedPropertyType.Array`    |
| `Object`   | `NormalizedPropertyType.Object`   |
| `Function` | `NormalizedPropertyType.Function` |
| `null`     | `NormalizedPropertyType.Any`      |

### 属性配置对象

除了直接传类型构造器之外，还可以传入一个配置对象来进行更精细的控制：

```js
export const myComponent = componentSpace
  .define()
  .property('b', {
    type: Number,
    value: 1,
  })
  .registerComponent()
```

配置对象支持的完整字段如下：

| 字段              | 类型                                       | 说明                                                                                                                        |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `type`            | `PropertyType`                             | 属性的类型构造器。默认为 `null`                                                                                             |
| `optionalTypes`   | `PropertyType[]`                           | 属性可接受的额外类型列表，属性值可以是 `type` 或 `optionalTypes` 中的任意一种类型                                           |
| `value`           | 与类型对应的值                             | 属性的初始值。如果未指定，会使用该类型的默认值。如果同时指定了 `default` 和 `value` ，则 `value` 会被忽略                   |
| `default`         | `() => V`                                  | 返回属性初始值的工厂函数。适用于初始值需要每个实例独立生成的场景。如果同时指定了 `default` 和 `value` ，则 `value` 会被忽略 |
| `observer`        | `((newValue, oldValue) => void) \| string` | 属性值变化时的监听回调。可以传入函数，也可以传入方法名字符串                                                                |
| `comparer`        | `(newValue, oldValue) => boolean`          | 自定义属性值比较函数。返回 `true` 表示值已改变（需要更新），返回 `false` 表示值未变（跳过更新）。默认使用 `!==` 比较        |
| `reflectIdPrefix` | `boolean`                                  | 当属性值反射到 DOM 属性时，是否自动添加组件的 id 前缀。默认为 `false`                                                       |

#### `type` 指定属性类型

在配置对象中使用 `type` 与直接传入类型构造器效果一致。以下两种写法等价：

```js
// 简写形式
property('name', String)

// 配置对象形式
property('name', { type: String })
```

当需要同时指定其他配置项（如 `value` 、 `observer` 等）时，就需要使用配置对象形式。如果未指定 `type` ，默认为 `null` （即任意类型）。

#### `optionalTypes` 指定额外可接受类型

当属性需要接受多种类型的值时，可以使用 `optionalTypes` 指定额外的类型。属性值可以是 `type` 或 `optionalTypes` 中的任意一种类型：

```js
property('flexible', {
  type: String,
  optionalTypes: [Number, Boolean],
  value: 'default',
})
```

#### `value` 指定初始值

`value` 指定属性的初始值。每次创建组件实例时，该值会经过一次简单深拷贝，以确保各实例之间数据互不干扰：

```js
property('config', {
  type: Object,
  value: { theme: 'light' },
})
```

如果同时指定了 `default` 和 `value` ，则 `value` 会被忽略。

> 💡 由于 `value` 需要对值进行拷贝，会存在拷贝开销以及一些非预期的行为（如循环引用导致栈溢出）推荐使用 `default` 工厂函数代替 `value` 。 `default` 工厂函数能更明确地表达“每个实例各自生成初始值“的语义，而且不会进行额外的深拷贝。

#### `default` 生成初始值

`default` 可以指定工厂函数，返回初始的值。`default` 工厂函数可以确保每个组件实例获得独立的初始值副本，没有额外的深拷贝。如果同时指定了 `default` 和 `value` ，则 `value` 会被忽略：

```js
property('list', {
  type: Array,
  default: () => [{ id: 1, name: 'item' }],
})
```

#### `observer` 监听属性变化

当属性值发生变化时，`observer` 回调会被触发。可以传入函数，也可以传入方法名字符串：

```js
property('count', {
  type: Number,
  value: 0,
  observer(newValue, oldValue) {
    console.log(`count changed from ${oldValue} to ${newValue}`)
  },
})
```

> ⚠️ property `observer` 和数据监听器（`observers`）的触发时机不同：property `observer` 只在 `comparer` 判定值发生变化后才触发（默认使用 `!==` 比较）；而数据监听器只要对应字段被 `setData` 设置就会触发，无论前后值是否相同。

#### `comparer` 自定义属性值比较逻辑

`comparer` 用于自定义属性值的比较方式。返回 `true` 表示值已改变（需要更新），返回 `false` 表示值未变（跳过更新）。默认使用 `!==` 比较。这在一些场景下可以减少更新范围提升性能：

```js
property('obj', {
  type: Object,
  value: { myField: '' },
  comparer(newValue, oldValue) {
    // 只有 myField 变了才认为属性发生了变化
    return newValue.myField !== oldValue.myField
  },
})
```

#### `reflectIdPrefix` 属性值反射时添加 id 前缀

当组件开启了 `reflectToAttributes` 选项时，属性值会反射到 DOM 属性上。设置 `reflectIdPrefix: true` 后，反射的属性值会自动添加组件的 id 前缀：

```js
property('targetId', {
  type: String,
  reflectIdPrefix: true,
})
```

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

`init` 函数的第一个参数提供了一系列实用方法，如 [`self`](#init-self) 、 [`setData`](#init-setData) 、 [`implement`](#init-implement) 、 [`relation`](#init-relation) 、 [`observer`](#init-observer) 、 [`lifetime`](#init-lifetime) 、 [`pageLifetime`](#init-pageLifetime) 、 [`method`](#init-method) 、 [`listener`](#init-listener) 等，可以在其中完成大部分组件逻辑的定义。

### self 对象 {#init-self}

`self` 指向当前组件实例的 method caller 对象。在大多数场景下，它等价于 `this`。

可以通过它访问组件的属性、数据以及方法等：

```js
init(function ({ self }) {
  // self 等价于 this
  console.log(self === this)
  console.log(self.data)
  self.triggerEvent('event', {})
})
```

> 💡 在 `init` 函数内部，如果使用了箭头函数，则无法通过 `this` 访问组件实例，此时可以使用 `self` 。

### setData 方法 {#init-setData}

`setData` 与 `this.setData` 等价，可以用来更新数据：

```js
init(({ setData, lifetime }) => {
  lifetime('attached', () => {
    setData({ message: 'updated!' })
  })
})
```

> 📖 更多高级数据更新方法请参阅 [高级数据更新方法](../data_management/advanced_update.md) 文档。

### implement 方法 {#init-implement}

`implement` 与连缀方法 [`.implement()`](#implement-实现-trait-behavior) 类似，用于为当前组件实例实现一个 Trait Behavior。

```js
const myTrait = componentSpace.defineTraitBehavior()

init(({ implement }) => {
  implement(myTrait, {
    greet() {
      return 'hello'
    },
  })
})
```

> ⚠️ `implement` 只能在 `init` 函数执行期间调用，初始化完成后调用会抛出异常。

> 📖 更多关于 Trait Behavior 的详细说明请参阅 [Trait Behaviors](../interaction/trait_behavior.md) 文档。

### relation 方法 {#init-relation}

`relation` 与连缀方法 [`.relation()`](#relations-组件间关系) 类似，用于在 `init` 函数中动态声明组件间关系。

```js
init(({ relation, lifetime }) => {
  const childRelation = relation({
    target: childComponent,
    type: 'child',
    linked(target) {
      console.log('child linked', target)
    },
    unlinked(target) {
      console.log('child unlinked', target)
    },
  })

  lifetime('attached', () => {
    const children = childRelation.list()
    console.log('linked children:', children.length)
  })
})
```

> 📖 更多关于组件间关系的详细说明请参阅 [组件间关系](../interaction/relation.md) 文档。

### observer 方法 {#init-observer}

`observer` 与连缀方法 [`.observer()`](#observers-数据监听器) 类似，用于在 `init` 函数中注册组件数据变化回调：

```js
.init(({ observer, setData }) => {
  // 监听单个字段
  observer('count', (newValue) => {
    console.log('count changed to', newValue)
  })

  // 监听多个字段
  observer(['a', 'b'], (aVal, bVal) => {
    setData({ sum: aVal + bVal })
  })
})
```

> ⚠️ `observer` 只能在 `init` 函数执行期间调用，初始化完成后调用会抛出异常。

### lifetime 方法 {#init-lifetime}

`lifetime` 与连缀方法 [`.lifetime()`](#lifetimes-生命周期) 类似，用于在 `init` 函数中注册组件生命周期回调：

```js
.init(({ lifetime }) => {
  lifetime('attached', () => {
    console.log('component attached')
  })

  lifetime('detached', () => {
    console.log('component detached')
  })
})
```

> ⚠️ `lifetime` 只能在 `init` 函数执行期间调用，初始化完成后调用会抛出异常。

### pageLifetime 方法 {#init-pageLifetime}

`pageLifetime` 与连缀方法 [`.pageLifetime()`](#pagelifetimes-页面生命周期) 类似，用于在 `init` 函数中注册页面生命周期回调：

```js
.init(({ pageLifetime }) => {
  pageLifetime('show', () => {
    console.log('page show')
  })

  pageLifetime('hide', () => {
    console.log('page hide')
  })
})
```

> ⚠️ `pageLifetime` 只能在 `init` 函数执行期间调用，初始化完成后调用会抛出异常。

### method 方法 {#init-method}

`method` 用于将一个普通函数标记为组件方法。被 `method` 包裹的函数可以通过 `init` 的返回值导出，使其成为组件实例上可调用的方法，也可以在模板中作为事件处理器绑定：

```js
.init(({ method, setData }) => {
  const increment = method(() => {
    setData({ count: count + 1 })
  })

  const reset = method(() => {
    setData({ count: 0 })
  })

  // 通过返回值导出为组件方法
  return { increment, reset }
})
```

`method` 包裹后的函数依然可以在 `init` 作用域内直接调用，同时也能在模板中通过方法名引用。

### listener 方法 {#init-listener}

`listener` 用于将一个函数标记为事件监听器。与 [`method`](#init-method) 类似，但 `listener` 标记的函数专用于事件监听，接收事件对象作为参数：

```js
.init(({ listener }) => {
  const onTap = listener((event) => {
    console.log('tapped at', event.detail)
  })

  return { onTap }
})
```

> 💡 `method` 和 `listener` 都可以用来处理模板中的事件绑定。 `listener` 在语义上更明确地表示这是一个事件监听器，且它的 Typescript 类型签名会接收事件对象参数。

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

## listeners 事件监听器

`listeners` 用于在组件定义中声明式地绑定事件监听器，将模板中的节点事件绑定到方法。

```js
export const myComponent = componentSpace
  .define()
  .template(
    wxml(`
      <div id="btn">Click me</div>
    `),
  )
  .listeners({
    'btn.tap': function () {
      console.log('button tapped')
    },
  })
  .registerComponent()
```

> 📖 具体用法请参考 [通过 listeners 监听事件](./event.md#通过-listeners-监听事件) 文档。

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

`implement` 连缀方法用于在组件定义时静态地实现一个 [Trait Behavior](../interaction/trait_behavior.md) 。Trait Behavior 类似于 TypeScript 中的接口，它要求实现者提供一组方法：

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

也可以在 [`init` 函数中通过 `implement`](#init-implement) 动态实现 Trait Behavior 。两者的区别在于：连缀方法 `implement` 在组件定义阶段静态声明，而 `init` 中的 `implement` 在实例创建时动态执行，后者可以利用闭包中的变量。

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

## definition 混入经典风格定义

`definition` 允许在 Chaining API 中混入 [Definition API](./definition_style.md) 风格的配置对象。当需要复用已有的 Definition API 配置，或希望将部分配置以对象形式集中声明时，可以使用此方法：

```js
export const myComponent = componentSpace
  .define()
  .definition({
    data: {
      message: 'Hello world!',
    },
    methods: {
      greet() {
        console.log(this.data.message)
      },
    },
    lifetimes: {
      attached() {
        this.greet()
      },
    },
  })
  .template(
    wxml(`
    <div>{{ message }}</div>
  `),
  )
  .registerComponent()
```

`definition` 接受的配置对象与 `componentSpace.defineComponent()` 中的配置对象格式一致，支持 `data` 、 `properties` 、 `methods` 、 `listeners` 、 `relations` 、 `lifetimes` 、 `pageLifetimes` 、 `observers` 、 `behaviors` 等字段。

可以将 `definition` 与其他连缀方法自由混用。例如，将适合集中声明的部分（如 `data` 、 `methods` ）放在 `definition` 中，将需要精细控制的逻辑（如 `init` ）通过连缀调用来定义：

```js
export const myComponent = componentSpace
  .define()
  .definition({
    data: {
      count: 0,
    },
  })
  .init(({ setData, method }) => {
    const increment = method(() => {
      setData({ count: count + 1 })
    })
    return { increment }
  })
  .registerComponent()
```

> 📖 更多关于两种 API 风格的对比请参阅 [组件定义风格](./definition_style.md) 文档。

## chainingFilter 连缀过滤器

`chainingFilter` 用于定义一个 Chaining API 层面的中间件。它允许你拦截并修改链式调用中的方法行为，常用于创建自定义的校验、转换或增强逻辑。

> 📖 关于连缀过滤器的详细说明和示例请参阅 [组件构造器中间件](../advanced/component_filter.md) 文档。

## methodCallerInit 方法调用者初始化

`methodCallerInit` 用于设置一个在所有 `init` 函数之前执行的初始化函数。该函数应返回一个 **method caller** 对象，作为后续各种回调（生命周期、方法、事件监听器等）中的 `this` 值：

```js
export const myComponent = componentSpace
  .define()
  .methodCallerInit(function () {
    // this 指向原始的组件实例
    // 返回值将作为后续回调中的 this
    return this
  })
  .init(function () {
    // 此处的 this 是 methodCallerInit 返回的对象
  })
  .registerComponent()
```

`methodCallerInit` 的执行顺序早于所有 `init` 函数（包括 behavior 中的 `init`）。它的典型用途是为组件提供自定义的 `this` 代理对象，例如添加额外的工具方法或包装层。

> ⚠️ 这是一个高级特性，大多数场景下不需要使用。如果只需要定义初始化逻辑，请使用 [`init`](#init-函数) 。

## extraThisFieldsType 额外 this 字段类型

`extraThisFieldsType` 是一个 **纯 TypeScript 类型辅助方法**，在运行时不做任何事情。它用于在 TypeScript 中为组件的 `this` 添加额外的字段类型声明：

```ts
export const myComponent = componentSpace
  .define()
  .extraThisFieldsType<{
    customField: string
    helperMethod: () => void
  }>()
  .registerComponent()
```

这在与 `methodCallerInit` 配合使用时非常有用——当 `methodCallerInit` 返回的 method caller 对象包含额外字段时，可以通过 `extraThisFieldsType` 让 TypeScript 正确识别这些字段的类型。

> ⚠️ 这是一个纯类型辅助方法，仅影响 TypeScript 类型推导，不会产生任何运行时效果。
