import child_process from 'child_process'
import fs from 'fs'
import { getPkg, getResolvedPath } from 'simon-js-tool'
export async function ccommand() {
  const dirname = process.argv[2] || '.'
  let isYarn = false
  try {
    fs.accessSync(getResolvedPath('./yarn.lock'), fs.constants.F_OK)
    isYarn = true
  }
  catch (error) {
  }
  const { scripts } = await getPkg(`${dirname}/package.json`)
  const keys: string[] = []
  const val = child_process.spawnSync(`gum choose ${Object.keys(scripts).reduce((result, key) => {
    const value = scripts[key]
    keys.push(key)
    result += `"${key}: ${value}" `
    return result
  }, '')}`, {
    shell: true,
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf8',
  }).output[1] as string

  child_process.spawnSync(`${isYarn ? 'yarn' : 'npm'} run ${transformScripts(val)} --prefix ${dirname}`, {
    shell: true,
    stdio: 'inherit',
  })

  function transformScripts(str: string) {
    return keys.find(key => str.startsWith(key))
  }
}

ccommand()
