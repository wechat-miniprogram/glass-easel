# 构建参数

glass-easel 的构建脚本会根据 `GLASS_EASEL_ARGS` 环境变量来构建出不同的结果。

## 构建模式

构建模式会决定构建产物的文件名（位于 dist 目录下）以及不同的 [自定义后端](custom_backend.md) 支持度。目前支持的构建模式如下。

| 构建模式 | 文件名 | 支持的自定义后端 | 产物格式 |
| -------- | ------ | ---------------- | ------------ |
| all | glass_easel.all.js | 支持全部后端（运行时自动选择） | CommonJS |
| all-es | glass_easel.all.es.js | 支持全部后端（运行时自动选择） | ES Module |
| all-global | glass_easel.all.global.js | 支持全部后端（运行时自动选择） | 全局变量（IIFE） |
| shadow | glass_easel.shadow.js | 支持 shadow 模式后端 | CommonJS |
| shadow-es | glass_easel.shadow.es.js | 支持 shadow 模式后端 | ES Module |
| shadow-global | glass_easel.shadow.global.js | 支持 shadow 模式后端 | 全局变量（IIFE） |
| composed | glass_easel.composed.js | 支持 composed 模式后端 | CommonJS |
| composed-es | glass_easel.composed.es.js | 支持 composed 模式后端 | ES Module |
| composed-global | glass_easel.composed.global.js | 支持 composed 模式后端 | 全局变量（IIFE） |
| domlike | glass_easel.domlike.js | 支持 DOM 后端 | CommonJS |
| domlike-es | glass_easel.domlike.es.js | 支持 DOM 后端 | ES Module |
| domlike-global | glass_easel.domlike.global.js | 支持 DOM 后端 | 全局变量（IIFE） |

一次可以同时启用多个构建模式。

在启用 `--dev` 时，产物文件名会加入 `.dev.` 前缀，例如 `glass_easel.dev.all.es.js` 。

## 额外参数

额外参数可以修饰构建结果：

* `--no-minimize` 禁用代码压缩混淆（默认启用压缩）；
* `--dev` 激活 development 构建模式，同时会自动禁用压缩和 sourcemap 。

## 默认行为

当 `GLASS_EASEL_ARGS` 未设置或为空时：

* **非 dev 模式（默认）** ：会构建以下 5 个产物：
  * `glass_easel.all.js`（CommonJS）
  * `glass_easel.all.es.js`（ES Module）
  * `glass_easel.dev.all.es.js`（ES Module，dev）
  * `glass_easel.all.global.js`（IIFE）
  * `glass_easel.dev.all.global.js`（IIFE，dev）
* **dev 模式**（通过 `npm run dev` 或 `GLASS_EASEL_ARGS=--dev`）：只构建 `glass_easel.dev.all.es.js`（ES Module，dev）。

## 导入行为

```js
// Node.js 中使用 require() 时，加载 CommonJS 产物：
//   → dist/glass_easel.all.js
const glassEasel = require('glass-easel')

// 打包工具（Rollup、webpack、Vite 等）处理 import 时，优先加载 ES Module 产物：
//   → dist/glass_easel.all.es.js
import * as glassEasel from 'glass-easel'
```

这些入口指向 `all` 和 `all-es` 模式的产物。如果通过 `GLASS_EASEL_ARGS` 自定义了构建模式但未包含 `all` 和 `all-es`，则这些入口文件不会被构建出来，可能导致导入失败。

## 示例

如果想要构建出支持全部后端和全局量模式 DOM 后端的两种构建结果、同时禁用代码压缩混淆，则 `GLASS_EASEL_ARGS` 环境变量应设为：

```
all domlike-global --no-minimize
```
