# 普通 Behaviors

behaviors 是一种简单的组件间代码共享机制。通过 behaviors ，可以将几个组件间共享的部分逻辑抽离出来。

对于 Definition API ，可以用 behaviors 定义一部分属性、方法等，然后在组件中可以引用 behaviors ，例如：

```js
export const sharedBehavior = componentSpace.defineComponent({
  // 属性列表会被合并到引用它的组件中
  properties: {
    a: Number,
  },
})

export const myComponent = componentSpace.defineComponent({
  // 引入 behavior
  behaviors: [sharedBehavior],
  properties: {
    b: String,
  },
  // 属性会与 behavior 中的属性列表合并，因而模板中可以引用模板中的字段
  template: compileTemplate(`
    <div>{{a}}</div>
    <div>{{b}}</div>
  `),
})
```

注意，有些字段不能写在 behaviors 中（会被忽略）。

* `template` 模板因为无法很好合并，所以不能写在 behaviors 中。
* `using` `generics` `placeholder` 由于涉及了模板中节点信息，也不能写在 behaviors 中。
* `options` 是针对组件的配置，不能写在 behaviors 中。

对于 Chaining API ， behaviors 相当于链式调用中的一部分。 Chaining API 的 behaviors 也有上述字段限制。

上面的例子可以用 Chaining API 表达为：

```js
export const sharedBehavior = componentSpace.define()
  .property('a', Number)
  .registerBehavior()

export const myComponent = componentSpace.define()
  .behavior(sharedBehavior)
  .property('b', String)
  .template(compileTemplate(`
    <div>{{a}}</div>
    <div>{{b}}</div>
  `))
  .registerComponent()
```
