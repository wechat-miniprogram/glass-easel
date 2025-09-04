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
  private onFirstScanDone: (this: Server) => void = () => {}
  private onNewDiagnostics: (diag: Diagnostic) => void = () => {}
  private options: ServerOptions
  private tsLangService: ts.LanguageService
  private projectDirManager: ProjectDirManager

  constructor(options: ServerOptions) {
    this.options = options

    // initialize ts language service
    /* eslint-disable @typescript-eslint/unbound-method */
    const configPath = ts.findConfigFile(options.projectPath, ts.sys.fileExists, 'tsconfig.json')
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
        console.info(config.fileNames)
        return config.fileNames
      },
      getScriptVersion(fileName) {
        // !!! TODO
        console.info(fileName)
        return ''
      },
      getScriptSnapshot: (fileName) => {
        this.virtualFs.getFileContent(fileName)
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
      readDirectory: ts.sys.readDirectory,
      readFile: ts.sys.readFile,
      fileExists: ts.sys.fileExists,
      getDirectories: ts.sys.getDirectories,
      directoryExists: ts.sys.directoryExists,
    }
    /* eslint-enable @typescript-eslint/unbound-method */
    const docReg = ts.createDocumentRegistry()
    this.tsLangService = ts.createLanguageService(servicesHost, docReg)

    // initialize virtual file system
    this.projectDirManager = new ProjectDirManager(
      options.projectPath,
      options.scanAllComponents || false,
      () => {
        this.onFirstScanDone.call(this)
      },
    )
  }

  end() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.projectDirManager.stop()
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
