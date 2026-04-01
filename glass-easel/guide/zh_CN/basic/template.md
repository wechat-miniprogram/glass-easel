# 模板

glass-easel 模板遵循 WXML 语法。

一些语法细节与 HTML 有一定差异。最明显的区别是标签都需要正确闭合，如 `<div></div>` 和 `<div />` 。

## 数据绑定

在模板中，可以用 `{{ ... }}` 的形式嵌入表达式，表达式中的数据来源于组件的 `data` ，例如：

```js
export const addComponent = componentSpace.define()
  .template(wxml(`
    <div>{{ a }} + {{ b }} = {{ a + b }}</div>
  `))
  .data(() => ({
    a: 1,
    b: 2,
  }))
  .registerComponent()
```

数据绑定表达式支持常见的 JavaScript 运算，包括算术运算、比较运算、逻辑运算、三元表达式、字符串拼接等。也支持对象和数组字面量：

```xml
<div>{{ { name: firstName + ' ' + lastName, age: age } }}</div>
<div>{{ [1, 2, a + b] }}</div>
```

使用组件实例的 `setData` 方法可以更新数据绑定，例如：

```js
export const addComponent = componentSpace.define()
  .template(wxml(`
    <div>{{ a }} + {{ b }} = {{ a + b }}</div>
  `))
  .data(() => ({
    a: 1,
    b: 2,
  }))
  .init(({ setData, lifetime }) => {
    lifetime('attached', () => {
      setData({ a: 3 })
    })
  })
  .registerComponent()
```

## 条件分支

借助 `wx:if` `wx:elif` `wx:else` 可以控制节点的存在与否，例如：

```xml
<div wx:if="{{ a > b }}"> a 大于 b </div>
<div wx:elif="{{ a < b }}"> a 小于 b </div>
<div wx:else> a 等于 b </div>
```

如果想要同时控制多个节点，可以借助 `<block>` 块，例如：

```xml
<block wx:if="{{ a > b }}">
  <span>a</span>
  <span>大于</span>
  <span>b</span>
</block>
```

> ⚠️ 注意 `<block>` 块不是一个真正的节点，它不会在最终的节点树中出现。

## 列表

借助 `wx:for` 可以将一个数组展开成一组节点，例如：

```xml
<div wx:for="{{ arr }}">数组的第 {{ index }} 项是 {{ item }}</div>
```

这个例子中，如果 `arr` 数组有 3 项，则会最终生成 3 个 `<div>` 。

这里也可以借助 `<block>` ：

```xml
<block wx:for="{{ arr }}">
  <div>数组的第 {{ index }} 项是 {{ item }}</div>
</block>
```

其中， `index` 和 `item` 是自动生成的临时变量，变量名可以使用 `wx:for-index` 和 `wx:for-item` 来调整：

```xml
<block wx:for="{{ arr }}" wx:for-index="i" wx:for-item="t">
  <div>数组的第 {{ i }} 项是 {{ t }}</div>
</block>
```

## 带 key 列表

在列表数据更新时， glass-easel 会尝试对比新旧列表数据来推断哪些节点应该被增删或移动。

如果列表开头或者中间部分需要发生插入或删除， glass-easel 的推断可能不够准确或高效。此时可以提供一个 key 字段来辅助推断。

例如对于这样的数据：

```js
data: {
  students: [
    { id: 'A0001', name: '张三' },
    { id: 'A0002', name: '李四' },
    { id: 'A0003', name: '王五' },
  ]
}
```

列表中每一项的 `id` 是唯一的、有代表性的，就可以将它作为 key 使用：

```xml
<block wx:for="{{ students }}" wx:key="id">
  <div>姓名：{{ item.name }}</div>
</block>
```

在复杂的列表中，使用 key 通常可以提升整体性能。但要注意：

* 如果每一项的 key 值不是唯一的，会降低使用 key 进行推断效果，不要将唯一性很差的字段作为 key ；
* 作为 key 的字段会被转换为字符串使用，所以只应使用数值或字符串类型的数据字段；
* 如果列表项目是固定的，或者只会在末尾增加、删除项目， key 不会有任何帮助（反而会增加少量开销），可以不用。

## 事件绑定

在模板中通过 `bind:` 前缀绑定事件，例如：

```xml
<div bind:tap="onTap">点击我</div>
<child bind:customEvent="onCustomEvent" />
```

除了 `bind:` ，还有多种事件绑定前缀，适用于不同场景：

