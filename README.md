<p align="center">
  <img src="https://github.com/wechat-miniprogram/glass-easel/blob/master/logo_256.png" style="width: 128px" />
</p>

# glass-easel

the new component-based framework for WeChat MiniProgram

![npm](https://img.shields.io/npm/v/glass-easel?style=flat-square) ![crates.io](https://img.shields.io/crates/v/glass-easel-template-compiler?style=flat-square)

[中文版 README](./README-zh_CN.md)

_glass-easel_ is the new implementation of the component management framework for WeChat MiniProgram.
Exactly, it is a JavaScript component-based UI framework, designed to component-based and declarative UI development.

_glass-easel_ is a rewrite of the legacy framework.
It keeps the feature-level compatibilities, while some new features are added.
The framework runtime does not require specific MiniProgram environment,
which means it can be executed in web or other JavaScript environments.

## Major Features

_glass-easel_ allows the same component code executed in different environments, i.e. in both web and MiniProgram environments.

_Backend_ is an important concept, which represents the current environment of the framework runtime.
When executed in browser, the backend is the DOM interface;
in MiniProgram, the backend is the MiniProgram environment interface.

_glass-easel_ contains the full implementation of custom components in MiniProgram, including templates, events, lifetimes, etc.
Furthermore, _glass-easel_ implements some extra practical features, and has better TypeScript support.

_glass-easel_ uses a per-component tree-update algorithm (as the legacy framework), which has a balanced performance for different cases.
This algorithm suits highly component-based programing.

## Introduction for each Submodule

[glass-easel](./glass-easel) is the core module that implements almost all features.
However, its interface has some difference from the MiniProgram interface, but looks more like common JavaScript modules.

[glass-easel-miniprogram-adapter](./glass-easel-miniprogram-adapter) is an interface adapter,
which makes the core module interface more similar to the MiniProgram interface.
[glass-easel-miniprogram-webpack-plugin](./glass-easel-miniprogram-webpack-plugin) is the Webpack plugin working with the adapter.
These two modules allows the use of WXML/WXSS/JS component files, just like the project directory structure of MiniProgram.

If you want to share code between web and MiniProgram environments, it is suggested to use all three modules above.
If you decide to write the adapter or the build tools by yourself, the core module is enough.

[glass-easel-template-compiler](./glass-easel-template-compiler) is the template compiler, which compiles WXML segments to JavaScript code.

[glass-easel-stylesheet-compiler](./glass-easel-stylesheet-compiler) is the stylesheet compiler, which compiles WXSS segments to CSS code.
If your code requires some style-related features, this module is needed.

Note that the two compilers are implemented in rust.
If you try to compile them, [rust](https://www.rust-lang.org/) 和 [wasm-pack](https://rustwasm.github.io/wasm-pack/) should be installed in your machine.

| Submodule Name                         | Language   | Description                                |
| -------------------------------------- | ---------- | ------------------------------------------ |
| glass-easel                            | TypeScript | The core module                            |
| glass-easel-miniprogram-adapter        | TypeScript | The MiniProgram interface adapter          |
| glass-easel-miniprogram-webpack-plugin | JavaScript | The Webpack plugin (work with the adapter) |
| glass-easel-template-compiler          | rust       | The template compiler                      |
| glass-easel-stylesheet-compiler        | rust       | The stylesheet compiler                    |

## Guides for Users

Like common npm packages, each submodule can be installed as you need. For example:

```sh
npm install --save glass-easel
npm install --save-dev glass-easel-template-compiler
```

The interface of [glass-easel-miniprogram-adapter](./glass-easel-miniprogram-adapter) is the same as the custom component interface of MiniProgram.
[glass-easel-miniprogram-template](./glass-easel-miniprogram-template) is a project template.

Furthermore, TypeScript modules contains TSDoc documents, which can be built with `npm run doc` (generated documents are in the `docs` directory); rust module documents can be retrived through `cargo doc` (like common rust crates).

## F.A.Q.

### Is this module a part of the MiniProgram SDK?

For each submodule:

- _glass-easel_ is a part of the MiniProgram runtime;
- _glass-easel-template-compiler_ and _glass-easel-stylesheet-compiler_ are parts of the MiniProgram compiler;
- _glass-easel-miniprogram-adapter_ and _glass-easel-miniprogram-webpack-plugin_ are not, because they are designed for simulation on web environments.

However, no MiniProgram code can use any _glass-easel_ submodules currently, because we are still checking the interface stabilities and compatibilities. When stable enough, MiniProgram code will be able to use _glass-easel_ as the framework implementation.

### Does this module contain implementation of MiniProgram components?

No. This module is the framework itself. Components like `<view />` `<image />` are not included.

This is because the implamentation of the components are complex and deeply coupled with WeChat environment interfaces. We cannot simply reuse the code in web environments.

We will consider do another implementation on web in future.

### Are some features unavailable in MiniProgram environments?

Some features of _glass-easel_ are designed as new features, which will be available in MiniProgram environments.

However, some advanced features - like custom backend, custom template engine, external components, etc. - are impossible to use in MiniProgram code, because of the special environment limitation and some security strategies. If you are writing code that shares between web and MiniProgram, please refer to the _custom components_ interface of MiniProgram and avoid the use of these unavailable features.

### What are the differences between _glass-easel_ and the legacy framework?

_glass-easel_ contains all features of the legacy framework, and has 99% interface compatibilities.
However, it is still a complete rewrite, which means some interface behaviors are not equivalent.
Before _glass-easel_ is formally available in the MiniProgram environment, we are trying to get better compatibilities.

_glass-easel_ has some new features which will be available in MiniProgram.

## Help us to Improve!

Bug reports and feature requests are welcomed!

Please note that _glass-easel_ is only a small part of the MiniProgram SDK (generally the custom components part of it).

If you are trying to implement a new feature for the MiniProgram SDK, please contact us to confirm the feature should be a part of _glass-easel_ (but not other modules of the MiniProgram SDK).

The GitHub repository is the main repository of this project.

If you are interested in new features that we are still implementing, refer to the [Road Map](https://github.com/wechat-miniprogram/glass-easel/milestones).

## LICENSE

Copyright 2023 wechat-miniprogram

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
