# glass-easel-template-compiler

The template compiler for the glass-easel project.

Refer to the [glass-easel](https://github.com/wechat-miniprogram/glass-easel) project for further details.

## Build

`rust` toolchain and `wasm-pack` should be globally installed.

Build WebAssembly binary:

```sh
wasm-pack build glass-easel-template-compiler --target nodejs --out-dir pkg-nodejs
```

Build binary:

```sh
cargo build --release
```

Build for simple browser usage:

```sh
wasm-pack build glass-easel-template-compiler --target no-modules --out-dir pkg-web
```

See the main project for the detailed usage.
