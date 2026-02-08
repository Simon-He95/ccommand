import type { Buffer } from 'node:buffer'
import process from 'node:process'
import readline from 'node:readline'
import { cancelCode, isZh } from './constants.js'

const boundaryChars = new Set(['-', '_', ' ', '.', '/', '\\', ':'])
const workspacePathSeparator = '  -  '
const workspacePathTruncationPrefix = '...'
const scriptDetailSeparator = ': '

function isLower(ch: string) {
  return ch >= 'a' && ch <= 'z'
}

function isUpper(ch: string) {
  return ch >= 'A' && ch <= 'Z'
}

function isWordBoundary(text: string, index: number) {
  if (index <= 0)
return true
  const prev = text[index - 1] || ''
  const curr = text[index] || ''
  if (boundaryChars.has(prev))
return true
  return isLower(prev) && isUpper(curr)
}

function findSubsequencePositions(query: string, candidate: string) {
  const positions: number[] = []
  let qIndex = 0
  for (let i = 0; i < candidate.length && qIndex < query.length; i++) {
    if (candidate[i] === query[qIndex]) {
      positions.push(i)
      qIndex++
    }
  }
  if (qIndex !== query.length)
return null
  return positions
}

function scoreToken(token: string, candidate: string) {
  const query = token.toLowerCase()
  const textLower = candidate.toLowerCase()
  if (!query)
return { score: 0, positions: [] as number[] }
  if (textLower === query)
    return { score: 100000, positions: [...candidate].map((_, i) => i) }
  if (textLower.startsWith(query)) {
    return {
      score: 90000 - (candidate.length - token.length),
      positions: [...token].map((_, i) => i),
    }
  }
  const substringIndex = textLower.indexOf(query)
  if (substringIndex !== -1) {
    return {
      score: 70000 - substringIndex,
      positions: [...token].map((_, i) => substringIndex + i),
    }
  }

  const positions = findSubsequencePositions(query, textLower)
  if (!positions)
return null

  let score = 1000
  let last = -1
  for (const pos of positions) {
    score += 10
    if (pos === last + 1)
score += 15
    if (pos === 0)
score += 12
    if (isWordBoundary(candidate, pos))
score += 8
    if (last !== -1)
score -= pos - last - 1
    last = pos
  }
  score += Math.max(0, 30 - (candidate.length - token.length))
  return { score, positions }
}

function scoreItem(query: string, candidate: string) {
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length)
return { score: 0, positions: [] as number[] }

  let total = 0
  const positions: number[] = []
  for (const token of tokens) {
    const scored = scoreToken(token, candidate)
    if (!scored)
return null
    total += scored.score
    positions.push(...scored.positions)
  }

  return { score: total, positions }
}

function rankItems(items: string[], query: string) {
  if (!query.trim()) {
    return items.map((item, index) => ({
      item,
      score: 0,
      index,
      positions: [] as number[],
    }))
  }
  const scored = items
    .map((item, index) => {
      const match = scoreItem(query, item)
      if (!match)
return null
      return { item, score: match.score, index, positions: match.positions }
    })
    .filter(Boolean) as Array<{
    item: string
    score: number
    index: number
    positions: number[]
  }>

  scored.sort((a, b) => {
    if (b.score !== a.score)
return b.score - a.score
    return a.index - b.index
  })
  return scored
}

function truncateLine(text: string, maxColumns: number | undefined) {
  if (!maxColumns || maxColumns <= 0)
return text
  if (text.length <= maxColumns)
return text
  if (maxColumns <= 3)
return text.slice(0, maxColumns)
  return `${text.slice(0, maxColumns - 3)}...`
}

function truncateItem(text: string, maxColumns: number | undefined) {
  if (!maxColumns || maxColumns <= 0)
    return { text, visibleLength: text.length }
  if (text.length <= maxColumns)
return { text, visibleLength: text.length }
  if (maxColumns <= 3)
    return { text: text.slice(0, maxColumns), visibleLength: maxColumns }
  const visibleLength = maxColumns - 3
  return { text: `${text.slice(0, visibleLength)}...`, visibleLength }
}

