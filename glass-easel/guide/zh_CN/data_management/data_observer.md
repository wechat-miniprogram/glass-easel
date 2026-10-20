# 数据监听器

## property observer 与 data observer 的区别 {#property-vs-data-observer}

glass-easel 中有两种名称相近的监听器：

* **属性监听器（property observer）** 是属性定义中的 `observer` 配置项，例如 `.property('count', { type: Number, observer(newValue, oldValue) { ... } })` ，经典 API 中对应 `properties.count.observer` 。它属于这个属性的定义。
* **数据监听器（data observer）** 通过 Chaining 方法 `.observer(paths, callback)` 、经典 API 的 `observers` 或 `init` 的 `builderContext.observer(paths, callback)` 注册。它独立于属性定义，按数据路径监听更新。

**data observer 可以同时监听 property 和普通 data 字段。** 即使写的是 `observer('count', callback)` ，且 `count` 是一个 property，注册的仍然是 data observer。两种监听器都可以响应父组件传入的属性更新，也可以响应组件自身通过 `setData` 等方法提交的更新。

| 对比项 | property observer | data observer |
| --- | --- | --- |
| 监听范围 | 所属的单个 property | property、普通 data 字段；支持多字段、子路径和 `**` 通配符 |
| 整体设置 property 时 | 通过值比较后才触发；默认以类型转换后的新值与旧值做 `!==` 比较，也可自定义 `comparer` | 匹配的路径被设置就会触发，不比较新旧值，也不受 property 的 `comparer` 过滤 |
| 回调参数 | 整体设置时为 `(newValue, oldValue)` ；子路径更新有特殊规则，见下文 | 按监听路径顺序传入各字段的当前值，不提供旧值；例如 `observer(['a', 'b'], (a, b) => {})` 的第二个参数是 `b` 的值 |
| 常规更新时的执行阶段 | 本组件的模板更新之后 | 本组件的模板更新之前，适合计算供模板使用的派生数据 |
| 回调中调用 `setData` | 会发起后续更新，可能增加模板更新次数 | 新增更新会与当前更新一起应用到模板 |
| 在 `init` 中注册 | `builderContext` 没有对应的注册方法 | 使用 `builderContext.observer` ，可以利用实例私有的闭包变量 |
| behavior 中的合并方式 | 随同名 property 的完整定义一起被覆盖，不会叠加执行 | 独立合并，可以对相同路径注册多个回调；重复引入时的去重规则见 [普通 Behaviors](../interaction/behavior.md#菱形继承) |
| 匹配 `pureDataPattern` 的属性 | 不触发 | 仍然触发 |

开发时，计算派生数据、监听多个字段或对象子字段，以及在 `init` 中组织实例逻辑，通常选择 data observer。需要属性整体更新的新旧值，或需要遵循该属性的 `comparer` 判定并在常规模板更新后响应时，可以使用 property observer。

例如，同一个 `count` 属性可以同时被这两种监听器监听：

```js
export const counter = componentSpace.define()
  .property('count', {
    type: Number,
    value: 0,
    observer(newValue, oldValue) {
      console.log('property', newValue, oldValue)
    },
  })
  .observer('count', function (count) {
    console.log('data', count)
  })
  .lifetime('attached', function () {
    this.setData({ count: 1 })
    // 输出：data 1，然后 property 1 0
    this.setData({ count: 1 })
    // 只输出：data 1
  })
  .registerComponent()
```

对于已经完成初始化的组件，一轮更新通常依次经历：应用数据更新、执行匹配的 data observer 及其追加更新、更新模板、执行 property observer。在同一批更新中，一个 data observer 即使匹配到多个路径，也只会因这批更新执行一次；如果回调又提交了匹配路径的更新，则可能再次执行。property observer 则按收集到的属性更新逐项执行，同一属性在一批更新中被多次设置时可能有多次回调。

这里的“模板更新之后”不代表组件已经挂载或后端已经完成绘制。初始化阶段还要考虑 [`propertyEarlyInit`](./property_early_init.md)：开启后，父组件传入的初始属性可能使两种 observer 都早于模板初始化和 `created` 执行。仅注册监听器或生成属性默认值不会自动执行回调；需要执行一次的初始化逻辑应显式安排在合适的生命周期中。

### 对象属性与子路径更新 {#property-subpaths}

“property observer 通过值比较后才触发”针对的是**整体替换 property**，不能理解为深度比较整个对象：

* `setData({ obj: nextObj })` 整体替换属性时，默认按对象引用比较。新对象即使内容相同，也会触发 property observer；相同引用则不会。自定义属性 `comparer` 或组件选项 `propertyComparer` 可以改变这个判定。
* `setData({ 'obj.a': 2 })` 直接设置属性子路径时，不经过属性的 `comparer` ，会触发所属 `obj` 的 property observer，即使子字段前后值相同。此时回调收到的是子路径的新值 `2` 和 `undefined` ，而不是整个对象的新旧快照；需要读取整个对象时，应读取 `this.data.obj` 。
* data observer 的 `observer('obj', ...)` 监听整体设置，不会因为只设置 `obj.a` 而触发。监听 `obj.a` 应使用 `observer('obj.a', ...)` ；监听对象及其所有子字段应使用 `observer('obj.**', ...)` 。整体替换 `obj` 也会触发这两种子路径监听器。

无论哪一种 observer，都不会因为直接赋值 `this.data.obj.a = 2` 就自动执行。需要通过 `setData` 或 [高级数据更新方法](./advanced_update.md) 提交更新。使用 `updateData` 、 `replaceDataOnPath` 等暂存更新时，要等更新被应用后才会触发监听器。

### 在 init 中监听 property {#init-property-observer}

`init` 中的 `builderContext.observer` 与 `.observer()` 、经典 API 的 `observers` 使用相同的数据监听机制。`builderContext` 没有 property observer 的注册入口，但已经可以用 `observer('属性名', callback)` 监听属性更新。

如果需要保留实例私有状态，并且只想在某个基本类型值改变时执行逻辑，可以在闭包中自行比较：

```js
export const counter = componentSpace.define()
  .property('count', Number)
  .init(({ data, observer }) => {
    // 每个实例单独保存；此时读取的是属性初始值
    let previousCount = data.count

    observer('count', (count) => {
      if (count === previousCount) return
      const oldCount = previousCount
      previousCount = count
      console.log('count changed', count, oldCount)
    })
  })
  .registerComponent()
```

这只是为 data observer 增加了业务层的比较逻辑：它仍在模板更新前执行，不会自动采用 property 的 `comparer` ，保存的也是上次观察到的值。对对象仅保存引用无法获得子字段修改前的快照，需要按业务保存关心的字段或自行复制。若确实依赖 property observer 的执行阶段和参数语义，应在 [属性定义的 `observer` 配置项](../api/definition.md#property-observer) 中声明。

## 监听数据字段变化

通过数据监听器，可以在某些属性或数据字段被设置时触发一个响应函数。

这个响应函数会在属性或数据字段应用到模板前被调用，可以在总体上减少模板更新次数从而提升性能。

在这个响应函数中，可以使用 `setData` 更新其他数据字段。数据值会更新，但新增更新不会立刻应用到模板上，而是等数据监听器及其引发的后续数据监听器执行完毕后，一起更新模板。`updateData` 只暂存更新，单独调用它不会在回调结束时自动提交；如果使用它，需要再调用 `applyDataUpdates` 等方法应用更新。

例如，可以在 `a` 和 `b` 两个字段中任何一个被设置时，触发一个响应函数：

```js
// 使用 Chaining 方法添加数据监听器
export const addComponent = componentSpace.define()
  .data(() => ({
    a: 1,
    b: 2,
    sum: 3,
  }))
  // 在 Chaining 方法中，应传入数组来监听多个数据字段
  .observer(['a', 'b'], function () {
    // 等价 this.updateData
    this.setData({
      sum: this.data.a + this.data.b,
    })
  })
  .lifetime('attached', function () {
    this.setData({
      a: 3,
    })
  })
  .registerComponent()
```

```js
// 或在 init 函数中添加数据监听器
export const addComponent = componentSpace.define()
  .data(() => ({
    a: 1,
    b: 2,
    sum: 3,
  }))
  .init(function ({ self, lifetime, observer }) {
    // 应传入数组来监听多个数据字段
    observer(['a', 'b'], () => {
      // 等价 this.updateData
      self.setData({
        sum: self.data.a + self.data.b,
      })
    })
    lifetime('attached', function () {
      self.setData({
        a: 3,
      })
    })
  })
  .registerComponent()
```

注意：数据监听器会在其所监听字段值被设置时触发，即使其值没有发生变化，监听器也会触发。

不要在数据监听器内设置被监听的数据字段本身，否则会无限循环：

```js
export const addComponent = componentSpace.define()
  .data(() => ({
    a: 1,
  }))
  .observer('a', function () {
    // 会导致无限循环！
    this.setData({
      a: 1,
    })
  })
  .registerComponent()
```

## 用数据监听器监听子字段

数据监听器也可以监听子字段，例如：

```js
export const addComponent = componentSpace.define()
  .data(() => ({
    obj: { a: 1 },
    arr: [1, 2, 3],
  }))
  // 添加一个数据监听器
  .observer(['obj.a', 'arr[2]'], function () {
    // 当 obj.a 或 arr[2] 被设置时会执行
  })
  .lifetime('attached', function () {
    // 执行这组更新时，数据监听器会被执行
    this.groupUpdates(() => {
      this.replaceDataOnPath(['obj', 'a'], 3)
    })
  })
  .registerComponent()
```

若想监听所有子字段，可以使用通配符 `**` ，例如：

```js
export const addComponent = componentSpace.define()
  .data(() => ({
    obj: { a: 1 },
  }))
  .observer('obj.**', function () {
    // 当 obj 的任何子字段被设置时都会执行
  })
  .registerComponent()
```

特别地，这样可以监听所有数据字段：

```js
export const addComponent = componentSpace.define()
  .observer('**', function () {
    // 当任何字段被设置时都会执行
  })
  .registerComponent()
```
