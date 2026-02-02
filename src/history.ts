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
  format: 'zsh' | 'bash' | 'fish'
}

const historyCache = new Map<string, HistoryCacheEntry>()

function isHistoryDisabled() {
  const raw = process.env.CCOMMAND_NO_HISTORY || process.env.NO_HISTORY || ''
  const flag = raw.toLowerCase()
  return flag === '1' || flag === 'true' || flag === 'yes'
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

  // 检测当前shell类型
  const currentShell = process.env.SHELL || '/bin/bash'
  const shellName = currentShell.split('/').pop() || 'bash'

  // 根据不同shell确定history文件路径和格式
  let historyFile = ''
  let historyFormat: 'zsh' | 'bash' | 'fish' = 'bash'

  const home = process.env.HOME || os.homedir()

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
      // 默认使用bash格式
      historyFile = process.env.HISTFILE || path.join(home, '.bash_history')
      historyFormat = 'bash'
  }

  try {
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

    // 解析原有内容为条目数组（对 fish 使用块解析）
    function parseEntries(content: string): string[] {
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
 else if (historyFormat === 'zsh') {
        return content
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean)
      }
 else {
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
      entries = parseEntries(raw)
    }

    // 提取条目对应的“命令字符串”，用于去重比较
    function extractCommand(entry: string): string {
      if (historyFormat === 'fish') {
        const m = entry.split('\n')[0].match(/^- cmd: (.*)$/)
        return (m ? m[1] : entry).trim()
      }
 else if (historyFormat === 'zsh') {
        const m = entry.match(/^[^;]*;(.+)$/)
        return (m ? m[1] : entry).trim()
      }
 else {
        if (entry.startsWith('#')) {
          const parts = entry.split(/\r?\n/)
          return (parts[1] ?? parts[0]).trim()
        }
        return entry.trim()
      }
    }

    // 构建新的条目数组，去掉已有相同 command 的旧条目
    const newEntries: string[] = []
    const newCmd = extractCommand(newEntry)
    let existingFishBlock: string | null = null
    for (const e of entries) {
      const cmd = extractCommand(e)
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
