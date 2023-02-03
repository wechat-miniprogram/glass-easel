# 节点树变更

## 何时可以手工变更节点树

绝大多数情况下，节点树都应该通过模板和数据绑定来改变。但在极少数情况下，需要绕开模板来手工变更节点树。

一种情况是，在实现 [自定义模板引擎](../advanced/template_engine.md) 时需要手工变更节点树。

另一种情况是，有些极特殊的组件树结构无法采用模板引擎表达。请注意：这种情况下，对于节点树的手工变更常常会和模板带来的更新冲突！通常，只应该更新不在模板上的节点，例如在模板的一个空节点内部插入新节点。

变更节点树时，只需要变更 Shadow Tree ，而 Composed Tree 会自动变更。所以只关心 Shadow Tree 的变更方法即可。

## 创建一个节点

创建节点时，可以使用组件实例的 `this.shadowRoot` 下的几个创建方法。

| 方法名 | 说明 |
| ------ | ---- |
| createTextNode | 创建一个 `glassEasel.TextNode` 文本节点 |
| createNativeNode | 创建一个 `glassEasel.NativeNode` 普通节点 |
| createComponent | 创建一个 `glassEasel.Component` 组件节点 |
| createComponentOrNativeNode | 如果节点名字是一个组件，就创建一个 `glassEasel.Component` 组件节点，否则创建一个 `glassEasel.NativeNode` 普通节点 |
| createVirtualNode | 创建一个 `glassEasel.VirtualNode` 虚拟节点 |

注意，在一个 `glassEasel.ShadowRoot` 下创建的节点只能被插入到这个 Shadow Tree 中。

## 增删节点

将节点插入节点树或移出节点树时，可以使用 `glassEasel.Element` 下的几个插入、移除方法。

| 方法名 | 说明 |
| ------ | ---- |
| appendChild | 追加一个新子节点 |
| insertChildAt | 在第 index 个子节点的位置上插入一个新子节点 |
| insertBefore | 在指定的子节点之前插入一个新子节点 |
| insertChildren | 批量插入新子节点 |
| removeChildAt | 移除第 index 个子节点 |
| removeChild | 移除指定的子节点 |
| removeChildren | 批量移除子节点 |
| replaceChildAt | 替换第 index 个子节点为新子节点 |
| replaceChild | 替换指定的子节点为新子节点 |
| selfReplaceWith | 将节点自身替换为一个新节点 |

如果将一个已经被插入的节点插入到另一个位置上，则会自动变为一个移动操作。

glass-easel 内部使用的算法是针对在一个节点末尾追加新子节点（即 `appendChild` ）来优化的，所以请尽量多使用这样的操作。

## 销毁节点

将一个节点移出节点树之后，如果它不再被使用，则需要调用销毁方法 `glassEasel.Element.destroyBackendElement` ，否则有些情况下会出现内存泄漏。

如果一个节点在被移出节点树后就必然不会再被使用，则可以提前调用 `glassEasel.Element.destroyBackendElementOnDetach` 使它在被移出后自动销毁，避免遗忘。

## 节点树变更流程示例

对节点树的操作流程可以大体上以下例表示：

```js
export const myComponent = componentSpace.defineComponent({
  template: compileTemplate(`
    <div id="wrapper" />
  `),
  lifetimes: {
    attached() {
      // 获得 wrapper 节点
      const wrapper = this.shadowRoot.getElementById('#wrapper')
      // 创建一个新的 span 节点
      const span = this.shadowRoot.createNativeNode('span')
      // 当 span 被移出时自动销毁它
      span.destroyBackendElementOnDetach()
      // 将 span 插入到 wrapper 下
      wrapper.appendChild(span)
      // 将 span 移除出来
      wrapper.removeChildAt(0)
    },
  },
})
```
