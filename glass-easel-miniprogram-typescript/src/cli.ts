import { parseArgs } from 'util'
import * as ts from 'typescript'
import { TmplGroup } from 'glass-easel-template-compiler'
import { type Diagnostic, DiagnosticLevel, Server } from './server'

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: {
      type: 'boolean',
    },
    path: {
      type: 'string',
      short: 'p',
      default: '.',
    },
    verbose: {
      type: 'boolean',
      short: 'v',
    },
    strict: {
      type: 'boolean',
      short: 's',
    },
    watch: {
      type: 'boolean',
      short: 'w',
    },
  },
  strict: true,
})

if (values.help) {
  // eslint-disable-next-line no-console
  console.log(`Usage: miniprogram-typescript-check [options]

Options:
  -h, --help            Show this help message and exit
  -p, --path <path>     The path of the mini-program project (default: .)
  -w, --watch           Watch the project and analyze on change
  -s, --strict          Enable strict mode (avoid using \`any\` types when possible)
  -v, --verbose         Print verbose messages
`)
  process.exit(0)
}

const logDiagnostic = (diag: Diagnostic) => {
  // eslint-disable-next-line no-console
  if (diag.level === DiagnosticLevel.Error) {
    // eslint-disable-next-line no-console
    console.error(server.formatDiagnostic(diag))
  } else if (diag.level === DiagnosticLevel.Warning) {
    // eslint-disable-next-line no-console
    console.warn(server.formatDiagnostic(diag))
  } else if (diag.level === DiagnosticLevel.Info) {
    // eslint-disable-next-line no-console
    console.info(server.formatDiagnostic(diag))
  } else {
    // eslint-disable-next-line no-console
    console.log(server.formatDiagnostic(diag))
  }
}

let success = true

const server = new Server({
  typescriptNodeModule: ts,
  tmplGroup: new TmplGroup(),
  projectPath: values.path,
  verboseMessages: values.verbose,
  strictMode: values.strict,
  onFirstScanDone() {
    this.getConfigErrors().forEach((diag) => {
      success = false
      logDiagnostic(diag)
    })
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      await this.waitPendingAsyncTasks()
      if (!values.watch) {
        server.end()
        if (!success) process.exit(1)
      }
      return undefined
    })()
  },
  onDiagnosticsNeedUpdate(fullPath: string) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      const diags = await this.analyzeWxmlFile(fullPath)
      if (diags.length) success = false
      diags.forEach(logDiagnostic)
      return undefined
    })()
  },
})
