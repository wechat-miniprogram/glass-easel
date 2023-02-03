# 抽象节点

有时，由于代码解耦等需要，一些节点对应的组件是不确定的。此时可以将它设置为一个 **抽象节点** ，它对应的组件可以由父组件来指定。例如：

```js
// 使用 Definition API 设置抽象节点
export const childComponent = componentSpace.defineComponent({
  generics: {
    // 设置一个抽象节点
    item: true,
  },
  // 在模板中可以使用抽象节点
  template: compileTemplate(`
    <item />
  `),
})
// 或使用 Chaining API 设置抽象节点
export const childComponent = componentSpace.define()
  .generics({
    item: true,
  })
  .template(compileTemplate(`
    <item />
  `))
  .registerComponent()
```

在使用含有抽象节点的组件时，需要指定抽象节点对应的实际组件，例如：

```js
// 先定义一个抽象节点的实现组件
export const implItemComponent = componentSpace.defineComponent({})

// 使用组件时，传入 itemComponent
export const myComponent = componentSpace.defineComponent({
  using: {
    child: childComponent,
    impl: implItemComponent,
  },
  template: compileTemplate(`
    <child generic:item="impl" />
  `),
})
```

注意：使用 `generic:` 传入实现组件时，不能使用数据绑定。

定义抽象节点时，可以提供一个默认组件，如果父组件没有传入实现组件，则会转而使用这个默认组件，例如：

```js
const defaultComponent = componentSpace.defineComponent({})

export const childComponent = componentSpace.defineComponent({
  generics: {
    item: {
      default: defaultComponent,
    },
  },
  template: compileTemplate(`
    <item />
  `),
})

export const myComponent = componentSpace.defineComponent({
  using: {
    child: childComponent,
  },
  // 未指定 generic:item 时，默认组件将被使用
  template: compileTemplate(`
    <child />
  `),
})
```
