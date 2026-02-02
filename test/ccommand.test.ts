import { describe, it, expect, vi } from 'vitest'
import { getCommand, runScript } from '../src/ccommand.js'

describe('ccommand helpers', () => {
  it('getCommand builds npm run command and text', async () => {
    const ctx = {
      termStart: 'npm',
      params: ['a', 'b'],
      dirname: 'mydir',
      argv: ['run'],
      val: 'test',
      runMsg: 'run',
      isZh: false,
      pushHistory: async () => {},
      jsShell: async () => ({ status: 0, result: '' }),
      isNeedPrefix: (p: string[]) => p.length > 0,
      fuzzyWorkspace: undefined,
    } as any

    const res = await getCommand(ctx)
    expect(res.command).toContain('npm run')
    // getCommand highlights the last token (the last param) with quotes
    expect(res.text).toContain("'b'")
    expect(res.val).toBe('test')
  })

  it('runScript logs success on zero exit status', async () => {
    const jsShell = vi.fn().mockResolvedValue({ status: 0, result: '' })
    const pushHistory = vi.fn().mockResolvedValue(undefined)
    const colorize = (o: any) =>
      ({
        ...o,
        text: o.text,
      } as any)

    // Should not throw
    await runScript(
      'npm',
      'build',
      [],
      ['build'],
      pushHistory as any,
      jsShell as any,
      colorize as any,
      false,
      'ok',
      'fail',
    )

    expect(jsShell).toHaveBeenCalled()
    expect(pushHistory).toHaveBeenCalled()
  })

  it('runScript logs failure on non-zero exit status', async () => {
    const jsShell = vi.fn().mockResolvedValue({ status: 1, result: '' })
    const pushHistory = vi.fn().mockResolvedValue(undefined)
    const colorize = (o: any) => ({ ...o, text: o.text } as any)

    await runScript(
      'npm',
      'build',
      [],
      ['build'],
      pushHistory as any,
      jsShell as any,
      colorize as any,
      false,
      'ok',
      'fail',
    )

    expect(jsShell).toHaveBeenCalled()
  })

  it('runScript falls back from pnpm to npm when pnpm Node support message appears', async () => {
    const jsShell = vi
      .fn()
      // First call simulates pnpm printing the Node.js support message
      .mockResolvedValueOnce({
        status: 1,
        result: 'pnpm versions with respective Node.js version support',
      })
      // Second call simulates npm success
      .mockResolvedValueOnce({ status: 0, result: '' })

    const pushHistory = vi.fn().mockResolvedValue(undefined)
    const colorize = (o: any) => ({ ...o, text: o.text } as any)

    await runScript(
      'pnpm',
      'build',
      [],
      ['build'],
      pushHistory as any,
      jsShell as any,
      colorize as any,
      false,
      'ok',
      'fail',
    )

    // jsShell should be called at least twice: pnpm then npm
    expect(jsShell).toHaveBeenCalled()
    expect(jsShell.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(pushHistory).toHaveBeenCalled()
  })
})
