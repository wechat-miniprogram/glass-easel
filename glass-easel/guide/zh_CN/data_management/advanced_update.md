# 高级数据更新方法

## 使用 setData 更新模板数据绑定

一般情况下，可以使用组件实例的 `this.setData` 来更新数据绑定。

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

在使用 Chaning API 时，也可以利用 init 函数这样做：

```js
export const addComponent = componentSpace.define()
  .template(compileTemplate(`
    <div>{{ a }} + {{ b }} = {{ a + b }}</div>
  `))
  .data(() => ({
    a: 1,
    b: 2,
  }))
  .init(function ({ setData, lifetime }) {
    lifetime('attached', () => {
      // 这种做法可以省略掉 this
      setData({
        a: 3,
      })
    })
  })
  .registerComponent()
```

setData 支持一些复杂的数据路径，例如：

```js
export const addComponent = componentSpace.defineComponent({
  data: {
    obj: {
      a: [1, 2],
    },
  },
  lifetimes: {
    attached() {
      this.setData({
        'obj.a[0]': 3,
      })
    },
  },
})
```

## 高级路径更新

如果想仅更新对象内的一个字段，可以使用高级路径更新的方式。这样虽然接口复杂一些，但可以拥有更好的性能。

例如，可以使用 `replaceDataOnPath` 来更新对象内的数据字段：

```js
export const addComponent = componentSpace.defineComponent({
  data: {
    obj: {
      a: [1, 2],
    },
  },
  lifetimes: {
    attached() {
      // 更新 obj.a 字段
      this.replaceDataOnPath(['obj', 'a', 0], 3)
      // 将更新应用到模板上
      this.applyDataUpdates()
    },
  },
})
```

如果字段是数组类型的，还可以使用 `spliceArrayDataOnPath` 来对数组项进行插入和删除：

```js
export const addComponent = componentSpace.defineComponent({
  data: {
    obj: {
      arr: [1, 2, 3, 4],
    },
  },
  lifetimes: {
    attached() {
      // 更新 obj.arr 数组：
      // 类似于数组的 splice 方法
      // 可以在一个位置上移除若干项，再插入若干项
      this.spliceArrayDataOnPath(['obj', 'arr'], 1, 2, [5, 6, 7])
      // 得到的 obj.arr 是 [1, 5, 6, 7, 4]
      // 将更新应用到模板上
      this.applyDataUpdates()
    },
  },
})
```

调用 `replaceDataOnPath` 和 `spliceArrayDataOnPath` 后，并不会立即将更新内容应用到模板上，还需要调用 `applyDataUpdates` 。如果需要连续调用多个 `replaceDataOnPath` 或 `spliceArrayDataOnPath` ，在末尾调用一次 `applyDataUpdates` 即可。

## 组合更新

连续调用多个 `replaceDataOnPath` 或 `spliceArrayDataOnPath` 后，可能会遗忘调用 `applyDataUpdates` 。

可以考虑改用 `groupUpdates` 将它们组合起来，例如：

```js
export const addComponent = componentSpace.defineComponent({
  data: {
    obj: {
      a: 1,
      b: 2,
    },
  },
  lifetimes: {
    attached() {
      // 进行组合更新
      this.groupUpdates(() => {
        this.replaceDataOnPath(['obj', 'a'], 3)
        this.replaceDataOnPath(['obj', 'b'], 5)
      })
    },
  },
})
```

在 `groupUpdates` 调用后，会自动将更新应用到模板上，不再需要调用 `applyDataUpdates` 。

另外，如果需要将多个 `setData` 调用组合起来，可以使用 `updateData` ，例如：

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
      this.groupUpdates(() => {
        this.updateData({
          a: 3,
        })
        this.updateData({
          b: 5,
        })
      })
    },
  },
})
```

这种做法性能上优于连续多次 `setData` 。
