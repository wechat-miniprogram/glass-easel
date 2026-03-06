# Component 常用 API

## 概述

`Component` 继承自 `Element` ，是 glass-easel 中组件实例的类型。除 [Element 常用 API](./element.md) 中描述的通用方法外，`Component` 还提供了组件特有的数据管理、生命周期、Behavior/Trait、Relation 和外部样式类等 API 。

> 📖 关于组件的基本概念和定义方式，请参阅 [组件](../basic/component.md) 和 [定义风格](../basic/definition_style.md) 文档。

## 基本属性

`Component` 上的基本只读属性，用于访问组件的核心信息。

+ [`Component.prototype.is`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#is)

+ [`Component.prototype.tagName`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#tagName)

+ [`Component.prototype.data`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#data)

+ [`Component.prototype.properties`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#properties)

+ [`Component.prototype.$`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#_)

+ [`Component.prototype.shadowRoot`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#shadowRoot)

+ [`Component.listProperties(comp)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#listProperties)

+ [`Component.hasProperty(comp, propName)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#hasProperty)

`is` 返回组件定义时的路径名。 `tagName` 返回组件在模板中使用时的标签名，它可能与 `is` 不同（例如通过 `using` 设置了别名时）。 `data` 和 `properties` 返回的是同一个对象，包含组件的数据字段和属性字段。 `$` 是一个以 id 为键的节点映射，可快速查找 Shadow Tree 中的节点。 `shadowRoot` 返回组件的 Shadow Root 。 `Component.listProperties` 和 `Component.hasProperty` 是静态方法，可以在外部查询组件的属性列表。

```js
const comp = this

// 获取组件路径和标签名
console.log(comp.is)       // e.g. 'components/my-comp'
console.log(comp.tagName)  // e.g. 'my-comp'

// 读取 data / properties（两者等价）
console.log(comp.data.count)
console.log(comp.properties.title)

// 通过 $ 快速查找节点
const node = comp.$['my-node']

// 访问 Shadow Root
console.log(comp.shadowRoot)

// 查询组件属性（静态方法）
const propNames = Component.listProperties(comp)    // ['title']
const hasProp = Component.hasProperty(comp, 'title') // true
```

## 组件信息

这些方法用于获取组件自身的信息，包括组件定义、选项、所在的组件空间等。

+ [`Component.prototype.getShadowRoot()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#getShadowRoot)

+ [`Component.prototype.getComponentDefinition()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#getComponentDefinition)

+ [`Component.prototype.getComponentOptions()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#getComponentOptions)

+ [`Component.prototype.getOwnerSpace()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#getOwnerSpace)

+ [`Component.prototype.isExternal()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#isExternal)

+ [`Component.prototype.general()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#general)

+ [`Component.isComponent(node)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#isComponent)

`getShadowRoot()` 返回组件的 `ShadowRoot`（对于外部组件返回 `null`）。 `getComponentDefinition()` 和 `getComponentOptions()` 分别返回组件定义和规范化后的组件选项。 `getOwnerSpace()` 返回组件所在的 `ComponentSpace` 。 `isExternal()` 判断是否为外部组件。 `general()` 将组件转换为通用类型（擦除泛型参数）。 `Component.isComponent` 是静态方法，用于判断一个节点是否为组件。

```js
const comp = this

// 获取 ShadowRoot（外部组件返回 null）
const sr = comp.getShadowRoot()

// 获取组件定义和选项
const def = comp.getComponentDefinition()
const opts = comp.getComponentOptions()
console.log(opts.styleScope)

// 获取组件所在的 ComponentSpace
const space = comp.getOwnerSpace()

// 判断是否为外部组件
if (comp.isExternal()) {
  console.log('This is an external component')
}

// 转换为通用类型（擦除泛型参数）
const general = comp.general()

// 判断节点是否为 Component（静态方法）
if (Component.isComponent(node)) {
  console.log('This is a component:', node.is)
}
```

> 📖 关于外部组件的详细说明请参阅 [外部组件](../advanced/external_component.md) 文档。

## 组件注册与创建

这些静态方法用于注册组件定义和创建组件实例。 `Component.register` 将组件定义注册到指定的组件空间中。 `Component.create` 、 `Component.createWithContext` 和 `Component.createWithGenerics` 分别用于创建组件实例、在指定后端上下文中创建组件实例、以及使用泛型实现创建组件实例。

+ [`Component.register(def, space?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#register)

+ [`Component.create(tagName, componentDefinition, initPropValues?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#create)

+ [`Component.createWithContext(tagName, componentDefinition, backendContext, initPropValues?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#createWithContext)

+ [`Component.createWithGenerics(tagName, componentDefinition, genericImpls, initPropValues?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#createWithGenerics)

```js
// 注册组件定义
const MyComp = Component.register({
  properties: { title: String },
  data: { count: 0 },
  methods: {
    increment() {
      this.setData({ count: this.data.count + 1 })
    },
  },
})

// 注册到指定的组件空间
const MyComp2 = Component.register(compDef, myComponentSpace)

// 创建组件实例
const comp1 = Component.create('my-comp', MyComp)

// 使用指定的后端上下文创建
const comp2 = Component.createWithContext('my-comp', MyComp, backendContext)

// 使用泛型实现创建
const comp3 = Component.createWithGenerics('my-comp', MyComp, {
  'generic-slot': AnotherCompDef,
})
```

> 📖 关于组件注册和组件空间的详细说明请参阅 [组件空间](../advanced/component_space.md) 和 [泛型](../interaction/generic.md) 文档。

## 数据更新

`Component` 提供了多种数据更新方式。 `setData` 是最常用的方法，会立即应用更新并触发数据观测器和模板重新渲染。 `updateData` 仅调度更新而不立即应用，适合在观测器回调中使用。 `replaceDataOnPath` 和 `spliceArrayDataOnPath` 提供了更细粒度的路径更新和数组操作能力。

+ [`Component.prototype.setData(newData?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#setData)

+ [`Component.prototype.updateData(newData?)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#updateData)

+ [`Component.prototype.replaceDataOnPath(path, data)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#replaceDataOnPath)

+ [`Component.prototype.spliceArrayDataOnPath(path, index, del, inserts)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#spliceArrayDataOnPath)

+ [`Component.prototype.applyDataUpdates()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#applyDataUpdates)

+ [`Component.prototype.groupUpdates(callback)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#groupUpdates)

+ [`Component.prototype.hasPendingChanges()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#hasPendingChanges)

```js
const comp = this

// setData：立即应用更新
comp.setData({
  count: 10,
  'list[0].name': 'Alice',
})

// updateData：仅调度更新，不立即应用（适合在 observer 中使用）
comp.updateData({ count: 20 })
// 需要手动 apply 才会生效
comp.applyDataUpdates()

// replaceDataOnPath：精确路径更新
comp.replaceDataOnPath(['list', 0, 'name'], 'Bob')
comp.applyDataUpdates()

// spliceArrayDataOnPath：数组操作（类似 Array.prototype.splice）
comp.spliceArrayDataOnPath(['list'], 1, 2, [{ name: 'Charlie' }])
comp.applyDataUpdates()

// groupUpdates：将多个更新合并为一次 apply
comp.groupUpdates(() => {
  comp.replaceDataOnPath(['a'], 1)
  comp.replaceDataOnPath(['b'], 2)
  comp.replaceDataOnPath(['c'], 3)
  // 回调结束后自动 applyDataUpdates
})

// 检查是否有未应用的更新
if (comp.hasPendingChanges()) {
  comp.applyDataUpdates()
}
```

> 📖 关于数据更新的详细说明请参阅 [高级数据更新](../data_management/advanced_update.md) 和 [数据观测器](../data_management/data_observer.md) 文档。

## 方法调用

`Component` 提供了通过方法名动态调用组件方法的能力，以及设置方法调用者（ `this` ）的机制。

+ [`Component.prototype.callMethod(methodName, ...args)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#callMethod)

+ [`Component.prototype.setMethodCaller(caller)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#setMethodCaller)

+ [`Component.prototype.getMethodCaller()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#getMethodCaller)

+ [`Component.getMethod(comp, methodName)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#getMethod)

+ [`Component.isTaggedMethod(func)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#isTaggedMethod)

`callMethod` 通过方法名动态调用组件上的方法。 `setMethodCaller` 和 `getMethodCaller` 用于设置和获取方法调用时的 `this` 对象。 `Component.getMethod` 是静态方法，用于获取组件上的方法引用。 `Component.isTaggedMethod` 是静态方法，用于判断一个函数是否为 tagged method 。

```js
const comp = this

// 动态调用方法
comp.callMethod('myMethod', arg1, arg2)

// 获取方法引用（静态方法）
const fn = Component.getMethod(comp, 'myMethod')
if (fn) {
  fn.call(comp, arg1, arg2)
}

// 判断是否为 tagged method（静态方法）
if (Component.isTaggedMethod(fn)) {
  console.log('This is a tagged method')
}

// 设置方法调用者（影响事件回调和生命周期回调的 this）
const originalCaller = comp.getMethodCaller()
comp.setMethodCaller(customCaller)
```

> 📖 关于组件方法的详细说明请参阅 [方法](../basic/method.md) 文档。

## 生命周期管理

这些方法用于命令式地添加、移除和触发组件的 [生命周期](../basic/lifetime.md) 回调，以及页面生命周期回调。

+ [`Component.prototype.addLifetimeListener(name, func)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#addLifetimeListener)

+ [`Component.prototype.removeLifetimeListener(name, func)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#removeLifetimeListener)

+ [`Component.prototype.triggerLifetime(name, args)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#triggerLifetime)

+ [`Component.prototype.addPageLifetimeListener(name, func)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#addPageLifetimeListener)

+ [`Component.prototype.removePageLifetimeListener(name, func)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#removePageLifetimeListener)

+ [`Component.prototype.triggerPageLifetime(name, args)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#triggerPageLifetime)

组件内置的生命周期名称包括： `created` 、 `attached` 、 `moved` 、 `detached` 、 `ready` 、 `error` 、 `listenerChange` 和 `workletChange` 。 页面生命周期名称是自定义的，由宿主环境约定。

```js
const comp = this

// 添加生命周期监听
const onAttached = () => {
  console.log('Component attached!')
}
comp.addLifetimeListener('attached', onAttached)

// 移除生命周期监听
comp.removeLifetimeListener('attached', onAttached)

// 手动触发自定义生命周期
comp.triggerLifetime('myCustomLifetime', [arg1, arg2])

// 页面生命周期
const onShow = () => {
  console.log('Page show')
}
comp.addPageLifetimeListener('show', onShow)
comp.removePageLifetimeListener('show', onShow)

// 触发页面生命周期（会递归传播给所有子组件）
comp.triggerPageLifetime('show', [])
```

> 📖 关于生命周期的详细说明请参阅 [生命周期](../basic/lifetime.md) 文档。

## Behavior 与 Trait

这些方法用于检查组件的 Behavior 依赖关系和获取 Trait Behavior 的实现。

+ [`Component.prototype.hasBehavior(other)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#hasBehavior)

+ [`Component.prototype.getRootBehavior()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#getRootBehavior)

+ [`Component.prototype.traitBehavior(traitBehavior)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#traitBehavior)

`hasBehavior` 可以接受 Behavior 对象、TraitBehavior 对象或 Behavior 路径字符串。 `traitBehavior` 返回 Trait Behavior 的实现对象，如果该组件没有实现指定的 Trait Behavior 则返回 `undefined` 。

```js
const comp = this

// 检查是否使用了某个 behavior
if (comp.hasBehavior(myBehavior)) {
  console.log('Component uses myBehavior')
}

// 检查是否实现了某个 trait behavior
if (comp.hasBehavior(myTraitBehavior)) {
  console.log('Component implements myTraitBehavior')
}

// 获取 trait behavior 的实现
const impl = comp.traitBehavior(myTraitBehavior)
if (impl) {
  impl.doSomething()
}

// 获取组件的根 behavior
const rootBehavior = comp.getRootBehavior()
```

> 📖 关于 Behavior 的详细说明请参阅 [Behavior](../interaction/behavior.md) 和 [Trait Behavior](../interaction/trait_behavior.md) 文档。

## Relation

`Component` 提供了获取 Relation 关联节点的方法。

+ [`Component.prototype.getRelationNodes(relationKey)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#getRelationNodes)

`getRelationNodes` 返回指定 Relation 键名对应的所有已链接的目标组件数组。如果 Relation 不存在或没有链接，返回空数组。

```js
const comp = this

// 获取 relation 关联的所有目标节点
const items = comp.getRelationNodes('my-relation')
items.forEach((item) => {
  console.log(item.data)
})
```

> 📖 关于 Relation 的详细说明请参阅 [组件间关系](../interaction/relation.md) 文档。

## 外部样式类

外部样式类（External Class）允许组件的使用者从外部覆盖组件内部的样式类名。

+ [`Component.prototype.hasExternalClass(name)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#hasExternalClass)

+ [`Component.prototype.setExternalClass(name, target)`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#setExternalClass)

+ [`Component.prototype.getExternalClasses()`](https://wechat-miniprogram.github.io/glass-easel/docs/glass-easel/classes/Component.html#getExternalClasses)

```js
const comp = this.shadowRoot.querySelector('#child-comp').asGeneralComponent()

// 检查是否定义了某个外部样式类
if (comp.hasExternalClass('my-class')) {
  // 设置外部样式类的映射
  comp.setExternalClass('my-class', 'actual-class-name')
}

// 获取所有外部样式类的映射
const classes = comp.getExternalClasses()
console.log(classes) // { 'my-class': ['actual-class-name'], ... }
```

> 📖 关于外部样式类的详细说明请参阅 [外部样式类](../styling/external_class.md) 文档。

