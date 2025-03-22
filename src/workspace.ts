import fsp from 'node:fs/promises'
import path from 'path'
import { getPkg } from 'lazy-js-utils/node'
import { isPlainObject } from 'lazy-js-utils'
import fg from 'fast-glob'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const YAML = require('yamljs')

// eslint-disable-next-line import/no-mutable-exports
let workspaceNames: string[] = []
let cacheData: any = null

export { workspaceNames }

// 读取工作区文件
export async function readWorkspaceFile(
  type: 'pnpm' | 'yarn',
): Promise<string> {
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

// 解析工作区包
export function parseWorkspacePackages(
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

// 读取glob匹配的包
export async function readGlob(
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
        scripts[key] = pkg.scripts![key]

      return scripts
    }, {} as Record<string, string>)

    return result
  }, {} as Record<string, Record<string, string>>)
}

// 加载工作区数据
export async function loadWorkspaceData(
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

// 获取工作区数据的导出函数
export async function getData(
  type: 'pnpm' | 'yarn',
): Promise<Record<string, Record<string, string>>> {
  return loadWorkspaceData(type)
}