function applyHighlight(
  text: string,
  positions: number[],
  highlightStyle: string,
  resumeStyle: string,
) {
  if (!highlightStyle || !positions.length)
return text
  const posSet = new Set(positions)
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] || ''
    if (posSet.has(i)) {
      out += `${highlightStyle}${ch}${resumeStyle}`
    }
 else {
      out += ch
    }
  }
  return out
}

function splitWorkspaceItem(item: string) {
  const sepIndex = item.indexOf(workspacePathSeparator)
  if (sepIndex === -1)
return null
  const pathStart = sepIndex + workspacePathSeparator.length
  return {
    name: item.slice(0, sepIndex),
    sep: workspacePathSeparator,
    path: item.slice(pathStart),
    sepIndex,
    pathStart,
  }
}

function splitScriptItem(item: string) {
  const sepIndex = item.indexOf(scriptDetailSeparator)
  if (sepIndex === -1)
return null
  const detailStart = sepIndex + scriptDetailSeparator.length
  return {
    name: item.slice(0, sepIndex),
    sep: scriptDetailSeparator,
    detail: item.slice(detailStart),
    sepIndex,
    detailStart,
  }
}

function findPathBoundary(text: string, startIndex: number) {
  const forwardSlash = text.indexOf('/', startIndex)
  const backSlash = text.indexOf('\\', startIndex)
  if (forwardSlash === -1)
return backSlash
  if (backSlash === -1)
return forwardSlash
  return Math.min(forwardSlash, backSlash)
}

function truncateWorkspacePath(pathText: string, maxLen: number) {
  if (maxLen <= 0)
    return { text: '', startIndex: pathText.length, prefixLen: 0 }
  if (pathText.length <= maxLen)
    return { text: pathText, startIndex: 0, prefixLen: 0 }
  if (maxLen <= workspacePathTruncationPrefix.length) {
    const startIndex = Math.max(0, pathText.length - maxLen)
    return { text: pathText.slice(startIndex), startIndex, prefixLen: 0 }
  }

  const tailLen = maxLen - workspacePathTruncationPrefix.length
  let startIndex = Math.max(0, pathText.length - tailLen)
  const boundaryIndex = findPathBoundary(pathText, startIndex)
  if (boundaryIndex !== -1 && boundaryIndex < pathText.length - 1) {
    startIndex = boundaryIndex + 1
  }

  return {
    text: `${workspacePathTruncationPrefix}${pathText.slice(startIndex)}`,
    startIndex,
    prefixLen: workspacePathTruncationPrefix.length,
  }
}

function dimLine(text: string, useColor: boolean) {
  if (!useColor)
return text
  return `\u001B[2m${text}\u001B[0m`
}

export function isInteractiveTty() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

export function isPickerDisabled() {
  const raw
    = process.env.CCOMMAND_NO_PICKER
      || process.env.NO_PICKER
      || process.env.CCOMMAND_NO_GUM
      || process.env.NO_GUM
      || ''
  const flag = raw.toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'yes'
}

export async function ensurePicker(_isZh: boolean): Promise<boolean> {
  if (isPickerDisabled() || !isInteractiveTty() || process.env.CI)
return false
  return true
}

