import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import fg from 'fast-glob'
import { isPlainObject } from 'lazy-js-utils'
import { getPkg } from 'lazy-js-utils/node'

// YAML parser (yamljs is CJS); load dynamically when needed
let YAML: any = null

let workspaceNamesInternal: string[] = []
let workspacePathsInternal: Record<string, string> = {}
let cacheData: Record<string, Record<string, string>> | null = null
let lastWorkspaceMtime: number | null = null

export function getWorkspaceNames() {
  return workspaceNamesInternal
}

export function getWorkspacePaths() {
  return workspacePathsInternal
}

export async function readWorkspaceFile(
  type: 'pnpm' | 'yarn',
): Promise<string> {
  const filePath
    = type === 'pnpm'
      ? path.resolve(process.cwd(), 'pnpm-workspace.yaml')
      : path.resolve(process.cwd(), 'package.json')
  try {
    try {
      const st = await fsp.stat(filePath)
      lastWorkspaceMtime = st.mtimeMs
    }
 catch {
      // ignore stat errors
    }

    return await fsp.readFile(filePath, 'utf-8')
  }
 catch {
    return ''
  }
}

export async function parseWorkspacePackages(
  type: 'pnpm' | 'yarn',
  workspace: string,
): Promise<string[]> {
  if (!workspace)
return []

  if (type === 'pnpm') {
    try {
      if (!YAML) {
        // dynamic import of yamljs (CJS); import() returns a module namespace
        // @ts-expect-error - yamljs has no types
        const mod = await import('yamljs')
        YAML = (mod && (mod as any).default) || mod
      }
      const parsed = YAML.parse(workspace)
      const pkgs = parsed?.packages
      if (Array.isArray(pkgs))
return pkgs.filter(Boolean)
      return []
    }
 catch {
      return []
    }
  }

  try {
    const parsed = JSON.parse(workspace)
    const _workspace = parsed?.workspaces
    if (isPlainObject(_workspace))
return _workspace?.packages || []
    if (Array.isArray(_workspace))
return _workspace
    return []
  }
 catch {
    return []
  }
}

export async function readGlob(packages: string[]): Promise<{
  data: Record<string, Record<string, string>>
  paths: Record<string, string>
}> {
  if (!packages.length)
return { data: {}, paths: {} }

  const entries = await fg(
    packages.map(v => `${v}/package.json`),
    {
      dot: true,
      ignore: ['**/node_modules/**'],
    },
  )

  const results = await Promise.all(
    entries.map(async (v) => {
      try {
        const pkg = await getPkg(v)
        if (!pkg)
return null
        const { name, scripts } = pkg
        const relPath = path.relative(process.cwd(), path.dirname(v)) || '.'
        return { name, scripts, relPath }
      }
 catch {
        return null
      }
    }),
  )

  return results.reduce(
    (result, pkg) => {
      if (!pkg || !pkg.name || !pkg.scripts)
return result

      result.data[pkg.name] = Object.keys(pkg.scripts).reduce(
        (scripts, key) => {
          if (!key.startsWith('//'))
scripts[key] = pkg.scripts![key]
          return scripts
        },
        {} as Record<string, string>,
      )

      result.paths[pkg.name] = pkg.relPath

      return result
    },
    { data: {}, paths: {} } as {
      data: Record<string, Record<string, string>>
      paths: Record<string, string>
    },
  )
}

export async function loadWorkspaceData(
  type: 'pnpm' | 'yarn',
): Promise<Record<string, Record<string, string>>> {
  if (cacheData) {
    try {
      const filePath
        = type === 'pnpm'
          ? path.resolve(process.cwd(), 'pnpm-workspace.yaml')
          : path.resolve(process.cwd(), 'package.json')
      const st = await fsp.stat(filePath)
      if (lastWorkspaceMtime && st.mtimeMs <= lastWorkspaceMtime) {
        return cacheData
      }
    }
 catch {
      return cacheData
    }
  }

  const workspace = await readWorkspaceFile(type)
  const packages = await parseWorkspacePackages(type, workspace)

  const { data, paths } = await readGlob(packages)
  cacheData = data
  workspacePathsInternal = paths
  workspaceNamesInternal = Object.keys(cacheData).filter(
    key => cacheData && cacheData[key] && Object.keys(cacheData[key]).length,
  )

  return cacheData
}

export function clearWorkspaceCache() {
  cacheData = null
  workspaceNamesInternal = []
  workspacePathsInternal = {}
  lastWorkspaceMtime = null
}

export async function getData(
  type: 'pnpm' | 'yarn',
): Promise<Record<string, Record<string, string>>> {
  return loadWorkspaceData(type)
}
