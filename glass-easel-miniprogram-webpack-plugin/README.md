# glass-easel-miniprogram-webpack-plugin

The webpack plugin for building mini-program code running in glass-easel.

Refer to the [glass-easel](https://github.com/wechat-miniprogram/glass-easel) project for further details.

## Usage

See the [template](../glass-easel-miniprogram-template/).

The `GlassEaselMiniprogramWxmlLoader` loader must be added to handle `.wxml` files, and the `GlassEaselMiniprogramWxssLoader` loader must be added to handle `.wxss` files. They can work with other loaders.

```js
{
  test: /\.wxml$/,
  use: GlassEaselMiniprogramWxmlLoader,
  exclude: /node_modules/,
},
{
  test: /\.wxss$/,
  use: [
    'css-loader',
    GlassEaselMiniprogramWxssLoader,
  ],
  exclude: /node_modules/,
},
```

Furthurmore, a webpack plugin that compiles a mini-program-like directory structure should be added. The directory should be specified in the plugin options.

```js
plugins: [
  new GlassEaselMiniprogramWebpackPlugin({
    path: path.join(__dirname, 'src'),
    resourceFilePattern: /\.(jpg|jpeg|png|gif|html)$/,
    defaultEntry: 'pages/index/index',
  }),
],
```

| Options | Explanation |
| ------- | ----------- |
| path | the mini-program-like directory to be compiled (default to `src` ) |
| resourceFilePattern | the filename pattern (in the mini-program-like directory) to be copied into the webpack output path |
| defaultEntry | the mini-program page to be loaded on startup |
| customBootstrap | (see the *Custom Bootstrap* section below) |
| disableClassPrefix | (see the *Custom Bootstrap* section below) |

The plugin will generate a virtual `index.js` file in the mini-program-like directory (a.k.a. `src/index.js` by default). This file can be used as the webpack entry or be imported by other modules.

## Custom Bootstrap

By default, the plugin inserts a bootstrap code to insert the `defaultEntry` into DOM `<body>` 。

However, if the backend is not DOM or you want to bootstrap manually, set the `customBootstrap` option to `true` .

```js
new GlassEaselMiniprogramWebpackPlugin({
  customBootstrap: true,
})
```

Furthermore, if the backend handles stylesheets unlike DOM, another `disableClassPrefix` may be required to be `true` depending on the backend.

When using custom bootstrap, the plugin will generate a module which has the following types: 

```ts
import type * as adapter from 'glass-easel-miniprogram-adapter'

export declare const env: adapter.MiniProgramEnv
export declare const codeSpace: adapter.CodeSpace
export declare const registerGlobalEventListener: (
  backend: adapter.glassEasel.GeneralBackendContext,
) => void
export declare const initWithBackend: (
  backend: adapter.glassEasel.GeneralBackendContext,
) => adapter.AssociatedBackend
```

You can put the code above into a `d.ts` file ( `src.d.ts` by default).

A page can be loaded like this:

```js
import * as glassEasel from 'glass-easel'
import { codeSpace, initWithBackend, registerGlobalEventListener } from './src' // import the plugin-generated code

// create the backend context
const backendContext = new glassEasel.CurrentWindowBackendContext() // or another backend context
registerGlobalEventListener(backendContext)
const ab = initWithBackend(backendContext)

// create a mini-program page
const root = ab.createRoot(
  'glass-easel-root', // the tag name of the mount point
  codeSpace,
  'pages/index/index', // the mini-program page to load
)

// insert the page into backend
// (this step is backend-related - if the backend is not DOM, refer to the backend documentation)
const placeholder = document.createElement('span')
document.body.appendChild(placeholder)
root.attach(
  document.body as unknown as glassEasel.GeneralBackendElement,
  placeholder as unknown as glassEasel.GeneralBackendElement,
)
```
