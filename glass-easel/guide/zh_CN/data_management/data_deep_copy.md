# 数据字段拷贝控制

## 数据深拷贝

默认情况下，数据字段应用到模板前，会经过一次深拷贝。这样，无意中对组件实例的 `this.data` 进行的修改，将不会应用到模板上。例如：

```js
export const myComponent = componentSpace.defineComponent({
  template: compileTemplate(`
    <div>{{ a }}</div>
  `),
  data: {
    a: 1,
  },
  lifetimes: {
    attached() {
      // 这样进行的更新不会应用到模板上
      this.data.a = 2
    },
  },
})
```

这样虽然可以提供一些对错误逻辑的保护，但需要进行一次深拷贝。默认情况下，这次深拷贝不支持含有递归字段的数据，例如：

```js
export const myComponent = componentSpace.defineComponent({
  data: {
    a: {},
  },
  lifetimes: {
    attached() {
      const a = {}
      a.b = a
      // a 是一个有递归字段的对象
      // 不能用于 setData ，否则会出错！
      this.setData({ a })
    },
  },
})
```

此时可以更改组件的 `dataDeepCopy` 选项，使其支持递归字段：

```js
export const myComponent = componentSpace.defineComponent({
  options: {
    dataDeepCopy: glassEasel.DeepCopyKind.SimpleWithRecursion,
  },
  data: {
    a: {},
  },
  lifetimes: {
    attached() {
      const a = {}
      a.b = a
      this.setData({ a })
    },
  },
})
```

或者也可以完全禁用拷贝（这需要保证不能直接修改 `this.data` ），这样可以完全避免额外开销、对象的原型链能够保留、性能最优：

```js
export const myComponent = componentSpace.defineComponent({
  options: {
    dataDeepCopy: glassEasel.DeepCopyKind.None,
  },
  data: {
    a: {},
  },
  lifetimes: {
    attached() {
      const a = {}
      a.b = a
      this.setData({ a })
    },
  },
})
```

如果需要改变所有组件的这个选项，考虑更改 [组件空间](../advanced/component_space.md) 中的默认组件选项。

## 属性传递深拷贝

默认情况下，传递组件属性时，也会经过一次深拷贝。这样可以使得两个组件之间不共享对象、对一个组件的数据变更不会影响另一个组件。

但这个行为也会使得含有递归字段的对象在传递时出错。可以通过更改子组件的 `propertyPassingDeepCopy` 选项，使其属性支持递归字段：

```js
export const childComponent = componentSpace.defineComponent({
  options: {
    propertyPassingDeepCopy: glassEasel.DeepCopyKind.SimpleWithRecursion,
  },
  properties: {
    a: Object,
  },
})

export const myComponent = componentSpace.defineComponent({
  options: {
    dataDeepCopy: glassEasel.DeepCopyKind.SimpleWithRecursion,
  },
  using: {
    child: childComponent,
  },
  template: compileTemplate(`
    <child a="{{ a }}" />
  `),
  data: {
    a: {},
  },
  lifetimes: {
    attached() {
      const a = {}
      a.b = a
      this.setData({ a })
    },
  },
})
```

或者也可以完全禁用拷贝（这需要子组件保证不修改传入的对象），这样可以完全避免额外开销、对象的原型链能够保留、性能最优：

```js
export const childComponent = componentSpace.defineComponent({
  options: {
    propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
  },
  properties: {
    a: Object,
  },
})

export const myComponent = componentSpace.defineComponent({
  options: {
    dataDeepCopy: glassEasel.DeepCopyKind.None,
  },
  using: {
    child: childComponent,
  },
  template: compileTemplate(`
    <child a="{{ a }}" />
  `),
  data: {
    a: {},
  },
  lifetimes: {
    attached() {
      const a = {}
      a.b = a
      this.setData({ a })
    },
  },
})
```
