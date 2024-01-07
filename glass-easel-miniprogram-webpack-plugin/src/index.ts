import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { NormalModule, type Compiler, type WebpackPluginInstance } from 'webpack'
import chokidar from 'chokidar'
import { RawSource } from 'webpack-sources'
import VirtualModulesPlugin from 'webpack-virtual-modules'
import { TmplGroup } from 'glass-easel-template-compiler'
import { escapeJsString } from './helpers'

export const GlassEaselMiniprogramWxmlLoader = path.join(__dirname, 'wxml-loader.js')
export const GlassEaselMiniprogramWxssLoader = path.join(__dirname, 'wxss-loader.js')

const PLUGIN_NAME = 'GlassEaselMiniprogramWebpackPlugin'
const CACHE_ETAG = 1

type PluginConfig = {
  path: string
  resourceFilePattern: RegExp
  defaultEntry: string
}

type GlobalStaticConfig = {
  usingComponents?: { [tagName: string]: string }
}

type ComponentStaticConfig = {
  component: boolean
  usingComponents: { [tagName: string]: string }
  styleIsolation:
    | 'isolated'
    | 'apply-shared'
    | 'shared'
    | 'page-isolated'
    | 'page-apply-shared'
    | 'page-shared'
  pureDataPattern: string
  taskConfig: unknown
}

const readCache = <T>(compiler: Compiler, key: string): Promise<T | undefined> =>
  new Promise((resolve) => {
    const cacheKey = `${PLUGIN_NAME}|${key}`
    compiler.cache.get(cacheKey, CACHE_ETAG, (err, cache) => {
      if (!err && cache !== undefined) {
        resolve(cache as T)
      } else {
        resolve(undefined)
      }
    })
  })

const writeCache = <T>(compiler: Compiler, key: string, value: T): Promise<void> =>
  new Promise((resolve) => {
    const cacheKey = `${PLUGIN_NAME}|${key}`
    compiler.cache.store(cacheKey, CACHE_ETAG, value, (_err) => {
      resolve()
    })
  })

class StyleSheetManager {
  map = Object.create(null) as { [path: string]: { scopeName: string; srcPath: string } }
  enableStyleScope = Object.create(null) as { [path: string]: boolean }
  scopeNameInc = 0

  add(compPath: string, srcPath: string) {
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

  setStyleIsolation(compPath: string, styleIsolation: string, isComponent: boolean) {
    const enabled = styleIsolation
      ? styleIsolation !== 'shared' && styleIsolation !== 'page-shared'
      : isComponent
    this.enableStyleScope[compPath] = enabled
  }

  getScopeName(compPath: string) {
    if (this.enableStyleScope[compPath]) {
      return this.map[compPath]?.scopeName
    }
    return undefined
  }

  toCodeString() {
    const arr = Object.entries(this.map).map(([compPath, { srcPath }]) => {
      const s = `backend.registerStyleSheetContent('${escapeJsString(
        compPath,
      )}', require('${escapeJsString(srcPath)}'));`
      return s
    })
    return `
      function (backend) {
        backend.registerStyleSheetContent('app', require('./app.wxss'))
        ${arr.join('')}
      }
    `
  }
}

export class GlassEaselMiniprogramWebpackPlugin implements WebpackPluginInstance {
  path: string
  resourceFilePattern: RegExp
  defaultEntry: string
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  virtualModules = new VirtualModulesPlugin() as {
    apply: (compiler: Compiler) => void
    writeModule: (p: string, c: string) => void
  }

  constructor(options: PluginConfig) {
    this.path = options.path || './src'
    this.resourceFilePattern = options.resourceFilePattern || /\.(jpg|jpeg|png|gif)$/
    this.defaultEntry = options.defaultEntry || 'pages/index/index'
  }

