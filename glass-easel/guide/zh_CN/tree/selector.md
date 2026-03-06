# 选择器查询

## 使用选择器获取节点

通常，可通过选择器来快速获得 [Shadow Tree](./node_tree.md#shadow-tree) 上一个特定的子孙节点。

例如，获得一个 id 为 `the-id` 的子节点：

```js
export const myComponent = componentSpace.define()
  .template(wxml(`
    <div>
      <span id="the-id">Some Text</span>
    </div>
  `))
  .lifetime('attached', function () {
    // 获取 id="the-id" 的节点
    const span = this.shadowRoot.querySelector('#the-id')
    span.childNodes[0].textContent = 'Some Text'
  })
  .registerComponent()
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

## 测试节点是否匹配选择器

`matchSelector` 用于测试一个节点是否匹配指定的选择器。它有两种使用方式：

**实例方法**：在指定的子树范围内测试匹配。

```js
export const myComponent = componentSpace.define()
  .template(wxml(`
    <div id="parent" class="container">
      <span id="child" class="item">Text</span>
    </div>
  `))
  .lifetime('attached', function () {
    const child = this.shadowRoot.querySelector('#child')
    // 在当前 Shadow Tree 内测试 child 是否匹配选择器
    const matched = this.shadowRoot.matchSelector('.container .item', child) // true
    const notMatched = this.shadowRoot.matchSelector('.other', child) // false
  })
  .registerComponent()
```

**静态方法**：不限定子树范围，在整棵树中测试匹配。

```js
// 不指定子树范围，在整棵树中测试
const matched = Element.matchSelector('.item', someElement)
```

两者的区别在于：实例方法只会在调用者所在的子树范围内进行匹配判断；静态方法则不限定范围，可以跨组件边界匹配。例如，使用实例方法时，如果目标节点不在调用者的子树中，即使选择器语法上匹配也会返回 `false` 。

## 使用 parseSelector 预解析选择器

如果需要对同一个选择器进行多次查询或匹配，可以使用 `Element.parseSelector` 将选择器字符串预先解析为一个 `ParsedSelector` 对象，避免重复解析的开销。

```js
// 预解析选择器
const selector = Element.parseSelector('#the-id.the-class')

// 可以复用 selector 进行多次查询和匹配
const node = this.shadowRoot.querySelector(selector)
const nodes = this.shadowRoot.querySelectorAll(selector)
const matched = this.shadowRoot.matchSelector(selector, someElement)
```

可通过 `isEmpty()` 方法判断解析结果是否为空（即选择器字符串是否合法）：

```js
const selector = Element.parseSelector('.-') // 不合法的选择器
selector.isEmpty() // true
```

`querySelector` 、 `querySelectorAll` 和 `matchSelector` 都接受字符串或 `ParsedSelector` 对象作为参数。当需要频繁使用同一选择器时，推荐先使用 `parseSelector` 预解析以获得更好的性能。
