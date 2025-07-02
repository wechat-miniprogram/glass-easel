# 模板

glass-easel 模板遵循 WXML 语法。

一些语法细节与 HTML 有一定差异。最明显的区别是标签都需要正确闭合，如 `<div></div>` 和 `<div />` 。

## 数据绑定

在模板中，可以用 `{{ ... }}` 的形式嵌入表达式，表达式中的数据来源于组件的 `data` ，例如：

```js
export const addComponent = componentSpace.defineComponent({
  template: compileTemplate(`
    <div>{{ a }} + {{ b }} = {{ a + b }}</div>
  `),
  data: {
    a: 1,
    b: 2,
  },
})
```

使用组件实例的 `setData` 方法可以更新数据绑定，例如：

```js
export const addComponent = componentSpace.defineComponent({
  template: compileTemplate(`
    <div>{{ a }} + {{ b }} = {{ a + b }}</div>
  `),
  data: {
    a: 1,
    b: 2,
  },
  lifetimes: {
    attached() {
      this.setData({
        a: 3,
      })
    },
  },
})
```

## 条件分支

借助 `wx:if` `wx:elif` `wx:else` 可以控制节点的存在与否，例如：

```xml
<div wx:if="{{ a > b }}"> a 大于 b </div>
<div wx:elif="{{ a < b }}"> a 小于 b </div>
<div wx:elif="{{ a === b }}"> a 等于 b </div>
```

如果想要同时控制多个节点，可以借助 `<block>` 块，例如：

```xml
<block wx:if="{{ a > b }}">
  <span>a</span>
  <span>大于</span>
  <span>b</span>
</block>
```

注意， `<block>` 块不是一个真正的节点，其中不能包含其他属性。

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
<block wx:for="{{ arr }}" wx:key="id">
  <div>姓名：{{ item.name }}</div>
</block>
```

在复杂的列表中，使用 key 通常可以提升整体性能。但要注意：

* 如果每一项的 key 值不是唯一的，会降低使用 key 进行推断效果，不要将唯一性很差的字段作为 key ；
* 作为 key 的字段会被转换为字符串使用，所以只应使用数值或字符串类型的数据字段；
* 如果列表项目是固定的，或者只会在末尾增加、删除项目， key 不会有任何帮助（反而会增加少量开销），可以不用。

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

## 转义符

在数据绑定以外，应使用 XML Entities 来进行特殊字符的转义。

通常情况下只需要转义尖括号，例如 `<` 转义为 `&lt;` ：

```xml
<div wx:if="{{ a > b }}"> a &gt; b </div>
<div wx:elif="{{ a < b }}"> a &lt; b </div>
```

数据绑定内部的转义方式与 JavaScript 一致。