| 前缀 | 停止冒泡 | 互斥 | 说明 |
| --- | --- | --- | --- |
| `bind:` | 否 | 否 | 普通绑定，不影响事件冒泡 |
| `catch:` | 是 | 否 | 停止事件冒泡，祖先节点不再响应该事件 |
| `mut-bind:` | 否 | 是 | 不停止冒泡，但与其他 `mut-bind:` 互斥 |
| `capture-bind:` | 否 | 否 | 在捕获阶段绑定 |
| `capture-catch:` | 是 | 否 | 在捕获阶段绑定，并停止事件继续传播 |
| `capture-mut-bind:` | 否 | 是 | 在捕获阶段绑定，不停止冒泡，但互斥 |

例如，使用 `catch:` 阻止事件冒泡：

```xml
<div bind:tap="onOuterTap">
  <button catch:tap="onInnerTap">点击时只触发 onInnerTap</button>
</div>
```

> 📖 更多事件绑定的详细用法请参阅 [事件](./event.md) 文档。

## 双向绑定

使用 `model:` 前缀可以实现属性的双向数据绑定。当子组件修改了对应的属性值时，父组件的数据也会自动更新，例如：

```xml
<child model:count="{{ parentCount }}" />
```

当 `child` 组件内部通过 `setData` 修改了 `count` 属性时，父组件的 `parentCount` 数据会自动同步更新。

`model:` 也可以用在原生表单元素上：

```xml
<textarea model:value="{{ inputText }}" />
```

> ⚠️ `model:` 绑定的表达式必须是一个可赋值的数据路径（即“左值“），例如 `{{ a.b }}` 或 `{{ list[index].name }}` ，而不能是一个计算表达式。

## 模板片段

模板中可以使用 `<template>` 定义和引用可复用的模板片段。

使用 `<template name="...">` 定义模板片段：

```xml
<template name="user-card">
  <div class="card">
    <div>{{ name }}</div>
    <div>{{ age }} 岁</div>
  </div>
</template>
```

使用 `<template is="...">` 引用模板片段，通过 `data` 传递数据：

```xml
<template is="user-card" data="{{ name: '张三', age: 20 }}" />
```

`data` 的值是一个对象表达式。也支持展开运算符：

```xml
<template is="user-card" data="{{ ...userInfo }}" />
```

`is` 属性支持数据绑定，从而实现动态切换模板：

```xml
<template name="typeA"><div>A: {{ value }}</div></template>
<template name="typeB"><div>B: {{ value }}</div></template>
<template is="type{{ currentType }}" data="{{ value }}" />
```

> 📖 跨组件的模板片段复用、 `<import>` 和 `<include>` 的用法请参阅 [模板引用](../interaction/template_import.md) 文档。

## 模板引入

### import

使用 `<import>` 可以引入其他模板文件中定义的模板片段（ `<template name="...">` ）：

```xml
<import src="./shared.wxml" />
<template is="shared-template" data="{{ a: 1 }}" />
```

### include

使用 `<include>` 可以将另一个模板文件的全部内容直接嵌入到当前位置：

```xml
<div>
  <include src="./header.wxml" />
  <div>页面内容</div>
  <include src="./footer.wxml" />
</div>
```

> 📖 详细用法请参阅 [模板引用](../interaction/template_import.md) 文档。

## WXS 内联脚本

`<wxs>` 允许在模板中嵌入 JavaScript 代码模块，可以在数据绑定表达式中调用这些模块导出的函数。

引用外部脚本文件：

```xml
<wxs module="utils" src="./utils.wxs" />
<div>{{ utils.formatDate(timestamp) }}</div>
```

也可以直接内联编写：

```xml
<wxs module="math">
  exports.sum = function (a, b) {
    return a + b
  }
</wxs>
<div>{{ math.sum(1, 2) }}</div>
```

