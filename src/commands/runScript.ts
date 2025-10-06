import type colorize from '@simon_he/colorize'
import type { pushHistory } from '../history.js'

export async function runScript(
  termStart: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'make',
  script: string,
  prefix: string,
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
  if (script && arg && arg !== script) {
    // slight reformatting of the original message

    console.log(
      colorizeFn({
        text: `🤔 ${colorizeFn({ text: `'${argv[0]}'`, color: 'cyan' })} ${
          isZhFlag ? '自动的为您匹配成' : 'automatically match for you'
        } ${colorizeFn({
          text: `'${script}${prefix ? ` ${prefix}` : ''}'`,
          color: 'cyan',
        })} `,
        color: 'yellow',
      }),
    )
  }
 else if (script) {
    console.log(
      colorizeFn({
        text: `🤔 is running for you... ${script}`,
        color: 'magenta',
      }),
    )
  }

  switch (termStart) {
    case 'npm': {
      const { status: _status, result: _result } = await jsShellFn(
        `npm run ${script}${prefix ? ` -- ${prefix}` : ''}`,
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
        `pnpm run ${script}${prefix ? ` ${prefix}` : ''}`,
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
          `npm run ${script}${prefix ? ` -- ${prefix}` : ''}`,
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
        `yarn ${script}${prefix ? ` ${prefix}` : ''}`,
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
        `bun run ${script} ${prefix}`,
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
        `make ${script} ${prefix}`,
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
    await pushHistoryFn(`prun ${script}${prefix ? ` ${prefix}` : ''}`)
    return console.log(
      colorizeFn({
        color: 'green',
        text: `\nprun '${script}${
          prefix ? ` ${prefix}` : ''
        }' ${successText} 🎉`,
      }),
    )
  }

  return console.log(
    colorizeFn({
      color: 'red',
      text: `\ncommand ${colorizeFn({
        bold: true,
        color: 'cyan',
        text: `'${script || argv[0]}${prefix ? ` ${prefix}` : ''}'`,
      })} ${failedText} ❌`,
    }),
  )
}
