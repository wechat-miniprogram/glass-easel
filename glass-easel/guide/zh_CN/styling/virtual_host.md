# 虚拟组件节点

默认情况下，代表组件的节点本身会和普通节点一样接收 class 和 style ，例如：

```js
export const myComponent = componentSpace.defineComponent({
  using: {
    child: childComponent,
  },
  template: compileTemplate(`
    <div class="a" style="color: red" />
    <child class="b" style="color: blue" />
  `)
})
```

在 DOM 节点树上， `<child>` 节点本身也会生成一个对应的 DOM 节点，使其能直接使用 class 和 style ；但这也使得一些情况下布局难以控制，例如在使用 flex 布局时， `<child>` 节点本身会成为一个 flex 内容项。

通过指定组件的 `virtualHost` 选项，可以改变这一行为，使其本身不生成一个对应的 DOM 节点，这样：

* flex 布局时，它本身不作为 flex 内容项参与布局；
* 节点本身的 class 和 style 失效。

虽然节点本身的 class 和 style 会失效，但可以将 class 定义为一个 [外部样式类](external_class.md) 、可以将 style 定义为一个属性，这样就可以用上它们，例如：

```js
export const childComponent = componentSpace.defineComponent({
  options: {
    virtualHost: true,
  },
  // 将 class 作为一个外部样式类
  externalClasses: ['class'],
  // 将 style 作为一个属性
  properties: {
    style: String,
  },
  // 将 class 和 style 应用到组件内部的节点上
  template: compileTemplate(`
    <div class="class" style="{{ style }}" />
  `),
})

export const myComponent = componentSpace.defineComponent({
  using: {
    child: childComponent,
  },
  // 同样可以使用 class 和 style
  template: compileTemplate(`
    <child class="b" style="color: blue" />
  `)
})
```
