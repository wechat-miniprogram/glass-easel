# 方法

## 普通组件方法

可以通过 `methods` 来定义一些能在组件实例 `this` 对象上访问的函数：

```js
// 使用 Definition API 添加方法
export const myComponent = componentSpace.defineComponent({
  methods: {
    aPlusB(a, b) {
      return a + b
    },
  },
  lifetimes: {
    attached() {
      this.aPlusB(1, 2) === 3 // true
    },
  },
})
// 或使用 Chaining API 添加方法
export const myComponent = componentSpace.define()
  .methods({
    aPlusB(a, b) {
      return a + b
    },
  })
  .lifetime('attached', function () {
    this.aPlusB(1, 2) === 3 // true
  })
  .registerComponent()
// 或在 init 中添加方法
export const myComponent = componentSpace.define()
  .init(function ({ lifetime, method }) {
    const aPlusB = method((a, b) => {
      return a + b
    })
    lifetime('attached', function () {
      this.aPlusB(1, 2) === 3 // true
    })
    // 注意 method 需要返回
    return { aPlusB }
  })
  .registerComponent()
```

## 使用 init 内函数代替

实际上，如果使用 init ，则通常不需要用普通组件方法，直接在 init 中定义函数即可。

```js
export const myComponent = componentSpace.define()
  .init(function ({ lifetime }) {
    const aPlusB = (a, b) => a + b
    lifetime('attached', function () {
      aPlusB(1, 2) === 3 // true
    })
  })
  .registerComponent()
```

这种做法可以让一些私有函数不能通过组件实例 `this` 来访问。
