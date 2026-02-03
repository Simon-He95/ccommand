import { describe, it, expect, vi } from 'vitest'
import { getCommand } from '../src/ccommand.js'

const noopPush = async () => {}
const noopShell = async () => ({ status: 0, result: '' })

function baseCtx(overrides = {}) {
  return Object.assign(
    {
      params: ['a', 'b'],
      dirname: 'pkg',
      argv: ['run'],
      val: 'test',
      runMsg: 'run',
      isZh: false,
      pushHistory: noopPush,
      jsShell: noopShell,
      isNeedPrefix: (p: string[]) => p.length > 0,
      fuzzyWorkspace: undefined,
    },
    overrides,
  ) as any
}

describe('getCommand variations', () => {
  it('pnpm produces pnpm run command and highlights last token', async () => {
    const ctx = baseCtx({ termStart: 'pnpm' })
    const res = await getCommand(ctx)
    expect(res.command).toContain('pnpm run')
    expect(res.text).toContain('b')
  })

  it('yarn produces workspace command without `run`', async () => {
    const ctx = baseCtx({ termStart: 'yarn' })
    const res = await getCommand(ctx)
    expect(res.command).toContain('yarn')
    // yarn should not include the literal 'run' after the tool name
    expect(res.command).not.toContain('yarn run')
  })

  it('bun produces bun run command', async () => {
    const ctx = baseCtx({ termStart: 'bun' })
    const res = await getCommand(ctx)
    expect(res.command).toContain('bun run')
  })

  it('make produces make command without run', async () => {
    const ctx = baseCtx({ termStart: 'make' })
    const res = await getCommand(ctx)
    expect(res.command).toContain('make')
    expect(res.command).not.toContain('make run')
  })

  it('find mode produces pfind text', async () => {
    const ctx = baseCtx({ termStart: 'npm', argv: ['find'] })
    const res = await getCommand(ctx)
    expect(res.text.startsWith('pfind')).toBeTruthy()
  })
})
