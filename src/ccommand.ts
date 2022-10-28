import child_process from 'child_process'
import { getPkg, getPkgTool } from 'simon-js-tool'
export async function ccommand() {
  const argv = process.argv.slice(2)
  if (argv[0] === '-v') {
    const { version } = await getPkg()
    console.log(`ccommand Version: ${version}`)
    return
  }
  const [dirname, params] = getParams(argv)
  const termStart = getPkgTool()
  const { scripts } = await getPkg(`${dirname || '.'}/package.json`)
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
}

function getParams(params: string[]): [string, string] {
  const first = params[0]
  if (!first)
    return ['', '']
  if (first.startsWith('--'))
    return ['.', params.join(' ')]

  return [first, params.slice(1).join(' ')]
}

ccommand()
