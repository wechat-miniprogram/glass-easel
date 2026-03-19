# 其他常用 API

## 概述

本文列出了 glass-easel 中不在节点对象上的常用方法 ，包括 `Event` 、 `MutationObserver` 、 `ElementIterator` 、 `ComponentSpace` 、 `StyleScopeManager` 、全局选项和便捷函数等。

## Event

`Event` 是事件对象类型，在事件触发和冒泡过程中使用。`ShadowedEvent` 是在事件回调中实际接收到的类型，它在 `Event` 基础上增加了 `target` 、 `currentTarget` 和 `mark` 属性。

> 📖 关于如何触发事件、监听事件、事件冒泡与捕获等用法请参阅 [事件](../basic/event.md) 文档。

### 创建与属性

+ [`new Event(name, detail, options?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#constructor)

+ [`Event.prototype.type`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#type)

+ [`Event.prototype.timeStamp`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#timeStamp)

+ [`Event.prototype.detail`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#detail)

+ [`Event.prototype.bubbles`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#bubbles)

+ [`Event.prototype.composed`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#composed)

+ [`Event.prototype.eventPhase`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#eventPhase)

`eventPhase` 的可能值：

| 值 | 含义 |
| --- | --- |
| `EventPhase.None` | 事件未被分发 |
| `EventPhase.CapturingPhase` | 捕获阶段 |
| `EventPhase.AtTarget` | 位于目标节点 |
| `EventPhase.BubblingPhase` | 冒泡阶段 |

`EventOptions` 支持以下字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `bubbles` | `boolean` | 事件是否冒泡（默认 `false` ） |
| `composed` | `boolean` | 事件是否跨越 Shadow 边界（默认 `false` ） |
| `capturePhase` | `boolean` | 是否启用捕获阶段（默认 `false` ） |
| `originalEvent` | `unknown` | 原始事件引用 |
| `extraFields` | `object` | 附加到事件对象上的额外字段 |

```js
// 创建事件
const ev = new glassEasel.Event('myevent', { key: 'value' }, {
  bubbles: true,
  composed: false,
})

console.log(ev.type)      // 'myevent'
console.log(ev.detail)    // { key: 'value' }
console.log(ev.bubbles)   // true
console.log(ev.timeStamp) // 相对时间戳
```

### 冒泡控制

+ [`Event.prototype.stopPropagation()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#stopPropagation)

+ [`Event.prototype.preventDefault()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#preventDefault)

+ [`Event.prototype.propagationStopped()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#propagationStopped)

+ [`Event.prototype.defaultPrevented()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#defaultPrevented)

+ [`Event.prototype.markMutated()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#markMutated)

+ [`Event.prototype.mutatedMarked()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#mutatedMarked)

+ [`Event.prototype.getEventBubbleStatus()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#getEventBubbleStatus)

+ [`Event.prototype.getEventName()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#getEventName)

+ [`Event.prototype.getOriginalEvent()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#getOriginalEvent)

`getEventName()` 返回事件名称。 `getOriginalEvent()` 返回原始事件对象（例如底层 DOM 事件）。

```js
// 在事件回调中控制冒泡
node.addListener('tap', (ev) => {
  // 阻止冒泡
  ev.stopPropagation()

  // 阻止默认行为
  ev.preventDefault()

  // 检查冒泡状态
  console.log(ev.propagationStopped()) // true
  console.log(ev.defaultPrevented())   // true

  // 获取事件名称和原始事件
  console.log(ev.getEventName())    // 'tap'
  console.log(ev.getOriginalEvent()) // 底层 DOM 事件（如果有）
})
```

### ShadowedEvent

在事件回调中收到的事件对象实际上是 `ShadowedEvent` 类型，它在 `Event` 的基础上增加了以下属性：

| 属性 | 说明 |
| --- | --- |
| `target` | 触发事件的源节点（经过 method caller 映射） |
| `currentTarget` | 当前处理事件的节点 |
| `mark` | 从事件源到当前节点沿路收集的所有 mark |

```js
node.addListener('tap', (ev) => {
  console.log(ev.target)        // 触发事件的节点
  console.log(ev.currentTarget) // 当前监听的节点
  console.log(ev.mark)          // 沿路收集的 mark，如 { type: 'important' }
})
```

### 静态方法

+ [`Event.triggerEvent(target, name, detail, options?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#triggerEvent)

+ [`Event.triggerExternalEvent(element, target, name, detail, options?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#triggerExternalEvent)

+ [`Event.dispatchEvent(target, event)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Event.html#dispatchEvent)

这些静态方法也作为顶层便捷函数导出（见 [便捷函数](#便捷函数) 一节）。

```js
// 静态方法触发事件
Event.triggerEvent(node, 'myevent', { key: 'value' }, { bubbles: true })

// 使用 Event 对象触发
const ev = new Event('myevent', { key: 'value' })
Event.dispatchEvent(node, ev)
```

> 📖 关于事件触发、监听、冒泡与捕获等用法请参阅 [事件](../basic/event.md) 文档。

## MutationObserver

`MutationObserver` 可以观察 Shadow Tree 中的节点变化，包括属性变更、子节点变更、文本变更和挂载状态变更。用法类似 DOM 的 `MutationObserver` 。

> 📖 关于各种变化类型的触发时机、使用场景和代码示例请参阅 [节点树变化监听](../tree/mutation_observer.md) 文档。

### 创建与观察

+ [`new MutationObserver(listener)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/MutationObserver.html#constructor)

+ [`MutationObserver.create(listener)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/MutationObserver.html#create)

+ [`MutationObserver.prototype.observe(targetNode, options?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/MutationObserver.html#observe)

+ [`MutationObserver.prototype.disconnect()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/MutationObserver.html#disconnect)

`create` 是 `new MutationObserver` 的简写。每个实例只能调用一次 `observe` ，再次调用会抛出异常。 `disconnect` 用于停止观察并释放资源。

```js
// 创建观察器
const observer = glassEasel.MutationObserver.create((ev) => {
  console.log(ev.type, ev.target)
})

// 开始观察
observer.observe(node, { properties: true, childList: true, subtree: true })

// 停止观察
observer.disconnect()
```

### 观察选项

`observe` 的第二个参数（ `MutationObserverOptions` ）支持以下选项：

| 选项 | 类型 | 说明 |
| --- | --- | --- |
| `properties` | `boolean \| 'all'` | 观察属性/property 变更。 `true` 只观察基本属性（ `id` / `class` / `style` / `slot` ）、通过 `setAttribute` 设置的普通属性和组件 property ； `'all'` 还包括 dataset 、 mark 、外部样式类和 slot value |
| `childList` | `boolean` | 观察子节点的添加和移除 |
| `characterData` | `boolean` | 观察文本节点内容变更 |
| `subtree` | `boolean` | 是否递归观察子树中的变更（对 `attachStatus` 无效） |
| `attachStatus` | `boolean` | 观察挂载/卸载状态变更（不支持 `subtree` ） |

### 事件对象类型

回调接收的事件对象是一个联合类型，根据 `type` 字段区分：

#### `MutationObserverAttrEvent` — 属性变更（ `type: 'properties'` ）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | `'properties'` | 事件类型 |
| `target` | `Element` | 发生变化的节点 |
| `nameType` | `string` | 变化的类别（见下表） |
| `propertyName` | `string?` | 当 `nameType` 为 `'component-property'` 或 `'slot-value'` 时设置 |
| `attributeName` | `string?` | 当 `nameType` 为其他类型时设置 |

`nameType` 的可能值：

| 值 | 说明 | `properties: true` 可收到 | `properties: 'all'` 可收到 |
| --- | --- | --- | --- |
| `'basic'` | `id` / `class` / `style` / `slot` 等基本属性 | ✅ | ✅ |
| `'attribute'` | 通过 `setAttribute` 设置的普通属性 | ✅ | ✅ |
| `'component-property'` | 组件 property 变更 | ✅ | ✅ |
| `'slot-value'` | slot 的 value 变更 | ❌ | ✅ |
| `'dataset'` | dataset 变更（ `attributeName` 带 `data:` 前缀） | ❌ | ✅ |
| `'mark'` | mark 变更（ `attributeName` 带 `mark:` 前缀） | ❌ | ✅ |
| `'external-class'` | 外部样式类变更 | ❌ | ✅ |

#### `MutationObserverChildEvent` — 子节点变更（ `type: 'childList'` ）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | `'childList'` | 事件类型 |
| `target` | `Element` | 子节点列表发生变化的父节点 |
| `addedNodes` | `Node[]?` | 新增的节点列表 |
| `removedNodes` | `Node[]?` | 移除的节点列表 |

#### `MutationObserverTextEvent` — 文本变更（ `type: 'characterData'` ）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | `'characterData'` | 事件类型 |
| `target` | `TextNode` | 内容发生变化的文本节点 |

#### `MutationObserverAttachEvent` — 挂载状态变更（ `type: 'attachStatus'` ）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | `'attachStatus'` | 事件类型 |
| `target` | `Element` | 状态发生变化的节点 |
| `status` | `'attached' \| 'detached'` | 挂载状态 |

```js
const observer = new glassEasel.MutationObserver((ev) => {
  switch (ev.type) {
    case 'properties':
      console.log('Name type:', ev.nameType)
      console.log('Property:', ev.propertyName, 'Attribute:', ev.attributeName)
      break
    case 'childList':
      console.log('Added:', ev.addedNodes, 'Removed:', ev.removedNodes)
      break
    case 'characterData':
      console.log('Text changed on:', ev.target)
      break
    case 'attachStatus':
      console.log('Status:', ev.status)
      break
  }
})

observer.observe(node, {
  properties: 'all',
  childList: true,
  characterData: true,
  subtree: true,
})
```

> ⚠️ 每个 `MutationObserver` 实例只能调用一次 `observe` 。如需观察多个节点，需创建多个实例。

## ElementIterator

`ElementIterator` 提供了对节点树进行先根/后根、Shadow/Composed 遍历的迭代器，支持 `for...of` 和 `forEach` 两种遍历方式。

> 📖 关于各种遍历模式的详细说明、遍历顺序图解和使用场景请参阅 [节点树遍历](../tree/element_iterator.md) 文档。

### 创建

+ [`new ElementIterator(node, type, nodeTypeLimit?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ElementIterator.html#constructor)

+ [`ElementIterator.create(node, type, nodeTypeLimit?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ElementIterator.html#create)

`create` 是 `new ElementIterator` 的简写。 `node` 必须是 `Element` 或 `TextNode` 类型的节点，否则会抛出异常。

### 遍历方向

`type` 参数（ `ElementIteratorType` ）决定遍历方向和顺序：

| 值 | 说明 |
| --- | --- |
| `ElementIteratorType.ShadowAncestors` | Shadow Tree 上的祖先遍历（由近及远） |
| `ElementIteratorType.ComposedAncestors` | Composed Tree 上的祖先遍历（由近及远，穿越 Shadow 边界） |
| `ElementIteratorType.ShadowDescendantsRootFirst` | Shadow Tree 先根遍历（先父后子） |
| `ElementIteratorType.ShadowDescendantsRootLast` | Shadow Tree 后根遍历（先子后父） |
| `ElementIteratorType.ComposedDescendantsRootFirst` | Composed Tree 先根遍历（先父后子，穿越 Shadow 边界） |
| `ElementIteratorType.ComposedDescendantsRootLast` | Composed Tree 后根遍历（先子后父，穿越 Shadow 边界） |

### 节点类型限制

`nodeTypeLimit` 参数用于限制返回的节点类型，内部通过 `instanceof` 判断。根据传入的类型不同，迭代器的泛型参数也随之变化：

| `nodeTypeLimit` 值 | 返回类型 | 说明 |
| --- | --- | --- |
| `Element` （默认） | `Element` | 所有元素节点（不含文本节点） |
| `Component` | `GeneralComponent` | 仅组件节点 |
| `NativeNode` | `NativeNode` | 仅 NativeNode |
| `ShadowRoot` | `ShadowRoot` | 仅 ShadowRoot |
| `VirtualNode` | `VirtualNode` | 仅 VirtualNode |
| `TextNode` | `TextNode` | 仅文本节点 |
| `Object` | `Node` | 所有节点（包含文本节点） |

### 遍历方式

+ [`ElementIterator.prototype.forEach(f)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ElementIterator.html#forEach)

+ [`ElementIterator.prototype[Symbol.iterator]()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ElementIterator.html)

`forEach` 接受回调函数 `(node: T) => boolean | void` ，回调返回 `false` 时中断遍历。

`[Symbol.iterator]()` 返回一个 `Generator<T, void, boolean | void>` ，支持 `for...of` 遍历。在先根遍历模式下，向 `next()` 传入 `false` 可跳过当前节点的子树（对于祖先遍历和后根遍历则直接中断）。

```js
const { ElementIterator, ElementIteratorType, Component } = glassEasel

// 使用 forEach 遍历 Shadow Tree
ElementIterator.create(root, ElementIteratorType.ShadowDescendantsRootFirst)
  .forEach((node) => {
    console.log(node)
    return false // 中断遍历
  })

// 使用 for...of 遍历
for (const node of ElementIterator.create(root, ElementIteratorType.ComposedDescendantsRootFirst, Object)) {
  console.log(node)
  if (someCondition) break
}

// 仅遍历组件
for (const comp of ElementIterator.create(root, ElementIteratorType.ShadowDescendantsRootFirst, Component)) {
  console.log('Component:', comp.is)
}

// 使用 Generator 接口跳过子树
const iter = ElementIterator.create(root, ElementIteratorType.ComposedDescendantsRootFirst, Object)[Symbol.iterator]()
for (let it = iter.next(); !it.done; ) {
  const node = it.value
  if (shouldSkipChildren(node)) {
    it = iter.next(false) // 跳过当前节点的子树
  } else {
    it = iter.next()
  }
}
```

> 📖 关于节点树遍历的详细说明请参阅 [节点树遍历](../tree/element_iterator.md) 文档。

## ComponentSpace

`ComponentSpace` 是组件和 Behavior 的注册中心，管理组件定义、别名、导入导出和全局 using 等。

> 📖 关于组件空间的详细说明请参阅 [组件空间](../advanced/component_space.md) 文档。

### 创建与配置

+ [`new ComponentSpace(defaultComponent?, baseSpace?, styleScopeManager?, allowUnusedNativeNode?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#constructor)

+ [`getDefaultComponentSpace()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/getDefaultComponentSpace.html)

+ [`ComponentSpace.prototype.updateComponentOptions(options)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#updateComponentOptions)

+ [`ComponentSpace.prototype.getComponentOptions()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#getComponentOptions)

+ [`ComponentSpace.prototype.styleScopeManager`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#styleScopeManager)

+ [`ComponentSpace.prototype.setSharedStyleScope(styleScopeId)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#setSharedStyleScope)

`getDefaultComponentSpace()` 是全局函数，返回默认的组件空间实例。 `baseSpace` 可以将一个已有的组件空间作为基础，继承其所有组件和 Behavior 定义。

```js
const { ComponentSpace, getDefaultComponentSpace } = glassEasel

// 使用默认组件空间
const defaultSpace = getDefaultComponentSpace()

// 创建新的组件空间
const mySpace = new ComponentSpace('my-default-comp')

// 基于已有空间创建（继承其组件定义）
const childSpace = new ComponentSpace('default', defaultSpace)

// 更新组件空间的默认选项
mySpace.updateComponentOptions({
  multipleSlots: true,
  dataDeepCopy: glassEasel.DeepCopyKind.SimpleWithRecursion,
})
```

### 组件与 Behavior 注册

+ [`ComponentSpace.prototype.define(is?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#define)

+ [`ComponentSpace.prototype.defineComponent(def)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#defineComponent)

+ [`ComponentSpace.prototype.defineBehavior(def)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#defineBehavior)

+ [`ComponentSpace.prototype.registerComponent(is, comp)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#registerComponent)

+ [`ComponentSpace.prototype.defineTraitBehavior(trans?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#defineTraitBehavior)

`define` 返回一个 `BehaviorBuilder` ，通过链式调用来定义组件或 Behavior 。 `defineComponent` 和 `defineBehavior` 接受经典风格的定义对象。 `registerComponent` 将已有的组件定义注册到空间中。

```js
const space = new ComponentSpace()

// 链式 API 定义组件
const MyComp = space
  .define('my-comp')
  .property('title', String)
  .data(() => ({ count: 0 }))
  .method('increment', function () {
    this.setData({ count: this.data.count + 1 })
  })
  .registerComponent()

// 经典风格定义组件
const MyComp2 = space.defineComponent({
  is: 'my-comp-2',
  properties: { title: String },
  data: { count: 0 },
  methods: {
    increment() {
      this.setData({ count: this.data.count + 1 })
    },
  },
})

// 经典风格定义 Behavior
const myBehavior = space.defineBehavior({
  is: 'my-behavior',
  data: { shared: 'value' },
})

// 定义 Trait Behavior（带转换函数）
const myTrait = space.defineTraitBehavior((impl) => ({
  greet: () => `Hello, ${impl.name}`,
}))
```

> 📖 关于链式 API 的完整说明请参阅 [定义风格](../basic/definition_style.md) 文档。

### 导入导出与全局 Using

+ [`ComponentSpace.prototype.exportComponent(alias, is)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#exportComponent)

+ [`ComponentSpace.prototype.exportBehavior(alias, is)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#exportBehavior)

+ [`ComponentSpace.prototype.getExportedComponent(alias)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#getExportedComponent)

+ [`ComponentSpace.prototype.getExportedBehavior(alias)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#getExportedBehavior)

+ [`ComponentSpace.prototype.importSpace(protoDomain, space, privateUse)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#importSpace)

+ [`ComponentSpace.prototype.setGlobalUsingComponent(key, target)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#setGlobalUsingComponent)

+ [`ComponentSpace.prototype.setComponentWaitingListener(listener)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#setComponentWaitingListener)

```js
// 导出组件（供其他空间使用）
space.exportComponent('my-comp-alias', 'my-comp')

// 导入另一个组件空间
space.importSpace('space://lib', libSpace, false)
// 使用导入的组件时需要带上 domain 前缀：'space://lib/comp-name'

// 设置全局 using（空间中所有组件可用）
space.setGlobalUsingComponent('my-icon', iconCompDef)

// 设置占位组件监听（按需加载场景）
space.setComponentWaitingListener((isPub, alias, owner) => {
  console.log(`Component "${alias}" is needed by`, owner.is)
  // 可以在此处触发异步加载
})
```

### 批量注册与 URL 创建

+ [`ComponentSpace.prototype.groupRegister(cb)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#groupRegister)

+ [`ComponentSpace.prototype.createComponentByUrl(tagName, url, genericTargets, backendContext)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/ComponentSpace.html#createComponentByUrl)

`groupRegister` 将一批组件和 Behavior 的注册包装在一起，占位符替换会在整批注册完成后统一执行。 `createComponentByUrl` 根据 URL 创建组件实例，URL 中的查询参数会自动设置为对应的 property 值。

```js
// 批量注册（占位符替换延迟到注册完成后）
space.groupRegister(() => {
  space.defineComponent({ is: 'comp-a', /* ... */ })
  space.defineComponent({ is: 'comp-b', /* ... */ })
  space.defineComponent({ is: 'comp-c', /* ... */ })
})

// 通过 URL 创建组件（查询参数会映射到 property）
const comp = space.createComponentByUrl(
  'my-page',
  'pages/index?title=Hello&count=10',
  null,
  backendContext,
)
```

## StyleScopeManager

`StyleScopeManager` 管理样式作用域的注册和查询。每个 `ComponentSpace` 关联一个 `StyleScopeManager` 。

+ [`StyleScopeManager.globalScope()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/StyleScopeManager.html#globalScope)

+ [`StyleScopeManager.prototype.register(name)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/StyleScopeManager.html#register)

+ [`StyleScopeManager.prototype.queryName(id)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/StyleScopeManager.html#queryName)

`globalScope()` 返回全局样式作用域 ID （值为 `0` ）。 `register` 注册一个新的样式作用域名称并返回其 ID 。 `queryName` 根据 ID 查询注册的名称。

```js
const { StyleScopeManager } = glassEasel

const manager = new StyleScopeManager()

// 全局作用域
const globalId = StyleScopeManager.globalScope() // 0

// 注册新的样式作用域
const scopeId = manager.register('my-component-scope')

// 查询作用域名称
console.log(manager.queryName(scopeId)) // 'my-component-scope'
```

> 📖 关于样式隔离的详细说明请参阅 [样式隔离](../styling/style_isolation.md) 文档。

### 默认组件选项

默认组件选项（ `NormalizedComponentOptions` ）为所有组件提供全局的默认值。每个组件可以通过自身的 `options` 字段覆盖这些默认值；组件未设置的选项将回退到 `globalOptions` 中的值。

> 📖 关于所有可用组件选项的完整列表和说明，请参阅 [组件配置](../advanced/component_options.md) 文档。

```js
const { globalOptions, DeepCopyKind } = glassEasel

// 设置环境选项（通常在初始化时）
globalOptions.throwGlobalError = true
globalOptions.writeExtraInfoToAttr = true
globalOptions.backendContext = myBackendContext

// 设置默认组件选项（所有组件都会继承这些默认值）
globalOptions.multipleSlots = true
globalOptions.dynamicSlots = true
globalOptions.dataDeepCopy = DeepCopyKind.SimpleWithRecursion
globalOptions.propertyPassingDeepCopy = DeepCopyKind.SimpleWithRecursion
globalOptions.virtualHost = true

// 单个组件可以通过 options 覆盖全局默认值
const myComp = componentSpace
  .define()
  .options({
    // 即使全局启用了 virtualHost，此组件仍使用真实宿主节点
    virtualHost: false,
    // 此组件不需要深拷贝
    dataDeepCopy: DeepCopyKind.None,
  })
  .registerComponent()
```

## 便捷函数

glass-easel 导出了一些顶层便捷函数，它们是对应类方法的简写。

+ [`registerElement(def)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/registerElement.html)

+ [`registerBehavior(def)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/registerBehavior.html)

+ [`createElement(tagName, compDef?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/createElement.html)

+ [`triggerEvent(target, name, detail, options?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/triggerEvent.html)

+ [`triggerExternalEvent(element, target, name, detail, options?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/triggerExternalEvent.html)

+ [`triggerRender(element, callback?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/triggerRender.html)

`registerElement` 等价于 `getDefaultComponentSpace().defineComponent(def)` 。 `registerBehavior` 等价于 `getDefaultComponentSpace().defineBehavior(def)` 。 `createElement` 等价于 `Component.create(tagName, compDef)` 。 `triggerEvent` 和 `triggerExternalEvent` 分别等价于 `Event.triggerEvent` 和 `Event.triggerExternalEvent` 。 `triggerRender` 调用后端的渲染回调。

```js
const { registerElement, registerBehavior, createElement, triggerRender } = glassEasel

// 在默认组件空间中注册组件
const MyComp = registerElement({
  is: 'my-comp',
  properties: { title: String },
})

// 在默认组件空间中注册 Behavior
const myBeh = registerBehavior({
  is: 'my-beh',
  data: { count: 0 },
})

// 创建组件实例
const comp = createElement('my-comp', MyComp)

// 请求后端渲染
triggerRender(comp, (err) => {
  if (err) console.error(err)
  else console.log('Rendered!')
})
```

## 调试工具函数

以下函数用于将节点树结构输出为字符串，方便调试。

+ [`dumpElement(elem, composed)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/dumpElement.html)

+ [`dumpElementToString(elem, composed)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/dumpElementToString.html)

+ [`dumpSingleElementToString(elem)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/dumpSingleElementToString.html)

`dumpElement` 将节点树以缩进格式打印到控制台。 `dumpElementToString` 返回格式化的字符串而不打印。 `dumpSingleElementToString` 返回单个节点的描述字符串。 `composed` 参数控制是遍历 Shadow Tree 还是 Composed Tree 。

```js
const { dumpElement, dumpElementToString, dumpSingleElementToString } = glassEasel
const comp = this

// 打印到控制台（Shadow Tree）
dumpElement(comp, false)

// 打印到控制台（Composed Tree）
dumpElement(comp, true)

// 获取字符串
const str = dumpElementToString(comp, false)
console.log(str)
// 输出类似：
// <my-comp:my-comp>
//   <div class="container">
//     <span>Hello</span>

// 单个节点的描述
console.log(dumpSingleElementToString(comp))
// 输出类似：<my-comp:my-comp id="xxx">
```

## 全局错误与警告处理

glass-easel 提供了全局的错误和警告监听机制，可以捕获组件中发生的异常。

+ [`addGlobalErrorListener(func)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/addGlobalErrorListener.html)

+ [`removeGlobalErrorListener(func)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/removeGlobalErrorListener.html)

+ [`addGlobalWarningListener(func)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/addGlobalWarningListener.html)

+ [`removeGlobalWarningListener(func)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/removeGlobalWarningListener.html)

+ [`dispatchError(err, method?, relatedComponent?, element?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/dispatchError.html)

+ [`triggerWarning(msg, relatedComponent?, element?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/functions/triggerWarning.html)

> 📖 详情请参阅 [全局错误与警告处理](../advanced/error_listener.md) 文档。
