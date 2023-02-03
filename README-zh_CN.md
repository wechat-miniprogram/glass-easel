![logo](./logo_256.png)

# glass-easel ：新版微信小程序组件框架

glass-easel 是小程序组件框架的核心实现。它实质上是一个 JavaScript 的组件化界面框架，用来进行组件化、定义式的界面开发。

glass-easel 是对旧版小程序组件框架的重写，保持对旧版小程序组件框架特性的兼容，并添加了一些新特性。它运行时并不依赖于小程序环境，可以独立运行在 web 或其他 JavaScript 环境下。

## 主要特点

glass-easel 可以让同样的组件代码运行在 web 、小程序等不同环境下。

**后端** 是 glass-easel 的一个重要概念，表示组件系统的运行环境。在 web 环境下运行时，后端是浏览器的 DOM 接口；在小程序环境下运行时，后端则是小程序环境接口。这使得（后端无关的）组件代码可以运行在不同环境下。

glass-easel 完整具备小程序自定义组件相关特性，如组件模板、通信与事件、生命周期等等。此外， glass-easel 还实现了一些实用的新特性，也具有更好的 TypeScript 支持。

glass-easel 采用单组件节点树更新算法（大体上沿用了旧版小程序组件框架的更新算法），具有均衡的性能表现，适合高度组件化开发。

## 各个子模块介绍

[glass-easel](./glass-easel) 是组件框架的核心模块，包含几乎所有特性实现。不过它的接口形式与小程序稍有差异，而更接近普通 JavaScript 模块接口。

[glass-easel-miniprogram-adapter](./glass-easel-miniprogram-adapter) 是对核心模块的一个接口适配器，使核心模块的对外接口与小程序自定义组件接口一致。 [glass-easel-miniprogram-webpack-plugin](./glass-easel-miniprogram-webpack-plugin) 是配合一起使用的 Webpack 插件。通过这两个模块，就可以采用 WXML 、 WXSS 、 JS 三类文件来组织代码，使项目结构与小程序项目相仿。

如果你想要在 web 和小程序项目间共享代码，推荐联合使用上面几个模块。如果你想根据自己的需要来做接口适配器和构建工具插件，也可以只使用 glass-easel 核心模块。

[glass-easel-template-compiler](./glass-easel-template-compiler) 是模板编译器，它将 WXML 语法的模板编译成 JS 代码。

[glass-easel-stylesheet-compiler](./glass-easel-stylesheet-compiler) 是样式表编译器，它将 WXSS 语法的样式表编译成 CSS 代码。如果项目中用到了部分样式特性，就需要用到它。

需要注意的是，上述两个 compiler 是使用 rust 语言编写的。若尝试自行编译这两个模块，需要安装 [rust](https://www.rust-lang.org/) 和 [wasm-pack](https://rustwasm.github.io/wasm-pack/) 。

| 子模块名                               | 编程语言   | 说明                                                             |
| -------------------------------------- | ---------- | ---------------------------------------------------------------- |
| glass-easel                            | TypeScript | 组件框架核心模块                                                 |
| glass-easel-miniprogram-adapter        | TypeScript | 在非小程序环境下模仿小程序的接口适配器                           |
| glass-easel-miniprogram-webpack-plugin | JavaScript | 简易的 Webpack 插件（配合 glass-easel-miniprogram-adapter 使用） |
| glass-easel-template-compiler          | rust       | 模板编译器                                                       |
| glass-easel-stylesheet-compiler        | rust       | 样式表编译器                                                     |

## 入门指引

与普通的 npm 包类似，安装你需要用到的子模块即可。例如：

```sh
npm install --save glass-easel
npm install --save-dev glass-easel-template-compiler
```

如果想要了解核心模块的具体特性，可以阅读 [guide](./glass-easel/guide/zh_CN/index.md) 。

glass-easel-miniprogram-adapter 接口与 [小程序自定义组件](https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/) 接口一致。
[glass-easel-miniprogram-template](./glass-easel-miniprogram-template) 是一个供参考的项目模板。

此外， TypeScript 编写的子模块支持 TSDoc ，可以在子模块代码目录中通过 `npm run doc` 来生成详细的接口文档（生成好的文档位于 `docs` 子目录中）； rust 编写的子模块，则可以通过 `cargo doc` 来生成详细的接口文档（与普通 rust crate 类似）。

## 常见问题

### 这个模块是小程序 SDK 的一部分吗？

就各个子模块而言：

- `glass-easel` 是小程序 SDK 运行时的一部分；
- `glass-easel-template-compiler` 和 `glass-easel-stylesheet-compiler` 是小程序 SDK 编译器的一部分；
- `glass-easel-miniprogram-adapter` 和 `glass-easel-miniprogram-webpack-plugin` 不是小程序 SDK 的一部分，它们是为了在 web 环境下模仿小程序接口而设计的。

不过，目前小程序代码还不能用到任何 glass-easel 子模块，因为我们还在确认整体接口的稳定性和兼容性。足够稳定后，小程序代码将可以选择使用 glass-easel 作为小程序的组件框架实现。

### 这个模块未包含小程序的组件实现？

是的。这个模块只是组件框架本身，而不包含 `<view />` `<image />` 等小程序组件实现。

小程序的各个组件实现非常复杂、代码量大、与微信的环境接口耦合比较深，不能将小程序的组件代码直接复用到 web 环境下。

未来我们会考虑提供常用组件、常用特性的等价 web 实现。

### glass-easel 的部分特性在小程序中不可用？

glass-easel 实现的一部分新特性是我们计划未来在小程序上推出的特性。

还有一部分高级特性，如自定义后端、自定义模板引擎、外部组件等，受限于小程序的特殊后端环境和小程序环境的一些安全策略，无法在小程序代码中使用。如果你在编写需要在 web 和小程序项目间共享的代码，请以小程序自定义组件的接口为参考，避免用到这些受限特性。

### glass-easel 与旧版小程序组件框架有什么差异？

glass-easel 包含了全部旧版小程序组件框架的特性，保持了 99% 的接口兼容性。但因为它是对旧版组件框架的完全重写，不可避免会有一些细微的接口表现差异。因此在它正式开放之前，我们还需要一些时间来观察和打磨。

glass-easel 还实现了一些新特性，未来将在小程序上可用。

## 欢迎参与开发改进！

我们欢迎各种 bug 反馈和特性建议！

但请注意 glass-easel 只是小程序 SDK 中的组件框架部分（一个很小的部分，大体上对应于小程序文档中的“自定义组件”一章）。对于小程序其他部分的反馈，请前往 [微信开放社区](https://developers.weixin.qq.com/) 。

如果想通过 Pull request 来为小程序 SDK 添加新特性，请先和我们联系，以确认这个特性确实应该是 glass-easel 的特性、而不应是由小程序 SDK 其他模块来实现的部分。

代码仓库管理方面：位于 GitHub 的仓库是主仓库。（出于集团信息安全方面的要求，项目开源前的 git 历史未在主仓库中保留，但开源后的会完整保留。）

如果想要了解我们正在实现的新特性，请查看 [Road Map](https://github.com/wechat-miniprogram/glass-easel/milestones) 。

## LICENSE

Copyright 2023 wechat-miniprogram

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
