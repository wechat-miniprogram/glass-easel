/* eslint-disable @typescript-eslint/no-var-requires */

const config = require('./webpack.config')

config[0].mode = 'development'
config[0].resolve.alias['glass-easel'] = 'glass-easel/dist/glass_easel.dev.all.es.js'

module.exports = config
