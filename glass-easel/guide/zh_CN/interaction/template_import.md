# 模板引用

## 模板片段

模板中可以使用 `<template>` 来提取一些公共的模板片段。

其中， `<template name="...">` 可以用来定义模板片段，片段中可以使用数据绑定，例如：

```xml
<template name="shared-template-slice">
  <div> {{ a }} + {{ b }} = {{ c }} </div>
</template>
```

而 `<template is="...">` 可以用来引用模板片段，引用时需要指定数据绑定，例如：

```xml
<template is="shared-template-slice" data="{{ a: 1, b: 2 }}"></template>
```

注意， `data="{{ }}"` 内部就是一个对象形式定义。

## 跨组件的模板片段

如果需要在多个组件中使用同一个模板片段，则需要调整模板编译方式。

在模板编译时，首先需要创建一个 `TmplGroup` 对象。这个对象可以同时管理多个路径的模板代码，例如：

```js
import { TmplGroup } from 'glass-easel-template-compiler'

const group = new TmplGroup()

// 添加一个模板路径及其对应的模板内容
group.addTmpl('path/to/a/component', `
  <div> text in a template </div>
`)

// 添加另一个模板路径及其对应的模板内容
group.addTmpl('path/to/another/component', `
  <div> text in another template </div>
`)

// 生成模板编译结果
const genObjectSrc = `return ${group.getTmplGenObjectGroups()}`
const genObjectGroupList = (new Function(genObjectSrc))() as { [key: string]: any }
group.free()

// 从编译结果中提取指定路径的模板
const templateForAComponent = {
  groupList: genObjectGroupList,
  content: genObjectGroupList['path/to/a/template'],
}
const templateForAnotherComponent = {
  groupList: genObjectGroupList,
  content: genObjectGroupList['path/to/another/template'],
}
```

这样，可以使用一个独立的模板路径来存放公共的模板片段，例如：

```js
group.addTmpl('path/to/shared', `
  <template name="shared-template-slice">
    <div> {{ a }} + {{ b }} = {{ c }} </div>
  </template>
`)
```

在其他路径的模板中，可以使用 `<import>` 引入模板片段：

```js
group.addTmpl('path/to/a/component', `
  <import src="../shared" />

  <template is="shared-template-slice" data="{{ a: 1, b: 2 }}" />
`)
```

## 模板文件引入

在引用其他路径的模板时，也可以使用 `<include>` 直接将整个模板文件内容嵌入到当前位置上，例如：

```js
group.addTmpl('path/to/shared', `
  <div> some text in shared template </div>
`)

group.addTmpl('path/to/a/component', `
  <div>
    <include src="../shared" />
  </div>
`)
```

## 嵌入 JavaScript 代码

在编译多个模板的同时，可以嵌入若干段 JavaScript 代码，与模板一同生成编译结果。

嵌入的每段 JavaScript 代码都必须是一个合法的 JavaScript 文件内容，并需要为它指定一个路径。例如：

```js
group.addScript('path/to/script', `
  // JavaScript 文件内容
`)
```

代码中可以访问 `require` 和 `exports` 。类似于 Node.js ， `require` 用于导入其他路径的代码， `exports` 用于导出。例如：

```js
exports.hello = function () {
  return 'Hello!'
}
```

在模板文件中，可以通过 `<wxs>` 来引用指定路径对应的 JavaScript 代码，并将这个 JavaScript 函数的返回值作为 wxs module 值。例如：

```xml
<wxs module="helloModule" src="/path/to/script" />
```

这样，模板中的数据绑定表达式中就可以访问 `helloModule` 变量（它的值就是对应 JavaScript 函数的导出）。

```xml
<wxs module="helloModule" src="/path/to/script" />
<div> {{ helloModule.hello() }} </div>
```

此外， `<wxs>` 也可以不使用 `src` 引入，而是直接将 JavaScript 代码内联在 `<wxs>` 内部。

## 模板全局 JavaScript 代码

除了按路径嵌入的 JavaScript 代码，还可以添加一段全局 JavaScript 代码。

```js
group.addExtraRuntimeScript(`
  // JavaScript 代码
  // ...
`)
```

这段代码无论如何都会执行，它可以定义一些全局量供所有其他 JavaScript 代码使用，但这些全局量无法被模板中的数据绑定表达式直接访问到。
