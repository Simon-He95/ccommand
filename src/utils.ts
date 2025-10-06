import process from 'node:process'
import { cancelledText, isZh, log } from './constants.js'

export function getParams(params: string[]): [string, string, string] {
  const first = params[0]
  if (!first)
return ['', '', '']

  // handle flags-only invocation
  if (first.startsWith('--'))
return ['', '', params.join(' ')]

  // if second arg is flags, treat it as param string
  if (params[1] && params[1].startsWith('--'))
    return [first, '', params.slice(1).join(' ')]

  return [first, params[1] || '', params.slice(2).join(' ')]
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function fuzzyMatch(scripts: Record<string, string>, params: string) {
  const keys = Object.keys(scripts)
  // quick prefix match
  const result = keys.find(key => key.startsWith(params))
  if (result)
return result

  // fallback fuzzy regex: escape user input and allow common separators between characters
  try {
    if (!params)
return undefined
    const escapedChars = params.split('').map(c => escapeRegExp(c))
    const pattern = escapedChars.join('[_-\\w$.:]*')
    const reg = new RegExp(pattern)
    return keys.find(key => reg.test(key))
  }
 catch (error) {
    // Can't recover from a RegExp construction failure in a sync path — report and exit
    log(`${isZh ? '正则错误' : 'RegExp error'}: ${error}`)
    process.exit(1)
  }
}

// 取消操作
export function cancel(): never {
  // cancel may run synchronously; print plain text to avoid dynamic import latency
  log(cancelledText)
  // Explicit exit code for cancel
  process.exit(130)
}

// 常量导出
export const constants = {
  log,
  isZh,
  cancelCode: 130,
  cancelledText,
  notfound: isZh
    ? '当前目录并未找到 package.json 文件'
    : 'package.json file not found in current directory',
  runMsg: isZh ? '正在为您执行...' : 'is running for you...',
  splitFlag: '__ccommand__split',
}
