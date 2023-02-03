# 外部样式类

有时，一个组件的部分样式规则需要由它的使用者来指定。此时可以使用 **外部样式类** 。

组件可以指定它自身的一些 class 可以由组件外传递，例如：

```js
// 使用 Definition API 指定外部样式类
export const childComponent = componentSpace.defineComponent({
  externalClasses: ['my-class'],
  // 在模板的 class 中可以使用外部样式类
  template: compileTemplate(`
    <div class="my-class" />
  `),
})
// 或使用 Chaining API 指定外部样式类
export const childComponent = componentSpace.define()
  .externalClasses(['my-class'])
  .template(compileTemplate(`
    <div id="a" class="my-class" />
  `))
  .registerComponent()
```

使用这个组件时，就可以指定：

```js
export const myComponent = componentSpace.defineComponent({
  using: {
    child: childComponent,
  },
  template: compileTemplate(`
    <child my-class="some-class" />
  `),
})
```

这样，子组件中的 `<div id="a" />` 就会最终应用 `.some-class` 的样式规则：

```css
.some-class {
  /* ... */
}
```

即使启用了 [样式隔离](style_isolation.md) ，外部样式类依然可用。
