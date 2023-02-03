# 样式隔离

glass-easel 的默认设置中，组件之间的样式是共享的。如果想将一个样式表仅用于一个组件，可以考虑启用 style scope 支持。

在 DOM 环境下， style scope 要求样式表预处理时对样式表中的 class 都添加一个前缀，例如：

```css
.my-prefix--header {
  font-size: 1.5em;
}
.my-prefix--footer {
  font-size: 0.9em;
}
```

通过 `glass-easel-stylesheet-compiler` 工具可以为样式表添加固定的前缀，具体用法请参考它的相关文档。

添加前缀后，可以注册一个 style scope ：

```js
const myStyleScope = componentSpace.styleScopeManager.register('my-prefix')
```

组件定义时，可以指定它使用这个 style scope ：

```js
export const myComponent = componentSpace.defineComponent({
  options: {
    styleScope: myStyleScope,
  },
  template: compileTemplate(`
    <div class="header" />
    <div class="footer" />
  `)
})
```

如果指定了 style scope ，模板中的所有 class 指定的样式将只应用含有前缀的 class 样式规则。

若想要同时应用无前缀和含前缀两种 class 样式规则，可以改用 `extraStyleScope` 选项：

```js
export const myComponent = componentSpace.defineComponent({
  options: {
    extraStyleScope: myStyleScope,
  },
  template: compileTemplate(`
    <div class="header" />
    <div class="footer" />
  `)
})
```

[自定义后端](../advanced/custom_backend.md) 对样式隔离的支持方式略有不同，请参考它的相关文档。
