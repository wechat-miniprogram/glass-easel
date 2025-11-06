import path from 'node:path'
import type * as ts from 'typescript'
import chalk from 'chalk'
import {
  getWxmlConvertedTsPath,
  getWxmlTsPathReverted,
  type Position,
  type PositionRange,
  ProjectDirManager,
  type TmplGroup,
} from './project'

export { type TmplGroup, type TmplConvertedExpr } from './project'

export const enum DiagnosticLevel {
  Unknown = 0,
  Note,
  Info,
  Warning,
  Error,
}

export type Diagnostic = {
  file: string
  source: ts.SourceFile | null
  start: Position
  end: Position
  code: number
  level: DiagnosticLevel
  message: string
}

type LocationLink = {
  originSelectionRange: PositionRange
  targetUri: string
  targetRange: PositionRange
}

class Cache<T> {
  private cache: T
  private dirty: boolean
  private updater: (this: void, cache: T) => T

  constructor(updater: (this: void, cache: T) => T, init: T) {
    this.cache = init
    this.dirty = false
    this.updater = updater
  }

  get(): T {
    if (this.dirty) {
      this.cache = this.updater(this.cache)
    }
    return this.cache
  }

  invalidate(): void {
    this.dirty = true
  }
}

const getDefaultExportOfSourceFile = (
  tc: ts.TypeChecker,
  source: ts.SourceFile,
): ts.Symbol | undefined => {
  const symbol = tc.getSymbolAtLocation(source)!
  let defaultExport: ts.Symbol | undefined
  try {
    defaultExport = tc.tryGetMemberInModuleExports('default', symbol)
  } catch {
    defaultExport = undefined
  }
  return defaultExport
}

export type ServerOptions = {
  /** the typescript node module */
  typescriptNodeModule: typeof ts
  /** the `TmplGroup` of glass-easel-template-compiler */
  tmplGroup: TmplGroup
  /** the path of the project root */
  projectPath: string
  /** the working directory */
  workingDirectory?: string
  /** whether to print verbose messages */
  verboseMessages?: boolean
  /** Whether to enable strict checks (avoid `any` type fallbacks) */
  strictMode?: boolean
  /** the callback when the first scan is done */
  onFirstScanDone?: (this: Server) => void
  /** the callback when diagnostics need update */
  onDiagnosticsNeedUpdate?: (this: Server, fullPath: string) => void
}

export class Server {
  private options: ServerOptions
  private tsc: typeof ts
  private tmplGroup: TmplGroup
  private projectPath: string
  private workingDirectory: string
  private tsLangService: ts.LanguageService
  private projectDirManager: ProjectDirManager
  private rootFilePaths: Cache<string[]>
  private rootTsFileCount: number
  private rootFilePathsVersion: number
  private configErrors: ts.Diagnostic[]
  private pendingAsyncTasksListeners: (() => void)[] = []

