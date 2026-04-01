# 节点树变化监听

[Shadow Tree](./node_tree.md#shadow-tree) 的变化可以通过 `MutationObserver` 来监听。它的用法类似 DOM 的 `MutationObserver` ：先创建一个观察器实例并传入回调函数，然后调用 `observe` 指定要观察的节点和变化类型。

> 📖 关于 `MutationObserver` 的完整 API 说明请参阅 [MutationObserver API](../api/other.md#mutationobserver) 文档。

> ⚠️ MutationObserver 无法监听 [Composed Tree](./node_tree.md#composed-tree) 的变化。

## 基本用法

创建 `MutationObserver` 有两种方式：通过 `new` 或静态方法 `create` 。一般在组件 `attached` 生命周期中开始观察，在 `detached` 生命周期中停止观察。

```js
export const myComponent = componentSpace.define()
  .init(({ self, lifetime }) => {
    let observer
    lifetime('attached', () => {
      // 组件挂载时，创建 observer 并开始观察
      observer = glassEasel.MutationObserver.create((ev) => {
        console.log('Change type:', ev.type)
        console.log('Target node:', ev.target)
      })
      observer.observe(self.shadowRoot, {
        properties: true,
        childList: true,
        characterData: true,
      })
    })
    lifetime('detached', () => {
      // 停止观察，释放资源
      observer.disconnect()
      observer = null
    })
  })
  .registerComponent()
```

> 每个 `MutationObserver` 实例只能调用一次 `observe` 。如需观察多个节点或不同的变化类型组合，需要创建多个实例。

## 监听属性变化（ `properties` ）

当节点的属性发生变化时触发，包括组件 property 、 `id` 、 `class` 、 `style` 、 `slot` 等基本属性的变更。回调接收到的事件对象中包含 `nameType` 字段，指示变化的具体类别。

如果是组件的 property 或 slot 的 value 变更，事件的 `propertyName` 字段会被设置为对应的属性名；其他情况下 `attributeName` 字段会被设置。

```js
// 监听基本属性和组件 property 变化
glassEasel.MutationObserver.create((ev) => {
  // ev.type === 'properties'
  console.log('Name type:', ev.nameType)

  if (ev.propertyName) {
    // 组件 property 或 slot value 变更
    console.log('Property changed:', ev.propertyName)
  }
  if (ev.attributeName) {
    // id, class, style, slot 等属性变更
    console.log('Attribute changed:', ev.attributeName)
  }
}).observe(node, { properties: true })
```

设置 `properties: true` 时只会收到 `nameType` 为 `'basic'` 、 `'attribute'` 或 `'component-property'` 的变更通知。若还需要监听 dataset 、 mark 、外部样式类等变化，需要将 `properties` 设置为 `'all'` ：

```js
// 监听所有属性变化（包括 dataset、mark、外部样式类等）
glassEasel.MutationObserver.create((ev) => {
  switch (ev.nameType) {
    case 'basic':
      // id, class, style, slot 等基本属性变更
      console.log('Basic attr:', ev.attributeName)
      break
    case 'component-property':
      // 组件 property 变更
      console.log('Property:', ev.propertyName)
      break
    case 'dataset':
      // dataset 变更，attributeName 带有 'data:' 前缀
      console.log('Dataset:', ev.attributeName) // 例如 'data:index'
      break
    case 'mark':
      // mark 变更，attributeName 带有 'mark:' 前缀
      console.log('Mark:', ev.attributeName) // 例如 'mark:type'
      break
    case 'external-class':
      // 外部样式类变更
      console.log('External class:', ev.attributeName)
      break
    case 'slot-value':
      // slot value 变更
      console.log('Slot value:', ev.propertyName)
      break
  }
}).observe(node, { properties: 'all' })
```

> ⚠️ `attribute` 、 `dataset` 、 `mark` 和 `external-class` 类型的变更只要被设置就会触发通知，即使实际值没有变化。

## 监听子节点变化（ `childList` ）

当节点的子节点列表发生变化时触发，包括子节点的添加、移除和移动。事件对象中包含 `addedNodes` 和 `removedNodes` 数组，分别列出新增和移除的节点。

```js
glassEasel.MutationObserver.create((ev) => {
  // ev.type === 'childList'
  console.log('Parent node:', ev.target)

  if (ev.addedNodes) {
    ev.addedNodes.forEach((node) => {
      console.log('Node added:', node)
    })
  }

  if (ev.removedNodes) {
    ev.removedNodes.forEach((node) => {
      console.log('Node removed:', node)
    })
  }
}).observe(node, { childList: true })
```

当节点被移动（先从旧位置移除，再插入新位置）时，会分别触发两次回调：一次移除事件和一次添加事件。

## 监听文本内容变化（ `characterData` ）

当文本节点的文本内容发生变化时触发。事件对象的 `target` 是发生变化的 `TextNode` 。

```js
glassEasel.MutationObserver.create((ev) => {
  // ev.type === 'characterData'
  console.log('Text node changed:', ev.target)
  console.log('New text:', ev.target.textContent)
}).observe(node, { characterData: true })
```

## 监听挂载状态变化（ `attachStatus` ）

当节点被挂载到节点树或从节点树卸载时触发。事件对象中包含 `status` 字段，值为 `'attached'` 或 `'detached'` 。

```js
glassEasel.MutationObserver.create((ev) => {
  // ev.type === 'attachStatus'
  if (ev.status === 'attached') {
    console.log('Node attached to tree')
  } else {
    console.log('Node detached from tree')
  }
}).observe(node, { attachStatus: true })
```

> ⚠️ `attachStatus` 不支持 `subtree: true` ，只能监听 `observe` 指定的目标节点本身的挂载状态。

## 监听子树变化（ `subtree` ）

默认情况下，MutationObserver 只会监听单个节点。启用 `subtree: true` 可以递归监听目标节点下所有子孙节点的变化，而不仅仅是目标节点本身。

```js
// 只监听目标节点自身的属性变化
observer.observe(node, { properties: true })

// 监听目标节点及其所有子孙节点的属性变化
observer.observe(node, { properties: true, subtree: true })
```

> ⚠️ `subtree` 会造成更多的计算开销，应谨慎使用。

> ⚠️ `subtree` 对 `properties` 、 `childList` 和 `characterData` 有效，但对 `attachStatus` 无效。
