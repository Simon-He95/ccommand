import fs from 'fs'
import path from 'path'
import { getPkg, getPkgTool, jsShell } from 'simon-js-tool'
import fg from 'fast-glob'
import chalk from 'chalk'
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
export async function ccommand() {
  const log = console.log
  const splitFlag = '__ccommand__split'
  const { status } = jsShell('gum -v', 'pipe')
  if (status !== 0) {
    log(chalk.blue('install gum...'))
    const { status } = jsShell('brew install gum')
    if (status !== 0) {
      const { status } = jsShell(`sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
    echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
    sudo apt update && sudo apt install gum`)
      if (status !== 0) {
        const link = terminalLink('the official website of gum', 'https://github.com/charmbracelet/gum#installation')
        return log(chalk.red('gum install error, you can install it yourself through ', chalk.yellow.bold(link)))
      }
    }
    log(chalk.green('gum install successfully'))
  }
  const argv = process.argv.slice(2)
  if (argv[0] === '-v' || argv[0] === '--version')
    return log(chalk.green(`ccommand Version: ${version}`))

  if (argv[0] === '-help') {
    const issueLink = terminalLink('open an issue', 'https://github.com/Simon-He95/ccommand/issues')
    const starLink = terminalLink('✨star it', 'https://github.com/Simon-He95/ccommand')
    return log(chalk.white(`
  ${chalk.bgBlueBright.bold('Common Command:')}
  ${chalk.cyanBright(`- ccommand -v  查看当前版本
  - ccommand -help 查看帮助
  - ccommand 执行当前package.json
  - ccommand find 查找当前workspace的所有目录
`)}
  If you encounter any problems, you can ${chalk.magentaBright(issueLink)}.
  If you like it, please ${chalk.cyan.bold(starLink)}`))
  }
  const [name, params] = getParams(argv)
  let dirname = name
  const termStart = getPkgTool()
  if (argv[0] === 'find') {
    if (termStart === 'yarn') {
      await getData(termStart)
      const { result: choose } = jsShell(`echo ${workspaceNames.join(',')} | sed "s/,/\\n/g" | gum filter --placeholder=" 🤔请选择一个要执行的目录"`, 'pipe')
      dirname = choose
      if (!dirname)
        return console.log(chalk.yellow('已取消'))
    }
    else if (termStart === 'pnpm') {
      await getData(termStart)
      const { result: choose } = jsShell(`echo ${workspaceNames.join(',')} | sed "s/,/\\n/g" | gum filter --placeholder=" 🤔请选择一个要执行的目录"`, 'pipe')
      dirname = choose.trim()
      if (!dirname)
        return console.log(chalk.yellow('已取消'))
    }
    else { return log(chalk.red('find command only support yarn or pnpm')) }
  }
  const scripts = await getScripts()
  if (!scripts)
    return log(chalk.red('No scripts found'))
  const keys: string[] = []
  const options = Object.keys(scripts).reduce((result, key) => {
    const value = scripts[key]
    keys.push(key)
    result += `"${key}: ${value}"${splitFlag}`
    return result
  }, '')
  const { result: val } = jsShell(`echo ${options} | sed "s/${splitFlag}/\\n/g" | gum filter --placeholder=" 🤔请选择一个要执行的指令" | cut -d' ' -f1`, 'pipe')
  if (!val) {
    log(chalk.yellow('已取消'))
    return process.exit()
  }
  jsShell(getCommand())

  function transformScripts(str: string) {
    return keys.find(key => str.startsWith(key))
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
      dir = dirname ? ` --filter ${dirname.slice(dirname.lastIndexOf('/') + 1)} ` : ' '
    }
    else if (termStart === 'yarn') {
      prefix = params ? ` ${params}` : ''
      dir = dirname ? ` workspace ${dirname.slice(dirname.lastIndexOf('/') + 1)} ` : ' '
    }
    else if (termStart === 'bun') {
      prefix = params ? ` ${params}` : ''
      dir = ''
    }
    return `${termStart}${withRun ? ' run' : ' '}${dir}${transformScripts(val)}${prefix}`
  }
  async function getScripts() {
    try {
      if (!dirname || termStart === 'bun' || termStart === 'npm')
        return (await getPkg('./package.json'))?.scripts
      if (termStart === 'pnpm')
        return (await getData(termStart))[dirname] || (await getPkg(`${dirname}/package.json`))?.scripts
      else if (termStart === 'yarn')
        return (await getData(termStart))[dirname] || (await getPkg(`${dirname}/package.json`))?.scripts
    }
    catch (error) {
      log(chalk.red('The package.json is not found in workspace or current directory, please check'))
      process.exit()
    }
  }
}

async function getData(type: 'pnpm' | 'yarn') {
  if (cacheData)
    return cacheData
  const workspace = type === 'pnpm'
    ? await fs.readFileSync(path.resolve(process.cwd(), 'pnpm-workspace.yaml'), 'utf-8')
    : await fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')
  const packages = type === 'pnpm'
    ? YAML.parse(workspace)?.packages || []
    : JSON.parse(workspace)?.workspaces || []
  cacheData = (await readGlob(packages)) || {}
  workspaceNames = Object.keys(cacheData).filter(key => cacheData[key] && Object.keys(cacheData[key]).length)
  return cacheData
}

function getParams(params: string[]): [string, string] {
  const first = params[0]
  if (!first)
    return ['', '']
  if (first.startsWith('--'))
    return ['.', params.join(' ')]
  return [first, params.slice(1).join(' ')]
}

async function readGlob(packages: string[]) {
  if (!packages.length)
    return
  const entries = await fg(packages.map(v => `${v}/package.json`), { dot: true, ignore: ['**/node_modules/**'] })
  return Promise.all(entries.map(async (v) => {
    const pkg = await getPkg(v)
    if (!pkg)
      return
    const { name, scripts } = pkg
    return { name, scripts }
  }) as Promise<IParams>[]).then(v => v.reduce((result, v) => {
    const { name, scripts } = v
    result[name] = scripts
    return result
  }, {} as Record<string, Record<string, string>>))
}
ccommand()
