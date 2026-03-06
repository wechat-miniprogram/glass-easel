# 组件路径

可以给组件起一个路径名称，用于给组件归类。

```js
export const myComponent = componentSpace.define('path/to/my/component')
  .registerComponent()
```

在引用其他组件时，可以使用组件路径来指定，这对于含有递归引用的组件很实用：

```js
componentSpace.define('path/to/one/component')
  .usingComponents({
    // 使用相对路径来指定另一个组件
    another: '../another/component',
  })
  .registerComponent()

componentSpace.define('path/to/another/component')
  .usingComponents({
    // 使用绝对路径来指定另一个组件
    one: '/path/to/one/component',
  })
  .registerComponent()
```


