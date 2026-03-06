# ShadowRoot 常用 API

## 概述

`ShadowRoot` 继承自 `VirtualNode` （进而继承 `Element` ），是组件 Shadow Tree 的根节点。每个非外部组件都拥有一个 `ShadowRoot` ，它提供了节点创建、组件解析、ID 查询、Slot 管理等能力。除 [Element 常用 API](./element.md) 中描述的通用方法外，本文介绍 `ShadowRoot` 上特有的 API 。

> 📖 关于 Shadow Tree 和节点类型的说明请参阅 [节点树与节点类型](../tree/node_tree.md) 文档。

## 宿主节点

`ShadowRoot` 通过 `getHostNode()` 获取其所属的宿主组件。

+ [`ShadowRoot.prototype.getHostNode()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#getHostNode)

+ [`ShadowRoot.isShadowRoot(node)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#isShadowRoot)

`getHostNode()` 返回该 `ShadowRoot` 所属的宿主组件实例。 `ShadowRoot.isShadowRoot` 是静态方法，用于判断一个节点是否为 `ShadowRoot` 。

```js
const sr = this.shadowRoot

// 获取宿主组件
const host = sr.getHostNode()
console.log(host.is) // 宿主组件的路径名

// 判断节点是否为 ShadowRoot（静态方法）
if (ShadowRoot.isShadowRoot(node)) {
  console.log('This is a shadow root')
}
```

## 节点创建

`ShadowRoot` 提供了创建各种节点类型的工厂方法，创建的节点属于该 `ShadowRoot` 所在的 Shadow Tree 。

+ [`ShadowRoot.prototype.createTextNode(text?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#createTextNode)

+ [`ShadowRoot.prototype.createNativeNode(tagName)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#createNativeNode)

+ [`ShadowRoot.prototype.createVirtualNode(virtualName?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#createVirtualNode)

+ [`ShadowRoot.prototype.createNativeNodeWithInit(tagName, stylingName, initPropValues?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#createNativeNodeWithInit)

`createTextNode` 创建文本节点。 `createNativeNode` 创建原生节点（如 `div` 、 `span` ）。 `createVirtualNode` 创建虚拟节点（默认名为 `virtual` ）。 `createNativeNodeWithInit` 创建原生节点的同时可指定用于样式隔离的 `stylingName` 和初始化回调。

```js
const sr = this.shadowRoot

// 创建文本节点
const text = sr.createTextNode('Hello World')

// 创建原生节点
const div = sr.createNativeNode('div')
const span = sr.createNativeNode('span')

// 创建虚拟节点
const vnode = sr.createVirtualNode('block')

// 创建原生节点并初始化属性
const img = sr.createNativeNodeWithInit('img', 'image', (node) => {
  node.setAttribute('src', 'https://example.com/image.png')
})

// 将创建的节点添加到 Shadow Tree
sr.appendChild(div)
div.appendChild(text)
div.appendChild(span)
```

> 📖 关于节点树变更的完整说明请参阅 [节点树变更](../tree/node_tree_modification.md) 文档。

## 组件创建与解析

`ShadowRoot` 提供了在 Shadow Tree 中创建子组件的方法，会根据组件定义中的 `using` 列表、泛型实现和组件空间进行解析。

+ [`ShadowRoot.prototype.createComponent(tagName, usingKey?, genericTargets?, initPropValues?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#createComponent)

+ [`ShadowRoot.prototype.createComponentByDef(tagName, componentDef, genericTargets?, initPropValues?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#createComponentByDef)

+ [`ShadowRoot.prototype.resolveComponent(tagName, usingKey?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#resolveComponent)

`createComponent` 根据标签名解析组件定义后创建子组件或原生节点。 `createComponentByDef` 直接使用指定的组件定义创建子组件。 `resolveComponent` 仅解析组件定义而不创建实例，返回解析到的组件定义和占位符处理器。

```js
const sr = this.shadowRoot

// 根据标签名创建组件（自动解析 using 列表和组件空间）
const child = sr.createComponent('child-comp')

// 指定 using key 进行解析
const comp = sr.createComponent('my-tag', 'my-using-key')

// 指定泛型目标创建组件
const genericComp = sr.createComponent('generic-comp', undefined, {
  'item-renderer': 'custom-item',
})

// 直接使用组件定义创建
const compByDef = sr.createComponentByDef('my-comp', MyCompDef)

// 仅解析组件定义（不创建实例）
const { using, placeholderHandler } = sr.resolveComponent('child-comp')
if (placeholderHandler) {
  // 如果使用了占位符，可以注册替换回调
  placeholderHandler.onReplace(() => {
    console.log('Placeholder replaced with real component')
  })
}
```

> 📖 关于组件空间和泛型的详细说明请参阅 [组件空间](../advanced/component_space.md) 和 [泛型](../interaction/generic.md) 文档。

## ID 查询

`ShadowRoot` 提供了通过 ID 查找 Shadow Tree 中节点的方法。

+ [`ShadowRoot.prototype.getElementById(id)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#getElementById)

`getElementById` 在 Shadow Tree 中查找第一个具有指定 ID 的节点，未找到时返回 `undefined` 。ID 映射会被缓存，当 Shadow Tree 变更后缓存会自动失效。

```js
const sr = this.shadowRoot

// 通过 ID 查找节点
const node = sr.getElementById('my-node')
if (node) {
  console.log(node.id) // 'my-node'
}

// 也可以使用 Element 上的 querySelector
const node2 = sr.querySelector('#my-node')
```

## 连接检查

+ [`ShadowRoot.prototype.isConnected(node)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#isConnected)

`isConnected` 检查一个节点是否连接到此 `ShadowRoot` ，即该节点是否在此 Shadow Tree 中且可通过父节点链追溯到 `ShadowRoot` 。

```js
const sr = this.shadowRoot
const node = sr.createNativeNode('div')

// 节点刚创建，未添加到 Shadow Tree
console.log(sr.isConnected(node)) // false

// 添加到 Shadow Tree 后
sr.appendChild(node)
console.log(sr.isConnected(node)) // true
```

## Slot 查询

`ShadowRoot` 提供了查询和遍历 Slot 的方法。Slot 的行为取决于组件选项中配置的 Slot 模式（单 Slot 、多 Slot 或动态 Slot ）。

+ [`ShadowRoot.prototype.getSlotMode()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#getSlotMode)

+ [`ShadowRoot.prototype.getSlotElementFromName(name)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#getSlotElementFromName)

+ [`ShadowRoot.prototype.getContainingSlot(elem)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#getContainingSlot)

+ [`ShadowRoot.prototype.getSlotContentArray(slot)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#getSlotContentArray)

`getSlotMode()` 返回当前的 Slot 模式。 `getSlotElementFromName` 根据名称获取对应的 Slot 元素（动态 Slot 模式下可能返回数组）。 `getContainingSlot` 获取指定节点所在的 Slot 元素。 `getSlotContentArray` 返回一个 Slot 中所有被分配的内容节点数组。

```js
const sr = this.shadowRoot

// 获取 Slot 模式
const mode = sr.getSlotMode()

// 获取默认 Slot 元素
const defaultSlot = sr.getSlotElementFromName('')

// 获取具名 Slot 元素
const namedSlot = sr.getSlotElementFromName('header')

// 获取节点所在的 Slot
const host = sr.getHostNode()
const child = host.childNodes[0]
const slot = sr.getContainingSlot(child)
console.log(slot) // 该子节点被分配到的 Slot 元素

// 获取 Slot 中的所有内容节点
if (slot) {
  const contents = sr.getSlotContentArray(slot)
  console.log(contents) // 分配给该 Slot 的所有节点
}
```

> 📖 关于 Slot 的详细说明请参阅 [Slot](../interaction/slot.md) 文档。

## Slot 遍历

`ShadowRoot` 提供了多种遍历 Slot 及其内容的方法。带 `SlotContent` 的方法会跳过 `inherit-slots` 节点，而不带的方法会包含它们。

+ [`ShadowRoot.prototype.forEachSlot(f)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#forEachSlot)

+ [`ShadowRoot.prototype.forEachNodeInSlot(f)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#forEachNodeInSlot)

+ [`ShadowRoot.prototype.forEachNodeInSpecifiedSlot(slot, f)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#forEachNodeInSpecifiedSlot)

+ [`ShadowRoot.prototype.forEachSlotContentInSlot(f)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#forEachSlotContentInSlot)

+ [`ShadowRoot.prototype.forEachSlotContentInSpecifiedSlot(slot, f)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#forEachSlotContentInSpecifiedSlot)

`forEachSlot` 遍历 Shadow Tree 中的所有 Slot 元素。 `forEachNodeInSlot` 遍历宿主的所有子节点及其对应的 Slot 。 `forEachNodeInSpecifiedSlot` 遍历指定 Slot 中的所有内容节点。 `forEachSlotContentInSlot` 和 `forEachSlotContentInSpecifiedSlot` 与前两者类似，但会跳过 `inherit-slots` 节点。所有回调函数返回 `false` 可提前中断遍历。

```js
const sr = this.shadowRoot

// 遍历所有 Slot 元素
sr.forEachSlot((slot) => {
  console.log('Slot name:', slot._$slotName)
})

// 遍历所有子节点及其对应的 Slot
sr.forEachNodeInSlot((node, slot) => {
  console.log('Node:', node, 'in slot:', slot)
})

// 遍历指定 Slot 中的内容节点
const slot = sr.getSlotElementFromName('')
if (slot && !Array.isArray(slot)) {
  sr.forEachNodeInSpecifiedSlot(slot, (node) => {
    console.log('Slot content:', node)
  })
}

// 遍历 Slot 内容（跳过 inherit-slots 节点）
sr.forEachSlotContentInSlot((node, slot) => {
  console.log('Content node:', node, 'in slot:', slot)
  // 返回 false 提前中断遍历
  return false
})
```

> 📖 关于 Slot 和 slot-inherit 的详细说明请参阅 [Slot](../interaction/slot.md) 文档。

## 动态 Slot 管理

在动态 Slot 模式下， `ShadowRoot` 提供了设置 Slot 处理器和管理 Slot 值的方法。这些 API 通常由 [自定义模板引擎](../advanced/template_engine.md) 使用。

+ [`ShadowRoot.prototype.setDynamicSlotHandler(insertSlotHandler, removeSlotHandler, updateSlotHandler, updateSlotValueHandler)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#setDynamicSlotHandler)

+ [`ShadowRoot.prototype.useDynamicSlotHandlerFrom(source)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#useDynamicSlotHandlerFrom)

+ [`ShadowRoot.prototype.replaceSlotValue(slot, name, value)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#replaceSlotValue)

+ [`ShadowRoot.prototype.applySlotValueUpdates(slot)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#applySlotValueUpdates)

+ [`ShadowRoot.prototype.applySlotUpdates()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ShadowRoot.html#applySlotUpdates)

`setDynamicSlotHandler` 注册四个回调，分别在 Slot 插入、移除、更新和 Slot 值变更时被调用。 `useDynamicSlotHandlerFrom` 从另一个 `ShadowRoot` 复用相同的处理器。 `replaceSlotValue` 更新某个 Slot 上指定名称的值。 `applySlotValueUpdates` 将单个 Slot 的值变更通知给处理器。 `applySlotUpdates` 在初始化完成后批量通知所有 Slot 的状态。

```js
const sr = this.shadowRoot

// 设置动态 Slot 处理器
sr.setDynamicSlotHandler(
  // 插入 Slot 时调用
  (slots) => {
    slots.forEach(({ slot, name, slotValues }) => {
      console.log('Slot inserted:', name, slotValues)
    })
  },
  // 移除 Slot 时调用
  (slots) => {
    slots.forEach((slot) => {
      console.log('Slot removed:', slot)
    })
  },
  // Slot 更新时调用
  (slot, slotValues) => {
    console.log('Slot updated:', slotValues)
  },
  // Slot 值变更时调用
  (slot, name) => {
    console.log('Slot value changed:', name)
  },
)

// 更新 Slot 值
const slot = sr.getSlotElementFromName('')
if (slot && !Array.isArray(slot)) {
  sr.replaceSlotValue(slot, 'myProp', 'new value')
  sr.applySlotValueUpdates(slot)
}

// 批量应用 Slot 更新
sr.applySlotUpdates()
```

> 📖 关于动态 Slot 和自定义模板引擎的详细说明请参阅 [Slot](../interaction/slot.md) 和 [自定义模板引擎](../advanced/template_engine.md) 文档。
