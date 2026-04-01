# 样式隔离

glass-easel 的默认设置中，组件之间的样式是共享的——一个组件中定义的 CSS class 样式规则可能会影响到其他组件。如果想将一个样式表的作用范围限定在某个组件内，可以启用 **style scope** 支持来实现样式隔离。

## 基本原理

在 DOM 环境下， style scope 的工作原理是为样式表中的 class 名添加一个**唯一前缀**。例如，原始的 CSS 样式：

```css
.header {
  font-size: 1.5em;
}
.footer {
  font-size: 0.9em;
}
```

经过 style scope 预处理后，会变成：

```css
.my-prefix--header {
  font-size: 1.5em;
}
.my-prefix--footer {
  font-size: 0.9em;
}
```

这样，只有同样标记了 `my-prefix` 前缀的组件才能匹配到这些样式规则，从而实现组件间的样式隔离。

通过 `glass-easel-stylesheet-compiler` 工具可以在构建时自动为样式表添加固定的前缀，具体用法请参考它的相关文档。

## 注册和使用 style scope

添加前缀后，需要在组件空间中注册一个对应的 style scope ：

```js
const myStyleScope = componentSpace.styleScopeManager.register('my-prefix')
```

然后在组件定义时，通过 `options` 指定它使用这个 style scope ：

```js
export const myComponent = componentSpace
  .define()
  .options({
    styleScope: myStyleScope,
  })
  .template(
    wxml(`
    <div class="header" />
    <div class="footer" />
  `),
  )
  .registerComponent()
```

指定 `styleScope` 后，模板中所有 class 在渲染时会自动匹配含有对应前缀的样式规则（如 `.my-prefix--header`），而不会匹配无前缀的全局样式规则（如 `.header`）。这意味着组件的样式被完全隔离在自己的作用域内。

## 同时应用全局样式和隔离样式

在某些场景下，你可能希望组件既能使用自己的隔离样式，又能应用全局的无前缀样式。此时可以使用 `extraStyleScope` 选项来添加一个**额外的样式作用域**：

```js
export const myComponent = componentSpace
  .define()
  .options({
    extraStyleScope: myStyleScope,
  })
  .template(
    wxml(`
    <div class="header" />
    <div class="footer" />
  `),
  )
  .registerComponent()
```

使用 `extraStyleScope` 时，模板中的 class 会**同时匹配**无前缀的全局样式规则和含前缀的隔离样式规则。例如，模板中的 `class="header"` 会同时应用 `.header` 和 `.my-prefix--header` 两条规则的样式。

> 💡 `styleScope` 和 `extraStyleScope` 也可以组合使用。此时组件会拥有两个样式作用域：`styleScope` 作为主作用域、`extraStyleScope` 作为附加作用域。

## 继承父组件的样式作用域

如果希望子组件自动继承父组件的样式作用域，而不需要为每个子组件单独指定，可以使用 `inheritStyleScope` 选项：

```js
export const childComponent = componentSpace
  .define()
  .options({
    inheritStyleScope: true,
  })
  .template(
    wxml(`
    <div class="content" />
  `),
  )
  .registerComponent()
```

开启 `inheritStyleScope` 后，子组件会自动继承其父组件的 `styleScope` 和 `extraStyleScope` ，使得父子组件共享同一套样式作用域。这在需要构建样式一致的组件层级结构时非常有用。

> 📖 更多组件选项的详细说明请参阅 [组件定义](../basic/component.md) 文档。

[自定义后端](../advanced/custom_backend.md) 对样式隔离的支持方式略有不同，请参考它的相关文档。
