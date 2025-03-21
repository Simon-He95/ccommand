import fsp from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'path'
import { getPkg, getPkgTool, jsShell } from 'lazy-js-utils/node'
import { isPlainObject } from 'lazy-js-utils'
import fg from 'fast-glob'
import colorize from '@simon_he/colorize'
import terminalLink from 'terminal-link'
import { version } from '../package.json'
import { gumInstall } from './gumInstall'
import { readMakefile } from './makefile'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const YAML = require('yamljs')

let workspaceNames: string[] = []
let cacheData: any = null
const log = console.log
const splitFlag = '__ccommand__split'
const isZh = process.env.PI_Lang === 'zh'
const cancelCode = 130
const cancelledText = isZh ? '已取消...' : 'Cancelled...'
const notfound = isZh
  ? '当前目录并未找到package.json文件'
  : 'The current directory and not found package.json file'

const runMsg = isZh ? '正在为您执行...' : 'is running for you...'

async function executeFile(
  filePath: string,
  command: string,
  successText: string,
  failedText: string,
) {
  await pushHistory(`prun ${filePath}`)
  const { status } = await jsShell(command, {
    errorExit: false,
    isLog: false,
    stdio: 'inherit',
  })

  log(
    colorize({
      color: status === 0 ? 'green' : 'red',
      text: `\n"prun ${filePath}" ${status === 0 ? successText : failedText} ${
        status === 0 ? '🎉' : '❌'
      }`,
    }),
  )
}

async function handleFileExecution(
  argv0: string,
  successText: string,
  failedText: string,
) {
  if (argv0.endsWith('.py')) {
    await executeFile(argv0, `python ${argv0}`, successText, failedText)
  }
  else if (argv0.endsWith('.rs')) {
    const compileStatus = (await jsShell(`rustc ${argv0}`)).status
    if (compileStatus === 0) {
      await pushHistory(`prun ${argv0}`)
      await jsShell(`./${argv0.slice(0, argv0.length - 3)}`, 'inherit')
      log(
        colorize({
          color: 'green',
          text: `\n"prun ${argv0}" ${successText} 🎉`,
        }),
      )
    }
    else {
      log(
        colorize({
          color: 'red',
          text: `\ncommand "prun ${argv0}" ${failedText} ❌`,
        }),
      )
    }
  }
}

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
  const [name, fuzzyWorkspace, params] = getParams(argv)
  let dirname = name
  let scripts: Record<string, string>
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
            // 检查是否存在Python文件
            const pythonFile = `${name}.py`
            if (existsSync(pythonFile)) {
              log(
                colorize({
                  text: `🤔 ${
                    isZh ? '找到Python文件' : 'Found Python file'
                  }: ${pythonFile}`,
                  color: 'yellow',
                }),
              )
              await pushHistory(`prun ${pythonFile}`)

              const { status } = await jsShell(`python ${pythonFile}`, {
                errorExit: false,
                isLog: false,
                stdio: 'inherit',
              })

              if (status === 0) {
                log(
                  colorize({
                    color: 'green',
                    text: `\n"prun ${pythonFile}" ${successText} 🎉`,
                  }),
                )
              }
              else {
                log(
                  colorize({
                    color: 'red',
                    text: `\ncommand ${colorize({
                      bold: true,
                      color: 'cyan',
                      text: `"prun ${pythonFile}"`,
                    })} ${failedText} ❌`,
                  }),
                )
              }
              return
            }
            // 检查是否存在Rust文件
            const rustFile = `${name}.rs`
            if (existsSync(rustFile)) {
              log(
                colorize({
                  text: `🤔 ${
                    isZh ? '找到Rust文件' : 'Found Rust file'
                  }: ${rustFile}`,
                  color: 'yellow',
                }),
              )
              await pushHistory(`prun ${rustFile}`)

              // 编译Rust文件
              const { status: compileStatus } = await jsShell(
                `rustc ${rustFile}`,
                {
                  errorExit: false,
                  isLog: false,
                  stdio: 'inherit',
                },
              )

              if (compileStatus === 0) {
                // 运行编译后的文件
                const { status: runStatus } = await jsShell(`./${argv[0]}`, {
                  errorExit: false,
                  isLog: false,
                  stdio: 'inherit',
                })

                if (runStatus === 0) {
                  log(
                    colorize({
                      color: 'green',
                      text: `\n"prun ${rustFile}" ${successText} 🎉`,
                    }),
                  )
                }
                else {
                  log(
                    colorize({
                      color: 'red',
                      text: `\ncommand ${colorize({
                        bold: true,
                        color: 'cyan',
                        text: `"prun ${rustFile}"`,
                      })} ${failedText} ❌`,
                    }),
                  )
                }
              }
              else {
                log(
                  colorize({
                    color: 'red',
                    text: `\ncommand ${colorize({
                      bold: true,
                      color: 'cyan',
                      text: `"prun ${rustFile}"`,
                    })} ${failedText} ❌`,
                  }),
                )
              }
              return
            }

            log(
              colorize({
                color: 'red',
                text: `"${argv[0]}" ${
                  isZh
                    ? '在工作区、当前目录中找不到任何可执行的脚本,请检查'
                    : 'is not found in workspace, current directory or current scripts, please check'
                }`,
              }),
            )
            process.exit(1)
          }
          else {
            const prefix = argv.slice(1).join(' ')
            await runScript(script, prefix)
            return
          }
        }
      }
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

