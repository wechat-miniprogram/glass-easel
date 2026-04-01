# 纯数据字段

通过组件选项 `pureDataPattern` 可以将部分数据字段排除在模板渲染之外。该选项接受一个正则表达式，匹配该正则表达式的字段名将不会参与模板渲染。

```js
export const myComponent = componentSpace.define()
  .options({
    // 所有以 _ 开头的字段都不能用于模板
    pureDataPattern: /^_/,
  })
  // 纯数据字段在模板中将被视为 undefined
  .template(wxml(`
    <div>{{ _a }}</div>
  `))
  .data(() => ({
    _a: 1,
  }))
  .registerComponent()
```

使用 `pureDataPattern` 通常不会带来性能影响。但如果通过 `dataDeepCopy` 禁用了数据深拷贝，`pureDataPattern` 仍可能引入部分数据拷贝开销。
