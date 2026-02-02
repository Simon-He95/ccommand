import { afterEach, describe, expect, it, vi } from 'vitest'

const jsShellMock = vi.fn()

vi.mock('lazy-js-utils/node', () => ({
  jsShell: jsShellMock,
}))

vi.mock('../src/history.js', () => ({
  pushHistory: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@simon_he/colorize', () => ({
  default: (opts: any) => opts,
}))

describe('executeJsFile', () => {
  const originalExitCode = process.exitCode

  afterEach(() => {
    process.exitCode = originalExitCode
    jsShellMock.mockReset()
  })

  it('sets exitCode when ts execution fails', async () => {
    jsShellMock.mockResolvedValue({ status: 1, result: '' })

    vi.resetModules()
    const mod = await import('../src/file-execution.js')
    vi.spyOn(mod, 'checkExecutable').mockImplementation(
      async (cmd) => cmd === 'bun',
    )
    await mod.initTsRunner()

    const ok = await mod.executeJsFile('script.ts', 'ok', 'fail')
    expect(ok).toBe(false)
    expect(process.exitCode).toBe(1)
  })
})
