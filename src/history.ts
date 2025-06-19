import { existsSync } from 'node:fs'
import fsp from 'node:fs/promises'
import process from 'node:process'
import colorize from '@simon_he/colorize'
import { jsShell } from 'lazy-js-utils/node'
import { isZh, log } from './constants'

export async function pushHistory(command: string) {
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
  let historyFormat = ''

  switch (shellName) {
    case 'zsh':
      historyFile = `${process.env.HOME}/.zsh_history`
      historyFormat = 'zsh'
      break
    case 'bash':
      historyFile = process.env.HISTFILE || `${process.env.HOME}/.bash_history`
      historyFormat = 'bash'
      break
    case 'fish':
      historyFile = `${process.env.HOME}/.local/share/fish/fish_history`
      historyFormat = 'fish'
      break
    default:
      // 默认使用bash格式
      historyFile = process.env.HISTFILE || `${process.env.HOME}/.bash_history`
      historyFormat = 'bash'
  }

  try {
    if (!existsSync(historyFile)) {
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

    const _history = await fsp.readFile(historyFile, 'utf8')
    const now = new Date()
    const timestamp = Math.floor(now.getTime() / 1000)

    let newEntry = ''
    let info = ''

    // 根据不同shell格式生成history条目
    switch (historyFormat) {
      case 'zsh':
        // zsh格式: : timestamp:0;command
        newEntry = `: ${timestamp}:0;${command}`
        break
      case 'fish':
        // fish格式: - cmd: command\n  when: timestamp
        newEntry = `- cmd: ${command}\n  when: ${timestamp}`
        break
      case 'bash':
      default:
        // bash格式: 直接是命令，不带时间戳（除非设置了HISTTIMEFORMAT）
        if (process.env.HISTTIMEFORMAT) {
          newEntry = `#${timestamp}\n${command}`
        }
 else {
          newEntry = command
        }
    }

    // 构造完整的history内容
    if (historyFormat === 'fish') {
      // fish使用YAML格式，需要特殊处理
      info = `${
        _history + (_history && !_history.endsWith('\n') ? '\n' : '') + newEntry
      }\n`
    }
 else {
      info = `${
        _history + (_history && !_history.endsWith('\n') ? '\n' : '') + newEntry
      }\n`
    }

    const infoSet: any[] = []

    // 过滤掉之前重复的指令（根据不同格式处理）
    info.split('\n').forEach((item) => {
      let cmd = ''
      if (historyFormat === 'zsh') {
        cmd = item.split(';').slice(1).join(';')
      }
 else if (historyFormat === 'fish') {
        if (item.startsWith('- cmd: ')) {
          cmd = item.substring(7) // 移除 "- cmd: "
        }
 else {
          cmd = item
        }
      }
 else {
        // bash: 跳过时间戳行
        if (!item.startsWith('#')) {
          cmd = item
        }
 else {
          cmd = item
        }
      }

      const targetIndex = infoSet.findIndex((i) => {
        let iCmd = ''
        if (historyFormat === 'zsh') {
          iCmd = i.split(';').slice(1).join(';')
        }
 else if (historyFormat === 'fish') {
          if (i.startsWith('- cmd: ')) {
            iCmd = i.substring(7)
          }
 else {
            iCmd = i
          }
        }
 else {
          if (!i.startsWith('#')) {
            iCmd = i
          }
 else {
            iCmd = i
          }
        }
        return iCmd === cmd
      })

      if (targetIndex !== -1)
infoSet.splice(targetIndex, 1)
      infoSet.push(item)
    })

    const newInfo = infoSet.join('\n')

    // 写回history
    await fsp.writeFile(historyFile, newInfo)
    // 根据不同shell环境执行对应的更新命令
    switch (shellName) {
      case 'zsh':
        await jsShell('zsh', 'inherit')
        break
      case 'bash':
        await jsShell('bash', 'inherit')
        break
      case 'fish':
        await jsShell('fish', 'inherit')
        break
    }
  }
 catch {
    log(
      colorize({
        text: `${
          isZh
            ? `❌ 添加到 ${shellName} 历史记录失败`
            : `❌ Failed to add to ${shellName} history`
        }`,
        color: 'red',
      }),
    )
  }
}