  constructor(options: ServerOptions) {
    this.tsc = options.typescriptNodeModule
    const tsc = this.tsc
    this.tmplGroup = options.tmplGroup
    const tmplGroup = this.tmplGroup
    this.options = options
    this.workingDirectory = options.workingDirectory ?? process.cwd()
    this.projectPath = path.resolve(this.workingDirectory, options.projectPath)

    // initialize virtual file system
    this.projectDirManager = new ProjectDirManager(tsc, tmplGroup, this.projectPath, () => {
      this.options.onFirstScanDone?.call(this)
    })
    this.projectDirManager.wxmlEnvGetter = this.wxmlEnvGetter.bind(this)
    this.projectDirManager.onEntranceFileAdded = (fullPath) => {
      this.logVerboseMessage(`Opened component WXML: ${fullPath}`)
      const p = getWxmlConvertedTsPath(fullPath)
      if (p) {
        this.rootFilePaths.get().push(p)
        this.rootFilePathsVersion += 1
      }
    }
    this.projectDirManager.onEntranceFileRemoved = (fullPath) => {
      this.logVerboseMessage(`Closed component WXML: ${fullPath}`)
      const p = getWxmlConvertedTsPath(fullPath)
      if (p) {
        const rootFilePaths = this.rootFilePaths.get()
        const index = rootFilePaths.lastIndexOf(p)
        if (index >= 0) {
          rootFilePaths[index] = rootFilePaths.pop()!
          this.rootFilePathsVersion += 1
        }
      }
    }
    this.projectDirManager.onConvertedExprCacheUpdated = (wxmlFullPath) => {
      this.logVerboseMessage(`Component WXML updated: ${wxmlFullPath}`)
      this.rootFilePathsVersion += 1
      this.options.onDiagnosticsNeedUpdate?.call(this, wxmlFullPath)
    }
    this.projectDirManager.onPendingAsyncTasksEmpty = () => {
      const f = this.pendingAsyncTasksListeners
      this.pendingAsyncTasksListeners = []
      f.forEach((f) => f.call(this))
    }

    // handling root ts file changes
    const handleRootTsFileChanges = () => {
      this.rootFilePathsVersion += 1
      this.rootFilePaths.invalidate()
    }
    this.projectDirManager.onScriptFileAdded = handleRootTsFileChanges
    this.projectDirManager.onScriptFileRemoved = handleRootTsFileChanges

    // initialize ts language service
    /* eslint-disable @typescript-eslint/unbound-method, arrow-body-style */
    const configPath = tsc.findConfigFile(this.projectPath, tsc.sys.fileExists, 'tsconfig.json')
    this.logVerboseMessage(`Using TypeScript config file: ${configPath ?? '(none)'}`)
    let config: ts.ParsedCommandLine
    if (configPath !== undefined) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const configFile = tsc.readJsonConfigFile(configPath, tsc.sys.readFile)
      const getConfig = () =>
        tsc.parseJsonSourceFileConfigFileContent(
          configFile,
          {
            useCaseSensitiveFileNames: false,
            readDirectory: tsc.sys.readDirectory,
            fileExists: tsc.sys.fileExists,
            readFile: tsc.sys.readFile,
          },
          path.dirname(configPath),
          {
            noEmit: true,
            noUnusedLocals: false,
            noUnusedParameters: false,
          },
          // undefined,
          // undefined,
          // [{ extension: '.wxml', isMixedContent: true, scriptKind: ts.ScriptKind.TS }],
        )
      config = getConfig()
      this.rootFilePaths = new Cache((old) => {
        const extra = old.slice(this.rootTsFileCount)
        const ret = getConfig().fileNames
        this.rootTsFileCount = ret.length
        return ret.concat(extra)
      }, config.fileNames)
      this.rootTsFileCount = config.fileNames.length
    } else {
      const compilerOptions = tsc.getDefaultCompilerOptions()
      config = {
        options: compilerOptions,
        fileNames: [],
        errors: [],
      }
      this.rootFilePaths = new Cache((x) => x, [] as string[])
      this.rootTsFileCount = 0
    }
    this.configErrors = config.errors
    this.rootFilePathsVersion = 1
    const servicesHost: ts.LanguageServiceHost = {
      getCompilationSettings() {
        return config.options
      },
      getProjectVersion: () => {
        return String(this.rootFilePathsVersion)
      },
      getScriptFileNames: () => {
        return this.rootFilePaths.get()
      },
      getScriptVersion: (fullPath) => {
        return this.projectDirManager.getFileVersion(fullPath)?.toString() ?? ''
      },
      getScriptSnapshot: (fullPath) => {
        const content = this.projectDirManager.getFileTsContent(fullPath)
        if (content === null) return undefined
        return tsc.ScriptSnapshot.fromString(content)
      },
      getCurrentDirectory: () => {
        return this.workingDirectory
      },
      getDefaultLibFileName(options) {
        return tsc.getDefaultLibFilePath(options)
      },
      log(message) {
        // eslint-disable-next-line no-console
        console.log(message)
      },
      trace(message) {
        // eslint-disable-next-line no-console
        console.trace(message)
      },
      error(message) {
        // eslint-disable-next-line no-console
        console.error(message)
      },
      readDirectory: (fullPath, extensions, exclude, include, depth) => {
        return tsc.sys.readDirectory(fullPath, extensions, exclude, include, depth)
      },
      readFile: (fullPath, encoding) => {
        return tsc.sys.readFile(fullPath, encoding)
      },
      fileExists: (fullPath) => {
        return tsc.sys.fileExists(fullPath)
      },
      getDirectories: (directoryName) => {
        return tsc.sys.getDirectories(directoryName)
      },
      directoryExists: (directoryName) => {
        return tsc.sys.directoryExists(directoryName)
      },
    }
    /* eslint-enable @typescript-eslint/unbound-method, arrow-body-style */
    const docReg = tsc.createDocumentRegistry()
    this.tsLangService = tsc.createLanguageService(servicesHost, docReg)

