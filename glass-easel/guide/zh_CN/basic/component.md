# 组件

## API 风格

在定义组件时，有两种接口风格可选： **Definition API** 和 **Chaining API** 。

### Definition API

Definition API 类似于微信小程序的传统接口风格，例如：

```js
export const helloWorld = componentSpace.defineComponent({
  template: compileTemplate(template),
  data: {
    hello: 'Hello world!',
  },
  methods: {},
})
```

这种风格的代码比较符合传统习惯，但对 TypeScript 的支持有一定限制。

### Chaining API

Chaining API 采用连缀的形式串联各个字段，例如：

```js
export const helloWorld = componentSpace.define()
  .template(compileTemplate(template))
  .data(() => ({
    hello: 'Hello world!',
  }))
  .registerComponent()
```

这种风格的特点是连缀函数（除了 `template` ）可以调用多次，这样可以轻松地将一个组件的逻辑分为几个部分，对于大组件的逻辑解耦有一定帮助。

### 混用 API 风格

这两种接口风格是等价的，定义每个组件时都可以任选一种。

在同一个组件内， Definition API 也可以混用于 Chaining API 中，例如：

```js
export const helloWorld = componentSpace.define()
  .definition({
    template: compileTemplate(template),
    data: {
      hello: 'Hello world!',
    },
  })
  .registerComponent()
```

## 引用其他组件

组件可以引用其他组件。例如有另一个组件：

```js
export const myComponent = componentSpace.defineComponent({
  template: compileTemplate(`
    <div> Some text in myComponent </div>
  `),
})
```

引入组件：

```js
// 使用 Definition API 引入组件
export const helloWorld = componentSpace.defineComponent({
  using: {
    'my-component': myComponent,
  },
  template: compileTemplate(`
    <my-component />
  `),
})
// 或使用 Chaining API 引入组件
export const helloWorld = componentSpace.define()
  .usingComponents({
    'my-component': myComponent,
  })
  .template(compileTemplate(`
    <my-component />
  `))
  .registerComponent()
```

## 属性

属性是组件对外暴露的数据字段，组件的使用者可以通过模板来指定组件的属性值。

定义属性：

```js
// 使用 Definition API 定义属性
export const addComponent = componentSpace.defineComponent({
  template: compileTemplate(`
    <div>{{a}} + {{b}} = {{ a + b }}</div>
  `),
  properties: {
    a: Number, // 数值类型
    b: {
      type: Number, // 数值类型
      value: 1, // 初始属性值为 1
    },
  },
})
// 或使用 Chaining API 定义属性
export const addComponent = componentSpace.define()
  .template(compileTemplate(`
    <div>{{a}} + {{b}} = {{ a + b }}</div>
  `)
  .property('a', Number)
  .property('b', {
    type: Number,
    value: 1,
  })
  .registerComponent()
```

使用组件时可以指定属性：

```js
export const helloWorld = componentSpace.defineComponent({
  using: {
    'my-component': myComponent,
  },
  template: compileTemplate(`
    <my-component a="1" b="2" />
  `),
})
```

使用组件时可能会更新组件的属性值。组件可以使用 `comparer` 来决定该属性是否需要更新，这样做有时可以提升性能。

```js
export const addComponent = componentSpace.defineComponent({
  properties: {
    b: {
      type: Object, // 对象类型
      value: { myField: '' },
      comparer(newValue, oldValue) {
        // 只有 myField 变了之后才更新属性
        return newValue.myField !== oldValue.myField
      },
    },
  },
})
```

## init 函数

init 函数是可以使用 Chaining API 定义的函数，每次创建实例时，函数会被执行一次。

```js
export const helloWorld = componentSpace.define()
  .template(compileTemplate(`
    <div>{{ hello }}</div>
  `))
  .data(() => ({
    hello: 'Hello world!',
  }))
  .init(function ({ setData }) {
    // 这个函数在每次创建实例时会执行一次
    // 不在模板上使用的私有变量可以定义在这里
    const someInnerData = {}
  })
  .registerComponent()
```

在这个函数中，可以定义私有变量和方法等，不需要用在模板上的变量可以定义在其中。函数的第一个参数中也提供了一些实用的工具方法。
