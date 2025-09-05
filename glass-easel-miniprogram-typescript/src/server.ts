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
}

export type ServerOptions = {
  projectPath: string
  reportTypeScriptDiagnostics?: boolean
  showTypeScriptMessages?: boolean
  verboseMessages?: boolean
  scanAllComponents?: boolean
  onFirstScanDone?: (this: Server) => void
  onNewDiagnostics?: (diag: Diagnostic) => void
}

export class Server {
  private onNewDiagnostics: (diag: Diagnostic) => void = () => {}
  private options: ServerOptions
  private projectPath: string
  private tsLangService: ts.LanguageService
  private projectDirManager: ProjectDirManager

  constructor(options: ServerOptions) {
    this.options = options
    this.projectPath = path.join(process.cwd(), options.projectPath)
    const rootFullPaths: string[] = []

    // initialize ts language service
    /* eslint-disable @typescript-eslint/unbound-method */
    const configPath = ts.findConfigFile(this.projectPath, ts.sys.fileExists, 'tsconfig.json')
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
        configPath,
        { noEmit: true },
      )
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
        // !!! TODO
        console.info('!!! getScriptFileNames', rootFullPaths)
        return rootFullPaths
      },
      getScriptVersion: (fileName) => {
        // !!! TODO
        console.info('!!! getScriptVersion', fileName)
        return this.projectDirManager.getFileVersion(fileName)?.toString() ?? ''
      },
      getScriptSnapshot: (fileName) => {
        const content = this.projectDirManager.getFileContent(fileName)
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
      readDirectory: (path, extensions, exclude, include, depth) => {
        console.info('!!! readDirectory', path, extensions, exclude, include, depth)
        return ts.sys.readDirectory(path, extensions, exclude, include, depth)
      },
      readFile: (path, encoding) => {
        console.info('!!! readFile', path, encoding)
        return ts.sys.readFile(path, encoding)
      },
      fileExists: (path) => {
        console.info('!!! fileExists', path, ts.sys.fileExists(path))
        return ts.sys.fileExists(path)
      },
      getDirectories: (directoryName) => {
        console.info('!!! getDirectories', directoryName)
        return ts.sys.getDirectories(directoryName)
      },
      directoryExists: (directoryName) => {
        console.info('!!! directoryExists', directoryName)
        return ts.sys.directoryExists(directoryName)
      },
    }
    /* eslint-enable @typescript-eslint/unbound-method */
    const docReg = ts.createDocumentRegistry()
    this.tsLangService = ts.createLanguageService(servicesHost, docReg)

    // initialize virtual file system
    this.projectDirManager = new ProjectDirManager(
      this.projectPath,
      options.scanAllComponents || false,
      () => {
        // collect all entrance files
        if (options.scanAllComponents) {
          this.projectDirManager.getEntranceFiles().forEach((relPath) => {
            const extname = path.extname(relPath)
            if (extname === '.wxml') {
              this.logVerboseMessage(`Found component WXML: ${relPath}`)
              const tsContent = this.projectDirManager.getFileContent(relPath)
              if (tsContent !== null) {
                const tsPath = `${relPath.slice(0, -extname.length)}.ts`
                const fullPath = path.join(this.projectPath, tsPath)
                rootFullPaths.push(fullPath)
              }
            }
            // this.analyzeWxmlFile(relPath)
          })
        }

        // run all ts files
        rootFullPaths.forEach((relPath) => {
          this.analyzeTsFile(relPath)
        })

        // callback
        this.options?.onFirstScanDone?.call(this)
      },
    )
  }

  end() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.projectDirManager.stop()
  }

  private analyzeTsFile(fullPath: string) {
    const services = this.tsLangService
    const allDiagnostics = services
      .getCompilerOptionsDiagnostics()
      .concat(services.getSyntacticDiagnostics(fullPath))
      .concat(services.getSemanticDiagnostics(fullPath))
    allDiagnostics.forEach((diag) => {
      this.diagnosticReporter(diag)
    })
  }

  private logTsMessage(message: string) {
    if (this.options.showTypeScriptMessages) {
      // eslint-disable-next-line no-console
      console.log(chalk.gray(message))
    }
  }

  private logVerboseMessage(message: string) {
    if (this.options.verboseMessages) {
      // eslint-disable-next-line no-console
      console.log(chalk.gray(message))
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private watchStatusReporter(
    diagnostic: ts.Diagnostic,
    _newLine: string,
    _options: ts.CompilerOptions,
    _errorCount?: number,
  ) {
    this.logTsMessage(`${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}\n`)
  }

  // eslint-disable-next-line class-methods-use-this
  private diagnosticReporter(diagnostic: ts.Diagnostic) {
    if (!this.options.reportTypeScriptDiagnostics) return
    const file = diagnostic.file
    if (!file) return
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
    this.onNewDiagnostics({
      file: file.fileName,
      start,
      end,
      code: diagnostic.code,
      level,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    })
  }
}
