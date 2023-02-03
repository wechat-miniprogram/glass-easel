# 节点树与节点类型

## Shadow Tree

glass-easel 自身以 **Shadow Tree** 为单位来存储节点树。每个组件实例对应于一个 Shadow Tree 。

例如，对于一个由以下两个组件构成的页面：

```js
export const childComponent = componentSpace.defineComponent({
  template: compileTemplate(`
    <div>Text in childComponent</div>
    <slot />
  `),
})

export const myComponent = componentSpace.defineComponent({
  using: {
    child: childComponent,
  },
  template: compileTemplate(`
    <div class="blue" />
    <child>
      <span>{{ text }}</span>
    </child>
  `),
  data: { text: 'Text in myComponent' },
})
```

这个页面中，包含两个 Shadow Tree 。其一是根组件 myComponent 的 Shadow Tree ：

```
ShadowRoot
  - div class="blue"
  - child
    - span
      - "Text in myComponent"
```

其二是 childComponent 的 Shadow Tree ：

```
ShadowRoot
  - div
    - "Text in childComponent"
  - slot
```

Shadow Tree 有几个关键特点：

* Shadow Tree 是一个组件实例自身模板中包含的节点，包括 slot 节点本身，但不包括组件的使用者放入 slot 中的内容；
* 每个 Shadow Tree 都以一种特殊的 `ShadowRoot` 节点为根节点。

## Composed Tree

Shadow Tree 不能直接用于最终的页面，还需要经过一个 **树拼接** 过程，将所有 Shadow Tree 拼成一个大的 **Composed Tree** 。

这个拼接过程中，组件节点会和它的 `ShadowRoot` 对应组合， slot 中也会被放入内容。

对于上例， Composed Tree 是：

```
ShadowRoot
  - div class="blue"
  - child
    - ShadowRoot
      - div
        - "Text in childComponent"
      - slot
        - span
          - "Text in myComponent"
```

Composed Tree 中包含一些 **虚拟节点** ，如 `ShadowRoot` 和 slot ，将这些节点去掉之后就是真正的 DOM 节点树了。

## 直接树访问

访问组件实例的 `this.shadowRoot` 属性可以获取到这个组件实例对应的 `ShadowRoot` 节点。进而通过每个节点的 `childNodes` 数组可以直接访问到每个节点。例如：

```js
export const childComponent = componentSpace.defineComponent({
  template: compileTemplate(`
    <div>Text in childComponent</div>
    <slot />
  `),
  lifetimes: {
    attached() {
      const shadowRoot = this.shadowRoot
      const textNode = shadowRoot.childNodes[0].childNodes[0]
      textNode.textContent === 'Text in childComponent' // true
    },
  },
})
```

## 节点类型

在通过 `childNodes` 访问节点树时，可能会访问到以下几种类型的节点：

* `glassEasel.TextNode` 文本节点；
* `glassEasel.NativeNode` 普通节点，如 `<div />` ；
* `glassEasel.Component` 组件节点；
* `glassEasel.VirtualNode` 虚拟节点。

其中，除了 `glassEasel.TextNode` 之外，其余类型共有一个基类 `glassEasel.Element` 。

`glassEasel.ShadowRoot` 是 `glassEasel.VirtualNode` 的子类。

## 常用树遍历属性和方法

除了 `childNodes` 外，还有一些属性和方法可以用来进行树遍历。常用的属性和方法如下：

* `glassEasel.Element#childNodes` 当前节点的所有 Shadow Tree 子节点列表；
* `glassEasel.Element#parentNode` 当前节点的 Shadow Tree 父节点；
* `glassEasel.Element#ownerShadowRoot` 当前节点所在 Shadow Tree 的 `ShadowRoot` ；
* `glassEasel.Element#getComposedChildren()` 当前节点的所有 Composed Tree 的子节点列表；
* `glassEasel.Element#getComposedParent()` 当前节点的 Composed Tree 的父节点；
* `glassEasel.Component#shadowRoot` 当前组件节点的 `ShadowRoot` ，对于 [外部组件](../advanced/external_component.md) 是一个 `glassEasel.ExternalShadowRoot` ；
* `glassEasel.Component#getShadowRoot()` 当前组件节点的 `ShadowRoot` ，对于 [外部组件](../advanced/external_component.md) 返回空；
* `glassEasel.ShadowRoot#getHostNode()` 当前 `ShadowRoot` 对应的组件节点；

注意：不要直接修改这些属性。

如果只是进行常规的树遍历，可以使用 [节点树遍历](element_iterator.md) 接口。

## 调试输出节点树

如果只是想临时输出节点树结构信息供调试使用，可以使用 `dumpElement` 或 `dumpElementToString` 方法：

```js
componentSpace.defineComponent({
  lifetimes: {
    attached() {
      // 在 console 中输出 Shadow Tree
      glassEasel.dumpElement(this.shadowRoot, false)
      // 在 console 中输出 Composed Tree
      glassEasel.dumpElement(this, true)
    },
  },
})
```
