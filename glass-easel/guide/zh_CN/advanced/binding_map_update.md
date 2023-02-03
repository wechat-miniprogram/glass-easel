# 绑定映射表更新

glass-easel 内置的模板引擎支持两种更新方式。

* 虚拟树更新：更新时，遍历需要更新的 Shadow Tree ，并更新变化了的数据绑定；
* 绑定映射表更新：更新时，根据改变的数据字段名、找到用到了该字段数据绑定表达式，然后更新它。

绑定映射表更新通常是一种更快速高效的更新方式，但它不能用于更新 `wx:if` `wx:for` 子节点树内部用到的数据字段。

每次更新时， glass-easel 会根据被设置的数据字段名，来选择应该使用哪种更新方式。

如果想要指定只其中一种更新方式，可以在编译模板时控制：

```js
const compileTemplate = (src: string, updateMode = '') => {
  const group = new TmplGroup()
  group.addTmpl('', src)
  const genObjectSrc = `return ${group.getTmplGenObjectGroups()}`
  group.free()
  const genObjectGroupList = (new Function(genObjectSrc))() as { [key: string]: any }
  return {
    content: genObjectGroupList[''],
    updateMode,
  }
}
// 指定模板只使用虚拟树更新
compileTemplate('<div />', 'virtualTree')
// 指定模板只使用绑定映射表更新
compileTemplate('<div />', 'bindingMap')
```

注意：在不支持的模板上强行只使用绑定映射表更新，会导致出错或更新异常。
