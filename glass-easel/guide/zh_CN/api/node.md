# 节点类型

## 概述

本文介绍 glass-easel 中 `Element` 以外的几种节点类型，包括 `TextNode` 、 `NativeNode` 和 `VirtualNode` 。它们与 [Element](./element.md) 、 [Component](./component.md) 和 [ShadowRoot](./shadow_root.md) 共同构成了 glass-easel 的节点树。

## TextNode

`TextNode` 是文本节点类型，不继承自 `Element` ，但拥有部分相似的属性。通过 [`ShadowRoot.prototype.createTextNode`](./shadow_root.md#节点创建) 创建。

+ [`TextNode.prototype.textContent`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/TextNode.html#textContent)

+ [`TextNode.prototype.ownerShadowRoot`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/TextNode.html#ownerShadowRoot)

+ [`TextNode.prototype.parentNode`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/TextNode.html#parentNode)

+ [`TextNode.prototype.containingSlot`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/TextNode.html#containingSlot)

+ [`TextNode.prototype.getBackendElement()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/TextNode.html#getBackendElement)

+ [`TextNode.prototype.$$`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/TextNode.html#__)

+ [`TextNode.prototype.getComposedParent()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/TextNode.html#getComposedParent)

+ [`TextNode.isTextNode(node)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/TextNode.html#isTextNode)

`textContent` 是可读写的属性，修改后会自动同步到后端。 `TextNode.isTextNode` 是静态方法，用于判断一个节点是否为文本节点。 `TextNode` 也支持 `asTextNode()` 、 `asElement()` 等类型转换方法（均在 `NodeCast` 接口中定义）。

```js
const sr = this.shadowRoot

// 创建文本节点
const text = sr.createTextNode('Hello')

// 读写文本内容
console.log(text.textContent) // 'Hello'
text.textContent = 'World'

// 访问树结构
console.log(text.ownerShadowRoot) // 所属的 ShadowRoot
console.log(text.parentNode)      // 父节点
console.log(text.containingSlot)  // 所在的 slot

// 获取后端元素
const be = text.getBackendElement()
const be2 = text.$$  // 等价

// 获取 Composed 父节点
const parent = text.getComposedParent()

// 判断是否为文本节点（静态方法）
if (TextNode.isTextNode(node)) {
  console.log('Text:', node.textContent)
}
```

## NativeNode

`NativeNode` 继承自 `Element` ，表示原生节点（如 `div` 、 `span` 等标签）。通过 [`ShadowRoot.prototype.createNativeNode`](./shadow_root.md#节点创建) 创建。除了 [Element 常用 API](./element.md) 中的通用方法外，还有以下特有的 API 。

+ [`NativeNode.prototype.is`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/NativeNode.html#is)

+ [`NativeNode.prototype.stylingName`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/NativeNode.html#stylingName)

+ [`NativeNode.prototype.setModelBindingListener(propName, listener)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/NativeNode.html#setModelBindingListener)

+ [`NativeNode.isNativeNode(node)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/NativeNode.html#isNativeNode)

`is` 是原生节点的标签名。 `stylingName` 是用于样式隔离的名称，通常与 `is` 相同。 `setModelBindingListener` 用于设置双向绑定监听器。 `NativeNode.isNativeNode` 是静态方法，用于判断一个节点是否为原生节点。

```js
const sr = this.shadowRoot
const div = sr.createNativeNode('div')

// 读取标签名和样式名
console.log(div.is)          // 'div'
console.log(div.stylingName) // 'div'

// 设置双向绑定监听器（当后端值变更时回调）
div.setModelBindingListener('value', (newValue) => {
  console.log('Model value changed:', newValue)
})

// 判断是否为原生节点（静态方法）
if (NativeNode.isNativeNode(node)) {
  console.log('Native node:', node.is)
}
```

## VirtualNode

`VirtualNode` 继承自 `Element` ，表示虚拟节点。虚拟节点在后端不产生真实的 DOM 元素，常用于逻辑分组（类似 `block` ）。通过 [`ShadowRoot.prototype.createVirtualNode`](./shadow_root.md#节点创建) 创建。

+ [`VirtualNode.prototype.is`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/VirtualNode.html#is)

+ [`VirtualNode.isVirtualNode(node)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/VirtualNode.html#isVirtualNode)

```js
const sr = this.shadowRoot
const vnode = sr.createVirtualNode('block')

console.log(vnode.is) // 'block'

// 判断是否为虚拟节点（静态方法）
if (VirtualNode.isVirtualNode(node)) {
  console.log('Virtual node:', node.is)
}

// 也可以用 Element 上的 isVirtual() 方法
if (node.isVirtual()) {
  console.log('This is a virtual element')
}
```
