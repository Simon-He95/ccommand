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

export async function ccommand() {
  const argv = process.argv.slice(2)
  if (argv[0] === '-v') {
    const { version } = await getPkg()
    console.log(`ccommand Version: ${version}`)
    return
  }

  const [dirname, params] = getParams(argv)
  const termStart = getPkgTool()

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
      if (termStart === 'pnpm') {
        const workspace = await fs.readFileSync(path.resolve(process.cwd(), 'pnpm-workspace.yaml'), 'utf-8')
        const packages = YAML.parse(workspace)?.packages || []
        const data = await readGlob(packages)
        return data?.[dirname] || (await getPkg(`${dirname}/package.json`))?.scripts
      }
      else if (termStart === 'yarn') {
        const workspace = await fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8')
        const packages = JSON.parse(workspace)?.workspaces || []
        const data = await readGlob(packages)
        return data?.[dirname] || (await getPkg(`${dirname}/package.json`))?.scripts
      }
    }
    catch (error) {
      console.log('The package.json is not found in workspace or current directory, please check')
      process.exit()
    }
  }
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