  apply(compiler: Compiler) {
    const codeRoot = path.resolve(this.path)
    const compInfoMap = Object.create(null) as {
      [compPath: string]: { main: string; taskConfig: unknown; hasWxss: boolean }
    }
    const resPathMap = Object.create(null) as { [compPath: string]: true }
    const wxmlContentMap = Object.create(null) as { [compPath: string]: string }
    let globalStaticConfig = {} as GlobalStaticConfig
    let appEntry: 'app.js' | 'app.ts' | null = null
    const depsTmplGroup = new TmplGroup()
    const styleSheetManager = new StyleSheetManager()

    // cleanup wasm modules
    compiler.hooks.shutdown.tap(PLUGIN_NAME, () => {
      depsTmplGroup.free()
    })

    // determine a file is located in the code root or not, returning relative path if true
    const normalizePath = (absPath: string): string | null => {
      const p = path.relative(codeRoot, absPath)
      if (p.split(path.sep, 1)[0] === '..') return null
      return p.split(path.sep).join('/')
    }

    // determine a path is a component path or not, returning the json content if true
    const isCompPath = async (relPath: string): Promise<ComponentStaticConfig | null> => {
      if (!relPath) return null
      let staticConfig = null
      try {
        const json = await fs.readFile(path.join(codeRoot, `${relPath}.json`), { encoding: 'utf8' })
        const parsed = JSON.parse(json) as ComponentStaticConfig
        if (parsed && (parsed.component === true || typeof parsed.usingComponents === 'object')) {
          staticConfig = parsed
        }
      } catch (e) {
        /* empty */
      }
      return staticConfig
    }

    // search for component files
    let codeRootWatching = false
    const searchCodeRoot = async (enableWatch: boolean) => {
      if (codeRootWatching) return
      codeRootWatching = true
      const handleFile = async (relPath: string) => {
        // for app.json, spread the global field
        if (relPath === 'app.json') {
          try {
            const json = await fs.readFile(path.join(codeRoot, relPath), { encoding: 'utf8' })
            const staticConfig = JSON.parse(json) as GlobalStaticConfig
            if (staticConfig.usingComponents) {
              globalStaticConfig = {
                usingComponents: staticConfig.usingComponents,
              }
            }
          } catch (e) {
            globalStaticConfig = {}
          }
          return
        }

        // for app.ts or app.js, load it first
        if (relPath === 'app.ts' || relPath === 'app.js') {
          appEntry = relPath
        }

        // find component by json files
        const extName = path.extname(relPath)
        if (extName === '.json') {
          const staticConfig = await isCompPath(relPath.slice(0, -extName.length))
          if (staticConfig) {
            const compPath = relPath.slice(0, -extName.length)
            const absPath = path.join(codeRoot, `${compPath}.wxss`)
            let hasWxss = false
            try {
              hasWxss = (await fs.stat(absPath)).isFile()
            } catch (e) {
              /* empty */
            }
            try {
              const tsFileStat = await fs.stat(path.join(codeRoot, `${compPath}.ts`))
              if (tsFileStat.isFile()) {
                compInfoMap[compPath] = {
                  main: `${compPath}.ts`,
                  taskConfig: staticConfig.taskConfig,
                  hasWxss,
                }
                styleSheetManager.add(compPath, absPath)
                styleSheetManager.setStyleIsolation(
                  compPath,
                  staticConfig.styleIsolation,
                  !!staticConfig.component,
                )
                return
              }
            } catch (e) {
              /* empty */
            }
            try {
              const jsFileStat = await fs.stat(path.join(codeRoot, `${compPath}.js`))
              if (jsFileStat.isFile()) {
                compInfoMap[compPath] = {
                  main: `${compPath}.js`,
                  taskConfig: staticConfig.taskConfig,
                  hasWxss,
                }
                return
              }
            } catch (e) {
              /* empty */
            }
          }
        }

        // find wxss file for components
        if (extName === '.wxss') {
          const compPath = relPath.slice(0, -5)
          if (compInfoMap[compPath]) {
            compInfoMap[compPath]!.hasWxss = true
          }
        }

        // find resource files
        if (this.resourceFilePattern.test(relPath)) {
          resPathMap[relPath] = true
        }
      }

      const removeEntry = (relPath: string) => {
        delete resPathMap[relPath]
        const extName = path.extname(relPath)
        const compPath = relPath.slice(0, -extName.length)
        if (compInfoMap[compPath]) {
          if (extName === '.json') {
            delete compInfoMap[compPath]
          } else if (extName === '.wxss') {
            compInfoMap[compPath]!.hasWxss = false
          }
        }
      }

      // await readdirp(codeRoot, handleFile)
      await new Promise((resolve, reject) => {
        const promises: Promise<void>[] = []
        /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
        const watcher = chokidar.watch(codeRoot, { ignoreInitial: false })
        watcher
          .on('add', (p: string) => {
            const normalized = normalizePath(p)
            if (normalized) {
              promises.push(handleFile(normalized))
            }
          })
          .on('unlink', (p: string) => {
            const normalized = normalizePath(p)
            if (normalized) removeEntry(normalized)
          })
          .on('ready', () => {
            Promise.all(promises)
              .then(() => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                if (!enableWatch) return watcher.close()
                return null
              })
              .then(resolve)
              .catch(reject)
          })
        /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
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
    compiler.resolverFactory.hooks.resolver.for('normal').tap(PLUGIN_NAME, (resolver) => {
      resolver.hooks.result.tap(PLUGIN_NAME, (data) => {
        if (data.path === false) return data
        const absPath = data.path
        const extName = path.extname(absPath)
        if (extName === '.js' || extName === '.ts') {
          const relPath = normalizePath(absPath)
          if (relPath && compInfoMap[relPath.slice(0, -3)]) {
            const redirected = `${absPath.slice(0, -3)}.glass-easel-component`
            if ((data.context as { issuer?: string })?.issuer !== redirected) {
              data.path = redirected
            }
          }
        }
        return data
      })
    })

    // collect virtual files
    const virtualModules = this.virtualModules
    virtualModules.apply(compiler)
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      // add loaders
      NormalModule.getCompilationHooks(compilation).beforeLoaders.tap(
        PLUGIN_NAME,
        (loaders, mod) => {
          const absPath = mod.resource
          const extName = path.extname(absPath)
          if (extName === '.wxml' || extName === '.wxss') {
            const relPath = path.relative(codeRoot, absPath).split(path.sep).join('/')
            const compPath = relPath.slice(0, -extName.length)
            if (extName === '.wxss') {
              loaders.forEach((x) => {
                if (x.loader === GlassEaselMiniprogramWxssLoader) {
                  x.options = {
                    classPrefix: styleSheetManager.getScopeName(compPath),
                    relPath,
                  }
                }
              })
            } else if (extName === '.wxml') {
              loaders.forEach((x) => {
                if (x.loader === GlassEaselMiniprogramWxmlLoader) {
                  x.options = {
                    addTemplate(content: string) {
                      depsTmplGroup.addTmpl(compPath, content)
                      wxmlContentMap[compPath] = content
                      const deps = depsTmplGroup
                        .getDirectDependencies(compPath)
                        .concat(depsTmplGroup.getScriptDependencies(compPath))
                      return {
                        compPath,
                        deps,
                        codeRoot,
                      }
                    },
                  }
                }
              })
            }
          }
        },
      )

      // do some rebuild after all module compilation done
      compilation.hooks.finishModules.tapPromise(PLUGIN_NAME, async (modules) => {
        const tasks: Promise<any>[] = []
        let indexModule: NormalModule | undefined
        const tmplGroup = new TmplGroup()

        // collect compilation results
        // eslint-disable-next-line no-restricted-syntax
        for (const m of modules) {
          if (m.type !== 'javascript/auto') continue
          const module = m as NormalModule
          if (module.resource === `${codeRoot}/index.js`) {
            indexModule = module
            continue
          }
          const absPath = module.resource
          const extName = path.extname(absPath)
          if (extName === '.wxml') {
            if (module.loaders.some((x) => x.loader === GlassEaselMiniprogramWxmlLoader)) {
              // check wxml results, read cache if needed
              const relPath = path.relative(codeRoot, absPath).split(path.sep).join('/')
              const compPath = relPath.slice(0, -extName.length)
              // eslint-disable-next-line no-loop-func
              tasks.push(
                (async () => {
                  let content = wxmlContentMap[compPath]
                  if (content) {
                    // TODO use compiled content as better cache
                    await writeCache(compiler, relPath, content)
                  } else {
                    const s = await readCache<string>(compiler, relPath)
                    if (s === undefined) {
                      throw new Error(
                        `Cannot find WXML compilation result for ${relPath} (webpack cache broken?)`,
                      )
                    }
                    content = s
                  }
                  if (typeof content === 'string') {
                    tmplGroup.addTmpl(compPath, content)
                  }
                })(),
              )
            }
          }
        }

        // write index module
        await Promise.all(tasks)
        await new Promise<void>((resolve) => {
          updateVirtualIndexFile(tmplGroup)
          tmplGroup.free()
          compilation.rebuildModule(indexModule!, () => resolve())
        })
      })

      // add virtual component js file
      const updateComponentJsFile = (compPath: string) => {
        const compInfo = compInfoMap[compPath]!
        const scopeName = styleSheetManager.getScopeName(compPath)
        const scopeNameStr = scopeName === undefined ? undefined : `'${scopeName}'`
        const jsonSrcPath = path.join(codeRoot, `${compPath}.json`)
        const wxmlSrcPath = path.join(codeRoot, `${compPath}.wxml`)
        const wxssSrcPath = path.join(codeRoot, `${compPath}.wxss`)
        const addStyleSheet = compInfo.hasWxss
          ? `
            require('${escapeJsString(wxssSrcPath)}')
            codeSpace.addStyleSheet(
              '${escapeJsString(compPath)}',
              '${escapeJsString(compPath)}',
              ${scopeNameStr}
            )
          `
          : ''
        virtualModules.writeModule(
          path.join(codeRoot, `${compPath}.glass-easel-component`),
          `
            var index = require('${escapeJsString(codeRoot)}/index.js')
            var codeSpace = index.codeSpace
            var staticConfig = require('${escapeJsString(jsonSrcPath)}')
            staticConfig.usingComponents = Object.assign(
              {},
              index.globalUsingComponents,
              staticConfig.usingComponents
            )
            codeSpace.addComponentStaticConfig('${escapeJsString(compPath)}', staticConfig)
            codeSpace.addCompiledTemplate('${escapeJsString(compPath)}', {
              groupList: index.genObjectGroups,
              content: index.genObjectGroups[require('${escapeJsString(wxmlSrcPath)}')]
            })
            ${addStyleSheet}
            codeSpace.globalComponentEnv(index.globalObject, '${escapeJsString(compPath)}', () => {
              require('./${escapeJsString(path.basename(compInfo.main))}')
            })
          `,
        )
      }
      Object.keys(compInfoMap).forEach((compPath) => updateComponentJsFile(compPath))

      // add virtual index file
      const updateVirtualIndexFile = (tmplGroup?: TmplGroup) => {
        const entryHeader = `
          var adapter = require('glass-easel-miniprogram-adapter')
          var glassEasel = adapter.glassEasel
          var env = new adapter.MiniProgramEnv()
          exports.env = env
          var backend = new glassEasel.CurrentWindowBackendContext()
          backend.onEvent((target, type, detail, options) => {
            glassEasel.triggerEvent(target, type, detail, options)
          })
          var ab = env.associateBackend(backend)
          ;(${styleSheetManager.toCodeString()})(ab)
          var codeSpace = env.createCodeSpace('', true)
          codeSpace.addStyleSheet('app', 'app')
          exports.codeSpace = codeSpace
          exports.genObjectGroups = ${tmplGroup ? tmplGroup.getTmplGenObjectGroups() : '{}'}
          exports.globalUsingComponents = ${JSON.stringify(globalStaticConfig.usingComponents)}
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
          var root = ab.createRoot('glass-easel-root', codeSpace, '${escapeJsString(
            this.defaultEntry,
          )}')
          var placeholder = document.createElement('span')
          document.body.appendChild(placeholder)
          root.attach(document.body, placeholder)
        `
        const entries = Object.values(compInfoMap).map((compInfo) => compInfo.main)
        if (appEntry) entries.unshift(appEntry)
        virtualModules.writeModule(
          path.join(codeRoot, 'index.js'),
          entryHeader +
            entries.map((p) => `require('./${escapeJsString(p)}')\n`).join('') +
            entryFooter,
        )
      }
      updateVirtualIndexFile()

      // copy res files
      compilation.hooks.additionalAssets.tapPromise(PLUGIN_NAME, async () => {
        await Promise.all(
          Object.keys(resPathMap).map(async (p) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            compilation.assets[p] = new RawSource(await fs.readFile(path.join(codeRoot, p)))
          }),
        )
      })
    })
  }
}
