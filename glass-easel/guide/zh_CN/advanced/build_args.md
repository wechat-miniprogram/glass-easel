# 构建参数

glass-easel 的构建脚本会根据 `GLASS_EASEL_ARGS` 环境变量来构建出不同的结果。

首先，构建模式会决定构建产物的文件名（位于 dist 目录下）以及不同的 [自定义后端](custom_backend.md) 支持度。目前支持的构建模式如下。

| 构建模式 | 文件名 | 支持的自定义后端 | 产物使用方式 |
| -------- | ------ | ---------------- | ------------ |
| all | glass_easel.all | 支持全部后端（运行时自动选择） | CommonJS |
| shadow | glass_easel.shadow | 支持 shadow 模式后端 | CommonJS |
| shadow-global | glass_easel.shadow.global | 支持 shadow 模式后端 | 全局变量 |
| composed | glass_easel.composed | 支持 composed 模式后端 | CommonJS |
| composed-global | glass_easel.composed.global | 支持 composed 模式后端 | 全局变量 |
| domlike | glass_easel.domlike | 支持 DOM 后端 | CommonJS |
| domlike-global | glass_easel.domlike.global | 支持 DOM 后端 | 全局变量 |

一次可以同时启用多个构建模式。在 node.js 和打包工具中，第一个构建模式会视为被 import 时采用的构建结果。

额外参数可以修饰构建结果：

* `--minimize` / `--no-minimize` 可以启用、禁用代码压缩混淆；
* `--dev` 可以激活 development 构建模式。

例如，如果想要构建出支持全部后端和全局量模式 DOM 后端的两种构建结果、同时禁用代码压缩混淆，则 `GLASS_EASEL_ARGS` 环境变量应设为：

```
all domlike-global --no-minimize
```