async function readWorkspaceFile(type: 'pnpm' | 'yarn'): Promise<string> {
  const filePath
    = type === 'pnpm'
      ? path.resolve(process.cwd(), 'pnpm-workspace.yaml')
      : path.resolve(process.cwd(), 'package.json')
  try {
    return await fsp.readFile(filePath, 'utf-8')
  }
  catch {
    return ''
  }
}

function parseWorkspacePackages(
  type: 'pnpm' | 'yarn',
  workspace: string,
): string[] {
  if (type === 'pnpm') {
    return YAML.parse(workspace)?.packages || []
  }
  else {
    const _workspace = JSON.parse(workspace)?.workspaces
    if (isPlainObject(_workspace))
      return _workspace?.packages || []

    return _workspace || []
  }
}

async function loadWorkspaceData(
  type: 'pnpm' | 'yarn',
): Promise<Record<string, Record<string, string>>> {
  if (cacheData)
    return cacheData

  const workspace = await readWorkspaceFile(type)
  const packages = parseWorkspacePackages(type, workspace)

  cacheData = (await readGlob(packages)) || {}
  workspaceNames = Object.keys(cacheData).filter(
    key => cacheData[key] && Object.keys(cacheData[key]).length,
  )

  return cacheData
}

async function readGlob(
  packages: string[],
): Promise<Record<string, Record<string, string>>> {
  if (!packages.length)
    return {}

  const entries = await fg(
    packages.map(v => `${v}/package.json`),
    { dot: true, ignore: ['**/node_modules/**'] },
  )

  const results = await Promise.all(
    entries.map(async (v) => {
      const pkg = await getPkg(v)
      if (!pkg)
        return null
      const { name, scripts } = pkg
      return { name, scripts }
    }),
  )

  return results.reduce((result, pkg) => {
    if (!pkg || !pkg.name || !pkg.scripts)
      return result

    result[pkg.name] = Object.keys(pkg.scripts).reduce((scripts, key) => {
      if (!key.startsWith('//'))
        scripts[key] = pkg.scripts[key]

      return scripts
    }, {} as Record<string, string>)

    return result
  }, {} as Record<string, Record<string, string>>)
}

export async function getData(
  type: 'pnpm' | 'yarn',
): Promise<Record<string, Record<string, string>>> {
  return loadWorkspaceData(type)
}

function getParams(params: string[]): [string, string, string] {
  const first = params[0]
  if (!first)
    return ['', '', '']
  if (first.startsWith('--'))
    return ['', '', params.join(' ')]
  if (params[1] && params[1].startsWith('--'))
    return [first, '', params.slice(1).join(' ')]

  return [first, params[1], params.slice(2).join(' ')]
}

function fuzzyMatch(scripts: Record<string, string>, params: string) {
  const keys = Object.keys(scripts)
  const result = keys.find(key => key.startsWith(params))
  if (result)
    return result
  try {
    const reg = new RegExp(params.split('').join('[_-\\w$.:]*'))
    return keys.find(key => reg.test(key))
  }
  catch (error) {
    log(
      colorize({
        text: `${isZh ? '正则错误' : 'RegExp error'}: ${error}`,
        color: 'red',
      }),
    )
    process.exit(1)
  }
}

function cancel() {
  log(colorize({ color: 'yellow', text: cancelledText }))
  return process.exit()
}

async function pushHistory(command: string) {
  log(
    colorize({
      text: `${isZh ? '快捷指令' : 'shortcut command'}: ${command}`,
      color: 'blue',
      bold: true,
    }),
  )
  // if (isWin()) {
  //   const env = process.env as any
  //   const historyFile = env.HOMEDRIVE + env.HOMEPATH
  //   try {
  //     let _history = await fsp.readFile(historyFile, 'utf8');
  //     const info = `${_history}${command}\n`
  //     fsp.writeFile(historyFile, info)
  //     await jsShell('source ~/.bash_history')
  //   } catch (error) {

  //   }
  // } else {
  const historyFile = `${process.env.HOME}/.zsh_history`
  try {
    if (!existsSync(historyFile))
      return
    const _history = await fsp.readFile(historyFile, 'utf8')
    // 构造Date对象,获取当前时间
    const now = new Date()
    // 调用getTime()获取UNIX时间戳(ms)
    const timestamp = now.getTime() / 1000
    const info = `${_history}: ${timestamp.toFixed(0)}:0;${command}\n`
    const infoSet: any[] = []
    // 过滤掉之前重复的指令
    info.split('\n').forEach((item) => {
      const command = item.split(';').slice(1).join(';')
      const targetIndex = infoSet.findIndex(
        i => i.split(';').slice(1).join(';') === command,
      )
      if (targetIndex !== -1)
        infoSet.splice(targetIndex, 1)

      infoSet.push(item)
    })
    const newInfo = infoSet.join('\n')

    // 写回history
    await fsp.writeFile(historyFile, newInfo)
  }
  catch (error) {
    // console.log(error)
  }
  // }
}