export async function pickFromList(
  items: string[],
  { placeholder, maxItems }: { placeholder?: string, maxItems?: number } = {},
): Promise<{ status: number, result: string }> {
  if (!isInteractiveTty())
return { status: cancelCode, result: '' }

  const input = process.stdin
  const output = process.stdout
  const useColor = Boolean(output.isTTY && !process.env.NO_COLOR)
  const promptLabel = (
    placeholder || (isZh ? '请选择一个选项' : 'Select')
  ).trim()
  const helpText = isZh
    ? '上/下选择 左/右移动 Enter确认 Esc清空/取消'
    : '↑/↓ Move ←/→ Cursor Enter select Esc clear/cancel'

  let query = ''
  let cursor = 0
  let offset = 0
  let inputCursor = 0
  let renderedLines = 0
  let cursorVisible = true
  let blinkTimer: ReturnType<typeof setInterval> | null = null

  const cursorBlinkMs = 500

  let maxVisible = 0
  const updateMaxVisible = () => {
    maxVisible = Math.max(4, Math.min(maxItems || 10, (output.rows || 24) - 5))
  }
  updateMaxVisible()

  let ranked = rankItems(items, query)

  const hideCursor = () => {
    if (useColor)
output.write('\u001B[?25l')
  }
  const showCursor = () => {
    if (useColor)
output.write('\u001B[?25h')
  }

  const clearRendered = () => {
    if (!renderedLines)
return
    for (let i = 0; i < renderedLines; i++) {
      readline.clearLine(output, 0)
      if (i < renderedLines - 1)
readline.moveCursor(output, 0, -1)
    }
    readline.cursorTo(output, 0)
    renderedLines = 0
  }

  const updateOffset = () => {
    if (cursor < offset)
offset = cursor
    else if (cursor >= offset + maxVisible)
offset = cursor - maxVisible + 1
    if (offset < 0)
offset = 0
  }

  const render = () => {
    clearRendered()

    const lines: string[] = []
    const prompt = `? ${promptLabel}`
    lines.push(dimLine(truncateLine(prompt, output.columns), useColor))
    const cursorMark = cursorVisible ? '|' : ' '
    const before = query.slice(0, inputCursor)
    const after = query.slice(inputCursor)
    const inputLine = `  > ${before}${cursorMark}${after}`
    lines.push(truncateLine(inputLine, output.columns))

    if (!ranked.length) {
      lines.push(
        truncateLine(isZh ? '  (无匹配)' : '  (no matches)', output.columns),
      )
    }
 else {
      updateOffset()
      const slice = ranked.slice(offset, offset + maxVisible)
      slice.forEach((entry, index) => {
        const isSelected = offset + index === cursor
        const prefix = isSelected ? '> ' : '  '
        const maxColumns = output.columns
          ? Math.max(0, output.columns - prefix.length)
          : undefined
        const baseStyle
          = useColor && isSelected ? '\u001B[48;5;237m\u001B[38;5;231m' : ''
        const highlightStyle = useColor
          ? `${baseStyle}\u001B[1m\u001B[38;5;214m`
          : ''
        const resetStyle = useColor ? '\u001B[0m' : ''
        const resumeStyle = baseStyle ? `${resetStyle}${baseStyle}` : resetStyle

        const renderStandardItem = () => {
          const truncated = truncateItem(entry.item, maxColumns)
          const visiblePositions = entry.positions.filter(
            pos => pos >= 0 && pos < truncated.visibleLength,
          )
          let line = ''
          if (baseStyle)
line += baseStyle
          line += prefix
          line += applyHighlight(
            truncated.text,
            visiblePositions,
            highlightStyle,
            resumeStyle,
          )
          if (baseStyle)
line += resetStyle
          lines.push(line)
        }

        const workspaceParts = splitWorkspaceItem(entry.item)
        if (!workspaceParts) {
          const scriptParts = splitScriptItem(entry.item)
          if (!scriptParts) {
            renderStandardItem()
            return
          }

          const scriptFixedLen
            = scriptParts.name.length + scriptParts.sep.length
          if (maxColumns !== undefined && scriptFixedLen >= maxColumns) {
            renderStandardItem()
            return
          }

          const maxDetailLen
            = maxColumns === undefined
              ? scriptParts.detail.length
              : maxColumns - scriptFixedLen
          const truncatedDetail = truncateItem(scriptParts.detail, maxDetailLen)

          const namePositions = entry.positions.filter(
            pos => pos >= 0 && pos < scriptParts.sepIndex,
          )
          const sepPositions = entry.positions
            .filter(
              pos =>
                pos >= scriptParts.sepIndex && pos < scriptParts.detailStart,
            )
            .map(pos => pos - scriptParts.sepIndex)
          const detailPositions = entry.positions
            .filter(pos => pos >= scriptParts.detailStart)
            .map(pos => pos - scriptParts.detailStart)
            .filter(pos => pos >= 0 && pos < truncatedDetail.visibleLength)

          const dimStyle = useColor ? '\u001B[2m' : ''
          const dimResume = useColor
            ? baseStyle
              ? `${resetStyle}${baseStyle}${dimStyle}`
              : `${resetStyle}${dimStyle}`
            : ''

          let line = ''
          if (baseStyle)
line += baseStyle
          line += prefix
          line += applyHighlight(
            scriptParts.name,
            namePositions,
            highlightStyle,
            resumeStyle,
          )
          line += applyHighlight(
            scriptParts.sep,
            sepPositions,
            highlightStyle,
            resumeStyle,
          )
          if (dimStyle)
line += dimStyle
          line += applyHighlight(
            truncatedDetail.text,
            detailPositions,
            highlightStyle,
            dimResume,
          )
          if (useColor && (baseStyle || dimStyle))
line += resetStyle
          lines.push(line)
          return
        }

        const fixedLen = workspaceParts.name.length + workspaceParts.sep.length
        if (maxColumns !== undefined && fixedLen >= maxColumns) {
          renderStandardItem()
          return
        }

        const maxPathLen
          = maxColumns === undefined
            ? workspaceParts.path.length
            : maxColumns - fixedLen
        const truncatedPath = truncateWorkspacePath(
          workspaceParts.path,
          maxPathLen,
        )

        const namePositions = entry.positions.filter(
          pos => pos >= 0 && pos < workspaceParts.sepIndex,
        )
        const sepPositions = entry.positions
          .filter(
            pos =>
              pos >= workspaceParts.sepIndex && pos < workspaceParts.pathStart,
          )
          .map(pos => pos - workspaceParts.sepIndex)
        const rawPathPositions = entry.positions
          .filter(pos => pos >= workspaceParts.pathStart)
          .map(pos => pos - workspaceParts.pathStart)
        const pathPositions = rawPathPositions
          .filter(pos => pos >= truncatedPath.startIndex)
          .map(
            pos => pos - truncatedPath.startIndex + truncatedPath.prefixLen,
          )
          .filter(pos => pos >= 0 && pos < truncatedPath.text.length)

        const dimStyle = useColor ? '\u001B[2m' : ''
        const dimResume = useColor
          ? baseStyle
            ? `${resetStyle}${baseStyle}${dimStyle}`
            : `${resetStyle}${dimStyle}`
          : ''

        let line = ''
        if (baseStyle)
line += baseStyle
        line += prefix
        line += applyHighlight(
          workspaceParts.name,
          namePositions,
          highlightStyle,
          resumeStyle,
        )
        line += applyHighlight(
          workspaceParts.sep,
          sepPositions,
          highlightStyle,
          resumeStyle,
        )
        if (dimStyle)
line += dimStyle
        line += applyHighlight(
          truncatedPath.text,
          pathPositions,
          highlightStyle,
          dimResume,
        )
        if (useColor && (baseStyle || dimStyle))
line += resetStyle
        lines.push(line)
      })
    }

    lines.push('')
    const meta = ranked.length ? `(${cursor + 1}/${ranked.length})` : ''
    lines.push(
      dimLine(
        truncateLine(`  ${helpText} ${meta}`.trimEnd(), output.columns),
        useColor,
      ),
    )

    output.write(lines.join('\n'))
    renderedLines = lines.length
  }

  const startBlink = () => {
    if (blinkTimer)
return
    blinkTimer = setInterval(() => {
      cursorVisible = !cursorVisible
      render()
    }, cursorBlinkMs)
  }

  const stopBlink = () => {
    if (!blinkTimer)
return
    clearInterval(blinkTimer)
    blinkTimer = null
    cursorVisible = true
  }

  const updateRanking = () => {
    ranked = rankItems(items, query)
    // Reset selection to the first item after query changes.
    cursor = 0
    if (cursor >= ranked.length)
cursor = ranked.length - 1
    if (cursor < 0)
cursor = 0
    if (inputCursor > query.length)
inputCursor = query.length
    if (inputCursor < 0)
inputCursor = 0
    updateOffset()
  }

  return new Promise((resolve) => {
    let resolved = false

    function finish(status: number, result: string) {
      if (resolved)
return
      resolved = true
      cleanup()
      resolve({ status, result })
    }

    function cleanup() {
      input.removeListener('data', onData)
      if (output.isTTY)
output.off('resize', onResize)
      if (input.isTTY)
input.setRawMode(false)
      input.pause()
      stopBlink()
      clearRendered()
      showCursor()
    }

    function onData(data: Buffer) {
      cursorVisible = true
      const str = data.toString('utf8')

      if (str === '\u0003' || str === '\u0004')
return finish(cancelCode, '')

      if (str === '\r' || str === '\n') {
        if (!ranked.length) {
          output.write('\u0007')
          return
        }
        return finish(0, ranked[cursor]?.item || '')
      }

      if (str.startsWith('\u001B')) {
        if (str === '\u001B') {
          if (query.length) {
            query = ''
            inputCursor = 0
            updateRanking()
            render()
            return
          }
          return finish(cancelCode, '')
        }
        if (str === '\u001B[A') {
          if (ranked.length) {
            cursor = cursor > 0 ? cursor - 1 : ranked.length - 1
          }
          render()
          return
        }
        if (str === '\u001B[B') {
          if (ranked.length) {
            cursor = cursor < ranked.length - 1 ? cursor + 1 : 0
          }
          render()
          return
        }
        if (str === '\u001B[D') {
          if (inputCursor > 0)
inputCursor--
          render()
          return
        }
        if (str === '\u001B[C') {
          if (inputCursor < query.length)
inputCursor++
          render()
          return
        }
        if (str === '\u001B[5~') {
          cursor = Math.max(0, cursor - maxVisible)
          render()
          return
        }
        if (str === '\u001B[6~') {
          cursor = Math.min(ranked.length - 1, cursor + maxVisible)
          render()
          return
        }
        if (str === '\u001B[3~') {
          if (inputCursor < query.length) {
            query = `${query.slice(0, inputCursor)}${query.slice(
              inputCursor + 1,
            )}`
            updateRanking()
            render()
          }
          return
        }
        return
      }

      if (str === '\u007F' || str === '\b' || str === '\u0008') {
        if (query.length && inputCursor > 0) {
          query = `${query.slice(0, inputCursor - 1)}${query.slice(
            inputCursor,
          )}`
          inputCursor = Math.max(0, inputCursor - 1)
          updateRanking()
          render()
        }
        return
      }

      let printable = ''
      for (const ch of str) {
        if (ch >= ' ' && ch !== '\u007F')
printable += ch
      }
      if (printable) {
        query = `${query.slice(0, inputCursor)}${printable}${query.slice(
          inputCursor,
        )}`
        inputCursor += printable.length
        updateRanking()
        render()
      }
    }

    if (input.isTTY)
input.setRawMode(true)
    input.resume()
    input.on('data', onData)
    if (output.isTTY) {
      output.on('resize', onResize)
    }

    hideCursor()
    startBlink()
    render()
    function onResize() {
      updateMaxVisible()
      updateOffset()
      render()
    }
  })
}
