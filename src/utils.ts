import process from 'node:process'
import colorize from '@simon_he/colorize'
import { cancelledText, isZh, log } from './constants'

export function getParams(params: string[]): [string, string, string] {
  const first = params[0]
  if (!first)
return ['', '', '']
  if (first.startsWith('--'))
return ['', '', params.join(' ')]
  if (params[1] && params[1].startsWith('--'))
    return [first, '', params.slice(1).join(' ')]

  return [first, params[1], params.slice(2).join(' ')]
}

export function fuzzyMatch(scripts: Record<string, string>, params: string) {
  const keys = Object.keys(scripts)
  const result = keys.find(key => key.startsWith(params))
  if (result)
return result
  try {
    const reg = new RegExp(params.split('').join('[_-\\w$.:]*'))
    return keys.find(key => reg.test(key))
  }
 catch (error) {
    log(
      colorize({
        text: `${isZh ? '正则错误' : 'RegExp error'}: ${error}`,
        color: 'red',
      }),
    )
    process.exit(1)
  }
}

// 取消操作
export function cancel() {
  log(colorize({ color: 'yellow', text: cancelledText }))
  return process.exit()
}

// 常量导出
export const constants = {
  log,
  isZh,
  cancelCode: 130,
  cancelledText,
  notfound: isZh
    ? '当前目录并未找到package.json文件'
    : 'The current directory and not found package.json file',
  runMsg: isZh ? '正在为您执行...' : 'is running for you...',
  splitFlag: '__ccommand__split',
}
