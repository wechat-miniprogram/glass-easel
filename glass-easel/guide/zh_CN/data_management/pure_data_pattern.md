# 纯数据字段

通过组件选项 `pureDataPattern` 可以使得一些数据字段不能用于模板上。这个选项接受一个正则表达式，符合这个正则表达式的字段名不能用于模板。

```js
export const myComponent = componentSpace.defineComponent({
  options: {
    // 所有以 _ 开头的字段都不能用于模板
    pureDataPattern: /^_/,
  },
  // 模板上的纯数据字段将视为 undefined
  template: compileTemplate(`
    <div>{{ _a }}</div>
  `),
  data: {
    _a: 1,
  },
})
```

使用 `pureDataPattern` 通常不会带来性能方面的影响。但如果通过 `dataDeepCopy` 禁用数据拷贝， `pureDataPattern` 可能仍然会带来部分数据拷贝开销。