    // collect config errors
    const optionsDiag = this.tsLangService.getCompilerOptionsDiagnostics()
    this.configErrors.push(...optionsDiag)
  }

  end() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.projectDirManager.stop()
  }

  async waitPendingAsyncTasks(): Promise<void> {
    if (this.projectDirManager.pendingAsyncTasksCount() > 0) {
      return new Promise((resolve) => {
        this.pendingAsyncTasksListeners.push(resolve)
      })
    }
    return undefined
  }

  getConfigErrors(): Diagnostic[] {
    const ret: Diagnostic[] = []
    this.configErrors.forEach((diag) => {
      const item = this.convDiagnostic(diag)
      if (item) ret.push(item)
    })
    return ret
  }

  private wxmlEnvGetter(tsFullPath: string, wxmlFullPath: string): string | null {
    const program = this.tsLangService.getProgram()
    if (!program) return null
    const source = program.getSourceFile(tsFullPath)
    if (!source) return null
    const compFullPath = tsFullPath.slice(0, -3)
    const compDir = path.dirname(wxmlFullPath)
    const tc = program.getTypeChecker()

    // escape helper
    const escapeJsString = (str: string) => str.replace(/['\\]/g, (a) => `\\${a}`)

    // get exports from corresponding ts file
    const defaultExport = getDefaultExportOfSourceFile(tc, source)
    const relPath = path.relative(compDir, tsFullPath.slice(0, -3))
    const adapterTypesLine = `type _Component_<P, W, M> = { propertyValues: P, dataWithProperties: W, methods: M }
type _ComponentFieldTypes_<T> = (T & Record<string, never>)['_$fieldTypes']`
    // eslint-disable-next-line no-nested-ternary
    const tsImportLine = defaultExport
      ? `import type component from './${escapeJsString(relPath)}'`
      : 'declare const component: UnknownElement'
    const dataLine = `
declare const data: _ComponentFieldTypes_<typeof component> extends _Component_<any, infer W, any>
? W
: { [k: string]: any }`
    const methodsLine = `
declare const methods: _ComponentFieldTypes_<typeof component> extends _Component_<any, any, infer M>
? M
: { [k: string]: any }`

    // get exports from using components
    const propertiesHelperLine = `
type Properties<T> = _ComponentFieldTypes_<T> extends _Component_<infer P, any, any>
? P
: { [k: string]: any }`
    let usingComponentsImports = ''
    const usingComponentsItems = [] as string[]
    const usingComponents = this.projectDirManager.getUsingComponents(compFullPath)
    Object.entries(usingComponents).forEach(([tagName, compPath]) => {
      const source = program.getSourceFile(`${compPath}.ts`)
      if (!source) return
      const defaultExport = getDefaultExportOfSourceFile(tc, source)
      if (!defaultExport) return
      const relPath = path.relative(compDir, compPath)
      const entryName = `_component_${tagName.replace(/-/g, '_')}`
      usingComponentsImports += `import type ${entryName} from './${escapeJsString(relPath)}'\n`
      usingComponentsItems.push(`'${tagName}': Properties<typeof ${entryName}>;\n`)
    })

    // treat generics as any type tags
    const generics = this.projectDirManager.getGenerics(compFullPath)
    generics.forEach((tagName) => {
      usingComponentsItems.push(`'${tagName}': any;\n`)
    })

    // TODO handling placeholders

    // compose tags types
    const unknownElementLine = this.options.strictMode
      ? 'interface UnknownElement { _$fieldTypes: { propertyValues: Record<string, never>, dataWithProperties: Record<string, never>, methods: Record<string, never> } }'
      : 'type UnknownElement = { _$fieldTypes: null, [k: string]: any }'
    const otherComponents = this.options.strictMode
      ? '[other: string]: unknown'
      : '[other: string]: any'
    const tagsLine = `
declare const tags: {
${usingComponentsItems.join('')}${otherComponents} }`

    // add an empty export to avoid some tsc behavior
    const exportLine = 'export default {}'

    return [
      tsImportLine,
      usingComponentsImports,
      adapterTypesLine,
      unknownElementLine,
      propertiesHelperLine,
      dataLine,
      methodsLine,
      tagsLine,
      exportLine,
      '',
    ].join('\n')
  }

  analyzeTsFile(fullPath: string): Diagnostic[] {
    const ret: Diagnostic[] = []
    const services = this.tsLangService
    const diags = services.getSyntacticDiagnostics(fullPath)
    diags.forEach((diag) => {
      const item = this.convDiagnostic(diag)
      if (item) ret.push(item)
    })
    if (!diags.length) {
      const diags = services.getSemanticDiagnostics(fullPath)
      diags.forEach((diag) => {
        const item = this.convDiagnostic(diag)
        if (item) ret.push(item)
      })
    }
    return ret
  }

  async analyzeWxmlFile(fullPath: string): Promise<Diagnostic[]> {
    if (!this.projectDirManager.isComponentTracking(fullPath)) return []
    const tsFullPath = getWxmlConvertedTsPath(fullPath)
    if (tsFullPath === null) return []
    const ret = this.analyzeTsFile(tsFullPath)
    await Promise.all(
      ret.map(async (diag) => {
        const loc = await this.projectDirManager.getWxmlSource(
          fullPath,
          diag.start.line,
          diag.start.character,
          diag.end.line,
          diag.end.character,
        )
        diag.file = diag.file === tsFullPath ? fullPath : diag.file
        diag.source = loc?.source ?? null
        diag.start = { line: loc?.startLine ?? 0, character: loc?.startCol ?? 0 }
        diag.end = { line: loc?.endLine ?? 0, character: loc?.endCol ?? 0 }
      }),
    )
    return ret
  }

  private async getWxmlSourcePos(
    fullPath: string,
    position: Position,
  ): Promise<{
    tsFullPath: string
    sourceStart: Position
    sourceEnd: Position
    destStart: Position
    dest: number
  } | null> {
    const tsFullPath = getWxmlConvertedTsPath(fullPath)
    if (tsFullPath === null) return null
    const program = this.tsLangService.getProgram()
    if (!program) return null
    const source = program.getSourceFile(tsFullPath)
    if (!source) return null
    const tokenInfo = await this.projectDirManager.getTokenInfoAtPosition(fullPath, position)
    if (!tokenInfo) return null
    if (
      tokenInfo.sourceStart.line === tokenInfo.sourceEnd.line &&
      tokenInfo.sourceStart.character === tokenInfo.sourceEnd.character
    ) {
      return null // ignore if the source range is empty (it is unimportant identifier in this case)
    }
    const dest = source.getPositionOfLineAndCharacter(tokenInfo.dest.line, tokenInfo.dest.character)
    return {
      tsFullPath,
      sourceStart: tokenInfo.sourceStart,
      sourceEnd: tokenInfo.sourceEnd,
      destStart: tokenInfo.dest,
      dest,
    }
  }

  async getWxmlHoverContent(fullPath: string, position: Position): Promise<string | null> {
    const tsFullPath = getWxmlConvertedTsPath(fullPath)
    if (tsFullPath === null) return null
    const pos = await this.getWxmlSourcePos(fullPath, position)
    if (pos === null) return null
    const quickInfo = this.tsLangService.getQuickInfoAtPosition(tsFullPath, pos.dest)
    return this.tsc.displayPartsToString(quickInfo?.displayParts ?? [])
  }

  private async toLocationLink(
    originSelectionRange: PositionRange,
    refInfo: ts.DocumentSpan,
  ): Promise<LocationLink | null> {
    const program = this.tsLangService.getProgram()
    if (!program) return null
    const targetOrigUri = refInfo.fileName
    const source = program.getSourceFile(targetOrigUri)
    if (!source) return null
    const targetRange = {
      start: source.getLineAndCharacterOfPosition(refInfo.textSpan.start),
      end: source.getLineAndCharacterOfPosition(refInfo.textSpan.start + refInfo.textSpan.length),
    }
    const targetWxmlUri = getWxmlTsPathReverted(targetOrigUri)
    if (targetWxmlUri) {
      const wxmlPosInfo = await this.projectDirManager.getWxmlSource(
        targetWxmlUri,
        targetRange.start.line,
        targetRange.start.character,
        targetRange.end.line,
        targetRange.end.character,
      )
      if (!wxmlPosInfo) return null
      return {
        originSelectionRange,
        targetUri: targetWxmlUri,
        targetRange: {
          start: { line: wxmlPosInfo?.startLine ?? 0, character: wxmlPosInfo?.startCol ?? 0 },
          end: { line: wxmlPosInfo?.endLine ?? 0, character: wxmlPosInfo?.endCol ?? 0 },
        },
      }
    }
    return {
      originSelectionRange,
      targetUri: targetOrigUri,
      targetRange,
    }
  }

  async getWxmlDefinition(fullPath: string, position: Position): Promise<LocationLink[] | null> {
    const tsFullPath = getWxmlConvertedTsPath(fullPath)
    if (tsFullPath === null) return null
    const pos = await this.getWxmlSourcePos(fullPath, position)
    if (pos === null) return null
    const list = this.tsLangService.getDefinitionAtPosition(tsFullPath, pos.dest)
    if (!list) return null
    const originSelectionRange = {
      start: pos.sourceStart,
      end: pos.sourceEnd,
    }
    const links = await Promise.all(
      list.map((item) => this.toLocationLink(originSelectionRange, item)),
    )
    const ret = links.filter((x) => x !== null)
    return ret as LocationLink[]
  }

  async getWxmlReferences(fullPath: string, position: Position): Promise<LocationLink[] | null> {
    const tsFullPath = getWxmlConvertedTsPath(fullPath)
    if (tsFullPath === null) return null
    const pos = await this.getWxmlSourcePos(fullPath, position)
    if (pos === null) return null
    const list = this.tsLangService.getReferencesAtPosition(tsFullPath, pos.dest)
    if (!list) return null
    const originSelectionRange = {
      start: pos.sourceStart,
      end: pos.sourceEnd,
    }
    const links = await Promise.all(
      list.map((item) => this.toLocationLink(originSelectionRange, item)),
    )
    const ret = links.filter((x) => x !== null)
    return ret as LocationLink[]
  }

  async getWxmlCompletion(
    fullPath: string,
    position: Position,
  ): Promise<{
    items: { label: string; kind: string; sortText: string }[]
    isIncomplete: boolean
  } | null> {
    const tsFullPath = getWxmlConvertedTsPath(fullPath)
    if (tsFullPath === null) return null
    const pos = await this.getWxmlSourcePos(fullPath, position)
    if (pos === null) return null
    const ret = this.tsLangService.getCompletionsAtPosition(tsFullPath, pos.dest, undefined)
    if (!ret || ret.isGlobalCompletion || !ret.isMemberCompletion) return null
    const items = ret.entries
      .map((item) => {
        if (item.hasAction) return null
        if (item.isSnippet) return null
        return {
          label: item.name,
          kind: item.kind,
          sortText: item.sortText,
        }
      })
      .filter((item) => item !== null) as { label: string; kind: string; sortText: string }[]
    return {
      items,
      isIncomplete: ret.isIncomplete ?? false,
    }
  }

  listTrackingComponents(): string[] {
    return this.projectDirManager.listTrackingComponents()
  }

  getTypeScriptServer(): ts.LanguageService {
    return this.tsLangService
  }

  private logVerboseMessage(message: string) {
    if (this.options.verboseMessages) {
      // eslint-disable-next-line no-console
      console.log(chalk.gray(message))
    }
  }

  formatDiagnostic(diag: Diagnostic): string {
    // draw source lines
    let sourceLines = ''
    if (diag.source !== null) {
      const lineStarts = diag.source.getLineStarts()
      for (let i = diag.start.line; i <= diag.end.line; i += 1) {
        const lineStart = lineStarts[i]
        const lineEnd = lineStarts[i + 1]
        const lineContent = diag.source.text.slice(lineStart, lineEnd).trimEnd().replace(/\t/g, ' ')
        const lineNum = i + 1
        const lineNumStr = lineNum.toString()
        const emptyLineNumStr = ' '.repeat(lineNumStr.length)
        const highlightStart = i === diag.start.line ? diag.start.character : 0
        const highlightEnd = i === diag.end.line ? diag.end.character : lineContent.length
        const highlightMark = ' '.repeat(highlightStart) + '~'.repeat(highlightEnd - highlightStart)
        let highlight = chalk.blue(highlightMark)
        if (diag.level === DiagnosticLevel.Error) {
          highlight = chalk.red(highlightMark)
        } else if (diag.level === DiagnosticLevel.Warning) {
          highlight = chalk.yellow(highlightMark)
        } else if (diag.level === DiagnosticLevel.Info) {
          highlight = chalk.blue(highlightMark)
        }
        sourceLines += [
          chalk.bgWhite.black(lineNumStr),
          ' ',
          chalk.white(lineContent),
          '\n',
          chalk.bgWhite.black(emptyLineNumStr),
          ' ',
          highlight,
          '\n',
        ].join('')
      }
    }

    // draw other parts
    let levelHint = chalk.blue('note')
    if (diag.level === DiagnosticLevel.Error) {
      levelHint = chalk.red('error')
    } else if (diag.level === DiagnosticLevel.Warning) {
      levelHint = chalk.yellow('warning')
    } else if (diag.level === DiagnosticLevel.Info) {
      levelHint = chalk.blue('info')
    }
    return [
      chalk.cyan(path.relative(this.workingDirectory, diag.file)),
      chalk.gray(':'),
      chalk.white(diag.start.line + 1),
      chalk.gray(':'),
      chalk.white(diag.start.character + 1),
      chalk.gray(' - '),
      levelHint,
      chalk.gray(` TS${diag.code}: `),
      chalk.white(diag.message),
      '\n\n',
      sourceLines,
    ].join('')
  }

  // eslint-disable-next-line class-methods-use-this
  private convDiagnostic(diagnostic: ts.Diagnostic): Diagnostic | null {
    const file = diagnostic.file
    const start = file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0) ?? {
      line: 0,
      character: 0,
    }
    const end = file?.getLineAndCharacterOfPosition(
      (diagnostic.start ?? 0) + (diagnostic.length ?? 0),
    ) ?? {
      line: 0,
      character: 0,
    }
    let level = DiagnosticLevel.Unknown
    if (diagnostic.category === this.tsc.DiagnosticCategory.Error) {
      level = DiagnosticLevel.Error
    } else if (diagnostic.category === this.tsc.DiagnosticCategory.Warning) {
      level = DiagnosticLevel.Warning
    } else if (diagnostic.category === this.tsc.DiagnosticCategory.Suggestion) {
      level = DiagnosticLevel.Info
    } else if (diagnostic.category === this.tsc.DiagnosticCategory.Message) {
      level = DiagnosticLevel.Note
    }
    const fileName = file?.fileName ?? ''
    const source = file ?? null
    return {
      file: fileName,
      source,
      start,
      end,
      code: diagnostic.code,
      level,
      message: this.tsc.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    }
  }

  openFile(fullPath: string, content: string) {
    this.projectDirManager.openFile(fullPath, content)
  }

  updateFile(fullPath: string, content: string) {
    this.projectDirManager.updateFile(fullPath, content)
  }

  closeFile(fullPath: string) {
    this.projectDirManager.closeFile(fullPath)
  }

  isFileOpened(fullPath: string) {
    return this.projectDirManager.isFileOpened(fullPath)
  }
}
