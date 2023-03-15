/* eslint-disable */

const path = require('path')
const webpack = require('webpack')
const { RawSource } = require('webpack-sources')

const jobs = []
let mainJobOutput = null
let minimize = null
let dev = false
const args = process.env['GLASS_EASEL_ARGS'] || ''
args.split(' ').forEach((arg) => {
  if (!arg) return
  if (arg[0] === '-') {
    if (arg === '--minimize') minimize = true
    else if (arg === '--no-minimize') minimize = false
    else if (arg === '--dev') dev = true
  } else {
    jobs.push(arg)
  }
})

const genOutputName = (jobExt) => `glass_easel.${jobExt}${dev ? '.dev' : ''}.js`

const mode = dev ? 'development' : 'production'

const rules = [
  {
    test: /\.ts$/,
    loader: 'ts-loader',
    exclude: /node_modules/,
  },
]

const optimization = {
  minimize: minimize === null ? undefined : minimize,
}

const devtool = 'source-map'

const resolve = {
  extensions: ['.ts', '.js'],
}

const performance = {
  maxEntrypointSize: 512000,
  maxAssetSize: 512000,
}

class BundleDeclarationEntrancePlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap(
      'BundleDeclarationEntrancePlugin',
      (compilation, compilationParams) => {
        compilation.hooks.additionalAssets.tapPromise('ExtraAssetPlugin', async () => {
          Object.keys(compilation.assets).forEach((file) => {
            if (file.endsWith('.js')) {
              const dtsFile = file.replace(/\.js$/, '.d.ts')
              compilation.assets[dtsFile] = new RawSource('export * from "./types/src/index"')
            }
          })
          if (mainJobOutput) {
            compilation.assets['index.js'] = new RawSource(
              `module.exports = require('./${mainJobOutput}')`,
            )
            compilation.assets['index.d.ts'] = new RawSource(`export * from "./${mainJobOutput}"`)
          }
        })
      },
    )
  }
}

const globalPlugins = [new BundleDeclarationEntrancePlugin()]

const allCompilation = {
  mode,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: genOutputName('all'),
    libraryTarget: 'commonjs2',
  },
  optimization,
  devtool,
  module: {
    rules,
  },
  resolve,
  performance,
  plugins: [
    new webpack.DefinePlugin({
      'BM.DYNAMIC': true,
      'BM.SHADOW': false,
      'BM.COMPOSED': false,
      'BM.DOMLIKE': false,
    }),
    ...globalPlugins,
  ],
}

const shadowCompilation = {
  mode,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: genOutputName('shadow'),
    libraryTarget: 'commonjs2',
  },
  optimization,
  devtool,
  module: {
    rules,
  },
  resolve,
  performance,
  plugins: [
    new webpack.DefinePlugin({
      'BM.DYNAMIC': false,
      'BM.SHADOW': true,
      'BM.COMPOSED': false,
      'BM.DOMLIKE': false,
    }),
    ...globalPlugins,
  ],
}

const shadowGlobalCompilation = {
  mode,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: genOutputName('shadow.global'),
    libraryTarget: 'var',
    library: 'glassEasel',
  },
  optimization,
  devtool,
  module: {
    rules,
  },
  resolve,
  performance,
  plugins: [
    new webpack.DefinePlugin({
      'BM.DYNAMIC': false,
      'BM.SHADOW': true,
      'BM.COMPOSED': false,
      'BM.DOMLIKE': false,
    }),
    ...globalPlugins,
  ],
}

const composedCompilation = {
  mode,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: genOutputName('composed'),
    libraryTarget: 'commonjs2',
  },
  optimization,
  devtool,
  module: {
    rules,
  },
  resolve,
  performance,
  plugins: [
    new webpack.DefinePlugin({
      'BM.DYNAMIC': false,
      'BM.SHADOW': false,
      'BM.COMPOSED': true,
      'BM.DOMLIKE': false,
    }),
    ...globalPlugins,
  ],
}

const composedGlobalCompilation = {
  mode,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: genOutputName('composed.global'),
    libraryTarget: 'var',
    library: 'glassEasel',
  },
  optimization,
  devtool,
  module: {
    rules,
  },
  resolve,
  performance,
  plugins: [
    new webpack.DefinePlugin({
      'BM.DYNAMIC': false,
      'BM.SHADOW': false,
      'BM.COMPOSED': true,
      'BM.DOMLIKE': false,
    }),
    ...globalPlugins,
  ],
}

const domlikeCompilation = {
  mode,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: genOutputName('domlike'),
    libraryTarget: 'commonjs2',
  },
  entry: dev ? './src/bootstrap_dom_dev.js' : './src/index.ts',
  optimization,
  devtool,
  module: {
    rules,
  },
  resolve,
  performance,
  plugins: [
    new webpack.DefinePlugin({
      'BM.DYNAMIC': false,
      'BM.SHADOW': false,
      'BM.COMPOSED': false,
      'BM.DOMLIKE': true,
    }),
    ...globalPlugins,
  ],
}

const domlikeGlobalCompilation = {
  mode,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: genOutputName('domlike.global'),
    libraryTarget: 'var',
    library: 'glassEasel',
  },
  entry: dev ? './src/bootstrap_dom_dev.js' : './src/index.ts',
  optimization,
  devtool,
  module: {
    rules,
  },
  resolve,
  performance,
  plugins: [
    new webpack.DefinePlugin({
      'BM.DYNAMIC': false,
      'BM.SHADOW': false,
      'BM.COMPOSED': false,
      'BM.DOMLIKE': true,
    }),
    ...globalPlugins,
  ],
}

const defaultJobs = [allCompilation, domlikeGlobalCompilation]

if (jobs.length) {
  module.exports = jobs.map((name) => {
    const map = {
      all: allCompilation,
      shadow: shadowCompilation,
      'shadow-global': shadowGlobalCompilation,
      composed: composedCompilation,
      'composed-global': composedGlobalCompilation,
      domlike: domlikeCompilation,
      'domlike-global': domlikeGlobalCompilation,
    }
    if (map[name]) return map[name]
    throw new Error('Unknown job: ' + name)
  })
} else {
  module.exports = defaultJobs
}
mainJobOutput = module.exports[0]?.output.filename.slice(0, -3)
