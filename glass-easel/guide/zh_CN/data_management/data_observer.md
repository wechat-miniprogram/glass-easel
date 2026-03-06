# 数据监听器

## 监听数据字段变化

通过数据监听器，可以在某些属性或数据字段被设置时触发一个响应函数。

这个响应函数会在属性或数据字段应用到模板前被调用，可以在总体上减少模板更新次数从而提升性能。

在这个响应函数中，可以使用 `updateData` 来更新其他的数据字段，这些数据字段会在响应函数执行完毕后生效。注意，虽然也可以使用 `setData` ，但数据监听器中的 `setData` 并不会立刻应用到模板上，而是像 `updateData` 一样、等到数据监听器执行完毕后才应用到模板上。

例如，可以在 `a` 和 `b` 两个字段中任何一个被设置时，触发一个响应函数：

```js
// 使用连缀方法添加数据监听器
export const addComponent = componentSpace.define()
  .data(() => ({
    a: 1,
    b: 2,
    sum: 3,
  }))
  // 在连缀方法中，应传入数组来监听多个数据字段
  .observer(['a', 'b'], function () {
    this.updateData({
      sum: this.data.a + this.data.b,
    })
  })
  .lifetime('attached', function () {
    this.setData({
      a: 3,
    })
  })
  .registerComponent()
// 或在 init 函数中添加数据监听器
export const addComponent = componentSpace.define()
  .data(() => ({
    a: 1,
    b: 2,
    sum: 3,
  }))
  .init(function ({ self, lifetime, observer }) {
    // 应传入数组来监听多个数据字段
    observer(['a', 'b'], () => {
      self.updateData({
        sum: self.data.a + self.data.b,
      })
    })
    lifetime('attached', function () {
      self.setData({
        a: 3,
      })
    })
  })
  .registerComponent()
```

注意：数据监听器会在其所监听字段值被设置时触发，即使其值没有发生变化，监听器也会触发。

不要在数据监听器内设置被监听的数据字段本身，否则会无限循环：

```js
export const addComponent = componentSpace.define()
  .data(() => ({
    a: 1,
  }))
  .observer('a', function () {
    // 会导致无限循环！
    this.updateData({
      a: 1,
    })
  })
  .registerComponent()
```

## 用数据监听器监听子字段

数据监听器也可以监听子字段，例如：

```js
export const addComponent = componentSpace.define()
  .data(() => ({
    obj: { a: 1 },
    arr: [1, 2, 3],
  }))
  // 添加一个数据监听器
  .observer('obj.a, arr[2]', function () {
    // 当 obj.a 或 arr[2] 被设置时会执行
  })
  .lifetime('attached', function () {
    // 执行这组更新时，数据监听器会被执行
    this.groupUpdates(() => {
      this.replaceDataOnPath(['obj', 'a'], 3)
    })
  })
  .registerComponent()
```

若想监听所有子字段，可以使用通配符 `**` ，例如：

```js
export const addComponent = componentSpace.define()
  .data(() => ({
    obj: { a: 1 },
  }))
  .observer('obj.**', function () {
    // 当 obj 的任何子字段被设置时都会执行
  })
  .registerComponent()
```

特别地，这样可以监听所有数据字段：

```js
export const addComponent = componentSpace.define()
  .observer('**', function () {
    // 当任何字段被设置时都会执行
  })
  .registerComponent()
```


