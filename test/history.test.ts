import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fsp from 'node:fs/promises'
import { mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const tmpPrefix = path.join(os.tmpdir(), 'ccommand-test-')

function makeTempHome() {
  const dir = mkdtempSync(tmpPrefix)
  return dir
}

describe('pushHistory', () => {
  let oldHome: string | undefined
  let oldShell: string | undefined
  let tmpHome: string

  beforeEach(() => {
    oldHome = process.env.HOME
    oldShell = process.env.SHELL
    tmpHome = makeTempHome()
    process.env.HOME = tmpHome
  })

  afterEach(() => {
    if (oldHome === undefined) delete process.env.HOME
    else process.env.HOME = oldHome
    if (oldShell === undefined) delete process.env.SHELL
    else process.env.SHELL = oldShell
    try {
      rmSync(tmpHome, { recursive: true, force: true })
    } catch {}
  })

  it('appends non-duplicate command to bash history without HISTTIMEFORMAT', async () => {
    process.env.SHELL = '/bin/bash'
    delete process.env.HISTTIMEFORMAT
    const historyPath = path.join(tmpHome, '.bash_history')
    await fsp.writeFile(historyPath, 'echo 1\n', 'utf8')

    const { pushHistory } = await import('../src/history.js')
    await pushHistory('echo 2')

    const got = await fsp.readFile(historyPath, 'utf8')
    expect(got).toBe('echo 1\necho 2\n')
  })

  it('deduplicates fish history entries and appends new one', async () => {
    process.env.SHELL = '/usr/bin/fish'
    const historyPath = path.join(tmpHome, '.local', 'share', 'fish')
    await fsp.mkdir(historyPath, { recursive: true })
    const histFile = path.join(historyPath, 'fish_history')
    const initial = '- cmd: a\n  when: 1\n- cmd: b\n  when: 2\n'
    await fsp.writeFile(histFile, initial, 'utf8')

    const { pushHistory } = await import('../src/history.js')
    await pushHistory('a')

    const got = await fsp.readFile(histFile, 'utf8')
    // last entry should be cmd a
    const lastBlock = got
      .trim()
      .split(/\n(?=- cmd: )/)
      .pop()
    expect(lastBlock?.startsWith('- cmd: a')).toBe(true)
  })

  it('deduplicates zsh history and appends new entry', async () => {
    process.env.SHELL = '/bin/zsh'
    const historyPath = path.join(tmpHome, '.zsh_history')
    // create two entries, one duplicate of 'echo 1'
    const initial = `: 1:0;echo 1\n: 2:0;echo 2\n`
    await fsp.writeFile(historyPath, initial, 'utf8')

    const { pushHistory } = await import('../src/history.js')
    await pushHistory('echo 1')

    const got = await fsp.readFile(historyPath, 'utf8')
    const lines = got.trim().split(/\r?\n/)
    // last line should be the new zsh formatted entry ending with ';echo 1'
    expect(lines[lines.length - 1].endsWith(';echo 1')).toBe(true)
  })

  it('bash with HISTTIMEFORMAT writes timestamped entry and deduplicates', async () => {
    process.env.SHELL = '/bin/bash'
    process.env.HISTTIMEFORMAT = '%F %T '
    const historyPath = path.join(tmpHome, '.bash_history')
    // initial timestamped entry
    await fsp.writeFile(historyPath, '#1\necho x\n', 'utf8')

    const { pushHistory } = await import('../src/history.js')
    await pushHistory('echo x')

    const got = await fsp.readFile(historyPath, 'utf8')
    // only one occurrence of the command
    const occurrences = (got.match(/echo x/g) || []).length
    expect(occurrences).toBe(1)
    // ensure the command is preceded by a timestamp line
    expect(/#\d+\necho x/.test(got)).toBe(true)
  })

  it('zsh collapses multiple previous duplicates into a single newest entry', async () => {
    process.env.SHELL = '/bin/zsh'
    const historyPath = path.join(tmpHome, '.zsh_history')
    const initial = ': 1:0;dup\n: 2:0;dup\n: 3:0;other\n'
    await fsp.writeFile(historyPath, initial, 'utf8')

    const { pushHistory } = await import('../src/history.js')
    await pushHistory('dup')

    const got = await fsp.readFile(historyPath, 'utf8')
    const lines = got.trim().split(/\r?\n/)
    // only one 'dup' should remain and be last
    const dupCount = lines.filter((l) => l.endsWith(';dup')).length
    expect(dupCount).toBe(1)
    expect(lines[lines.length - 1].endsWith(';dup')).toBe(true)
  })

  it('fish preserves extra metadata lines in a block when deduplicating', async () => {
    process.env.SHELL = '/usr/bin/fish'
    const historyPath = path.join(tmpHome, '.local', 'share', 'fish')
    await fsp.mkdir(historyPath, { recursive: true })
    const histFile = path.join(historyPath, 'fish_history')
    const initial =
      '- cmd: a\n  when: 1\n  something: yes\n- cmd: b\n  when: 2\n'
    await fsp.writeFile(histFile, initial, 'utf8')

    const { pushHistory } = await import('../src/history.js')
    await pushHistory('a')

    const got = await fsp.readFile(histFile, 'utf8')
    const lastBlock =
      got
        .trim()
        .split(/\n(?=- cmd: )/)
        .pop() || ''
    expect(lastBlock.startsWith('- cmd: a')).toBe(true)
    expect(lastBlock.includes('something: yes')).toBe(true)
  })

  it('does nothing if history file does not exist', async () => {
    process.env.SHELL = '/bin/bash'
    const historyPath = path.join(tmpHome, '.bash_history')
    // ensure file does not exist
    try {
      await fsp.unlink(historyPath)
    } catch {}

    const { pushHistory } = await import('../src/history.js')
    await pushHistory('nope')

    const exists = await fsp
      .stat(historyPath)
      .then(() => true)
      .catch(() => false)
    expect(exists).toBe(false)
  })
})
