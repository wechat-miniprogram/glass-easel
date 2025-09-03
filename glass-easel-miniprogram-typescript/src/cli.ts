import { parseArgs } from 'util'
import chalk from 'chalk'
import { DiagnosticLevel, Server } from './server'

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
  showTypeScriptMessages: true,
  onNewDiagnostics(diag) {
    // eslint-disable-next-line no-console
    console.log(chalk.gray(`${diag.file}:${diag.start.line}:${diag.start.character}`))
    if (diag.level === DiagnosticLevel.Error) {
      // eslint-disable-next-line no-console
      console.error(chalk.red(diag.message))
    } else if (diag.level === DiagnosticLevel.Warning) {
      // eslint-disable-next-line no-console
      console.warn(chalk.yellow(diag.message))
    } else if (diag.level === DiagnosticLevel.Info) {
      // eslint-disable-next-line no-console
      console.info(chalk.blue(diag.message))
    } else {
      // eslint-disable-next-line no-console
      console.log(chalk.white(diag.message))
    }
    // eslint-disable-next-line no-console
    console.log('')
  },
  onFirstScanDone() {
    server.end()
  },
})
