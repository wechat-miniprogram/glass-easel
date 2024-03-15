# 事件

## 触发事件

子组件可以向父组件发送事件，事件中可以携带数据。这是子组件向父组件传递消息和数据的主要方式。

子组件触发事件时应使用组件实例的 `this.triggerEvent` 方法。例如：

```js
export const childComponent = componentSpace.defineComponent({
  lifetimes: {
    attached() {
      // 事件携带的数据
      const detail = { someData: 'data' }
      // 触发事件
      this.triggerEvent('customEvent', detail)
    },
  },
})
```

事件的可以指定为不冒泡事件（默认）、冒泡事件或跨组件冒泡事件，由 `triggerEvent` 的第三个参数控制，例如：

```js
// 触发冒泡事件（冒泡范围仅限于父组件内部）
this.triggerEvent('customEvent', detail, { bubbles: true })
// 触发跨组件冒泡事件
this.triggerEvent('customEvent', detail, { bubbles: true, composed: true })
```

在 DOM 环境下， glass-easel 也会自动触发 DOM 事件。

## 用普通组件方法响应事件

`methods` 内定义的方法可以用于响应事件。例如：

```js
// 使用 Definition API 响应事件
export const myComponent = componentSpace.defineComponent({
  using: {
    child: childComponent,
  },
  template: compileTemplate(`
    <child catch:customEvent="childEvent" />
  `),
  methods: {
    childEvent({ detail }) {
      detail.someData === 'data' // true
    },
  },
})
// 或使用 Chaining API 响应事件
export const myComponent = componentSpace.define()
  .usingComponents({
    child: childComponent,
  })
  .template(compileTemplate(`
    <child catch:customEvent="childEvent" />
  `))
  .methods({
    childEvent({ detail }) {
      detail.someData === 'data' // true
    },
  })
  .registerComponent()
// 或在 init 中响应事件
export const myComponent = componentSpace.define()
  .template(compileTemplate(`
    <child catch:customEvent="childEvent" />
  `))
  .init(function ({ method }) {
    const childEvent = method(({ detail }) => {
      detail.someData === 'data' // true
    })
    return { childEvent }
  })
  .registerComponent()
```

## 用 init 响应事件

如果使用 init ，也可以用 `listener` 包裹函数后将响应函数返回来响应事件。

```js
export const myComponent = componentSpace.define()
  .template(compileTemplate(`
    <child catch:customEvent="childEvent" />
  `))
  .init(function ({ method }) {
    const childEvent = listener(({ detail }) => {
      detail.someData === 'data' // true
    })
    return { childEvent }
  })
  .registerComponent()
```

这样做的好处是，如果使用 TypeScript ，可以方便地指定 `detail` 数据类型：

```ts
.init(function ({ method }) {
  const childEvent = listener<{ someData: string }>(({ detail }) => {
    detail.someData === 'data' // true
  })
  return { childEvent }
})
```

## 绑定前缀

在模板中绑定事件时，除了 `catch:` 前缀，还可以使用 `bind:` 前缀，例如：

```xml
<div bind:customEvent="childEvent2">
  <child bind:customEvent="childEvent1" />
</div>
```

`bind:` 的区别是它不会停止事件冒泡，使得节点的祖先也能够响应这个事件。（对于非冒泡事件，两者效果相同。）

为了保持与微信小程序 WXML 的兼容性， `catch:` 和 `bind:` 中的冒号 `:` 可以在组件节点上可以省略，但在其他节点上不行，且有冒号时更容易被编译优化。因此建议永远不要省略它。

另一个绑定前缀是 `mut-bind:` ，它不会停止事件冒泡，但一个 `mut-bind:` 绑定的函数执行后，其他 `mut-bind:` 绑定的函数不会被执行。换而言之，所有 `mut-bind:` 绑定之间是互斥的。

## 事件捕获阶段

冒泡事件支持类似于 DOM 事件的捕获阶段。捕获阶段位于普通的冒泡阶段之前，且与冒泡经过的节点顺序正好相反。

事件需要具有捕获阶段时，需要指定 `capture` 选项，例如：

```js
this.triggerEvent('customEvent', detail, { bubbles: true, capture: true })
```

在捕获阶段绑定响应函数时，可以使用 `capture-catch:` 或 `capture-bind:` ，例如：

```xml
<div capture-bind:customEvent="childEvent2">
  <child capture-catch:customEvent="childEvent1" />
</div>
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
childEvent({ mark }) {
  mark.listIndex // 列表中的 index
}
```

`mark:` 也可以打在祖先节点上：

```xml
<block wx:for="{{ list }}">
  <div mark:listIndex="{{ index }}">
    <child bind:customEvent="childEvent" />
  </div>
</block>
```
