# 节点树变化监听

Shadow Tree 的变化可以通过 `MutationObserver` 来监听。

例如，获取整个 Shadow Tree 上子节点的变化：

```js
export const myComponent = componentSpace.defineComponent({
  lifetimes: {
    attached() {
      // 监听 Shadow Tree 上的所有属性变化
      glassEasel.MutationObserver.create((ev) => {
        ev.type === 'properties' // true
        ev.target // 是哪个节点发生了变化
        // 如果是组件的属性变化，则 propertyName 会被设置
        ev.propertyName // 变化的属性名
        // 如果是节点的 id 、 slot 、 class 或 style 变化，则 attributeName 会被设置
        ev.attributeName // 变化的项目名
      }).observe(this.shadowRoot, { subtree: true, properties: true })

      // 监听 Shadow Tree 上节点的插入、移动或移除
      glassEasel.MutationObserver.create((ev) => {
        ev.type === 'childList' // true
        ev.target // 是哪个节点的子节点列表发生了变化
        ev.addedNodes // 新增的节点列表
        ev.removedNodes // 移除的节点列表
      }).observe(this.shadowRoot, { subtree: true, childList: true })

      // 监听 Shadow Tree 上文本节点的内容变化
      glassEasel.MutationObserver.create((ev) => {
        ev.type === 'characterData' // true
        ev.target // 是哪个节点所含文本发生了变化
      }).observe(this.shadowRoot, { subtree: true, characterData: true })

      // 监听当前节点的 attach 和 detach 状态变化
      glassEasel.MutationObserver.create((ev) => {
        ev.type === 'attachStatus' // true
        ev.status // 'attached' 或 'detached'
      }).observe(this.shadowRoot, { attachStatus: true })
    },
  },
})
```

目前 glass-easel 支持的监听：

* `properties` 属性变化；
* `childList` 子节点列表变化；
* `characterData` 文本内容变化；
* `attachStatus` attach 和 detach 状态变化。

一个监听器可以同时监听多类变化。同时可以激活 `subtree: true` 来监听所有子孙节点的变化。（ `subtree: true` 对 `attachStatus` 无效。）
