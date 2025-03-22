import process from 'node:process'
import colorize from '@simon_he/colorize'

export const log = console.log
export const splitFlag = '__ccommand__split'
export const isZh = process.env.PI_Lang === 'zh'
export const cancelCode = 130
export const cancelledText = isZh ? '已取消...' : 'Cancelled...'
export const notfound = isZh
  ? '当前目录并未找到package.json文件'
  : 'The current directory and not found package.json file'
export const runMsg = isZh ? '正在为您执行...' : 'is running for you...'

export function cancel() {
  log(colorize({ color: 'yellow', text: cancelledText }))
  return process.exit()
}
