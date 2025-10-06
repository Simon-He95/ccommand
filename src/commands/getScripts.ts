import { memorizeFn } from 'lazy-js-utils'
import { getPkg } from 'lazy-js-utils/node'
import { getData } from '../workspace.js'

const memoizedGetPkg = memorizeFn(getPkg)
const cacheData: Record<string, any> = {}

type TermStart = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'make'

export async function getScripts(
  dirname: string,
  termStart: TermStart,
): Promise<Record<string, string> | null> {
  try {
    const cacheKey = dirname || 'root'
    if (cacheData[cacheKey])
return cacheData[cacheKey]

    let scripts
    if (!dirname || termStart === 'bun' || termStart === 'npm') {
      scripts = (await memoizedGetPkg('./package.json'))?.scripts
    }
 else if (termStart === 'pnpm' || termStart === 'yarn') {
      const workspaceData = await getData(termStart)
      scripts
        = workspaceData[dirname]
          || (await memoizedGetPkg(`${dirname}/package.json`))?.scripts
    }

    if (scripts)
cacheData[cacheKey] = scripts
    return scripts
  }
 catch {
    return null
  }
}
