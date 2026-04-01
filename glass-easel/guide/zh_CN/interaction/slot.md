# slot 插槽

在 glass-easel 中，每个组件实例都拥有独立的 [Shadow Tree](../tree/node_tree.md#shadow-tree)，代表组件自身模板中的节点结构。当组件的使用者在组件标签内编写子节点时，这些子节点并不直接出现在组件的 Shadow Tree 中，而是通过 **slot 插槽** 机制被插入到 Shadow Tree 的指定位置。

slot 是 Shadow Tree 中的一种虚拟节点，它作为占位符，标记了组件使用者传入的子节点应该被放置的位置。在 [Composed Tree（组合树）](../tree/node_tree.md#composed-tree) 的拼接过程中，slot 节点会被填入相应的 slot 内容，最终形成完整的节点树。

glass-easel 提供了三种 slot 模式，分别适用于不同的使用场景：

| slot 模式 | 选项 | 说明 |
|-----------|------|------|
| 单一 slot | 默认 | 只有一个匿名 slot，所有子节点都插入到该 slot 中 |
| 多 slot | `multipleSlots: true` | 支持多个命名 slot，子节点通过 `slot` 属性指定插入位置 |
| 动态 slot | `dynamicSlots: true` | 支持 slot 在列表循环中重复出现，并可向 slot 内容传递数据 |

## 单一 slot

默认情况下，glass-easel 定义的组件采用单一 slot 模式，与 Web Components 的行为类似——组件的 Shadow Tree 中只能有一个 `<slot />` 节点，所有的 slot 内容都会被放置到这个唯一的 slot 位置上。

子组件可以通过 `<slot />` 节点来承载它在父组件上的子树内容，例如：

```js
export const childComponent = componentSpace.define()
  .template(wxml(`
    <div>
      <slot />
    </div>
  `))
  .registerComponent()

export const myComponent = componentSpace.define()
  .usingComponents({ child: childComponent })
  .template(wxml(`
    <div>
      <child>
        <div class="a" />
      </child>
    </div>
  `))
  .registerComponent()
```

上例中 `<div class="a" />` 将被放置到子组件中的 `<slot />` 位置上。最终拼接形成的 Composed Tree 结构如下：

```html
<!-- myComponent 的 Composed Tree -->
<myComponent>
  <:shadowRoot>
    <div>
      <child>
        <:shadowRoot>
          <div>
            <:slot>
              <!-- slot 内容被插入到此处 -->
              <div class="a">
```

### slot 的挂载特性

与 Web Components 的行为相同，在单一 slot 和多 slot 模式下，即使子组件的模板中**没有**对应的 `<slot />` 标签来放置 slot 内容，这些 slot 内容依然会被完整创建，其中的组件节点也会正常触发 `attached` 生命周期。

换言之，slot 内容的创建与否并不取决于是否存在匹配的 slot 标签，而是取决于组件使用者是否在组件标签内编写了子节点。例如：

```js
// 子组件模板中没有 <slot /> 标签
export const childComponent = componentSpace.define()
  .template(wxml(`
    <div>child content</div>
  `))
  .registerComponent()

export const myComponent = componentSpace.define()
  .usingComponents({ child: childComponent })
  .template(wxml(`
    <child>
      <div class="a">这段内容依然会被创建</div>
    </child>
  `))
  .registerComponent()
```

上例中，尽管 `childComponent` 的模板里没有 `<slot />`，`<div class="a">` 仍然会被创建。但由于没有 slot 标签来承载它，这段内容不会出现在最终渲染的 DOM 节点树中。

## 多 slot

有时子组件需要放置多个 slot 节点。此时可以指定组件的 `multipleSlots` 选项，并使用 `name` 来区分多个节点，例如：

```js
export const childComponent = componentSpace.define()
  .options({ multipleSlots: true })
  .template(wxml(`
    <div>
      <slot name="body" />
    </div>
    <slot name="footer" />
  `))
  .registerComponent()

export const myComponent = componentSpace.define()
  .usingComponents({ child: childComponent })
  .template(wxml(`
    <div>
      <child>
        <div slot="body"> 这段内容被插入到 name="body" 的 slot 中 </div>
        <div slot="footer"> 这段内容被插入到 name="footer" 的 slot 中 </div>
      </child>
    </div>
  `))
  .registerComponent()
```

> ⚠️ glass-easel 本身为单一 slot 应用了更多优化。激活 `multipleSlots` 同时也禁用了一些优化，对于不需要多 slot 的组件，最好不要激活这个选项。

> ⚠️ 与单一 slot 相同，在多 slot 模式下，即使某些 slot 内容没有找到对应 `name` 的 `<slot />` 标签，这些内容依然会被完整创建并触发 `attached` 生命周期，只是不会出现在最终渲染的 DOM 节点树中。

## 动态 slot

上述两种 slot 类型要求（相同 name 的） slot 节点只有一个，重复的 `<slot />` 中只有第一个会生效。

但有时，需要在列表中放置 `<slot />` ，表示将 slot 内容重复多次。此时需要指定组件的 `dynamicSlots` 选项，例如：

```js
export const childComponent = componentSpace.define()
  .options({ dynamicSlots: true })
  .template(wxml(`
    <block wx:for="{{ list }}">
      <slot />
    </block>
  `))
  .data(() => ({
    list: ['A', 'B', 'C'],
  }))
  .registerComponent()

export const myComponent = componentSpace.define()
  .usingComponents({ child: childComponent })
  .template(wxml(`
    <div>
      <child>
        <div class="a" />
      </child>
    </div>
  `))
  .registerComponent()
```

当 `dynamicSlots` 选项激活时，还可以向 slot 中传递数据，组件的使用者可以通过 `slot:` 来接收 slot 传递的数据，例如：

```js
export const childComponent = componentSpace.define()
  .options({ dynamicSlots: true })
  .template(wxml(`
    <block wx:for="{{ list }}">
      <slot list-index="{{ index }}" item="{{ item }}" />
    </block>
  `))
  .data(() => ({
    list: ['A', 'B', 'C'],
  }))
  .registerComponent()

export const myComponent = componentSpace.define()
  .usingComponents({ child: childComponent })
  .template(wxml(`
    <div>
      <child>
        <div class="a" slot:item>{{ item }}</div>
      </child>
    </div>
  `))
  .registerComponent()
```

使用 `slot:` 来接收数据时，也可以用 `=` 来指定一个别名。此外，接收数据的节点也可以是 `<block />` 。例如：

```xml
<child>
  <div class="a" slot:listIndex="index">{{ index }}</div>
  <block slot:item>{{ item }}</block>
</child>
```

> 📖 通过 slot 传递的数据受到 [数据字段拷贝控制](../data_management/data_deep_copy.md) 选项中的 `propertyPassingDeepCopy` 选项控制。

> ⚠️ 与单一 slot 和多 slot 不同，动态 slot 模式下，slot 内容的创建与 `<slot />` 标签的存在直接关联——slot 内容会在对应的 `<slot />` 标签被创建时才创建，并在 `<slot />` 标签被移除时销毁。因此，动态 slot 不会出现前两种模式中 slot 内容没有对应 slot 标签却仍被创建的情况。
