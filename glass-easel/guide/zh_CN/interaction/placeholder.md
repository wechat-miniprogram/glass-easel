# 占位组件

有时，出于性能考虑，一些组件需要被延迟加载。此时，可以设置一个占位组件，当一个组件缺失时，可以用占位组件来暂时代替。等到组件被注册之后，占位组件会被自动替换成它。例如：

```js
export const placeholderComponent = componentSpace.define()
  .template(wxml(`
    <div>Loading...</div>
  `))
  .registerComponent()

export const myComponent = componentSpace.define()
  .usingComponents({
    child: 'lazy-components/child',
    placeholder: placeholderComponent,
  })
  .placeholders({
    child: 'placeholder',
  })
  .registerComponent()
```

等到对应的组件被注册时，占位组件会被自动替换：

```js
componentSpace.define('lazy-components/child')
  .registerComponent()
```
