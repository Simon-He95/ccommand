import child_process from 'child_process'
import fs from 'fs'
import path from 'path'
import { getPkg, getPkgTool } from 'simon-js-tool'
import fg from 'fast-glob'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const YAML = require('yamljs')

interface IParams {
  name: string
  scripts: Record<string, string>
}

let workspaceNames: string[] = []
let cacheData: any = null
export async function ccommand() {
  const argv = process.argv.slice(2)
  if (argv[0] === '-v') {
    const { version } = await getPkg()
    console.log(`ccommand Version: ${version}`)
    return
  }

  const [name, params] = getParams(argv)
  let dirname = name
  const termStart = getPkgTool()
  if (argv[0] === 'find') {
    if (termStart === 'yarn') {
      await getYarnData()
      const choose = child_process.spawnSync(`echo ${workspaceNames.join(',')} | sed "s/,/\\n/g" | gum filter`, {
        shell: true,
        stdio: ['inherit', 'pipe', 'inherit'],
        encoding: 'utf8',
      }).output[1] as string
      dirname = choose.trim()
    }
    else if (termStart === 'pnpm') {
      await getPnpmData()
      const choose = child_process.spawnSync(`echo ${workspaceNames.join(',')} | sed "s/,/\\n/g" | gum filter`, {
        shell: true,
        stdio: ['inherit', 'pipe', 'inherit'],
        encoding: 'utf8',
      }).output[1] as string
      dirname = choose.trim()
    }
    else { return console.log('find command only support yarn or pnpm') }
  }
  const scripts = await getScripts()
  if (!scripts)
    return console.log('No scripts found')

  const keys: string[] = []
  const options = Object.keys(scripts).reduce((result, key) => {
    const value = scripts[key]
    keys.push(key)
    result += `"${key}: ${value}",`
    return result
  }, '')
  const val = child_process.spawnSync(`echo ${options} | sed "s/,/\\n/g" | gum filter | cut -d' ' -f1`, {
    shell: true,
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf8',
  }).output[1] as string
  if (!val) {
    console.log('已取消')
    return process.exit()
  }
  child_process.spawnSync(getCommand(), {
    shell: true,
    stdio: 'inherit',
  })

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
        return (await getPnpmData())[dirname] || (await getPkg(`${dirname}/package.json`))?.scripts
      else if (termStart === 'yarn')
        return (await getYarnData())[dirname] || (await getPkg(`${dirname}/package.json`))?.scripts
    }
    catch (error) {
      console.log('The package.json is not found in workspace or current directory, please check')
      process.exit()
    }
  }
}

async function getPnpmData() {
  if (cacheData)
    return cacheData
  const workspace = await fs.readFileSync(path.resolve(process.cwd(), 'pnpm-workspace.yaml'), 'utf-8')
  const packages = YAML.parse(workspace)?.packages || []
  cacheData = (await readGlob(packages)) || {}
  workspaceNames = Object.keys(cacheData)
  return cacheData
}

async function getYarnData() {
  if (cacheData)
    return cacheData
  const workspace = await fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')
  const packages = JSON.parse(workspace)?.workspaces || []
  cacheData = (await readGlob(packages)) || {}
  workspaceNames = Object.keys(cacheData)
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
