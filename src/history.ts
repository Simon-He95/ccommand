import { Buffer } from 'node:buffer'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { isZh, log } from './constants.js'

let _colorize: any | null = null
async function getColorize() {
  if (_colorize)
return _colorize
  _colorize = (await import('@simon_he/colorize')).default
  return _colorize
}

interface HistoryCacheEntry {
  mtimeMs: number
  size: number
  entries: string[]
  format: HistoryFormat
}

const historyCache = new Map<string, HistoryCacheEntry>()
type HistoryFormat = 'zsh' | 'bash' | 'fish'

function isHistoryDisabled() {
  const raw = process.env.CCOMMAND_NO_HISTORY || process.env.NO_HISTORY || ''
  const flag = raw.toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'yes'
}

function resolveHistoryHintPath() {
  const custom = process.env.CCOMMAND_HISTORY_HINT || ''
  if (custom)
return custom

  const home = process.env.HOME || os.homedir()
  const cacheHome = process.env.XDG_CACHE_HOME || path.join(home, '.cache')
  return path.join(cacheHome, 'ccommand', 'last-history')
}

async function writeLastHistory(command: string) {
  const hintPath = resolveHistoryHintPath()
  try {
    await fsp.mkdir(path.dirname(hintPath), { recursive: true })
    const timestamp = Date.now()
    await fsp.writeFile(hintPath, `${timestamp}\t${command}\n`, 'utf8')
  }
 catch {
    // ignore hint write failures
  }
}

function detectShellName() {
  const shellEnv = process.env.SHELL || '/bin/bash'
  return shellEnv.split('/').pop() || 'bash'
}

function resolveHistoryTarget(shellName: string) {
  const home = process.env.HOME || os.homedir()
  let historyFile = ''
  let historyFormat: HistoryFormat = 'bash'

  switch (shellName) {
    case 'zsh':
      historyFile = path.join(home, '.zsh_history')
      historyFormat = 'zsh'
      break
    case 'bash':
      historyFile = process.env.HISTFILE || path.join(home, '.bash_history')
      historyFormat = 'bash'
      break
    case 'fish':
      historyFile = path.join(home, '.local', 'share', 'fish', 'fish_history')
      historyFormat = 'fish'
      break
    default:
      historyFile = process.env.HISTFILE || path.join(home, '.bash_history')
      historyFormat = 'bash'
  }

  return { historyFile, historyFormat }
}

function parseHistoryEntries(
  content: string,
  historyFormat: HistoryFormat,
): string[] {
  if (historyFormat === 'fish') {
    const lines = content.split(/\r?\n/)
    const blocks: string[] = []
    let buffer: string[] = []
    for (const line of lines) {
      if (line.startsWith('- cmd: ')) {
        if (buffer.length) {
          blocks.push(buffer.join('\n'))
          buffer = []
        }
        buffer.push(line)
      }
 else if (buffer.length) {
        buffer.push(line)
      }
 else if (line.trim() !== '') {
        blocks.push(line)
      }
    }
    if (buffer.length)
blocks.push(buffer.join('\n'))
    return blocks.filter(Boolean)
  }
  if (historyFormat === 'zsh') {
    return content
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
  }

  // bash: 需要保留时间戳行和命令行的配对
  const lines = content.split(/\r?\n/)
  const entries: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('#')) {
      const next = lines[i + 1] ?? ''
      entries.push(`${line}\n${next}`)
      i++
    }
 else if (line.trim() !== '') {
      entries.push(line)
    }
  }
  return entries
}

function extractHistoryCommand(
  entry: string,
  historyFormat: HistoryFormat,
): string {
  if (historyFormat === 'fish') {
    const m = entry.split('\n')[0].match(/^- cmd: (.*)$/)
    return (m ? m[1] : entry).trim()
  }
  if (historyFormat === 'zsh') {
    const m = entry.match(/^[^;]*;(.+)$/)
    return (m ? m[1] : entry).trim()
  }

  if (entry.startsWith('#')) {
    const parts = entry.split(/\r?\n/)
    return (parts[1] ?? parts[0]).trim()
  }
  return entry.trim()
}

