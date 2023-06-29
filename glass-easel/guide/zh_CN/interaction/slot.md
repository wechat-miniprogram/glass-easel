# slot 及 slot 类型

## 单一 slot

子组件可以通过 `<slot />` 节点来承载它在父组件上的子树内容，例如：

```js
export const childComponent = componentSpace.defineComponent({
  template: compileTemplate(`
    <div>
      <slot />
    </div>
  `),
})
export const myComponent = componentSpace.defineComponent({
  using: {
    child: childComponent,
  },
  template: compileTemplate(`
    <div>
      <child>
        <div class="a" />
      </child>
    </div>
  `),
})
```

上例中 `<div class="a" />` 将被放置到子组件中的 `<slot />` 位置上。

## 多 slot

有时子组件需要放置多个 slot 节点。此时可以指定组件的 `multipleSlots` 选项，并使用 `name` 来区分多个节点，例如：

```js
export const childComponent = componentSpace.defineComponent({
  options: {
    multipleSlots: true,
  },
  template: compileTemplate(`
    <div>
      <slot name="body" />
    </div>
    <slot name="footer" />
  `),
})
export const myComponent = componentSpace.defineComponent({
  using: {
    child: childComponent,
  },
  template: compileTemplate(`
    <div>
      <child>
        <div slot="body"> 这段内容被插入到 name="body" 的 slot 中 </div>
        <div slot="footer"> 这段内容被插入到 name="footer" 的 slot 中 </div>
      </child>
    </div>
  `),
})
```

glass-easel 本身为单一 slot 应用了更多优化。激活 `multipleSlots` 同时也禁用了一些优化，对于不需要多 slot 的组件，最好不要激活这个选项。

## 动态 slot

上述两种 slot 类型要求（相同 name 的） slot 节点只有一个，重复的 `<slot />` 中只有第一个会生效。

但有时，需要在列表中放置 `<slot />` ，表示将 slot 内容重复多次。此时需要指定组件的 `dynamicSlots` 选项，例如：

```js
export const childComponent = componentSpace.defineComponent({
  options: {
    dynamicSlots: true,
  },
  template: compileTemplate(`
    <block wx:for="{{ list }}">
      <slot />
    </block>
  `),
  data: {
    list: ['A', 'B', 'C'],
  },
})
export const myComponent = componentSpace.defineComponent({
  using: {
    child: childComponent,
  },
  template: compileTemplate(`
    <div>
      <child>
        <div class="a" />
      </child>
    </div>
  `),
})
```

当 `dynamicSlots` 选项激活时，还可以向 slot 中传递数据，组件的使用者可以通过 `slot:` 来接收 slot 传递的数据，例如：

```js
export const childComponent = componentSpace.defineComponent({
  options: {
    dynamicSlots: true,
  },
  template: compileTemplate(`
    <block wx:for="{{ list }}">
      <slot list-index="{{ index }}" item="{{ item }}" />
    </div>
  `),
  data: {
    list: ['A', 'B', 'C'],
  },
})
export const myComponent = componentSpace.defineComponent({
  using: {
    child: childComponent,
  },
  template: compileTemplate(`
    <div>
      <child>
        <div class="a" slot:item>{{ item }}</div>
      </child>
    </div>
  `),
})
```

使用 `slot:` 来接收数据时，也可以用 `=` 来指定一个别名。此外，接收数据的节点也可以是 `<block />` 。例如：

```xml
<child>
  <div class="a" slot:listIndex="index">{{ index }}</div>
  <block slot:item>{{ item }}</block>
</child>
```

通过 slot 传递的数据受到 [数据字段拷贝控制](../data_management/data_deep_copy.md) 选项中的 `propertyPassingDeepCopy` 选项控制。
