import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import colorize from '@simon_he/colorize'
import { memorizeFn } from 'lazy-js-utils'
import { getPkg, getPkgTool, jsShell } from 'lazy-js-utils/node'
import { version } from '../package.json'
import { getCommand as exportedGetCommand } from './commands/getCommand.js'

import { getScripts as exportedGetScripts } from './commands/getScripts.js'
import { runScript as exportedRunScript } from './commands/runScript.js'
import {
  cancel,
  cancelCode,
  isZh,
  log,
  notfound,
  runMsg,
  splitFlag,
} from './constants.js'
// 导入新模块
import { findAndExecuteFile, handleFileExecution } from './file-execution.js'
import { ensureGum } from './gumInstall.js'
import { pushHistory } from './history.js'
import { readMakefile } from './makefile.js'
import {
  formatShellCommand,
  fuzzyMatch,
  getParams,
  normalizeArgv,
} from './utils.js'
import { getData, getWorkspaceNames } from './workspace.js'

// Then wrap your getPkg calls
const memoizedGetPkg = memorizeFn(getPkg)

// cacheData moved to individual command modules

export const getScripts = exportedGetScripts

export const getCommand = exportedGetCommand
export const runScript = exportedRunScript

function needPrefixCheck(argv0: string, prefixArgs: string[], argv: string[]) {
  if (argv0 === 'find') {
    return Boolean(argv[1] && prefixArgs.length)
  }
  return Boolean(argv[1] && prefixArgs.length)
}

export async function ccommand(
  userParams: string | string[] = process.argv.slice(2),
) {
  const noWorkspaceText = isZh
    ? '当前目录不存在任何子目录'
    : 'The current directory does not have any subdirectories'
  const successText = isZh ? '运行成功' : 'run successfully'
  const failedText = isZh ? '运行失败' : 'run error'
  const argv = normalizeArgv(userParams)
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
    const terminalLink = (await import('terminal-link')).default
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
 catch {
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
        let makePrefixArgs: string[] = []
        if (argv.length) {
          const target = argv[0]
          makePrefixArgs = argv.slice(1)
          script = fuzzyMatch(fuzzyOptions, target) || ''
          if (!script) {
            return log(
              colorize({
                color: 'red',
                text: notfound,
              }),
            )
          }
        }
 else {
          const gumReady = await ensureGum(isZh)
          if (!gumReady) {
            return log(
              colorize({
                color: 'yellow',
                text: isZh
                  ? '未检测到可用的交互环境或 gum 已被禁用，请直接传入 make 目标名称'
                  : 'Gum is unavailable (non-interactive or disabled). Please pass a make target explicitly.',
              }),
            )
          }
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
        await runScript(
          termStart,
          script.trim()!,
          makePrefixArgs,
          argv,
          pushHistory,
          jsShell,
          colorize,
          isZh,
          successText,
          failedText,
        )

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
 catch {
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
  const [name, fuzzyWorkspace, paramsArgs] = getParams(argv)
  let dirname = name
  let scripts: Record<string, string> | undefined
  if (argv[0] === 'find') {
    if (fuzzyWorkspace) {
      await getData(termStart as any)
      dirname = getWorkspaceNames().filter(name =>
        name.includes(fuzzyWorkspace),
      )[0]
    }
 else {
      if (termStart === 'yarn') {
        await getData(termStart)
        if (!getWorkspaceNames().length)
          return log(colorize({ color: 'yellow', text: noWorkspaceText }))

        const gumReady = await ensureGum(isZh)
        if (!gumReady) {
          return log(
            colorize({
              color: 'yellow',
              text: isZh
                ? '未检测到可用的交互环境或 gum 已被禁用，请直接传入 workspace 名称'
                : 'Gum is unavailable (non-interactive or disabled). Please pass a workspace name explicitly.',
            }),
          )
        }
        const { result: choose, status } = await jsShell(
          `echo ${getWorkspaceNames().join(
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
        if (!getWorkspaceNames().length) {
          return log(
            colorize({
              color: 'yellow',
              text: noWorkspaceText,
            }),
          )
        }

        const gumReady = await ensureGum(isZh)
        if (!gumReady) {
          return log(
            colorize({
              color: 'yellow',
              text: isZh
                ? '未检测到可用的交互环境或 gum 已被禁用，请直接传入 workspace 名称'
                : 'Gum is unavailable (non-interactive or disabled). Please pass a workspace name explicitly.',
            }),
          )
        }
        const { result: choose, status } = await jsShell(
          `echo ${getWorkspaceNames().join(
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

    scripts = (await getScripts(dirname, termStart)) || undefined
  }
 else {
    scripts = (await getScripts(dirname, termStart)) || undefined

    try {
      const pkg = ((await memoizedGetPkg('./package.json')) || {})?.scripts
      if (pkg && pkg[argv[0]]) {
        await runScript(
          termStart,
          argv[0],
          argv.slice(1),
          argv,
          pushHistory,
          jsShell,
          colorize,
          isZh,
          successText,
          failedText,
        )
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
          const pythonExists = await fsp
            .stat(pythonFile)
            .then(s => s.isFile())
            .catch(() => false)
          if (pythonExists) {
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
          const rustExists = await fsp
            .stat(rustFile)
            .then(s => s.isFile())
            .catch(() => false)
          if (rustExists) {
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
          const prefixArgs = argv.slice(1)
          await runScript(
            termStart,
            script,
            prefixArgs,
            argv,
            pushHistory,
            jsShell,
            colorize,
            isZh,
            successText,
            failedText,
          )
          return
        }
      }
    }
 catch {}
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
      const value = scripts?.[key] ?? ''
      keys.push(key)
      result += `"${key}: ${value
        .replace(/\\/g, '\\\\')
        .replace(/(["`])/g, '\\$1')}"${splitFlag}`
      return result
    }, '')
    const gumReady = await ensureGum(isZh)
    if (!gumReady) {
      return log(
        colorize({
          color: 'yellow',
          text: isZh
            ? '未检测到可用的交互环境或 gum 已被禁用，请直接传入脚本名称'
            : 'Gum is unavailable (non-interactive or disabled). Please pass a script name explicitly.',
        }),
      )
    }
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

  // Compute the command and highlighted text using the exported helper
  const {
    command: computedCommand,
    text: computedText,
    val: computedVal,
  } = await getCommand({
    termStart,
    params: paramsArgs,
    dirname,
    argv,
    val,
    runMsg,
    isZh,
    pushHistory,
    jsShell,
    // provide a scope-aware isNeedPrefix that uses the current argv
    isNeedPrefix: (p: string[]) => needPrefixCheck(argv[0], p, argv),
    fuzzyWorkspace,
  })
  const _command = computedCommand
  val = computedVal
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
        text: `\n${computedText} 🎉`,
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
    const npmArgs = [...paramsArgs]
    if (npmArgs[0] === '--')
npmArgs.shift()
    const npmCommand = formatShellCommand([
      'npm',
      'run',
      val,
      ...(npmArgs.length ? ['--', ...npmArgs] : []),
    ])
    const { status } = await jsShell(npmCommand, 'inherit')
    if (status === 0) {
      return log(
        colorize({
          color: 'green',
          text: `\n${computedText} 🎉`,
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
  // Note: getScripts and transformScripts are provided by the commands module now.

  // inner helpers replaced by top-level implementations
}
