const path = require('path')
const webpack = require('webpack')
const { RawSource } = require('webpack-sources')

const jobs = []
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
        })
      },
    )
  }
}

const globalPlugins = [new BundleDeclarationEntrancePlugin()]

module.exports = {
  mode,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'glass_easel_miniprogram_adapter.js',
    libraryTarget: 'commonjs2',
  },
  optimization,
  devtool: 'source-map',
  module: {
    rules,
  },
  resolve,
  externals: 'glass-easel',
  performance,
  plugins: [...globalPlugins],
}
