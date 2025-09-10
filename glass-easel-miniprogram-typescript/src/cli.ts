import { parseArgs } from 'util'
import { DiagnosticLevel, formatDiagnostic, Server } from './server'

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    path: {
      type: 'string',
      short: 'p',
      default: '.',
    },
    verbose: {
      type: 'boolean',
      short: 'v',
    },
  },
  strict: true,
})

const server = new Server({
  projectPath: values.path,
  reportTypeScriptDiagnostics: true,
  scanAllComponents: true,
  verboseMessages: values.verbose,
  onNewDiagnostics(diag) {
    // eslint-disable-next-line no-console
    if (diag.level === DiagnosticLevel.Error) {
      // eslint-disable-next-line no-console
      console.error(formatDiagnostic(diag))
    } else if (diag.level === DiagnosticLevel.Warning) {
      // eslint-disable-next-line no-console
      console.warn(formatDiagnostic(diag))
    } else if (diag.level === DiagnosticLevel.Info) {
      // eslint-disable-next-line no-console
      console.info(formatDiagnostic(diag))
    } else {
      // eslint-disable-next-line no-console
      console.log(formatDiagnostic(diag))
    }
  },
  onFirstScanDone() {
    server.end()
  },
})
