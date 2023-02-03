# glass-easel-stylesheet-compiler

The stylesheet compiler for the glass-easel project.

This tool can help:

* convert `rpx` to `vw` ;
* work with style isolation options through class-prefixes;
* minify the output CSS.

Refer to the [glass-easel](https://github.com/wechat-miniprogram/glass-easel) project for further details.

## Build

`rust` toolchain and `wasm-pack` should be globally installed.

Build WebAssembly binary:

```sh
wasm-pack build glass-easel-stylesheet-compiler --target nodejs --out-dir pkg-nodejs
```

Build binary:

```sh
cargo build --release
```

## JavaScript Interface

This tool can be used in webpack, i.e. [glass-easel-miniprogram-webpack-plugin](../glass-easel-miniprogram-webpack-plugin/) .

However, if you want to call it directly, see the example below.

```js
const { StyleSheetTransformer } = require('glass-easel-stylesheet-compiler')

// convert a CSS file
const rpxRatio = 750
const sst = new StyleSheetTransformer(PATH, CONTENT, CLASS_PREFIX, rpxRatio)

// get the CSS output
const ss = sst.getContent()

// get the source map if needed
sst.toSourceMap()

// free it if the source map is not required
sst.free()
```
