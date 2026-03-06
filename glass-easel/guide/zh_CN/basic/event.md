# 事件

## 事件系统

glass-easel 的事件系统与 DOM 事件模型类似，存在**捕获**和**冒泡**和阶段。

事件触发后，会按以下阶段顺序处理：

1. **捕获阶段**（需要事件启用 `capturePhase` 选项）：事件从最外层祖先节点开始，逐层向下传播到目标节点。
2. **当前节点**：事件到达目标节点。
3. **冒泡阶段**（需要事件启用 `bubbles` 选项）：事件从目标节点开始，逐层向上传播到祖先节点。

## 触发事件

子组件可以向父组件发送事件，事件中可以携带数据。这是子组件向父组件传递消息和数据的主要方式。

子组件触发事件时应使用组件实例的 `this.triggerEvent` 方法。`triggerEvent` 第一个参数传递参数名，第二个参数传递事件携带的数据。例如：

```js
export const childComponent = componentSpace.define()
  .init(function ({ lifetime, self }) {
    lifetime('attached', function () {
      // 事件携带的数据
      const detail = { someData: 'data' }
      // 触发事件
      self.triggerEvent('customEvent', detail)
    })
  })
  .registerComponent()
```

默认情况下，事件不会冒泡，只会在当前组件上触发。要修改这个行为，可以由 `triggerEvent` 的第三个参数控制，例如：

```js
// 触发冒泡事件（冒泡范围仅限于父组件内部）
triggerEvent('customEvent', detail, { bubbles: true })
// 触发跨组件冒泡事件
triggerEvent('customEvent', detail, { bubbles: true, composed: true })
```

### 触发选项

