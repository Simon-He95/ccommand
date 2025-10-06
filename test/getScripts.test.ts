import { describe, it, expect, vi } from 'vitest'

// Mock lazy-js-utils/node before importing the module under test
const mockGetPkg = vi.fn(async (p?: string) => {
  if (!p || p === './package.json') return { scripts: { root: 'r' } }
  if (p === 'pkgA/package.json') return { scripts: { a: '1' } }
  return null
})

vi.mock('lazy-js-utils/node', () => ({
  getPkg: mockGetPkg,
  getPkgTool: async () => 'npm',
  jsShell: async () => ({ status: 0, result: '' }),
}))

// Mock workspace getData to return empty object so fallback to package.json occurs
vi.mock('../src/workspace.js', () => ({
  getData: async () => ({}),
  workspaceNames: [],
}))

import { getScripts } from '../src/ccommand.js'

describe('getScripts', () => {
  it('returns root package scripts for npm when dirname is empty', async () => {
    const scripts = await getScripts('', 'npm')
    expect(scripts).toBeTruthy()
    expect(scripts?.root).toBe('r')
    expect(mockGetPkg).toHaveBeenCalled()
  })

  it('returns package scripts for pnpm when dirname provided and fallback to package.json', async () => {
    const scripts = await getScripts('pkgA', 'pnpm')
    expect(scripts).toBeTruthy()
    expect(scripts?.a).toBe('1')
  })
})
