# 选择器查询

## 使用选择器获取节点

通常，可通过选择器来快速获得 Shadow Tree 上一个特定的子孙节点。

例如，获得一个 id 为 `the-id` 的子节点：

```js
export const myComponent = componentSpace.defineComponent({
  template: compileTemplate(`
    <div>
      <span id="the-id">Some Text</span>
    </div>
  `),
  lifetimes: {
    attached() {
      // 获取 id="the-id" 的节点
      const span = this.shadowRoot.querySelector('#the-id')
      span.childNodes[0].textContent = 'Some Text'
    },
  },
})
```

目前 glass-easel 支持的选择器列表如下。

| 名称 | 示例 | 说明 |
| ---- | ---- | ---- |
| id 选择器 | `#the-id` | 选择节点 id 为 `the-id` 的节点 |
| class 选择器 | `.the-class` | 选择节点 class 含 `the-class` 的节点 |
| 交集选择 | `#the-id.the-class` | 选择节点 id 为 `the-id` 且 class 含 `the-class` 的节点 |
| 儿子选择 | `#the-id > .the-class` | 在节点 id 为 `the-id` 节点的儿子节点中，选择节点 class 含 `the-class` 的节点 |
| 子孙选择 | `#the-id .the-class` | 在节点 id 为 `the-id` 节点的子孙节点中，选择节点 class 含 `the-class` 的节点 |
| 跨组件子孙选择 | `#the-id >>> .the-class` | 在节点 id 为 `the-id` 节点的子孙节点中，选择节点 class 含 `the-class` 的节点，查找时可以进入其他组件、不限于当前 Shadow Tree |

`querySelector` 只会返回第一个找到的节点。如果需要返回所有节点组成的列表，使用 `querySelectorAll` 。

## 节点类型特化

在使用 TypeScript 时，选择器查询返回的节点都是 `glassEasel.Element` 类型。此时可以使用一些类型特化方法将其转换为更具体的节点类型。

最常用的类型特化方法是 `asInstanceOf` ，用来将一个节点转为某个特定组件的实例，例如：

```js
export const childComponent = componentSpace.define()
  .methods({
    aPlusB(a, b) { return a + b }
  })
  .registerComponent()
export const myComponent = componentSpace.define()
  .usingComponents({
    child: childComponent,
  })
  .template(compileTemplate(`
    <child id="the-id" />
  `)
  .lifetime('attached', function () {
    // 获取 id="the-id" 的节点，并将其转换为 childComponent 的实例
    const child = this.shadowRoot.querySelector('#the-id').asInstanceOf(childComponent)!
    child.aPlusB(1, 2) === 3 // true
  })
  .registerComponent()
```

另一种比较好的实现方式是不关心节点的具体类型、只关心节点实现的接口，以实现更好的组件间解耦，此时可以使用 [Trait Behaviors](../interaction/trait_behavior.md) 。
