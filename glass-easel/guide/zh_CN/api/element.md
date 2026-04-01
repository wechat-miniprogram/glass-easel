# Element 常用 API

## 概述

`Element` 是 glass-easel 中所有元素的基类，`NativeNode` 、 `Component` 和 `VirtualNode` 都继承自 `Element` 。本文介绍 `Element` 上常用的实例属性、实例方法和静态方法。

> 📖 关于节点类型的继承关系和基本概念，请参阅 [节点树与节点类型](../tree/node_tree.md) 文档。

## 基本属性

`Element` 上提供了几个基础属性，用于读写节点的基本信息。

+ [`Element.prototype.id`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#id)

+ [`Element.prototype.slot`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#slot)

+ [`Element.prototype.class`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#class)

+ [`Element.prototype.style`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#style)

+ [`Element.prototype.dataset`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#dataset)

+ [`Element.prototype.classList`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#classList)

+ [`Element.prototype.attributes`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#attributes)

```js
const node = this.shadowRoot.querySelector('#my-node')

// 读写 id 和 slot
node.id = 'new-id'
node.slot = 'footer'

// 读写 class 和 style（对应主样式段）
node.class = 'foo bar'
node.style = 'color: red; font-size: 16px'

// 读取 dataset 和 attributes
console.log(node.dataset) // { key: 'value' }
console.log(node.attributes) // [{ name: 'src', value: '...' }, ...]

// classList 提供更精细的 class 操作
console.log(node.classList)
```

## Shadow Tree 结构

以下属性描述了节点在 [Shadow Tree](../tree/node_tree.md#shadow-tree) 中的位置关系。这些属性都是只读的，不应直接修改。如需变更节点树结构，请参考 [节点树变更](../tree/node_tree_modification.md) 文档。

+ [`Element.prototype.parentNode`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#parentNode)

+ [`Element.prototype.childNodes`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#childNodes)

+ [`Element.prototype.parentIndex`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#parentIndex)

+ [`Element.prototype.ownerShadowRoot`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#ownerShadowRoot)

+ [`Element.prototype.containingSlot`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#containingSlot)

+ [`Element.prototype.slotNodes`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#slotNodes)

```js
const child = this.shadowRoot.querySelector('#child')

// 获取父节点和子节点列表
console.log(child.parentNode)     // 父元素
console.log(child.childNodes)     // 子节点数组
console.log(child.parentIndex)    // 在父节点 childNodes 中的索引

// 获取所属的 Shadow Root
console.log(child.ownerShadowRoot)

// Slot 相关
console.log(child.containingSlot) // 该节点所在的 slot 元素
console.log(child.slotNodes)      // 如果该节点是 slot，则为其内容节点列表
```

## 类型判断与转换

glass-easel 中存在多种 [节点类型](../tree/node_tree.md#节点类型) ，可以通过 `asXxx()` 系列方法将节点安全地转换为具体类型。如果类型匹配则返回对应类型的节点，否则返回 `null` 。

+ [`Element.prototype.asElement()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#asElement)

+ [`Element.prototype.asTextNode()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#asTextNode)

+ [`Element.prototype.asNativeNode()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#asNativeNode)

+ [`Element.prototype.asVirtualNode()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#asVirtualNode)

+ [`Element.prototype.asShadowRoot()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#asShadowRoot)

+ [`Element.prototype.asGeneralComponent()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#asGeneralComponent)

+ [`Element.prototype.asInstanceOf(def)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#asInstanceOf)

+ [`Element.prototype.isVirtual()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#isVirtual)

+ [`Element.isElement(node)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#isElement)

```js
const node = this.shadowRoot.querySelector('#my-node')

// 安全类型转换
const nativeNode = node.asNativeNode()
if (nativeNode) {
  console.log('This is a native node:', nativeNode.is)
}

// 判断是否为特定组件的实例
const comp = node.asInstanceOf(MyComponentDefinition)
if (comp) {
  console.log('Component data:', comp.data)
}

// 使用静态方法判断是否为 Element
if (Element.isElement(someNode)) {
  console.log('It is an element')
}
```

> 📖 更多关于节点类型判断的说明请参阅 [节点树与节点类型](../tree/node_tree.md#如何判断节点类型) 。

## 样式与 Class 操作

支持**样式段（Style Segment）** 机制，允许不同模块独立设置同一节点的 class 和 style ，互不覆盖。最终的 class 和 style 值是各个样式段的拼接结果。

`Element` 提供了操作节点 class 和 style 的方法，读写 [`Element.prototype.class`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#class) 和 [`Element.prototype.style`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#style) 属性默认操作的是主样式段（ `MAIN` ）。而 `setNodeClass` / `setNodeStyle` 支持**样式段（Style Segment）** 机制，允许不同模块独立设置同一节点的 class 和 style ，互不覆盖。最终的 class 和 style 值是各个样式段的拼接结果。

+ [`Element.prototype.setNodeClass(classNames, index?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#setNodeClass)

+ [`Element.prototype.setNodeClassList(classNames, index?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#setNodeClassList)

+ [`Element.prototype.toggleNodeClass(className, force?, index?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#toggleNodeClass)

+ [`Element.prototype.setNodeStyle(styleSegment, index?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#setNodeStyle)

+ [`Element.prototype.getNodeStyleSegments()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getNodeStyleSegments)

样式段索引（ `StyleSegmentIndex` ）如下：

| 索引 | 名称 | 说明 |
| --- | --- | --- |
| `0` | `MAIN` | 主样式段，通常由模板引擎或手动设置管理 |
| `1` | `TEMPLATE_EXTRA` | 模板额外样式段，保留给模板引擎使用 |
| `2` | `ANIMATION_EXTRA` | 动画样式段，保留给临时过渡使用 |
| `3` | `TEMP_EXTRA` | 临时样式段，保留给高优先级样式使用 |

```js
const node = this.shadowRoot.querySelector('#my-node')

// 设置 class（主样式段）
node.setNodeClass('foo bar')

// 使用数组形式设置 class 列表
node.setNodeClassList(['foo', 'bar', 'baz'])

// 切换单个 class
node.toggleNodeClass('active')         // 切换 active
node.toggleNodeClass('active', true)   // 强制添加 active
node.toggleNodeClass('active', false)  // 强制移除 active

// 设置 style（主样式段）
node.setNodeStyle('color: red; font-size: 16px')

// 获取所有样式段
const segments = node.getNodeStyleSegments()
console.log(segments) // ['color: red', ...]
```

> 📖 关于样式隔离和外部样式类的详细说明，请参阅 [样式隔离](../styling/style_isolation.md) 和 [外部样式类](../styling/external_class.md) 文档。

## Attribute, Dataset 与 Mark

Attribute 是节点上的自定义属性，与组件的 property 不同。Attribute 会直接同步到后端元素上。

+ [`Element.prototype.getAttribute(name)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getAttribute)

+ [`Element.prototype.setAttribute(name, value)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#setAttribute)

+ [`Element.prototype.removeAttribute(name)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#removeAttribute)

+ [`Element.prototype.setDataset(name, value)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#setDataset)

+ [`Element.prototype.setMark(name, value)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#setMark)

+ [`Element.prototype.collectMarks()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#collectMarks)

```js
const node = this.shadowRoot.querySelector('#my-node')

// Attribute 操作
node.setAttribute('aria-label', 'Close button')
console.log(node.getAttribute('aria-label')) // 'Close button'
node.removeAttribute('aria-label')

// Dataset 操作
node.setDataset('userId', '12345')
console.log(node.dataset.userId) // '12345'

// Mark 操作（会在事件冒泡时沿 Shadow Tree 向上收集）
node.setMark('type', 'important')
const marks = node.collectMarks() // 收集当前节点及所有祖先节点上的 mark
console.log(marks) // { type: 'important', ... }
```

> 📖 Mark 在事件系统中的用法请参阅 [事件节点标记](../basic/event.md#事件节点标记) 。

## 事件

`Element` 提供了命令式的事件监听和触发 API 。

+ [`Element.prototype.addListener(name, func, options?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#addListener)

+ [`Element.prototype.removeListener(name, func, options?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#removeListener)

+ [`Element.prototype.getListeners()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getListeners)

+ [`Element.prototype.triggerEvent(name, detail?, options?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#triggerEvent)

+ [`Element.prototype.dispatchEvent(event)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#dispatchEvent)

```js
const node = this.shadowRoot.querySelector('#my-button')

// 添加事件监听
const handler = (event) => {
  console.log('tapped!', event.detail)
}
node.addListener('tap', handler)

// 支持捕获阶段和 mut 绑定
node.addListener('tap', handler, { capture: true })
node.addListener('tap', handler, { mut: true })

// 移除事件监听
node.removeListener('tap', handler)

// 获取所有已注册的监听器
const listeners = node.getListeners()

// 触发自定义事件
node.triggerEvent('myevent', { key: 'value' })

// 使用 Event 对象触发事件（可控制冒泡等行为）
const event = new glassEasel.Event('myevent', { key: 'value' }, { bubbles: true })
node.dispatchEvent(event)
```

> 📖 更多关于事件系统的详细说明请参阅 [事件](../basic/event.md) 文档。

## 选择器查询

`Element` 上提供了基于 CSS 选择器的节点查询方法，用于在 [Shadow Tree](../tree/node_tree.md#shadow-tree) 中查找子孙节点。

+ [`Element.prototype.querySelector(selector)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#querySelector)

+ [`Element.prototype.querySelectorAll(selector)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#querySelectorAll)

+ [`Element.prototype.matchSelector(selector, target)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#matchSelector)

+ [`Element.matchSelector(selector, target)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#matchSelector-1)

+ [`Element.parseSelector(str)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#parseSelector)

```js
// 查询单个节点
const node = this.shadowRoot.querySelector('#my-node')
const item = this.shadowRoot.querySelector('.list-item')

// 查询所有匹配节点
const items = this.shadowRoot.querySelectorAll('.list-item')

// 测试节点是否匹配选择器
const matches = this.shadowRoot.matchSelector('.active', node)

// 使用静态方法测试（不限定子树范围）
const matches2 = Element.matchSelector('.active', node)

// 预解析选择器以提升多次查询的性能
const parsed = Element.parseSelector('.list-item.active')
const result1 = root.querySelector(parsed)
const result2 = root.querySelectorAll(parsed)
```

> 📖 关于选择器的完整语法和更多用法请参阅 [选择器查询](../tree/selector.md) 文档。

## Shadow Tree 操作

这些方法用于手工变更 [Shadow Tree](../tree/node_tree.md#shadow-tree) 中的子节点。变更 Shadow Tree 后，Composed Tree 会自动同步。

+ [`Element.prototype.appendChild(child)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#appendChild)

+ [`Element.prototype.insertChildAt(child, index)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#insertChildAt)

+ [`Element.prototype.insertBefore(child, before?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#insertBefore)

+ [`Element.prototype.insertChildren(children, index)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#insertChildren)

+ [`Element.prototype.removeChildAt(index)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#removeChildAt)

+ [`Element.prototype.removeChild(child)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#removeChild)

+ [`Element.prototype.removeChildren(index, count)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#removeChildren)

+ [`Element.prototype.replaceChildAt(child, index)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#replaceChildAt)

+ [`Element.prototype.replaceChild(child, relChild)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#replaceChild)

+ [`Element.prototype.selfReplaceWith(replaceWith)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#selfReplaceWith)

```js
const parent = this.shadowRoot.querySelector('#container')
const sr = this.shadowRoot

// 创建并追加节点
const child = sr.createNativeNode('div')
parent.appendChild(child)

// 在指定位置插入
const another = sr.createNativeNode('span')
parent.insertChildAt(another, 0)         // 插入到第一个位置
parent.insertBefore(another, child)      // 插入到 child 之前

// 批量插入
const nodes = [sr.createNativeNode('p'), sr.createNativeNode('p')]
parent.insertChildren(nodes, 0)

// 移除节点
parent.removeChild(child)
parent.removeChildAt(0)

// 批量移除
parent.removeChildren(0, 2) // 从索引 0 开始移除 2 个

// 替换节点
const replacement = sr.createNativeNode('section')
parent.replaceChildAt(replacement, 0)
parent.replaceChild(replacement, another)

// 节点自我替换
const newNode = sr.createNativeNode('article')
child.selfReplaceWith(newNode)
```

> 📖 关于节点树变更的完整说明（包括节点创建、销毁等）请参阅 [节点树变更](../tree/node_tree_modification.md) 文档。

## Composed Tree 遍历

这些方法用于在 [Composed Tree](../tree/node_tree.md#composed-tree) 上遍历节点。与 Shadow Tree 上的 `childNodes` / `parentNode` 不同，Composed Tree 遍历会跨越组件边界，将 Shadow Tree 和 slot 内容组合在一起。

+ [`Element.prototype.getComposedParent()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getComposedParent)

+ [`Element.prototype.getComposedChildren()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getComposedChildren)

+ [`Element.prototype.forEachComposedChild(f)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#forEachComposedChild)

+ [`Element.prototype.iterateComposedChild()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#iterateComposedChild)

+ [`Element.prototype.forEachNonVirtualComposedChild(f)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#forEachNonVirtualComposedChild)

```js
const node = this.shadowRoot.querySelector('#my-node')

// 获取 Composed Tree 上的父节点（可能跨越组件边界）
const composedParent = node.getComposedParent()

// 获取 Composed Tree 上的子节点（返回新数组）
const composedChildren = node.getComposedChildren()

// 使用回调方式遍历 Composed 子节点（更高性能）
node.forEachComposedChild((child) => {
  console.log(child)
  // 返回 false 可提前中断遍历
})

// 使用迭代器遍历
const iter = node.iterateComposedChild()
for (const child of iter) {
  console.log(child)
}

// 跳过虚拟节点，只遍历非虚拟的 Composed 子节点
node.forEachNonVirtualComposedChild((child) => {
  console.log(child)
})
```

> 📖 如果需要进行更复杂的树遍历（如先根/后根遍历），请参阅 [节点树遍历](../tree/element_iterator.md) 文档。

## 后端查询与观察

以下方法用于直接调用后端能力，包括布局信息查询、交叉/尺寸观察和获取交互上下文等。当后端元素不存在或不支持相应能力时，回调函数会收到全零的结果或返回 `null` 。

+ [`Element.prototype.getBoundingClientRect(cb)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getBoundingClientRect)

+ [`Element.prototype.getScrollOffset(cb)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getScrollOffset)

+ [`Element.prototype.createIntersectionObserver(relativeElement, margin, thresholds, listener)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#createIntersectionObserver)

+ [`Element.prototype.createResizeObserver(mode, listener)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#createResizeObserver)

+ [`Element.prototype.getContext(cb)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getContext)

```js
const node = this.shadowRoot.querySelector('#my-node')

// 获取元素的边界矩形
node.getBoundingClientRect((rect) => {
  console.log(rect.left, rect.top, rect.width, rect.height)
})

// 获取元素的滚动偏移
node.getScrollOffset((offset) => {
  console.log(offset.scrollLeft, offset.scrollTop)
  console.log(offset.scrollWidth, offset.scrollHeight)
})

// 创建交叉观察器：监测节点与 viewport 的交叉状态
const viewport = this.shadowRoot.querySelector('#scroll-area')
const intersectionObs = node.createIntersectionObserver(
  viewport,       // 相对元素，null 表示视口
  '0px',          // 相对元素的 margin
  [0, 0.5, 1],   // 触发阈值
  (status) => {
    console.log('Intersection ratio:', status.intersectionRatio)
  },
)

// 创建尺寸变化观察器
const resizeObs = node.createResizeObserver(
  glassEasel.ResizeObserverMode.BorderBox,  // 观察模式：ResizeObserverMode.BorderBox 或 ResizeObserverMode.ContentBox
  (status) => {
    console.log('New size:', status.width, status.height)
  },
)

// 销毁观察器
intersectionObs?.disconnect()
resizeObs?.disconnect()

// 获取交互上下文（如 Canvas 的 context）
node.getContext((context) => {
  console.log(context)
})
```

## 后端元素管理

这些 API 用于访问和管理节点对应的 [后端（Backend）](../tree/node_tree.md#backend-tree) 元素。

+ [`Element.prototype.getBackendElement()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getBackendElement)

+ [`Element.prototype.$$`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#__)

+ [`Element.prototype.getBackendContext()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getBackendContext)

+ [`Element.prototype.destroyBackendElement()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#destroyBackendElement)

+ [`Element.prototype.destroyBackendElementOnSubtree()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#destroyBackendElementOnSubtree)

+ [`Element.prototype.destroyBackendElementOnRemoval()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#destroyBackendElementOnRemoval)

+ [`Element.prototype.cancelDestroyBackendElementOnRemoval()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#cancelDestroyBackendElementOnRemoval)

```js
const node = this.shadowRoot.querySelector('#my-node')

// 获取后端元素（也可使用 $$ 简写）
const be = node.getBackendElement()
const be2 = node.$$  // 等价

// 获取后端上下文
const ctx = node.getBackendContext()

// 手动销毁当前节点的后端元素
node.destroyBackendElement()

// 递归销毁整个子树的后端元素
node.destroyBackendElementOnSubtree()

// 设置为移除时自动销毁后端元素
node.destroyBackendElementOnRemoval()

// 取消移除时的自动销毁
node.cancelDestroyBackendElementOnRemoval()
```

> 📖 关于后端节点树的详细说明请参阅 [节点树与节点类型](../tree/node_tree.md#backend-tree) 和 [节点树变更](../tree/node_tree_modification.md) 文档。

## Slot 管理

这些静态方法用于在实现 [自定义模板引擎](../advanced/template_engine.md) 等高级场景中手工管理 slot 。

+ [`Element.setSlotName(element, name?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#setSlotName)

+ [`Element.getSlotName(element)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getSlotName)

+ [`Element.setInheritSlots(element)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#setInheritSlots)

+ [`Element.getInheritSlots(element)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getInheritSlots)

+ [`Element.setSlotElement(node, slot)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#setSlotElement)

+ [`Element.getSlotElement(node)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#getSlotElement)

```js
const sr = this.shadowRoot
const slotNode = sr.createVirtualNode('slot')
const child = sr.createNativeNode('div')

// 将一个虚拟节点设置为 slot
Element.setSlotName(slotNode, 'content')
console.log(Element.getSlotName(slotNode)) // 'content'

// 设置 slot-inherit 模式（子节点会被视为兄弟节点，可分配到不同 slot）
const inheritNode = sr.createVirtualNode('virtual')
Element.setInheritSlots(inheritNode)
console.log(Element.getInheritSlots(inheritNode)) // true

// 在动态 slot 模式下，手动指定节点的绑定 slot
Element.setSlotElement(child, slotNode)
console.log(Element.getSlotElement(child)) // slotNode
```

## 挂载/卸载

这些静态方法用于将元素挂载到后端中，或模拟 `attach`/`detach` 过程以触发相应的 [生命周期](../basic/lifetime.md) 。

+ [`Element.replaceDocumentElement(element, targetParent, targetNode)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#replaceDocumentElement)

+ [`Element.pretendAttached(element)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#pretendAttached)

+ [`Element.pretendDetached(element)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#pretendDetached)

+ [`Element.isAttached(element)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Element.html#isAttached)

```js
// 将 glass-easel 元素挂载到后端的某个节点上，替换占位元素
Element.replaceDocumentElement(element, targetParent, targetNode)

// 在没有后端的场景下（如测试），模拟 attach 以触发 attached 生命周期
Element.pretendAttached(element)

// 模拟 detach 以触发 detached 生命周期（不会真正移除后端元素）
Element.pretendDetached(element)

// 检查元素是否已 attached
if (Element.isAttached(element)) {
  console.log('Element is attached')
}
```