export async function pushHistory(command: string) {
  if (isHistoryDisabled())
return

  const colorize = await getColorize()
  log(
    colorize({
      text: `${isZh ? '快捷指令' : 'shortcut command'}: ${command}`,
      color: 'blue',
      bold: true,
    }),
  )

  const shellName = detectShellName()
  const { historyFile, historyFormat } = resolveHistoryTarget(shellName)

  try {
    await writeLastHistory(command)
    // Use async access check to avoid blocking the event loop and handle race conditions.
    try {
      await fsp.access(historyFile)
    }
 catch {
      log(
        colorize({
          text: `${
            isZh
              ? `未找到 ${shellName} 历史文件`
              : `${shellName} history file not found`
          }`,
          color: 'yellow',
        }),
      )
      return
    }

    const stat = await fsp.stat(historyFile).catch(() => null)
    const timestamp = Math.floor(Date.now() / 1000)

    // 根据格式生成 newEntry（保持与原实现兼容）
    let newEntry = ''
    if (historyFormat === 'zsh') {
      newEntry = `: ${timestamp}:0;${command}`
    }
 else if (historyFormat === 'fish') {
      newEntry = `- cmd: ${command}\n  when: ${timestamp}`
    }
 else {
      if (process.env.HISTTIMEFORMAT) {
        newEntry = `#${timestamp}\n${command}`
      }
 else {
        newEntry = command
      }
    }

    let entries: string[] = []
    const cached = historyCache.get(historyFile)
    if (
      cached
      && stat
      && cached.mtimeMs === stat.mtimeMs
      && cached.size === stat.size
      && cached.format === historyFormat
    ) {
      entries = cached.entries.slice()
    }
 else {
      const raw = await fsp.readFile(historyFile, 'utf8')
      entries = parseHistoryEntries(raw, historyFormat)
    }

    // 构建新的条目数组，去掉已有相同 command 的旧条目
    const newEntries: string[] = []
    const newCmd = extractHistoryCommand(newEntry, historyFormat)
    let existingFishBlock: string | null = null
    for (const e of entries) {
      const cmd = extractHistoryCommand(e, historyFormat)
      if (cmd === newCmd) {
        // For fish, keep the whole existing block (to preserve metadata) and update its timestamp later
        if (historyFormat === 'fish') {
          existingFishBlock = e
          continue
        }
        // otherwise skip the duplicate
        continue
      }
      newEntries.push(e)
    }

    // 将 newEntry 推到末尾（保持最近记录在最后）
    if (historyFormat === 'fish' && existingFishBlock) {
      // update the 'when' line in the existing block to the new timestamp
      const lines = existingFishBlock.split('\n')
      let hasWhen = false
      const updated = lines.map((line) => {
        if (line.trim().startsWith('when:') || line.startsWith('  when:')) {
          hasWhen = true
          return `  when: ${timestamp}`
        }
        return line
      })
      if (!hasWhen) {
        // insert when after the cmd line
        updated.splice(1, 0, `  when: ${timestamp}`)
      }
      newEntries.push(updated.join('\n'))
    }
 else {
      newEntries.push(newEntry)
    }

    // 根据格式重组文件内容
    let finalContent = ''
    if (historyFormat === 'fish') {
      finalContent = `${newEntries.map(e => e.trimEnd()).join('\n')}\n`
    }
 else {
      finalContent = `${newEntries.join('\n')}\n`
    }

    // 原子写入：先写入临时文件，再重命名覆盖
    const tmpPath = `${historyFile}.ccommand.tmp`
    await fsp.writeFile(tmpPath, finalContent, 'utf8')
    await fsp.rename(tmpPath, historyFile)
    try {
      const updatedStat = await fsp.stat(historyFile)
      historyCache.set(historyFile, {
        mtimeMs: updatedStat.mtimeMs,
        size: updatedStat.size,
        entries: newEntries,
        format: historyFormat,
      })
    }
 catch {
      historyCache.set(historyFile, {
        mtimeMs: Date.now(),
        size: Buffer.byteLength(finalContent),
        entries: newEntries,
        format: historyFormat,
      })
    }
  }
 catch (err) {
    log(
      colorize({
        text: `${
          isZh
            ? `❌ 添加到 ${shellName} 历史记录失败`
            : `❌ Failed to add to ${shellName} history`
        }${err ? `: ${String(err)}` : ''}`,
        color: 'red',
      }),
    )
  }
}
