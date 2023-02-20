/* eslint-disable */

const fs = require('fs').promises
const path = require('path')
const webpack = require('webpack')
const { RawSource } = require('webpack-sources')
const VirtualModulesPlugin = require('webpack-virtual-modules')
const chokidar = require('chokidar')
const { TmplGroup } = require('glass-easel-template-compiler')

const { escapeJsString } = require('./helpers')

const GlassEaselMiniprogramWxssLoader = path.join(__dirname, 'wxss_loader.js')

const PLUGIN_NAME = 'GlassEaselMiniprogramWebpackPlugin'

class StyleSheetManager {
  constructor() {
    this.map = Object.create(null)
    this.enableStyleScope = Object.create(null)
    this.scopeNameInc = 0
  }

  add(compPath, srcPath) {
    let scopeNameNum = this.scopeNameInc
    this.scopeNameInc += 1
    let scopeName = ''
    do {
      const n = scopeNameNum % 52
      let c
      if (n >= 26) {
        c = String.fromCharCode(n - 26 + 97)
      } else {
        c = String.fromCharCode(n + 65)
      }
      scopeName += c
      scopeNameNum = Math.floor(scopeNameNum / 52)
    } while (scopeNameNum > 0)
    this.map[compPath] = {
      srcPath,
      scopeName,
    }
  }

  setStyleIsolation(compPath, styleIsolation, isComponent) {
    const enabled = styleIsolation
      ? styleIsolation !== 'shared' && styleIsolation !== 'page-shared'
      : isComponent
    this.enableStyleScope[compPath] = enabled
  }

  getScopeName(compPath) {
    if (this.enableStyleScope[compPath]) {
      return this.map[compPath].scopeName
    }
    return undefined
  }

  toCodeString() {
    const arr = Object.entries(this.map).map(([compPath, { srcPath }]) => {
      const s = `backend.registerStyleSheetContent('${escapeJsString(compPath)}', require('${escapeJsString(srcPath)}'));`
      return s
    })
    return `
      function (backend) { ${arr.join('')} }
    `
  }
}

class GlassEaselMiniprogramWebpackPlugin {
  constructor(options) {
    this.path = options.path || './src'
    this.resourceFilePattern = options.resourceFilePattern || /\.(jpg|jpeg|png|gif|html)$/
    this.defaultEntry = 'pages/index/index'
    this.virtualModules = new VirtualModulesPlugin()
  }

