# glass-easel-miniprogram-webpack-plugin

The webpack plugin for building mini-program code running in glass-easel.

Refer to the [glass-easel](https://github.com/wechat-miniprogram/glass-easel) project for further details.

## Usage

See the [template](../glass-easel-miniprogram-template/).

## Custom Bootstrap

By default, the plugin inserts a bootstrap code to insert the `defaultEntry` into DOM `<body>` 。

However, if the backend is not DOM or you want to bootstrap manually, set the `customBootstrap` option to `true` .

```js
new GlassEaselMiniprogramWebpackPlugin({
  customBootstrap: true,
})
```

Furthermore, if the backend handles stylesheets unlike DOM, another `disableClassPrefix` may be required to be `true` depending on the backend.
