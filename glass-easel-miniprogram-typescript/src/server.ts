import * as ts from 'typescript'
import chalk from 'chalk'

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
  showTypeScriptMessages?: boolean
  reportTypeScriptDiagnostics?: boolean
  onFirstScanDone?: (this: Server) => void
  onNewDiagnostics?: (diag: Diagnostic) => void
}

export class Server {
  private onFirstScanDone: (this: Server) => void = () => {}
  private onNewDiagnostics: (diag: Diagnostic) => void = () => {}
  private options: ServerOptions
  private tsWatcher: ts.WatchOfConfigFile<ts.SemanticDiagnosticsBuilderProgram>

  constructor(options: ServerOptions) {
    this.options = options
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const configPath = ts.findConfigFile(options.projectPath, ts.sys.fileExists, 'tsconfig.json')
    if (configPath === undefined) {
      throw new Error('tsconfig.json not found')
    }
    const hostCreator = ts.createWatchCompilerHost(
      configPath,
      { noEmit: true },
      ts.sys,
      ts.createSemanticDiagnosticsBuilderProgram,
      this.diagnosticReporter.bind(this),
      this.watchStatusReporter.bind(this),
      undefined,
      undefined,
    )
    const origPostProgramCreate = hostCreator.afterProgramCreate?.bind(hostCreator)
    hostCreator.afterProgramCreate = (program) => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return
      Promise.resolve().then(() => {
        this.onFirstScanDone.call(this)
        return undefined
      })
      origPostProgramCreate?.(program)
    }
    this.onFirstScanDone = options.onFirstScanDone ?? this.onFirstScanDone
    this.onNewDiagnostics = options.onNewDiagnostics ?? this.onNewDiagnostics
    this.tsWatcher = ts.createWatchProgram(hostCreator)
  }

  end() {
    this.tsWatcher.close()
  }

  private logTsMessage(message: string) {
    if (this.options.showTypeScriptMessages) {
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
