import { describe, it, expect } from 'vitest'
import fsp from 'node:fs/promises'
import { mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const tmpPrefix = path.join(os.tmpdir(), 'ccommand-make-test-')

function makeTempDir() {
  return mkdtempSync(tmpPrefix)
}

describe('readMakefile', () => {
  it('parses .PHONY with single and multiple names and extracts details', async () => {
    const tmp = makeTempDir()
    const mf = path.join(tmp, 'Makefile')
    const content = `
.PHONY: build test\
  lint

build: ; echo building

test:
	@echo testing

# a comment
.PHONY: clean
clean: ; rm -rf dist
`
    await fsp.writeFile(mf, content, 'utf8')

    const { readMakefile } = await import('../src/makefile.js')
    const res = await readMakefile(mf)
    // Expect at least build, test, clean, lint
    const names = res.map((r) => r.name).sort()
    expect(names).toEqual(['build', 'clean', 'lint', 'test'])

    const byName = Object.fromEntries(res.map((r) => [r.name, r.detail]))
    expect(byName.build).toContain('echo building')
    expect(byName.test).toContain('echo testing')
    expect(byName.clean).toContain('rm -rf dist')

    try {
      rmSync(tmp, { recursive: true, force: true })
    } catch {}
  })
})
