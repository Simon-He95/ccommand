import fsp from 'node:fs/promises'
import { existsSync } from 'node:fs'
import colorize from '@simon_he/colorize'
import { isZh, log } from './constants'

export async function pushHistory(command: string) {
  log(
    colorize({
      text: `${isZh ? '快捷指令' : 'shortcut command'}: ${command}`,
      color: 'blue',
      bold: true,
    }),
  )

  const historyFile = `${process.env.HOME}/.zsh_history`
  try {
    if (!existsSync(historyFile))
      return

    const _history = await fsp.readFile(historyFile, 'utf8')
    // 构造Date对象,获取当前时间
    const now = new Date()
    // 调用getTime()获取UNIX时间戳(ms)
    const timestamp = now.getTime() / 1000
    const info = `${_history}: ${timestamp.toFixed(0)}:0;${command}\n`
    const infoSet: any[] = []

    // 过滤掉之前重复的指令
    info.split('\n').forEach((item) => {
      const command = item.split(';').slice(1).join(';')
      const targetIndex = infoSet.findIndex(
        i => i.split(';').slice(1).join(';') === command,
      )
      if (targetIndex !== -1)
        infoSet.splice(targetIndex, 1)

      infoSet.push(item)
    })
    const newInfo = infoSet.join('\n')

    // 写回history
    await fsp.writeFile(historyFile, newInfo)
  }
  catch (error) {
    // console.log(error)
  }
}