  apply(compiler) {
    // search paths
    const codeRoot = path.resolve(this.path)
    const params = {
      globalStaticConfig: {},
      compInfoMap: Object.create(null),
      resPathMap: Object.create(null),
      appEntry: null,
      tmplGroup: new TmplGroup(),
      styleSheetManager: new StyleSheetManager(),
    }

    // determine a path is a component path or not, returning the json content if true
    const isCompPath = async (relPath) => {
      if (!relPath) return null
      let staticConfig = null
      try {
        const json = await fs.readFile(path.join(codeRoot, `${relPath}.json`), { encoding: 'utf8' })
        const parsed = JSON.parse(json)
        if (parsed && (parsed.component === true || typeof parsed.usingComponents === 'object')) {
          staticConfig = parsed
        }
      } catch (e) { /* empty */ }
      return staticConfig
    }

    // determine a file is located in the code root or not, returning relative path if true
    const normalizePath = (absPath) => {
      const p = path.relative(codeRoot, absPath)
      if (p.split(path.sep, 1)[0] === '..') return null
      return p.split(path.sep).join('/')
    }

    // search for component files
    let codeRootWatching = false
    const searchCodeRoot = async (enableWatch) => {
      if (codeRootWatching) return
      codeRootWatching = true
      const handleFile = async (relPath) => {
        // for app.json, spread the global field
        if (relPath === 'app.json') {
          try {
            const json = await fs.readFile(path.join(codeRoot, relPath), { encoding: 'utf8' })
            const staticConfig = JSON.parse(json)
            if (staticConfig.usingComponents) {
              params.globalStaticConfig = {
                usingComponents: staticConfig.usingComponents,
              }
            }
          } catch (e) {
            params.globalStaticConfig = {}
          }
          return
        }

        // for app.ts or app.js, load it first
        if (relPath === 'app.ts' || relPath === 'app.js') {
          params.appEntry = relPath
        }

        // find component by json files
        const extName = path.extname(relPath)
        if (extName === '.json') {
          const staticConfig = await isCompPath(relPath.slice(0, -extName.length))
          if (staticConfig) {
            const compPath = relPath.slice(0, -5)
            try {
              const tsFileStat = await fs.stat(path.join(codeRoot, `${compPath}.ts`))
              if (tsFileStat.isFile()) {
                params.compInfoMap[compPath] = {
                  main: `${compPath}.ts`,
                  staticConfig,
                }
                params.styleSheetManager.setStyleIsolation(
                  compPath,
                  staticConfig.styleIsolation,
                  !!staticConfig.component,
                )
                return
              }
            } catch (e) { /* empty */ }
            try {
              const jsFileStat = await fs.stat(path.join(codeRoot, `${compPath}.js`))
              if (jsFileStat.isFile()) {
                params.compInfoMap[compPath] = {
                  main: `${compPath}.js`,
                  staticConfig,
                }
                return
              }
            } catch (e) { /* empty */ }
          }
        }

        // add wxml
        if (extName === '.wxml') {
          const src = await fs.readFile(path.join(codeRoot, relPath), { encoding: 'utf8' })
          params.tmplGroup.addTmpl(relPath.slice(0, -extName.length), src)
          // TODO support wxml file remove
        }

        // add wxss
        if (extName === '.wxss') {
          const srcPath = path.join(codeRoot, relPath)
          params.styleSheetManager.add(relPath.slice(0, -extName.length), srcPath)
          // TODO support wxss file remove
        }

        // find resource files
        if (this.resourceFilePattern.test(relPath)) {
          params.resPathMap[relPath] = true
        }
      }

      const removeEntry = (relPath) => {
        delete params.resPathMap[relPath]
        delete params.compInfoMap[relPath]
      }

      // await readdirp(codeRoot, handleFile)
      await new Promise((resolve, reject) => {
        const promises = []
        const watcher = chokidar.watch(codeRoot, { ignoreInitial: false })
        watcher
          .on('add', (p) => {
            promises.push(handleFile(normalizePath(p)))
          })
          .on('change', (p) => {
            promises.push(handleFile(normalizePath(p)))
          })
          .on('unlink', (p) => {
            removeEntry(normalizePath(p))
          })
          .on('error', (err) => {
            throw new Error(err)
          })
          .on('ready', () => {
            Promise.all(promises)
              .then(() => {
                if (!enableWatch) return watcher.close()
                return null
              })
              .then(resolve)
              .catch(reject)
          })
      })
    }

    // init component list before run
    compiler.hooks.beforeRun.tapPromise(PLUGIN_NAME, async () => {
      await searchCodeRoot(false)
    })
    compiler.hooks.watchRun.tapPromise(PLUGIN_NAME, async () => {
      await searchCodeRoot(true)
    })

    // rewrite component entry paths
    compiler.resolverFactory.hooks.resolver
      .for('normal')
      .tap(PLUGIN_NAME, (resolver) => {
        resolver.hooks.result.tap(PLUGIN_NAME, (data) => {
          const absPath = data.path
          const extName = path.extname(absPath)
          if (extName === '.js' || extName === '.ts') {
            const relPath = normalizePath(absPath)
            if (relPath && params.compInfoMap[relPath.slice(0, -3)]) {
              const redirected = `${absPath.slice(0, -3)}.component`
              if (data.context.issuer !== redirected) {
                data.path = redirected
              }
            }
          }
          return data
        })
      })

    // add loaders
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      webpack.NormalModule.getCompilationHooks(compilation).beforeLoaders
        .tap(PLUGIN_NAME, (loaders, mod) => {
          const absPath = mod.resource
          const extName = path.extname(absPath)
          if (extName === '.ts' || extName === '.js' || extName === '.wxml' || extName === '.wxss') {
            const relPath = path.relative(codeRoot, absPath).split(path.sep).join('/')
            const compPath = relPath.slice(0, -extName.length)
            if (params.compInfoMap[compPath] || compPath === 'app') {
              if (extName === '.wxss') {
                loaders.forEach((x) => {
                  if (x.loader === GlassEaselMiniprogramWxssLoader) {
                    x.options = {
                      classPrefix: params.styleSheetManager.getScopeName(compPath),
                      relPath,
                    }
                  }
                })
              }
            }
          }
        })
    })

    // collect virtual files
    const virtualModules = this.virtualModules
    virtualModules.apply(compiler)
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      // add virtual component js file
      Object.keys(params.compInfoMap).forEach((compPath) => {
        const compInfo = params.compInfoMap[compPath]
        const json = JSON.stringify(compInfo.staticConfig)
        const scopeName = params.styleSheetManager.getScopeName(compPath)
        const scopeNameStr = scopeName === undefined ? undefined : `'${scopeName}'`
        virtualModules.writeModule(
          path.join(codeRoot, `${compPath}.component`),
          `
            var index = require('${escapeJsString(codeRoot)}/index.js')
            index.codeSpace.addComponentStaticConfig('${escapeJsString(compPath)}', ${json})
            index.codeSpace.addCompiledTemplate('${escapeJsString(compPath)}', {
              groupList: index.genObjectGroups,
              content: index.genObjectGroups['${escapeJsString(compPath)}']
            })
            index.codeSpace.addStyleSheet(
              '${escapeJsString(compPath)}',
              '${escapeJsString(compPath)}',
              ${scopeNameStr},
            )
            index.codeSpace.globalComponentEnv(index.globalObject, '${escapeJsString(compPath)}', () => {
              require('./${escapeJsString(path.basename(compInfo.main))}')
            })
          `,
        )
      })

      // add virtual index file
      const entryHeader = `
        var adapter = require('glass-easel-miniprogram-adapter')
        var glassEasel = adapter.glassEasel
        var env = new adapter.MiniProgramEnv()
        exports.env = env
        var backend = new glassEasel.domlikeBackend.CurrentWindowBackendContext()
        backend.onEvent((target, type, detail, options) => {
          let cur = target
          while (cur && !cur.__wxElement) cur = cur.parentNode
          if (!cur) return
          glassEasel.triggerEvent(target.__wxElement, type, detail, options)
        })
        var ab = env.associateBackend(backend)
        ;(${params.styleSheetManager.toCodeString()})(ab)
        var codeSpace = env.createCodeSpace('', true)
        codeSpace.addStyleSheet('app', 'app')
        exports.codeSpace = codeSpace
        exports.genObjectGroups = ${params.tmplGroup.getTmplGenObjectGroups()}
        exports.globalObject = (function () {
          if (typeof this !== 'undefined') { return this }
          if (typeof globalThis !== 'undefined') { return globalThis }
          if (typeof self !== 'undefined') { return self }
          if (typeof window !== 'undefined') { return window }
          if (typeof global !== 'undefined') { return global }
          throw new Error('The global object cannot be recognized')
        })()
      `
      const entryFooter = `
        var root = ab.createRoot('glass-easel-root', codeSpace, '${escapeJsString(this.defaultEntry)}')
        var placeholder = document.createElement('span')
        document.body.appendChild(placeholder)
        root.attach(document.body, placeholder)
      `
      const entries = Object.values(params.compInfoMap).map((compInfo) => compInfo.main)
      if (params.appEntry) entries.unshift(params.appEntry)
      virtualModules.writeModule(
        `${codeRoot}/index.js`,
        entryHeader + entries.map((p) => `require('./${escapeJsString(p)}')\n`).join('') + entryFooter,
      )

      // copy res files
      compilation.hooks.additionalAssets.tapPromise(PLUGIN_NAME, async () => {
        await Promise.all(Object.keys(params.resPathMap).map(async (p) => {
          compilation.assets[p] = new RawSource(await fs.readFile(path.join(codeRoot, p)))
        }))
      })
    })
  }
}

exports.GlassEaselMiniprogramWebpackPlugin = GlassEaselMiniprogramWebpackPlugin
exports.GlassEaselMiniprogramWxssLoader = GlassEaselMiniprogramWxssLoader