`triggerEvent` 的第三个参数是一个选项对象，支持以下字段：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `bubbles` | `boolean` | `false` | 是否为冒泡事件。启用后事件会从目标节点向上传播到祖先节点 |
| `composed` | `boolean` | `false` | 是否跨组件冒泡。需要同时启用 `bubbles` 才有效。启用后事件会穿越 [Shadow Root](../tree/node_tree.md#shadow-root-节点) 边界，沿 [Composed Tree](../tree/node_tree.md#composed-tree) 路径向上冒泡 |
| `capturePhase` | `boolean` | `false` | 是否启用捕获阶段。启用后在冒泡阶段之前，事件会从最外层祖先节点向下传播到目标节点 |
| `extraFields` | `Record<string, unknown>` | `undefined` | 附加到事件对象上的额外字段。这些字段会通过 `Object.assign` 合并到事件对象上，可在响应函数中直接访问 |

> ⚠️ 如果需要事件**跨组件冒泡**，需要在触发事件时同时启用 `bubbles` 和 `composed` 选项。启用 `composed` 后，事件会穿过 [Shadow Root](../tree/node_tree.md#shadow-root-节点) 边界，沿着 [Composed Tree](../tree/node_tree.md#composed-tree) 的路径向上冒泡，从而使父组件乃至更高层级的祖先组件都能响应该事件。

## 监听事件

glass-easel 中有多种方式可以监听事件并响应事件。

### 在 wxml 中绑定事件

可以在 wxml 中通过 `bind:` 前缀绑定事件。绑定的事件响应函数需要通过 [`methods` 声明](../basic/method.md)，或在 `init` 中通过 `method` / `listener` 包裹后返回。

```js
export const myComponent = componentSpace.define()
  .usingComponents({
    child: childComponent,
  })
  .template(wxml(`
    <child
      bind:customEvent="childEvent"
      bind:customEvent2="childEvent2"
    />
  `))
  .init(function ({ method, listener }) {
    const childEvent = method(({ detail }) => {
      console.log(detail.someData)
    })
    // 也可以用 `listener` 包裹函数后将响应函数返回来响应事件。
    const childEvent2 = listener<{ someData: string }>(({ detail }) => {
      console.log(detail.someData)
    })
    return { childEvent, childEvent2 }
  })
  .registerComponent()
```

在模板中绑定事件时，除了 `bind:` 前缀，还可以使用 `catch:` 前缀，例如：

```xml
<div catch:customEvent="childEvent2">
  <child catch:customEvent="childEvent1" />
</div>
```

`catch:` 的区别是它会停止事件冒泡，使得节点的祖先不再能够响应这个事件。（对于非冒泡事件，两者效果相同。）

> ⚠️ 为了保持与微信小程序 WXML 的兼容性， `catch:` 和 `bind:` 中的冒号 `:` 可以在组件节点上可以省略，但在其他节点上不行，且有冒号时更容易被编译优化。因此建议永远不要省略它。

另一个绑定前缀是 `mut-bind:` ，它不会停止事件冒泡，但一个 `mut-bind:` 绑定的函数执行后，其他 `mut-bind:` 绑定的函数不会被执行。换而言之，所有 `mut-bind:` 绑定之间是互斥的。

> 📖 `bind:` 和其他前缀的具体区别请参考 [事件绑定](../basic/template.md#事件绑定) 文档。

### 通过 listeners 监听事件

`listeners` 提供了一种声明式的方式来监听 Shadow Tree 中节点的事件，无需在模板中使用 `bind:` 绑定。

`listeners` 的键（key）是一个字符串，格式为 `{id}.{event}` ，其中 `id` 是模板中节点的 `id` 属性，`event` 是事件名。如果省略 `id` 和 `.` ，仅写事件名，则绑定到 Shadow Root 上。 `id` 也可以设置为特殊值 `this` ，表示绑定到组件自身：

```js
export const myComponent = componentSpace.define()
  .template(wxml(`
    <div id="myDiv">
      <child id="myChild" />
    </div>
  `))
  .definition({
    // listeners 需要通过 definition 声明
    listeners: {
      // listen to the 'tap' event on the element with id "myDiv"
      'myDiv.tap': function (e) {
        console.log('myDiv tapped', e.detail)
      },
      // listen to the 'customEvent' on the element with id "myChild"
      'myChild.customEvent': function (e) {
        console.log('child event', e.detail)
      },
      // listen to events on the Shadow Root (no id prefix)
      'someEvent': function (e) {
        console.log('shadow root event', e.detail)
      },
      // listen to events on the component itself
      'this.customEvent': function (e) {
        console.log('self event', e.detail)
      },
    },
  })
  .registerComponent()
```

设置 `listeners` 与在模板中写 `bind:xxx` 的监听效果相同，但 `listeners` 额外支持监听 `this` （组件自身）上的事件，这在模板中无法直接实现。

> ⚠️ `listeners` 的键中的 `id` 仅匹配模板中静态存在的节点。对于动态节点（例如 `wx:if` 控制的节点），其 `id` 可能无法被正确定位，因此不推荐对动态节点使用 `listeners` 。推荐直接在模板中使用 `bind:xxx` 来绑定事件监听。

### 通过 addListener 监听事件

可以在 `init` 或生命周期中通过 `addListener` 方法命令式地为节点添加事件监听器。

```js
export const myComponent = componentSpace.define()
  .usingComponents({
    child: childComponent,
  })
  .template(wxml(`
    <child id="myChild" />
  `))
  .init(function ({ self, lifetime }) {
    lifetime('attached', function () {
      // listen to events on the component itself
      self.addListener('customEvent', (e) => {
        console.log('self event', e.detail)
      })

      // listen to events on a child node by id
      const shadowRoot = self.getShadowRoot()
      const child = shadowRoot.getElementById('myChild')
      child.addListener('customEvent', (e) => {
        console.log('child event', e.detail)
      })
    })
  })
  .registerComponent()
```

`addListener` 的第三个参数是 `EventListenerOptions`，可以指定监听行为：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `final` | `boolean` | `false` | 是否在此监听器执行后停止冒泡（类似 `catch:`） |
| `mutated` | `boolean` | `false` | 是否在此监听器执行后标记为互斥已触发（类似 `mut-bind:`） |
| `capture` | `boolean` | `false` | 是否在捕获阶段监听（类似 `capture-bind:`） |

可以通过 `removeListener` 移除已添加的监听器：

```js
const handler = (e) => { console.log(e.detail) }
self.addListener('customEvent', handler)
// remove later
self.removeListener('customEvent', handler)
```

## 事件捕获阶段

冒泡事件支持类似于 DOM 事件的捕获阶段。捕获阶段位于普通的冒泡阶段之前，且与冒泡经过的节点顺序正好相反。

事件需要具有捕获阶段时，需要指定 `capture` 选项，例如：

```js
triggerEvent('customEvent', detail, { bubbles: true, capture: true })
```

在捕获阶段绑定响应函数时，可以使用 `capture-bind:` 、 `capture-catch:` 或 `capture-mut-bind:` ，例如：

```xml
<div capture-bind:customEvent="childEvent2">
  <child capture-catch:customEvent="childEvent1" />
</div>
```

## 互斥事件

互斥事件（ `mut-bind:` ）是一种特殊的绑定方式，它不会阻止事件冒泡，但在冒泡路径上所有 `mut-bind:` 绑定之间是**互斥**的：当其中一个 `mut-bind:` 监听器执行后，冒泡路径上后续的 `mut-bind:` 监听器将不再执行，而 `bind:` 绑定的监听器不受影响。

这在嵌套的可点击区域中非常有用。例如，一个可点击的列表项内包含一个可点击的按钮：

```xml
<div mut-bind:tap="onListItemTap">
  <button mut-bind:tap="onButtonTap">Click Me</button>
</div>
```

当点击按钮时，只有 `onButtonTap` 会被执行，`onListItemTap` 不会被执行。但事件仍然会继续冒泡，因此更外层通过 `bind:` 绑定的监听器仍能收到事件。

在事件响应函数中，也可以通过 `e.markMutated()` 手动标记互斥状态，效果等同于 `mut-bind:` ：

```js
const onButtonTap = listener((e) => {
  e.markMutated() // mark mutated manually
  // ...
})
```

## 事件节点标记

在 `wx:for` 列表中绑定的事件，常常想要知道它具体是列表中的哪个节点，此时可以使用 `mark:` 为节点加上标记：

```xml
<block wx:for="{{ list }}">
  <child mark:listIndex="{{ index }}" bind:customEvent="childEvent" />
</block>
```

在响应函数中可以访问到：

```js
const childEvent = listener((e) => {
  e.mark.listIndex // 列表中的 index
})
```

`mark:` 也可以打在祖先节点上：

```xml
<block wx:for="{{ list }}">
  <div mark:listIndex="{{ index }}">
    <child bind:customEvent="childEvent" />
  </div>
</block>
```

## Event 事件对象

> 📖 关于 `Event` 和 `ShadowedEvent` 对象的属性与方法详情，请参阅 [Event API](../api/other.md#event) 文档。

## 后端事件

glass-easel 的事件系统并不直接监听 DOM 事件，而是通过**后端（Backend）**接收和转换事件。glass-easel 通过 `backend.onEvent(...)` 注册事件监听回调，后端在接收到原生事件后，将其转换为 glass-easel 事件并分发，由 glass-easel 统一进行捕获、冒泡等处理。

```js
// 初始化时需要将后端事件转换为 glass-easel 事件
backendContext.onEvent(glassEasel.Event.triggerBackendEvent)
```

具体会产生哪些事件，以及事件是否有捕获/冒泡阶段，均取决于后端的实现。以 `CurrentWindowBackendContext` （当前网页后端）为例，它会将浏览器触发的事件都转换为 glass-easel 事件，并且同步浏览器事件是否有捕获/冒泡阶段。除此之外还会产生一个特殊的 `tap` 事件。

### `tap` 事件

`tap` 不是原生的 DOM 事件，而是由 `CurrentWindowBackendContext` 合成的。该事件主要为了抹平移动端与桌面端的差异。它基于 `touchstart` / `touchend` （触屏设备）或 `mousedown` / `mouseup` （桌面设备）模拟。