> 📖 更多关于 `<wxs>` 脚本、 `require` 和 `exports` 的详细用法请参阅 [模板引用](../interaction/template_import.md#嵌入-javascript-代码) 文档。

## class 绑定

写节点的 class 时，可以使用 `class:` 语法，例如：

```xml
<div class:age class:age-big />
<!-- 等同于 -->
<div class="age age-big" />
```

后面也可以加上一个数据绑定，当表达式值非真时，这个 class 失效，例如：

```xml
<div class:age="{{ true }}" class:age-big="{{ false }}" />
<!-- 等同于 -->
<div class="age" />
```

这在需要根据条件动态切换 class 时非常方便：

```xml
<div class:selected="{{ index === currentIndex }}" class:disabled="{{ !enabled }}">
  {{ item.name }}
</div>
```

注意： `class:` 如果和 `class=` 混用， `class=` 中不能包含数据绑定，例如：

```xml
<!-- 下面这种写法是非法的！ -->
<div class:age class="{{ another }}" />
```

## style 绑定

写节点的 style 时，可以使用 `style:` 语法，例如：

```xml
<div style:color="red" style:font-size="{{ size }}px" />
<!-- 等同于 -->
<div style="color: red; font-size: {{ size }}px" />
```

注意： `style:` 如果和 `style=` 混用， `style=` 中不能包含数据绑定，例如：

```xml
<!-- 下面这种写法是非法的！ -->
<div style:color="red" style="font-size: {{ size }}px" />
```

## 节点 ID

可以通过 `id` 属性为节点指定一个标识符，用于在组件代码中引用该节点：

```xml
<div id="myDiv">内容</div>
<child id="myChild" />
```

在组件代码中，可以通过 `this.$` 快速访问，或通过 `getShadowRoot().getElementById()` 查找带有 `id` 的节点。

> 📖 详细用法请参阅 [`Component.prototype.$`](../api/component.md#基本属性) 文档。

## 临时变量

有些时候，组件数据结构特别复杂，而里面一个部分的数据被反复使用。此时，可以用 `let:` 将数据片段赋值给一个临时变量，例如：

```xml
<block let:tempVar="{{ some.complex.student.data }}">
  <div>ID：{{ tempVar.id }}</div>
  <div>名字：{{ tempVar.name }}</div>
  <div>年龄：{{ tempVar.age }}</div>
</block>
```

注意：临时变量仅在它所在的节点本身和节点内部生效，对节点树其他部分无效。

## dataset 属性

模板中可以使用 `data:` 前缀为节点附加自定义 dataset，在事件响应函数中可以通过 `e.target.dataset` 访问：

```xml
<div data:userId="{{ user.id }}" data:userName="{{ user.name }}" bind:tap="onTap" />
```

```js
const onTap = listener((e) => {
  console.log(e.target.dataset.userId)
  console.log(e.target.dataset.userName)
})
```

也支持传统的 `data-` 连字符语法（转换规则与 HTML dataset 相同，连字符后首字母大写）：

```xml
<div data-user-id="123" />
<!-- dataset.userId === '123' -->
```

## 事件节点标记

使用 `mark:` 可以为节点添加标记数据。与 `data:` 不同的是， `mark:` 的值会沿节点树向上收集——事件响应函数中可以同时获取目标节点及其所有祖先节点上的标记：

```xml
<block wx:for="{{ list }}">
  <div mark:listIndex="{{ index }}">
    <child mark:itemId="{{ item.id }}" bind:customEvent="onEvent" />
  </div>
</block>
```

```js
const onEvent = listener((e) => {
  console.log(e.mark.listIndex) // from ancestor
  console.log(e.mark.itemId)   // from target
})
```

> 📖 详细用法请参阅 [事件](./event.md#事件节点标记) 文档。

## 属性变化监听

使用 `change:` 前缀可以在模板中监听子组件属性的变化，绑定的响应函数需要是一个 WXS 函数。这在需要直接操作节点进行动画或高性能更新时非常有用：

```xml
<wxs module="bindUtils">
  exports.onCountChange = function (newVal, oldVal, self, target) {
    // self: host component instance
    // target: the node element
    console.log('count changed:', newVal)
  }
</wxs>
<child change:count="{{ bindUtils.onCountChange }}" count="{{ count }}" />
```

## slot 插槽

子组件可以使用 `<slot />` 承载父组件传入的子节点内容：

```xml
<!-- child component template -->
<div>
  <slot />
</div>
```

```xml
<!-- parent template -->
<child>
  <div>这段内容会被投射到子组件的 slot 位置</div>
</child>
```

> 📖 更多关于动态 slot、slot 数据传递（ `slot:` ）等高级用法请参阅 [slot 及 slot 类型](../interaction/slot.md) 文档。

## 转义符

在数据绑定以外，应使用 XML Entities 来进行特殊字符的转义。

通常情况下只需要转义尖括号，例如 `<` 转义为 `&lt;` ：

```xml
<div wx:if="{{ a > b }}"> a &gt; b </div>
<div wx:elif="{{ a < b }}"> a &lt; b </div>
```

数据绑定内部的转义方式与 JavaScript 一致。
