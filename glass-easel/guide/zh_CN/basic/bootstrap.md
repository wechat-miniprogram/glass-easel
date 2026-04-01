# 启动与预编译

本文介绍如何在纯 HTML 环境启动 glass-easel 并渲染组件，以及如何在 node 环境中预编译模板字符串。

## 在纯 HTML 环境中渲染组件

在浏览器环境下，glass-easel 使用 `CurrentWindowBackendContext` 作为 DOM 渲染后端。以下是完整的启动流程。

> ⚠️ 注意：以下示例直接在浏览器使用了 `glass-easel-template-compiler`，需要在运行时加载 WASM 并编译模板字符串，这会带来额外的体积和性能开销。在生产环境中建议参考 [预编译指引](#在-node-环境中预编译模板) 提前编译模板。

### 1. 安装依赖

```sh
npm install glass-easel glass-easel-template-compiler
```

### 2. 定义组件

首先，定义一个组件（本例沿用 [快速入门](./quick_start.md) 中的计数器示例）：

```js
import * as glassEasel from "glass-easel"
import { wxml } from "glass-easel-template-compiler"

const componentSpace = glassEasel.getDefaultComponentSpace()

const Counter = componentSpace
  .define()
  .template(wxml(`
    <div class="counter">
      <div class="greeting">Hello Glass Easel!</div>
      <div class="count">{{ count }}</div>
      <button bind:tap="decrement">-</button>
      <button bind:tap="increment">+</button>
    </div>
  `))
  .data(() => ({
    count: 0,
  }))
  .init(({ setData, data, method }) => {
    const increment = method(() => {
      setData({ count: data.count + 1 })
    })

    const decrement = method(() => {
      setData({ count: data.count - 1 })
    })

    return { increment, decrement }
  })
  .registerComponent()
```

### 3. 创建后端上下文并连接事件

`CurrentWindowBackendContext` 是 glass-easel 内置的 DOM 后端，它会将浏览器原生事件转换为 glass-easel 事件：

```js
// create the DOM backend context
const backendContext = new glassEasel.CurrentWindowBackendContext()

// connect the backend event system to glass-easel
backendContext.onEvent(glassEasel.Event.triggerBackendEvent)
```

> 💡 `onEvent` 调用是必需的——它告诉后端如何将原生 DOM 事件转发给 glass-easel 的事件系统。如果不调用，模板中的 `bind:tap` 等事件绑定将不会生效。

### 4. 创建组件实例

使用 `Component.createWithContext` 在指定的后端上下文中创建组件实例：

```js
const rootComponent = glassEasel.Component.createWithContext(
  'root',          // tag name of the root element
  Counter,         // component definition
  backendContext,  // backend context
)
```

### 5. 挂载到页面

最后，将组件实例挂载到页面的 DOM 中。挂载方式是 **替换一个占位元素** ：

```js
// find placeholder element in the DOM
const placeholder = document.getElementById('app')

// mount the component by replacing the placeholder
glassEasel.Element.replaceDocumentElement(
  rootComponent,
  placeholder.parentNode,    // parent node in the backend
  placeholder,               // placeholder node to replace
)
```

挂载完成后，组件的 `attached` 生命周期会被触发，界面即可正常渲染和交互。

### 完整示例

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>glass-easel Demo</title>
</head>
<body>
  <div id="app"></div>
  <script type="module">
    import * as glassEasel from "glass-easel"
    import { wxml } from "glass-easel-template-compiler"

    // define the component
    const componentSpace = glassEasel.getDefaultComponentSpace()
    const Counter = componentSpace
      .define()
      .template(wxml(`
        <div class="counter">
          <div class="greeting">Hello Glass Easel!</div>
          <div class="count">{{ count }}</div>
          <button bind:tap="decrement">-</button>
          <button bind:tap="increment">+</button>
        </div>
      `))
      .data(() => ({
        count: 0,
      }))
      .init(({ setData, data, method }) => {
        const increment = method(() => {
          setData({ count: data.count + 1 })
        })
        const decrement = method(() => {
          setData({ count: data.count - 1 })
        })
        return { increment, decrement }
      })
      .registerComponent()

    // create the backend context and connect events
    const backendContext = new glassEasel.CurrentWindowBackendContext()
    backendContext.onEvent(glassEasel.Event.triggerBackendEvent)

    // create the root component
    const rootComponent = glassEasel.Component.createWithContext(
      'root',
      Counter,
      backendContext,
    )

    // mount to DOM
    const placeholder = document.getElementById('app')
    glassEasel.Element.replaceDocumentElement(
      rootComponent,
      placeholder.parentNode,
      placeholder,
    )
  </script>
</body>
</html>
```

## 在 Node 环境中预编译模板

在浏览器中，`wxml()` 函数通过内嵌的 WASM 编译器实时编译模板字符串。但在生产环境中，建议在 Node.js 构建阶段 **预编译模板** ，这样可以避免在运行时加载 WASM 编译器，减小包体积并提升启动性能。

预编译的核心思路是：在构建时调用 `wxml()` 函数编译模板，将编译结果直接内联到产物中，从而跳过运行时编译过程。

### 通过 Babel Macro 预编译

[babel-plugin-macros](https://github.com/kentcdodds/babel-plugin-macros) 是一个通用的 Babel 宏系统。利用它可以在 Babel 编译时执行 `wxml()` 函数，将模板字符串替换为编译后的结果对象。

#### 1. 安装依赖

```sh
npm install --save-dev babel-plugin-macros
```

#### 2. 配置 Babel

在 `.babelrc` 或 `babel.config.js` 中启用 `babel-plugin-macros`：

```json
{
  "plugins": ["macros"]
}
```

#### 3. 编写宏文件

在项目中创建一个宏文件 `wxml.macro.js`，在编译时调用 `glass-easel-template-compiler` 的 Node 版本编译模板：

```js
const { createMacro } = require("babel-plugin-macros")
const { TmplGroup } = require("glass-easel-template-compiler")

module.exports = createMacro(({ references, babel }) => {
  const { types: t } = babel

  references.default.forEach((referencePath) => {
    const callExpression = referencePath.parentPath
    if (!callExpression.isCallExpression()) return

    // extract template string from the first argument
    const arg = callExpression.get("arguments.0")
    let tmplStr
    if (arg.isStringLiteral()) {
      tmplStr = arg.node.value
    } else if (arg.isTemplateLiteral() && arg.node.expressions.length === 0) {
      tmplStr = arg.node.quasis.map((q) => q.value.raw).join("")
    } else {
      throw callExpression.buildCodeFrameError("wxml() argument must be a static string")
    }

    // compile the template
    const group = new TmplGroup()
    group.addTmpl("", tmplStr)
    const code = group.getTmplGenObjectGroups()
    group.free()

    // replace wxml(...) with the compiled object
    const compiled = `(function() { var g = ${code}; return { content: g[''] } })()`
    callExpression.replaceWithSourceString(compiled)
  })
})
```

#### 4. 在代码中使用

```js
import wxml from "./wxml.macro"

const Counter = componentSpace
  .define()
  .template(wxml(`
    <div class="counter">
      <div class="greeting">Hello Glass Easel!</div>
      <div class="count">{{ count }}</div>
      <button bind:tap="decrement">-</button>
      <button bind:tap="increment">+</button>
    </div>
  `))
  .data(() => ({ count: 0 }))
  .registerComponent()
```

Babel 编译时，`wxml(...)` 调用会被替换为编译后的模板对象，最终产物中不会包含 WASM 编译器。

### 通过 Webpack Loader 预编译

如果你的项目使用 Webpack 构建，可以编写一个自定义 Webpack Loader，在构建时将 `.wxml` 模板文件编译为 JavaScript 代码。

#### 1. 编写 Loader

创建 `wxml-loader.js`，在 Loader 中调用 `TmplGroup` 编译模板并输出为 JS 模块：

```js
// wxml-loader.js
const { TmplGroup } = require("glass-easel-template-compiler")

module.exports = function (source) {
  // create a template group and compile
  const group = new TmplGroup()
  const warnings = group.addTmpl("", source)
  const code = group.getTmplGenObjectGroups()
  group.free()

  // report compile warnings/errors
  for (const w of warnings) {
    if (w.isError) {
      this.emitError(new Error(`${w.message} (${w.startLine}:${w.startColumn})`))
    } else {
      this.emitWarning(new Error(`${w.message} (${w.startLine}:${w.startColumn})`))
    }
  }

  // export as a module: { content: <compiled template> }
  return `
    var g = ${code};
    module.exports = { content: g[''] };
  `
}
```

#### 2. 配置 Webpack

在 `webpack.config.js` 中注册该 Loader：

```js
const path = require("path")

module.exports = {
  // ...other config
  module: {
    rules: [
      {
        test: /\.wxml$/,
        use: path.resolve(__dirname, "wxml-loader.js"),
        exclude: /node_modules/,
      },
    ],
  },
}
```

#### 3. 在代码中使用

将模板放在单独的 `.wxml` 文件中，然后直接 `import` 即可获得编译后的模板对象：

```html
<!-- src/counter.wxml -->
<div class="counter">
  <div class="greeting">Hello Glass Easel!</div>
  <div class="count">{{ count }}</div>
  <button bind:tap="decrement">-</button>
  <button bind:tap="increment">+</button>
</div>
```

```js
import * as glassEasel from "glass-easel"
import counterTemplate from "./counter.wxml"

const componentSpace = glassEasel.getDefaultComponentSpace()
const Counter = componentSpace
  .define()
  .template(counterTemplate)  // use the pre-compiled template directly
  .data(() => ({ count: 0 }))
  .init(({ setData, data, method }) => {
    const increment = method(() => {
      setData({ count: data.count + 1 })
    })
    const decrement = method(() => {
      setData({ count: data.count - 1 })
    })
    return { increment, decrement }
  })
  .registerComponent()
```

Webpack 构建时，Loader 会自动将 `.wxml` 文件编译为 JavaScript 代码，最终产物中不会包含 WASM 编译器。

### 编译多个模板

`TmplGroup` 支持一次编译多个模板，编译后的模板之间可以通过 `<import>` 和 `<include>` 互相引用：

```js
const group = new TmplGroup()

// add multiple templates
group.addTmpl("components/counter", `
  <div class="counter">
    <div class="count">{{ count }}</div>
    <button bind:tap="increment">+</button>
  </div>
`)

group.addTmpl("pages/index", `
  <div class="page">
    <h1>My App</h1>
  </div>
`)

// compile all at once
const compiledCode = group.getTmplGenObjectGroups()
group.free()

// the result contains all templates
// genObjectGroupList["components/counter"]  -> counter template
// genObjectGroupList["pages/index"]         -> index page template
```

### Dev 模式

在开发阶段，可以使用 `TmplGroup.newDev()` 创建 dev 模式的模板组，它会在编译产物中包含额外的调试信息：

```js
const group = TmplGroup.newDev()
group.addTmpl("components/counter", templateString)
const compiledCode = group.getTmplGenObjectGroups()
group.free()
```

#### 错误处理

`addTmpl` 方法会返回一个包含编译警告和错误的数组，可以在构建时进行检查：

```js
const warnings = group.addTmpl("components/counter", templateString)
for (const w of warnings) {
  if (w.isError) {
    console.error(`ERROR ${w.path}:${w.startLine}:${w.startColumn} - ${w.message}`)
  } else {
    console.warn(`WARN ${w.path}:${w.startLine}:${w.startColumn} - ${w.message}`)
  }
}
```
