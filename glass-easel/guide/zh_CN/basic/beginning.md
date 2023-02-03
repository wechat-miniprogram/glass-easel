# 入门

glass-easel 将整个页面视为由 **组件** 组成的，组件间可以相互引用。

其中一个组件用于展示完整页面内容，称为 **根组件** 。在一个最简单的页面中，可以只有一个根组件。

每个组件大体上由三部分内容组成：模板、样式、脚本。

## 模板及其编译

模板就是包含 `{{ ... }}` 数据绑定的类 XML 代码。 glass-easel 模板遵循 WXML 语法。例如：

```xml
<div class="blue">
  <span>{{ hello }}</span>
</div>
```

模板需要预先使用 `glass-easel-template-compiler` 编译。这个编译器既可以通过 WebAssembly 的方式引入，也可以在构建期间调用。

如果是以 WebAssembly 方式引入，基本的调用方法是：

```js
import { TmplGroup } from 'glass-easel-template-compiler'
const compileTemplate = (src: string) => {
  const group = new TmplGroup()
  group.addTmpl('', src)
  const genObjectSrc = `return ${group.getTmplGenObjectGroups()}`
  group.free()
  const genObjectGroupList = (new Function(genObjectSrc))() as { [key: string]: any }
  return {
    content: genObjectGroupList[''],
  }
}
```

## 样式

样式就是一段 CSS 代码。例如：

```css
.blue {
  color: blue;
}
```

glass-easel 本身并不对 CSS 做过多处理，直接将其引入页面即可。

## 脚本

组件需要用一段 JavaScript 或 TypeScript 代码来定义出来。例如：

```js
// hello-world.js
import * as glassEasel from 'glass-easel'

// 定义一个组件空间
const componentSpace = new glassEasel.ComponentSpace()

// 组件模板
const template = `
  <div class="blue">
    <span>{{ hello }}</span>
  </div>
`

// 定义组件
export const helloWorld = componentSpace.defineComponent({
  // 组件所使用的模板
  template: compileTemplate(template),
  // 用在组件模板上的数据
  data: {
    hello: 'Hello world!'
  },
})
```

## 挂载

最后，在 DOM 环境下，需要一段启动脚本来将根组件 **挂载** 到页面内。例如：

```js
import * as glassEasel from 'glass-easel'
import { helloWorld } from './hello-world'

// 创建根组件实例
const domBackend = new glassEasel.domlikeBackend.CurrentWindowBackendContext()
const rootComponent = glassEasel.Component.createWithContext('body', helloWorld, domBackend)

// 将组件插入到 DOM 树中
const placeholder = document.createElement('span')
document.body.appendChild(placeholder)
glassEasel.Element.replaceDocumentElement(rootComponent, document.body, placeholder)
```
