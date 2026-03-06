# 快速入门

本文将带你从零开始，用一个简单的计数器示例，快速上手 glass-easel 的核心用法。你将学会如何创建组件、使用模板渲染数据、处理用户交互，以及组合多个组件。

## 创建你的第一个组件

组件是 glass-easel 的基本渲染单元。每个组件都包含自己的模板、数据和逻辑，是一个独立的、可复用的界面构建块。

下面通过 Chaining API 创建一个最简单的组件：

```javascript
import * as glassEasel from "glass-easel"
import { wxml } from "glass-easel-template-compiler"

// get the default component space
const componentSpace = glassEasel.getDefaultComponentSpace()

const HelloWorld = componentSpace
  .define()
  .template(wxml(`
    <div>Hello World!</div>
  `))
  .registerComponent()
```

这段代码做了三件事：

1. 通过 `getDefaultComponentSpace()` 获取默认的组件空间
2. 调用 `define()` 开始定义一个组件
3. 设置模板内容，并调用 `registerComponent()` 完成注册

> 💡 glass-easel 提供了 **Chaining API** 和 **Definition API** 两种组件定义风格。本文使用 Chaining API，它以连缀调用的形式串联各个字段，对 TypeScript 有更好的类型支持。更多详情请参阅 [组件](./component.md) 文档。

## 模板和数据渲染

glass-easel 采用声明式渲染——你只需要描述界面 **应该是什么样子**，框架会自动处理界面的更新。

模板是包含 `{{ ... }}` 数据绑定的类 XML 代码，遵循 [WXML 语法](./template.md)。现在给组件增加一些内容：

```javascript
const HelloWorld = componentSpace
  .define()
  .template(wxml(`
    <div class="counter">
      <div class="greeting">Hello Glass Easel!</div>
      <div class="count">{{ count }}</div>
    </div>
  `))
  .data(() => ({
    count: 0,
  }))
  .registerComponent()
```

在模板中，`{{ count }}` 是数据绑定表达式。glass-easel 会自动将组件数据渲染到模板中，当 `count` 发生变化时，界面也会自动更新——你不需要手动操作 DOM。

`data` 方法用于声明组件的初始数据。这里我们定义了一个初始值为 `0` 的 `count` 字段。

> 📖 更多模板语法请参阅 [模板](./template.md) 文档。

## 事件处理和数据变更

静态的界面还不够，我们需要让用户能够与之交互。在 glass-easel 中，数据变更通过 `setData` 方法来触发更新。

下面为计数器添加两个按钮，点击时修改 `count` 的值：

```javascript
const HelloWorld = componentSpace
  .define()
  .template(wxml(`
    <div class="counter">
      <div class="greeting">Hello Glass Easel!</div>
      <div class="count">{{ count }}</div>
      <button bind:tap="decrement">-</button>
      <button bind:tap="increment">+</button>
    </div>
  `))
  .data(() => ({
    count: 0,
  }))
  .init(({ setData, data, method }) => {
    const increment = method(() => {
      setData({ count: data.count + 1 })
    })

    const decrement = method(() => {
      setData({ count: data.count - 1 })
    })

    return { increment, decrement }
  })
  .registerComponent()
```

这里有几个关键点：

- **事件监听**：模板中通过 `bind:xxx` 声明事件监听，`xxx` 是事件名。例如 `bind:tap` 监听点击事件。
- **init 函数**：组件的交互逻辑定义在 `init` 方法中。每次创建组件实例时，`init` 函数会执行一次。
- **method 包装**：需要在模板中调用的方法，必须用 `method` 函数包装并返回，这样框架才能将方法与模板中的事件绑定关联起来。
- **setData 更新**：调用 `setData` 传入新的数据，框架会自动计算差异并更新界面。

> ⚠️ 数据的初始化在 `data` 方法中完成，交互逻辑在 `init` 方法中完成，两者各司其职。

> 📖 更多事件监听方式请参阅 [事件](./event.md) 文档。

## 引用组件和事件派发

glass-easel 中，组件可以嵌套组合。你可以将通用的界面逻辑封装为独立组件，然后在其他组件中引用。

下面我们创建一个自定义的 `Btn` 按钮组件，替代原生的 `button`：

```javascript
// define the Btn component with a "disable" property
const Btn = componentSpace
  .define()
  .property("disable", Boolean)
  .template(wxml(`
    <button disabled="{{disable}}" bind:tap="onTap"><slot /></button>
  `))
  .init(({ self, data, method }) => {
    const onTap = method(() => {
      if (data.disable) return
      self.triggerEvent("hit")
    })
    return { onTap }
  })
  .registerComponent()
```

这个组件展示了几个重要概念：

- **属性（Property）**：通过 `property` 方法定义对外暴露的属性。`disable` 是一个布尔类型的属性，父组件可以传值来控制按钮是否禁用。
- **事件派发**：通过 `self.triggerEvent("hit")` 向父组件触发自定义事件 `hit`。
- **slot 插槽**：模板中的 `<slot />` 标签是一个插槽，允许父组件将子内容投射到这个位置。

接下来在 `HelloWorld` 组件中引用 `Btn` ：

```javascript
const HelloWorld = componentSpace
  .define()
  .usingComponents({ Btn })
  .template(wxml(`
    <div class="counter">
      <div class="greeting">Hello Glass Easel!</div>
      <div class="count">{{ count }}</div>
      <Btn disable bind:hit="decrement">-</Btn>
      <Btn bind:hit="increment">+</Btn>
    </div>
  `))
  .data(() => ({
    count: 0,
  }))
  .init(({ setData, data, method }) => {
    const increment = method(() => {
      setData({ count: data.count + 1 })
    })

    const decrement = method(() => {
      setData({ count: data.count - 1 })
    })

    return { increment, decrement }
  })
  .registerComponent()
```

通过 `usingComponent({ Btn })` 引入 `Btn` 组件后，就可以在模板中像使用普通标签一样使用它。`bind:hit` 监听了 `Btn` 组件派发的 `hit` 自定义事件。

注意第一个 `<Btn disable ...>` 传递了 `disable` 属性（等价于 `disable="{{true}}"`），因此减号按钮是禁用状态。

> 📖 更多组件定义选项请参阅 [组件](./component.md) 文档。
> 📖 更多插槽用法请参阅 [Slot 插槽](../interaction/slot.md) 文档。

## 下一步

接下来可以根据需要深入学习：

- [框架思维](./thinking.md) —— 深入理解 glass-easel 的声明式、组件隔离和多后端设计理念
- [模板](./template.md) —— 了解条件渲染、列表渲染、class/style 绑定等完整模板语法
- [组件](./component.md) —— 了解两种 API 风格、属性定义、init 函数等组件详细用法
- [事件](./event.md) —— 了解事件冒泡、捕获、互斥事件等完整的事件处理机制
- [生命周期](./lifetime.md) —— 了解组件从创建到销毁的完整生命周期
- [Slot 插槽](../interaction/slot.md) —— 了解更灵活的内容分发方式
