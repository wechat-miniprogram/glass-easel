# 外部样式类

由于 glass-easel 存在样式隔离，每个组件的样式只在其自身的 Shadow Tree 内生效，子组件无法直接使用父组件定义的样式。然而在实际开发中，经常需要让父组件能够自定义子组件的外观——例如统一调整按钮颜色、列表项间距等。此时可以使用**外部样式类（External Classes）**。

外部样式类允许组件声明一些 class 名是「可从外部传入的」，使用组件时，父组件通过属性将自身的 class 名映射到子组件声明的外部样式类上，从而实现跨组件的样式传递。例如：

```js
export const childComponent = componentSpace.define()
  .externalClasses(['my-class'])
  .template(wxml(`
    <div id="a" class="my-class" />
  `))
  .registerComponent()
```

使用这个组件时，就可以指定：

```js
export const myComponent = componentSpace.define()
  .usingComponents({
    child: childComponent,
  })
  .template(wxml(`
    <child my-class="some-class" />
  `))
  .registerComponent()
```

```css
/* 父组件的样式 */
.some-class {
  color: red;
}
```

这样，子组件中的 `<div id="a" />` 就会最终应用 `.some-class` 的样式规则。最终渲染的 DOM 结构如下：

```html
<!-- 最终渲染的 DOM -->
<child>
  <div id="a" class="some-class"></div>
</child>
```

可以看到，子组件模板中声明的 `my-class` 已被替换为父组件传入的 `some-class`，使得父组件中定义的 `.some-class` 样式规则能够正确地应用到子组件内部的 `<div>` 元素上。

> 样式的优先级取决于样式表本身，比如 CSS 中后声明的样式会优先于先声明的。external-class 并不改变优先级，即 external-class 并不优先于普通 class，或反之。

## 多层嵌套传递

外部样式类支持跨多层组件嵌套传递。中间层组件可以将自己声明的外部样式类继续传递给更内层的子组件，从而实现样式从最外层一直穿透到最内层。

```js
// 最内层组件：声明 ext-class 为外部样式类
export const innerComponent = componentSpace.define()
  .externalClasses(['ext-class'])
  .template(wxml(`
    <div class="ext-class" />
  `))
  .registerComponent()

// 中间层组件：声明 a-class 为外部样式类，并将其传递给 inner 的 ext-class
export const middleComponent = componentSpace.define()
  .usingComponents({ inner: innerComponent })
  .externalClasses(['a-class'])
  .template(wxml(`
    <inner ext-class="a-class" />
  `))
  .registerComponent()

// 最外层组件：使用 middle 组件并传入实际的样式类名
export const outerComponent = componentSpace.define()
  .usingComponents({ middle: middleComponent })
  .template(wxml(`
    <middle a-class="highlight" />
  `))
  .registerComponent()
```

```css
/* 最外层组件的样式 */
.highlight {
  color: red;
  font-weight: bold;
}
```

最终渲染时，最内层 `<div>` 的 class 将被替换为最外层传入的 `highlight`：

```html
<!-- 最终渲染的 DOM -->
<middle>
  <inner>
    <div class="highlight"></div>
  </inner>
</middle>
```

这样，最外层组件定义的 `.highlight` 样式就能穿透多层组件，应用到最内层的元素上。
