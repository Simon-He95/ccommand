import type colorize from '@simon_he/colorize'
import type { pushHistory } from '../history.js'
import { formatShellCommand } from '../utils.js'

export async function runScript(
  termStart: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'make',
  script: string,
  prefixArgs: string[],
  argv: string[],
  pushHistoryFn: typeof pushHistory,
  jsShellFn: any,
  colorizeFn: typeof colorize,
  isZhFlag: boolean,
  successText: string,
  failedText: string,
) {
  let status: number | null | undefined
  let result = ''
  const arg = argv[0]?.trim()
  const matchedDisplay = formatShellCommand([script, ...prefixArgs])
  const attemptedDisplay = formatShellCommand([
    script || argv[0] || '',
    ...prefixArgs,
  ])
  if (script && arg && arg !== script) {
    // slight reformatting of the original message

    console.log(
      colorizeFn({
        text: `🤔 ${colorizeFn({ text: `'${argv[0]}'`, color: 'cyan' })} ${
          isZhFlag ? '自动的为您匹配成' : 'automatically match for you'
        } ${colorizeFn({
          text: `'${matchedDisplay}'`,
          color: 'cyan',
        })} `,
        color: 'yellow',
      }),
    )
  }
 else if (script) {
    console.log(
      colorizeFn({
        text: `🤔 is running for you... ${matchedDisplay}`,
        color: 'magenta',
      }),
    )
  }

  const buildRunCommand = () => {
    switch (termStart) {
      case 'npm': {
        const args = ['run', script]
        if (prefixArgs.length) {
          if (prefixArgs[0] !== '--')
args.push('--')
          args.push(...prefixArgs)
        }
        return formatShellCommand(['npm', ...args])
      }
      case 'pnpm': {
        return formatShellCommand(['pnpm', 'run', script, ...prefixArgs])
      }
      case 'yarn': {
        return formatShellCommand(['yarn', script, ...prefixArgs])
      }
      case 'bun': {
        return formatShellCommand(['bun', 'run', script, ...prefixArgs])
      }
      case 'make': {
        return formatShellCommand(['make', script, ...prefixArgs])
      }
      default: {
        return formatShellCommand([script, ...prefixArgs])
      }
    }
  }
  const buildNpmCommand = () => {
    const args = ['run', script]
    if (prefixArgs.length) {
      if (prefixArgs[0] !== '--')
args.push('--')
      args.push(...prefixArgs)
    }
    return formatShellCommand(['npm', ...args])
  }

  switch (termStart) {
    case 'npm': {
      const { status: _status, result: _result } = await jsShellFn(
        buildRunCommand(),
        {
          errorExit: false,
          isLog: false,
          stdio: 'inherit',
        },
      )
      status = _status
      result = _result
      break
    }
    case 'pnpm': {
      const { status: _status, result: _result = '' } = await jsShellFn(
        buildRunCommand(),
        {
          errorExit: false,
          isLog: false,
          stdio: 'inherit',
        },
      )
      result = _result
      status = _status
      if (
        result.includes('pnpm versions with respective Node.js version support')
      ) {
        console.log(
          colorizeFn({
            text: isZhFlag
              ? '正在尝试使用 npm 再次执行...'
              : 'Trying to use npm to run again...',
            color: 'yellow',
          }),
        )
        const { status: _status, result: _result } = await jsShellFn(
          buildNpmCommand(),
          {
            errorExit: false,
            isLog: false,
            stdio: 'inherit',
          },
        )
        status = _status
        result = _result
      }
      break
    }
    case 'yarn': {
      const { status: _status, result: _result } = await jsShellFn(
        buildRunCommand(),
        {
          errorExit: false,
          isLog: false,
          stdio: 'inherit',
        },
      )
      status = _status
      result = _result
      break
    }
    case 'bun': {
      const { status: _status, result: _result } = await jsShellFn(
        buildRunCommand(),
        {
          errorExit: false,
          isLog: false,
          stdio: 'inherit',
        },
      )
      status = _status
      result = _result
      break
    }
    case 'make': {
      const { status: _status, result: _result } = await jsShellFn(
        buildRunCommand(),
        {
          errorExit: false,
          isLog: false,
          stdio: 'inherit',
        },
      )
      status = _status
      result = _result
      break
    }
  }
  if (status === 0) {
    const historyCommand = formatShellCommand(['prun', script, ...prefixArgs])
    await pushHistoryFn(historyCommand)
    return console.log(
      colorizeFn({
        color: 'green',
        text: `\n${historyCommand} ${successText} 🎉`,
      }),
    )
  }

  return console.log(
    colorizeFn({
      color: 'red',
      text: `\ncommand ${colorizeFn({
        bold: true,
        color: 'cyan',
        text: `'${attemptedDisplay}'`,
      })} ${failedText} ❌`,
    }),
  )
}
