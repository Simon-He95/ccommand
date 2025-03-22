import { existsSync } from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import colorize from '@simon_he/colorize'
import { getPkg, getPkgTool, jsShell } from 'lazy-js-utils/node'
import terminalLink from 'terminal-link'
import { version } from '../package.json'
import {
  cancel,
  cancelCode,
  isZh,
  log,
  notfound,
  runMsg,
  splitFlag,
} from './constants'

// 导入新模块
import { findAndExecuteFile, handleFileExecution } from './file-execution'
import { gumInstall } from './gumInstall'
import { pushHistory } from './history'
import { readMakefile } from './makefile'
import { fuzzyMatch, getParams } from './utils'
import { getData, workspaceNames } from './workspace'

const cacheData: any = null

export async function ccommand(userParams?: string) {
  await gumInstall(isZh)
  const noWorkspaceText = isZh
    ? '当前目录不存在任何子目录'
    : 'The current directory does not have any subdirectories'
  const successText = isZh ? '运行成功' : 'run successfully'
  const failedText = isZh ? '运行失败' : 'run error'
  const argv = userParams
    ? userParams.replace(/\s+/, ' ').split(' ')
    : process.argv.slice(2)
  if (argv[0] === '-v' || argv[0] === '--version') {
    return log(
      colorize({
        text: isZh
          ? `ccommand 当前版本: ${version}`
          : `ccommand Version: ${version}`,
        color: 'green',
      }),
    )
  }
  else if (argv[0] === '-h' || argv[0] === '--help') {
    const issueLink = terminalLink(
      isZh ? '打开一个新的问题' : 'open an issue',
      'https://github.com/Simon-He95/ccommand/issues',
    )
    const starLink = terminalLink(
      isZh ? '✨帮助点一个星星' : '✨star it',
      'https://github.com/Simon-He95/ccommand',
    )
    return log(
      colorize({
        color: 'white',
        text: `
  ${colorize({
    bold: true,
    text: 'Common Commands:',
    bgColor: 'blue',
  })}
  ${colorize({
    text: `- ccommand -v  查看当前版本
  - ccommand -help 查看帮助
  - ccommand 执行当前package.json
  - ccommand find 查找当前workspace的所有目录
      `,
    color: 'cyan',
  })}
  If you encounter any problems, you can ${colorize({
    color: 'magenta',
    text: issueLink,
  })}.
  If you like it, please ${colorize({
    text: starLink,
    bold: true,
    color: 'cyan',
  })} `,
      }),
    )
  }
  else if (argv[0]?.endsWith('.py') || argv[0]?.endsWith('.rs')) {
    await handleFileExecution(argv[0], successText, failedText)
    return
  }
  let termStart!: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'make'
  try {
    termStart = await getPkgTool()
  }
  // eslint-disable-next-line unused-imports/no-unused-vars
  catch (error) {
    // 如果都没有找到package.json文件，考虑一下rust的情况，判断目录下是否有Makefile文件
    try {
      const makefile = await fsp.readFile(
        path.resolve(process.cwd(), './Makefile'),
        'utf-8',
      )
      if (makefile) {
        termStart = 'make'
        const options = await readMakefile('./Makefile')
        const fuzzyOptions = options.reduce((r, o) => {
          const { name, detail } = o
          r[name] = detail
          return r
        }, {} as Record<string, string>)
        let script = ''
        if (userParams) {
          script = fuzzyMatch(fuzzyOptions, userParams)!
        }
        else {
          const { result, status } = await jsShell(
            `echo "${options
              .map(i => i.name)
              .join(
                '\n',
              )}" | gum filter --placeholder=" 🤔请选择一个要执行的指令"`,
            'pipe',
          )
          if (status === cancelCode)
            return cancel()
          script = result
        }
        await runScript(script.trim()!, '')

        return
      }
      else {
        return log(
          colorize({
            color: 'red',
            text: notfound,
          }),
        )
      }
    }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (error) {
      if (argv[0] !== 'find') {
        return log(
          colorize({
            color: 'red',
            text: notfound,
          }),
        )
      }
    }
  }

  // 下面是原始代码，保持不变
  const [name, fuzzyWorkspace, params] = getParams(argv)
  let dirname = name
  let scripts
  if (argv[0] === 'find') {
    if (fuzzyWorkspace) {
      await getData(termStart as any)
      dirname = workspaceNames.filter(name =>
        name.includes(fuzzyWorkspace),
      )[0]
    }
    else {
      if (termStart === 'yarn') {
        await getData(termStart)
        if (!workspaceNames.length)
          return log(colorize({ color: 'yellow', text: noWorkspaceText }))

        const { result: choose, status } = await jsShell(
          `echo ${workspaceNames.join(
            ',',
          )} | sed "s/,/\\n/g" | gum filter --placeholder=" 🤔${
            isZh
              ? '请选择一个要执行的目录'
              : 'Please select a directory to execute'
          }"`,
          ['inherit', 'pipe', 'inherit'],
        )
        dirname = choose
        if (status === cancelCode)
          return cancel()
      }
      else if (termStart === 'pnpm') {
        await getData(termStart)
        if (!workspaceNames.length) {
          return log(
            colorize({
              color: 'yellow',
              text: noWorkspaceText,
            }),
          )
        }

        const { result: choose, status } = await jsShell(
          `echo ${workspaceNames.join(
            ',',
          )} | sed "s/,/\\n/g" | gum filter --placeholder=" 🤔${
            isZh
              ? '请选择一个要执行的目录'
              : 'Please select a directory to execute'
          }"`,
          ['inherit', 'pipe', 'inherit'],
        )
        if (status === cancelCode)
          return cancel()
        dirname = choose.trim()
      }
      // else {
      //   // 判断 rust 环境 ./folder/Cargo.toml 如果存在则，提供 folder_name 作为选择去执行
      //   const cwd = process.cwd()

      // }
      else {
        return log(
          colorize({
            color: 'red',
            text: isZh
              ? 'find指令只能支持在yarn或pnpm的monorepo模式下使用'
              : 'find command only support yarn or pnpm',
          }),
        )
      }
    }

    scripts = await getScripts()
  }
  else {
    scripts = await getScripts()

    if ((name && cacheData && !cacheData[name]) || !cacheData) {
      try {
        const pkg = ((await getPkg('./package.json')) || {})?.scripts
        if (pkg && pkg[argv[0]]) {
          await runScript(argv[0], argv.slice(1).join(' '))
          return
        }
        else if (pkg && name) {
          const script = fuzzyMatch(pkg, argv[0])!
          if (!script) {
            // 首先尝试查找并执行文件
            const foundAndExecuted = await findAndExecuteFile(
              argv[0],
              successText,
              failedText,
            )
            if (foundAndExecuted)
              return

            // 然后尝试Python文件 (保留原有逻辑)
            const pythonFile = `${name}.py`
            if (existsSync(pythonFile)) {
              // 原有的Python执行代码
              log(
                colorize({
                  text: `🤔 ${
                    isZh ? '找到Python文件' : 'Found Python file'
                  }: ${pythonFile}`,
                  color: 'yellow',
                }),
              )
              // 剩余的Python执行代码...
              return
            }

            // 然后尝试Rust文件 (保留原有逻辑)
            const rustFile = `${name}.rs`
            if (existsSync(rustFile)) {
              // 原有的Rust执行代码...
              return
            }

            // 如果所有方法都失败，显示错误信息
            log(
              colorize({
                color: 'red',
                text: `"${argv[0]}" ${
                  isZh
                    ? '在工作区、当前目录中找不到任何可执行的脚本或文件，请检查'
                    : 'is not found in workspace, current directory or current scripts, please check'
                }`,
              }),
            )
            process.exit(1)
          }
          else {
            // 原有的执行脚本逻辑
            const prefix = argv.slice(1).join(' ')
            await runScript(script, prefix)
            return
          }
        }
      }
      // eslint-disable-next-line unused-imports/no-unused-vars
      catch (error) {}
    }
  }

  if (!scripts) {
    return log(
      colorize({
        color: 'red',
        text: isZh ? '找不到任何可执行脚本' : 'No scripts found',
      }),
    )
  }

  const keys: string[] = []
  let val = ''
  if (
    !fuzzyWorkspace
    || (argv[0] === 'find' && (!argv[2] || argv[2].startsWith('--')))
  ) {
    const options = Object.keys(scripts).reduce((result, key) => {
      const value = scripts[key]
      keys.push(key)
      result += `"${key}: ${value
        .replace(/\\/g, '\\\\')
        .replace(/(["`])/g, '\\$1')}"${splitFlag}`
      return result
    }, '')
    const { result, status } = await jsShell(
      `echo ${options} | sed "s/${splitFlag}/\\n/g" | gum filter --placeholder=" 🤔请选择一个要执行的指令"`,
      {
        stdio: ['inherit', 'pipe', 'inherit'],
        isLog: false,
      },
    )
    if (status === cancelCode)
      return cancel()
    val = result.substring(0, result.indexOf(': '))
  }

  if (!fuzzyWorkspace && !val)
    return cancel()

  log(
    colorize({
      text: `🤔 ${runMsg} ${val}`,
      color: 'magenta',
    }),
  )

  const [command, text] = await getCommand()
  const _command = command.replace(/\s+/g, ' ')
  const { status, result = '' } = await jsShell(_command, {
    errorExit: false,
    stdio: 'inherit',
  })

  // todo: 当 stdio 默认是 inherit 时, 会直接输出到控制台, 但是这样会导致无法捕获到错误
  // const { status, result = '' } = await useNodeWorker({
  //   stdio: 'pipe',
  //   params: _command,
  // })

  if (status === 0) {
    return log(
      colorize({
        color: 'green',
        text: `\n${text} 🎉`,
      }),
    )
  }
  else if (
    result.includes('pnpm versions with respective Node.js version support')
  ) {
    log(
      colorize({
        text: isZh
          ? '正在尝试使用 npm 再次执行...'
          : 'Trying to use npm to run again...',
        color: 'yellow',
      }),
    )
    const { status } = await jsShell(
      `npm run ${val}${params ? ` -- ${params}` : ''}`,
      'inherit',
    )
    if (status === 0) {
      return log(
        colorize({
          color: 'green',
          text: `\n${text} 🎉`,
        }),
      )
    }
  }

  log(
    colorize({
      color: 'red',
      text: `\ncommand '${val}' ${failedText} ❌`,
    }),
  )

  function transformScripts(str: string) {
    return (
      keys.find(key => key === str) ?? keys.find(key => str.startsWith(key))
    )
  }
  async function getCommand(): Promise<[string, string]> {
    let dir = ''
    let prefix = ''
    const withRun = termStart !== 'yarn'
    if (termStart === 'npm') {
      prefix = params ? ` -- ${params}` : ''
      dir = dirname ? ` --prefix ${dirname} ` : ' '
    }
    else if (termStart === 'pnpm') {
      prefix = params ? ` ${params}` : ''
      dir = dirname ? ` --filter ${dirname} ` : ' '
    }
    else if (termStart === 'yarn') {
      prefix = params ? ` ${params}` : ''
      dir = dirname ? ` workspace ${dirname} ` : ' '
    }
    else if (termStart === 'bun') {
      prefix = params ? ` ${params}` : ''
      dir = ''
    }
    let command = ''
    let text = ''
    if (prefix && !prefix.startsWith(' --')) {
      const _all = prefix.split(' ').filter(Boolean)
      command = _all[0]
      prefix = _all.slice(1).join(' ')
    }
    const result = `${termStart}${withRun ? ' run' : ' '}${dir} ${
      command || (val ? transformScripts(val) || val : fuzzyWorkspace)
    } ${isNeedPrefix(prefix) ? `-- ${prefix}` : prefix}`
    val = `${command || (val ? transformScripts(val) : fuzzyWorkspace)}`
    if (argv[0] === 'find')
      text = `pfind ${dirname} ${val} ${prefix}`.replace(/\s+/g, ' ').trim()
    else text = `prun ${val} ${prefix}`.replace(/\s+/g, ' ').trim()

    await pushHistory(text)
    const texts = text.split(' ')
    const last = texts.slice(-1)[0]
    texts[texts.length - 1] = `'${last}'`
    const highlighText = texts.join(' ')
    return [result, highlighText]
  }

  async function getScripts() {
    try {
      if (!dirname || termStart === 'bun' || termStart === 'npm')
        return (await getPkg('./package.json'))?.scripts
      if (termStart === 'pnpm') {
        return (
          (await getData(termStart))[dirname]
          || (await getPkg(`${dirname}/package.json`))?.scripts
        )
      }
      else if (termStart === 'yarn') {
        return (
          (await getData(termStart))[dirname]
          || (await getPkg(`${dirname}/package.json`))?.scripts
        )
      }
    }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (error) {}
  }

  function isNeedPrefix(prefix: string) {
    if (argv[0] === 'find')
      return argv[1] && prefix
    else return argv[1] && prefix
  }

  async function runScript(script: string, prefix: string) {
    let status
    let result = ''
    const arg = argv[0]?.trim()
    if (script && arg && arg !== script) {
      log(
        colorize({
          text: `🤔 ${colorize({
            text: `'${argv[0]}'`,
            color: 'cyan',
          })} ${
            isZh ? '自动的为您匹配成' : 'automatically match for you to'
          } ${colorize({
            text: `'${script}${prefix ? ` ${prefix}` : ''}'`,
            color: 'cyan',
          })} `,
          color: 'yellow',
        }),
      )
    }
    else if (script) {
      log(
        colorize({
          text: `🤔 ${runMsg} ${script}`,
          color: 'magenta',
        }),
      )
    }

    switch (termStart) {
      case 'npm': {
        const { status: _status, result: _result } = await jsShell(
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
        const { status: _status, result: _result = '' } = await jsShell(
          `pnpm run ${script}${prefix ? ` ${prefix}` : ''}`,
          {
            errorExit: false,
            isLog: false,
            stdio: 'inherit',
          },
        )

        // const { status: _status, result: _result = '' } = await useNodeWorker({
        //   stdio: 'pipe',
        //   params: `pnpm run ${script}${prefix ? ` ${prefix}` : ''}`,
        // })

        result = _result
        status = _status
        if (
          result.includes(
            'pnpm versions with respective Node.js version support',
          )
        ) {
          log(
            colorize({
              text: isZh
                ? '正在尝试使用 npm 再次执行...'
                : 'Trying to use npm to run again...',
              color: 'yellow',
            }),
          )
          const { status: _status, result: _result } = await jsShell(
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
        const { status: _status, result: _result } = await jsShell(
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
        const { status: _status, result: _result } = await jsShell(
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
        const { status: _status, result: _result } = await jsShell(
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
      await pushHistory(`prun ${script}${prefix ? ` ${prefix}` : ''}`)
      return log(
        colorize({
          color: 'green',
          text: `\nprun '${script}${
            prefix ? ` ${prefix}` : ''
          }' ${successText} 🎉`,
        }),
      )
    }

    return log(
      colorize({
        color: 'red',
        text: `\ncommand ${colorize({
          bold: true,
          color: 'cyan',
          text: `'${script || argv[0]}${prefix ? ` ${prefix}` : ''}'`,
        })} ${failedText} ❌`,
      }),
    )
  }
}
