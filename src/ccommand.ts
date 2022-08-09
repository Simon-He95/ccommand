import child_process from 'child_process'
import { getPkg } from 'simon-js-tool'
export async function ccommand() {
  const { scripts } = await getPkg('./package.json')
  const val = child_process.spawnSync(`gum choose ${Object.keys(scripts).reduce((result, key) => {
    const value = scripts[key]
    result += `"${key}: ${value}" `
    return result
  }, '')}`, {
    shell: true,
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf8',
  }).output[1] as string

  child_process.spawnSync(`npm run ${transformScripts(val)}`, {
    shell: true,
    stdio: 'inherit',
  })

  function transformScripts(str: string) {
    return str.slice(0, str.lastIndexOf(':'))
  }
}

ccommand()
