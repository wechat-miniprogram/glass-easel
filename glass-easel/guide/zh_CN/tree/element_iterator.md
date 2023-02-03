# 节点树遍历

## 使用节点树遍历器

通常，节点树遍历可以直接借助 `ElementIterator` 来实现。

例如，依次获得某个节点在 Shadow Tree 上的所有节点：

```js
export const myComponent = componentSpace.defineComponent({
  lifetimes: {
    attached() {
      // 遍历模式： Shadow Tree 上所有子孙节点
      const mode = 'shadow-descendants-root-first'
      // 遍历
      glassEasel.ElementIterator.create(this.shadowRoot, mode)
        .forEach((node) => {
          // 依次回调所有子孙节点
          // 返回 false 会中断遍历
        })
    },
  },
})
```

节点树遍历模式有以下几种。

| 模式 | 遍历范围 | 遍历顺序 |
| ---- | -------- | -------- |
| shadow-ancestors | Shadow Tree | 当前节点的祖先节点，由近及远 |
| shadow-descendants-root-first | Shadow Tree | 当前节点的子孙节点，先父节点再子节点（先根遍历） |
| shadow-descendants-root-last | Shadow Tree | 当前节点的子孙节点，先子节点再父节点（后根遍历） |
| composed-ancestors | Composed Tree | 当前节点的祖先节点，由近及远 |
| composed-descendants-root-first | Composed Tree | 当前节点的子孙节点，先父节点再子节点（先根遍历） |
| composed-descendants-root-last | Composed Tree | 当前节点的子孙节点，先子节点再父节点（后根遍历） |

## 限制节点遍历器返回的节点类型

常常，遍历时只需要关心某一类节点。例如，遍历过程中只需要处理 `glassEasel.Element` ，不需要 `glassEasel.TextNode` ，此时可以限制 `ElementIterator` 的返回类型：

```js
export const myComponent = componentSpace.defineComponent({
  lifetimes: {
    attached() {
      const mode = 'shadow-descendants-root-first'
      // 仅返回 glassEasel.Element
      glassEasel.ElementIterator.create(this.shadowRoot, mode, glassEasel.Element)
        .forEach((node) => {
          // 依次回调所有 glassEasel.Element 节点
        })
    },
  },
})
```
