import path from 'node:path'
import * as ts from 'typescript'
import chalk from 'chalk'
import { ProjectDirManager } from './project'

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
  start: Position
  end: Position
  code: number
  level: DiagnosticLevel
  message: string
  formattedMessage: string
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

  constructor(options: ServerOptions) {
    this.options = options
    this.projectPath = path.join(process.cwd(), options.projectPath)
    const rootFullPaths: string[] = []

    // initialize virtual file system
    this.projectDirManager = new ProjectDirManager(
      this.projectPath,
      options.scanAllComponents || false,
      () => {
        // collect all entrance files
        if (options.scanAllComponents) {
          this.projectDirManager.getEntranceFiles().forEach((fullPath) => {
            const extname = path.extname(fullPath)
            if (extname === '.wxml') {
              this.logVerboseMessage(`Found component WXML: ${fullPath}`)
              const tsPath = `${fullPath.slice(0, -extname.length)}.ts`
              const tsContent = this.projectDirManager.getFileContent(tsPath)
              if (tsContent !== null) {
                rootFullPaths.push(tsPath)
              }
              this.analyzeWxmlFile(fullPath)
            }
          })
        }

        // run all ts files
        if (this.options.reportTypeScriptDiagnostics) {
          rootFullPaths.forEach((fullPath) => {
            this.analyzeTsFile(fullPath)
          })
        }

        // callback
        this.options?.onFirstScanDone?.call(this)
      },
    )

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
    const servicesHost: ts.LanguageServiceHost = {
      getCompilationSettings() {
        return config.options
      },
      getScriptFileNames() {
        return config.fileNames
      },
      getScriptVersion: (fullPath) => {
        return this.projectDirManager.getFileVersion(fullPath)?.toString() ?? ''
      },
      getScriptSnapshot: (fullPath) => {
        // console.info('!!! getSnapshot', fullPath)
        const content = this.projectDirManager.getFileContent(fullPath)
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
    // TODO
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
    if (!this.options.reportTypeScriptDiagnostics) {
      if (path.extname(file.fileName) !== '.wxml') return
    }
    const start = file.getLineAndCharacterOfPosition(diagnostic.start ?? 0)
    const end = file.getLineAndCharacterOfPosition(
      (diagnostic.start ?? 0) + (diagnostic.length ?? 0),
    )
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
      file: file.fileName,
      start,
      end,
      code: diagnostic.code,
      level,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      formattedMessage: ts.formatDiagnosticsWithColorAndContext([diagnostic], {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
      }),
    })
  }
}
