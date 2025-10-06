import fsp from 'node:fs/promises'

// escapeRegExp removed — not needed after simplified parsing

export async function readMakefile(
  filepath: string,
): Promise<{ name: string, detail: string }[]> {
  try {
    const text = await fsp.readFile(filepath, 'utf-8')
    const lines = text.split(/\r?\n/)

    // Collect all names declared in .PHONY lines. A single .PHONY: line can contain multiple names.
    const phonyNames = new Set<string>()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.startsWith('.PHONY:')) {
        const rest = line
          .substring('.PHONY:'.length)
          .replace(/\\\\$/g, '')
          .trim()
        for (const n of rest.split(/\s+/)) {
          if (n)
phonyNames.add(n)
        }
      }
    }

    const results: { name: string, detail: string }[] = []

    for (const name of phonyNames) {
      let detail = ''
      // Find the target definition line for the name by scanning lines
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i]
        if (!raw)
continue
        const trimmed = raw.trimStart()
        if (trimmed.startsWith(`${name}:`) || trimmed.startsWith(`${name} :`)) {
          const afterColon = trimmed.split(':', 2)[1] || ''
          const semicolonIndex = afterColon.indexOf(';')
          if (semicolonIndex !== -1) {
            detail = afterColon.slice(semicolonIndex + 1).trim()
          }
          // Look for the following recipe line (tab-starting line)
          if (!detail) {
            if (i + 1 < lines.length) {
              const next = lines[i + 1]
              if (next.startsWith('\t')) {
                detail = next.trim()
              }
            }
          }
          if (!detail) {
            const deps = afterColon.trim()
            detail = deps ? deps.replace(/\s+/g, ' ').slice(0, 120) : ''
          }
          break
        }
      }
      results.push({ name, detail: detail ? `${detail}...` : '' })
    }

    return results
  }
 catch {
    // On error, return empty list — callers can decide how to handle missing makefile
    // (keeps the original behaviour of resolving instead of throwing)
    return []
  }
}
