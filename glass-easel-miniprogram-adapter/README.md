# glass-easel-miniprogram-adapter

An MiniProgram interface adapter for glass-easel, which exports a mini-program-like API, such as `Component` and `Behavior` .

Refer to the [glass-easel](https://github.com/wechat-miniprogram/glass-easel) project for further details.

## Build

`nodejs` toolchain should be globally installed.

Install dependencies:

```sh
npm install
```

Build:

```sh
npm run build
```

Build Doc:

```sh
npm run doc
```

Test:

```sh
npm test
```

Test coverage:

```sh
npm run coverage
```

## Limitations

Supported component API is a subset of mini-program API. See `docs` and mini-program docs for details.

Style isolation support is also limited.

* The `component: true` in JSON files should only be used in components, not pages (this influences the default style isolation settings).
* The `styleIsolation` options should be specified in JSON files, not JS `Component` options.
* Please work with [glass-easel-miniprogram-webpack-plugin](../glass-easel-miniprogram-webpack-plugin/) so that WXSS content can be correctly handled.
