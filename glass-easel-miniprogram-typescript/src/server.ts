import path from 'node:path'
import * as ts from 'typescript'
import chalk from 'chalk'
import { getWxmlConvertedTsPath, getWxmlTsPathReverted, ProjectDirManager } from './project'

export type Position = {
  line: number
  character: number
}

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

export const formatDiagnostic = (diag: Diagnostic): string => {
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
    chalk.cyan(path.relative(process.cwd(), diag.file)),
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

export type ServerOptions = {
  /** the path of the project root */
  projectPath: string
  /** whether to report diagnostics in TypeScript files */
  reportTypeScriptDiagnostics?: boolean
  /** whether to print verbose messages */
  verboseMessages?: boolean
  /** whether to find diagnostics in all components on startup */
  scanAllComponents?: boolean
  /** the callback when the first scan is done */
  onFirstScanDone?: (this: Server) => void
  /** the callback when new diagnostics are found */
  onNewDiagnostics?: (diag: Diagnostic) => void
}

export class Server {
  private options: ServerOptions
  private projectPath: string
  private tsLangService: ts.LanguageService
  private projectDirManager: ProjectDirManager
  private rootFilePaths: string[]
  private rootFilePathsVersion: number

  constructor(options: ServerOptions) {
    this.options = options
    this.projectPath = path.join(process.cwd(), options.projectPath)

    // initialize virtual file system
    this.projectDirManager = new ProjectDirManager(
      this.projectPath,
      options.scanAllComponents || false,
      () => {
        if (this.options.reportTypeScriptDiagnostics) {
          const rootFullPaths: string[] = []

          // collect all entrance files
          if (options.scanAllComponents) {
            this.projectDirManager.getEntranceWxmlFiles().forEach((fullPath) => {
              const tsPath = `${fullPath.slice(0, -5)}.ts`
              const tsContent = this.projectDirManager.getFileContent(tsPath)
              if (tsContent !== null) {
                rootFullPaths.push(tsPath)
              }
              this.analyzeWxmlFile(fullPath)
            })
          }

          // run all ts files
          rootFullPaths.forEach((fullPath) => {
            this.analyzeTsFile(fullPath)
          })
        }

        // callback
        this.options?.onFirstScanDone?.call(this)
      },
    )
    this.projectDirManager.onEntranceFileAdded = (fullPath) => {
      this.logVerboseMessage(`Opened component WXML: ${fullPath}`)
      const p = getWxmlConvertedTsPath(fullPath)
      if (p) {
        this.rootFilePaths.push(p)
        this.rootFilePathsVersion += 1
      }
    }
    this.projectDirManager.onEntranceFileRemoved = (fullPath) => {
      this.logVerboseMessage(`Closed component WXML: ${fullPath}`)
      const p = getWxmlConvertedTsPath(fullPath)
      if (p) {
        const index = this.rootFilePaths.lastIndexOf(p)
        if (index >= 0) {
          this.rootFilePaths[index] = this.rootFilePaths.pop()!
          this.rootFilePathsVersion += 1
        }
      }
    }

    // initialize ts language service
    /* eslint-disable @typescript-eslint/unbound-method, arrow-body-style */
    const configPath = ts.findConfigFile(this.projectPath, ts.sys.fileExists, 'tsconfig.json')
    this.logVerboseMessage(`Using TypeScript config file: ${configPath ?? '(none)'}`)
    let config: ts.ParsedCommandLine
    if (configPath !== undefined) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const configFile = ts.readJsonConfigFile(configPath, ts.sys.readFile)
      config = ts.parseJsonSourceFileConfigFileContent(
        configFile,
        {
          useCaseSensitiveFileNames: false,
          readDirectory: ts.sys.readDirectory,
          fileExists: ts.sys.fileExists,
          readFile: ts.sys.readFile,
        },
        path.dirname(configPath),
        { noEmit: true },
        // undefined,
        // undefined,
        // [{ extension: '.wxml', isMixedContent: true, scriptKind: ts.ScriptKind.TS }],
      )
      config.errors.forEach((diag) => {
        diag.file = configFile
        this.diagnosticReporter(diag)
      })
    } else {
      const compilerOptions = ts.getDefaultCompilerOptions()
      config = {
        options: compilerOptions,
        fileNames: [],
        errors: [],
      }
    }
    this.rootFilePaths = config.fileNames
    this.rootFilePathsVersion = 1
    const servicesHost: ts.LanguageServiceHost = {
      getCompilationSettings() {
        return config.options
      },
      getProjectVersion: () => {
        return String(this.rootFilePathsVersion)
      },
      getScriptFileNames: () => {
        return this.rootFilePaths
      },
      getScriptVersion: (fullPath) => {
        return this.projectDirManager.getFileVersion(fullPath)?.toString() ?? ''
      },
      getScriptSnapshot: (fullPath) => {
        const content = this.projectDirManager.getFileTsContent(fullPath, tsExportsGetter)
        if (content === null) return undefined
        return ts.ScriptSnapshot.fromString(content)
      },
      getCurrentDirectory() {
        return process.cwd()
      },
      getDefaultLibFileName(options) {
        return ts.getDefaultLibFilePath(options)
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
        return ts.sys.readDirectory(fullPath, extensions, exclude, include, depth)
      },
      readFile: (fullPath, encoding) => {
        return ts.sys.readFile(fullPath, encoding)
      },
      fileExists: (fullPath) => {
        return ts.sys.fileExists(fullPath)
      },
      getDirectories: (directoryName) => {
        return ts.sys.getDirectories(directoryName)
      },
      directoryExists: (directoryName) => {
        return ts.sys.directoryExists(directoryName)
      },
    }
    /* eslint-enable @typescript-eslint/unbound-method, arrow-body-style */
    const docReg = ts.createDocumentRegistry()
    this.tsLangService = ts.createLanguageService(servicesHost, docReg)

    // get the exports of a file
    const tsExportsGetter = (fullPath: string) => {
      const program = this.tsLangService.getProgram()
      if (!program) return ''
      const source = program.getSourceFile(fullPath)
      if (!source) return ''
      const tc = program.getTypeChecker()
      const symbol = tc.getSymbolAtLocation(source)!
      const defaultExport = tc.tryGetMemberInModuleExports('default', symbol)
      // tc.symbolToString(defaultExport, source)
      // if (!defaultExport) return ''
      return ''
    }

    // report diagnostics about compiler options
    const optionsDiag = this.tsLangService.getCompilerOptionsDiagnostics()
    optionsDiag.forEach((diag) => {
      this.diagnosticReporter(diag)
    })
  }

  end() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.projectDirManager.stop()
  }

  private analyzeTsFile(fullPath: string) {
    const services = this.tsLangService
    const diags = services.getSyntacticDiagnostics(fullPath)
    if (!diags?.length) {
      const diags = services.getSemanticDiagnostics(fullPath)
      diags.forEach((diag) => {
        this.diagnosticReporter(diag)
      })
      return
    }
    diags.forEach((diag) => {
      this.diagnosticReporter(diag)
    })
  }

  private analyzeWxmlFile(fullPath: string) {
    const tsFullPath = getWxmlConvertedTsPath(fullPath)
    if (tsFullPath === null) return
    this.analyzeTsFile(tsFullPath)
  }

  private logVerboseMessage(message: string) {
    if (this.options.verboseMessages) {
      // eslint-disable-next-line no-console
      console.log(chalk.gray(message))
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private diagnosticReporter(diagnostic: ts.Diagnostic) {
    const file = diagnostic.file
    if (!file) return
    let start = file.getLineAndCharacterOfPosition(diagnostic.start ?? 0)
    let end = file.getLineAndCharacterOfPosition((diagnostic.start ?? 0) + (diagnostic.length ?? 0))
    const wxmlFullPath = getWxmlTsPathReverted(file.fileName)
    let fileName: string
    let source: ts.SourceFile | null
    if (wxmlFullPath) {
      fileName = wxmlFullPath
      const loc = this.projectDirManager.getWxmlSource(
        wxmlFullPath,
        start.line,
        start.character,
        end.line,
        end.character,
      )
      source = loc?.source ?? null
      start = { line: loc?.startLine ?? 0, character: loc?.startCol ?? 0 }
      end = { line: loc?.endLine ?? 0, character: loc?.endCol ?? 0 }
    } else {
      if (!this.options.reportTypeScriptDiagnostics) return
      fileName = file.fileName
      source = file
    }
    let level = DiagnosticLevel.Unknown
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      level = DiagnosticLevel.Error
    } else if (diagnostic.category === ts.DiagnosticCategory.Warning) {
      level = DiagnosticLevel.Warning
    } else if (diagnostic.category === ts.DiagnosticCategory.Suggestion) {
      level = DiagnosticLevel.Info
    } else if (diagnostic.category === ts.DiagnosticCategory.Message) {
      level = DiagnosticLevel.Note
    }
    this.options.onNewDiagnostics?.({
      file: fileName,
      source,
      start,
      end,
      code: diagnostic.code,
      level,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    })
  }
}
