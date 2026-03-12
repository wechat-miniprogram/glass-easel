# 虚拟组件节点

默认情况下，代表组件的节点本身会和普通节点一样接收 class 和 style ，例如：

```js
const childComponent = componentSpace.define()
  .template(wxml(`
    <div>child</div>
  `))
  .registerComponent()

export const myComponent = componentSpace.define()
  .usingComponents({
    child: childComponent,
  })
  .template(wxml(`
    <div class="a" style="color: red" />
    <child class="b" style="color: blue" />
  `))
  .registerComponent()
```

此时，最终的 [Backend Tree](../tree/node_tree.md) 中 `<child>` 节点本身也会生成一个对应的 DOM 节点，使其能直接使用 class 和 style ：

```html
<!-- Backend Tree -->
<my-component>
  <div class="a" style="color: red">
  <child class="b" style="color: blue">
    <div>
      "child"
```

但这也使得一些情况下布局难以控制，例如在使用 flex 布局时， `<child>` 节点本身会成为一个 flex 内容项。

## 开启 virtualHost

通过指定组件的 `virtualHost` 选项，可以改变这一行为，使组件节点本身不生成一个对应的 DOM 节点：

```js
const childComponent = componentSpace.define()
  .options({
    virtualHost: true,
  })
  .template(wxml(`
    <div>child</div>
  `))
  .registerComponent()
```

开启后，组件节点在最终的 Backend Tree 中表现为 [虚拟节点](../tree/node_tree.md) ，其子节点会直接挂载到上层的父节点中：

```html
<!-- Backend Tree（开启 virtualHost） -->
<my-component>
  <div class="a" style="color: red">
  <!-- child 不再生成 DOM 节点，子节点直接挂到 my-component 下 -->
  <div>
    "child"
```

此时：

* flex 布局中，`<child>` 本身不再作为 flex 内容项参与布局，其内部子节点会直接参与父容器的布局；
* 节点本身的 class 和 style 失效。

## 保留 class 和 style 的能力

虽然节点本身的 class 和 style 会失效，但可以将 class 定义为一个 [外部样式类](external_class.md) 、将 style 定义为一个属性，再将它们应用到组件内部的节点上，例如：

```js
const childComponent = componentSpace.define()
  .options({
    virtualHost: true,
  })
  .externalClasses(['class'])
  .property('style', String)
  .template(wxml(`
    <div class="class" style="{{ style }}">child</div>
  `))
  .registerComponent()

export const myComponent = componentSpace.define()
  .usingComponents({
    child: childComponent,
  })
  .template(wxml(`
    <child class="b" style="color: blue" />
  `))
  .registerComponent()
```

此时 class 和 style 被传递到了组件内部的 `<div>` 上：

```html
<!-- Backend Tree -->
<my-component>
  <!-- child 本身没有 DOM 节点 -->
  <div class="b" style="color: blue">
    "child"
```

> **注意**：开启了 `virtualHost` 的组件节点，调用 `getBackendElement()` 或访问 `$$` 属性将返回 `null` ，因为它没有对应的真实 DOM 元素。
