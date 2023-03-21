import fs from 'fs'
import path from 'path'
import { getPkg, getPkgTool, jsShell } from 'lazy-js-utils'
import fg from 'fast-glob'
import colorize from '@simon_he/colorize'
import terminalLink from 'terminal-link'
import { version } from '../package.json'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const YAML = require('yamljs')

interface IParams {
  name: string
  scripts: Record<string, string>
}

let workspaceNames: string[] = []
let cacheData: any = null
const log = console.log

export async function ccommand() {
  const splitFlag = '__ccommand__split'
  const { status } = jsShell('gum -v', 'pipe')
  if (status !== 0) {
    log(colorize({ color: 'blue', text: 'install gum...' }))
    const { status } = jsShell('brew install gum')
    if (status !== 0) {
      const { status } = jsShell(`sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
    echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
    sudo apt update && sudo apt install gum`)
      if (status !== 0) {
        const link = terminalLink(
          'the official website of gum',
          'https://github.com/charmbracelet/gum#installation',
        )
        return log(
          colorize({
            color: 'red',
            text: `gum install error, you can install it yourself through ${colorize(
              { color: 'yellow', text: link, bold: true },
            )}`,
          }),
        )
      }
    }
    log(colorize({ color: 'green', text: 'gum install successfully 🎉' }))
  }
  const argv = process.argv.slice(2)
  if (argv[0] === '-v' || argv[0] === '--version') {
    return log(
      colorize({
        text: `ccommand Version: ${version}`,
        color: 'green',
      }),
    )
  }

  if (argv[0] === '-h' || argv[0] === '--help') {
    const issueLink = terminalLink(
      'open an issue',
      'https://github.com/Simon-He95/ccommand/issues',
    )
    const starLink = terminalLink(
      '✨star it',
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
  const termStart = getPkgTool()

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
        const { result: choose } = jsShell(
          `echo ${workspaceNames.join(
            ',',
          )} | sed "s/,/\\n/g" | gum filter --placeholder=" 🤔请选择一个要执行的目录"`,
          'pipe',
        )
        dirname = choose
        if (!dirname)
          return log(colorize({ color: 'yellow', text: '已取消' }))
      }
      else if (termStart === 'pnpm') {
        await getData(termStart)
        const { result: choose } = jsShell(
          `echo ${workspaceNames.join(
            ',',
          )} | sed "s/,/\\n/g" | gum filter --placeholder=" 🤔请选择一个要执行的目录"`,
          'pipe',
        )
        dirname = choose.trim()
        if (!dirname)
          return log(colorize({ color: 'yellow', text: '已取消' }))
      }
      else {
        return log(
          colorize({
            color: 'red',
            text: 'find command only support yarn or pnpm',
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
          log(
            colorize({
              text: `ccommand is executing ${colorize({
                color: 'cyan',
                text: `'${argv[0]}'`,
              })} 🤔 `,
              color: 'yellow',
            }),
          )
          return runScript(argv[0], argv.slice(1).join(' '))
        }
        else if (pkg && name) {
          const script = fuzzyMatch(pkg, argv[0])!
          const prefix = argv.slice(1).join(' ')
          return runScript(script, prefix)
        }
      }
      catch (error) {}
    }
    if (cacheData && !cacheData[argv[0]]) {
      log(
        colorize({
          color: 'red',
          text: `"${argv[0]}" is not found in workspace, current directory
      or current scripts, please check`,
        }),
      )
      process.exit()
    }
  }

  if (!scripts)
    return log(colorize({ color: 'red', text: 'No scripts found' }))

  const keys: string[] = []
  let val = ''
  if (
    !fuzzyWorkspace
    || (argv[0] === 'find' && (!argv[2] || argv[2].startsWith('--')))
  ) {
    const options = Object.keys(scripts).reduce((result, key) => {
      const value = scripts[key]
      keys.push(key)
      result += `"${key}: ${value.replace(/\"/g, '\'')}"${splitFlag}`
      return result
    }, '')
    const { result } = jsShell(
      `echo ${options} | sed "s/${splitFlag}/\\n/g" | gum filter --placeholder=" 🤔请选择一个要执行的指令"`,
      'pipe',
    )
    val = result.substring(0, result.indexOf(': '))
  }

  if (!fuzzyWorkspace && !val) {
    log(colorize({ color: 'yellow', text: '已取消' }))
    return process.exit()
  }

  const { status: _status } = await jsShell(getCommand())
  if (_status === 0) {
    log(
      colorize({
        color: 'green',
        text: `\ncommand '${
          (argv[0] === 'find' ? argv[2] : argv[1]) || val
        }' run successfully 🎉`,
      }),
    )
    return process.exit()
  }
  log(colorize({ color: 'red', text: `\ncommand '${val}' run error ❌` }))

  function transformScripts(str: string) {
    return (
      keys.find(key => key === str) ?? keys.find(key => str.startsWith(key))
    )
  }
  function getCommand(): string {
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

    if (prefix && !prefix.startsWith(' --')) {
      const _all = prefix.split(' ').filter(Boolean)
      command = _all[0]
      prefix = _all.slice(1).join(' ')
    }
    const result = `${termStart}${withRun ? ' run' : ' '}${dir} ${
      command || (val ? transformScripts(val) || val : fuzzyWorkspace)
    } ${isNeedPrefix(prefix) ? `-- ${prefix}` : prefix}`
    val = `${command || (val ? transformScripts(val) : fuzzyWorkspace)}`
    if (argv[0] === 'find') {
      log(
        colorize({
          text: `tips: pfind ${dirname} ${val} ${prefix}`.replace(/\s+/g, ' '),
          color: 'blue',
          bold: true,
        }),
      )
    }
    else {
      log(
        colorize({
          text: `tips: prun ${val} ${prefix}`.replace(/\s+/g, ' '),
          color: 'blue',
          bold: true,
        }),
      )
    }

    return result
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
    let _status
    if (script && argv[0] !== script) {
      log(
        colorize({
          text: `🤔 ${colorize({
            text: `'${argv[0]}'`,
            color: 'cyan',
          })} automatically match for you to ${colorize({
            text: `'${script}${prefix ? ` ${prefix}` : ''}'`,
            color: 'cyan',
          })} `,
          color: 'yellow',
        }),
      )
    }

    switch (termStart) {
      case 'npm': {
        const { status } = jsShell(
          `npm run ${script}${prefix ? ` -- ${prefix}` : ''}`,
        )
        _status = status
        break
      }
      case 'pnpm': {
        const { status } = jsShell(
          `pnpm run ${script}${prefix ? ` ${prefix}` : ''}`,
        )
        _status = status
        break
      }
      case 'yarn': {
        const { status: runStatus } = jsShell(
          `yarn ${script}${prefix ? ` ${prefix}` : ''}`,
        )
        _status = runStatus
        break
      }
      case 'bun': {
        const { status } = jsShell(`bun ${script} ${prefix}`)
        _status = status
        break
      }
    }
    if (_status === 0) {
      return log(
        colorize({
          color: 'green',
          text: `\ncommand '${script}${
            prefix ? ` ${prefix}` : ''
          }' run successfully 🎉`,
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
        })} run error ❌`,
      }),
    )
  }
}

async function getData(type: 'pnpm' | 'yarn') {
  if (cacheData)
    return cacheData
  const workspace
    = type === 'pnpm'
      ? await fs.readFileSync(
        path.resolve(process.cwd(), 'pnpm-workspace.yaml'),
        'utf-8',
      )
      : await fs.readFileSync(
        path.resolve(process.cwd(), 'package.json'),
        'utf-8',
      )
  const packages
    = type === 'pnpm'
      ? YAML.parse(workspace)?.packages || []
      : JSON.parse(workspace)?.workspaces || []
  cacheData = (await readGlob(packages)) || {}
  workspaceNames = Object.keys(cacheData).filter(
    key => cacheData[key] && Object.keys(cacheData[key]).length,
  )
  return cacheData
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

async function readGlob(packages: string[]) {
  if (!packages.length)
    return
  const entries = await fg(
    packages.map(v => `${v}/package.json`),
    { dot: true, ignore: ['**/node_modules/**'] },
  )
  return Promise.all(
    entries.map(async (v) => {
      const pkg = await getPkg(v)
      if (!pkg)
        return
      const { name, scripts } = pkg
      return { name, scripts }
    }) as Promise<IParams>[],
  ).then(v =>
    v.reduce((result, v) => {
      const { name, scripts } = v
      // 过滤没有scripts或name的子包
      if (!name || !scripts)
        return result
      result[name] = scripts
      return result
    }, {} as Record<string, Record<string, string>>),
  )
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
    log(colorize({ text: `RegExp error: ${error}`, color: 'red' }))
    process.exit(1)
  }
}

ccommand()
