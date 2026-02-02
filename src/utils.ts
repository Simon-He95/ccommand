import process from 'node:process'
import { cancelledText, isZh, log } from './constants.js'

const safeArgRegExp = /^[\w./:@%+=,-]+$/

export function parseArgv(input: string): string[] {
  const args: string[] = []
  let current = ''
  let quote: '\'' | '"' | null = null
  let inArg = false

  const pushCurrent = () => {
    if (inArg) {
      args.push(current)
      current = ''
      inArg = false
    }
  }

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (quote) {
      if (ch === quote) {
        quote = null
        inArg = true
        continue
      }

      if (quote === '"' && ch === '\\') {
        const next = input[i + 1]
        if (next) {
          current += next
          inArg = true
          i++
          continue
        }
      }

      current += ch
      inArg = true
      continue
    }

    if (ch === '"' || ch === '\'') {
      quote = ch
      inArg = true
      continue
    }

    if (/\s/.test(ch)) {
      pushCurrent()
      while (i + 1 < input.length && /\s/.test(input[i + 1])) i++
      continue
    }

    if (ch === '\\') {
      const next = input[i + 1]
      if (next) {
        current += next
        inArg = true
        i++
        continue
      }
    }

    current += ch
    inArg = true
  }

  pushCurrent()
  return args
}

export function normalizeArgv(input?: string | string[]): string[] {
  if (!input)
return []
  if (Array.isArray(input))
return input
  const trimmed = input.trim()
  if (!trimmed)
return []
  return parseArgv(trimmed)
}

export function shellEscape(arg: string): string {
  if (arg === '')
return '\'\''
  if (safeArgRegExp.test(arg))
return arg
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

export function formatShellCommand(args: Array<string | undefined>): string {
  return args
    .filter((arg): arg is string => typeof arg === 'string')
    .map(shellEscape)
    .join(' ')
}

export function isSafeShellArg(arg: string): boolean {
  return safeArgRegExp.test(arg)
}

export function getParams(params: string[]): [string, string, string[]] {
  const first = params[0]
  if (!first)
return ['', '', []]

  const dividerIndex = params.indexOf('--')
  if (dividerIndex !== -1) {
    const head = params.slice(0, dividerIndex)
    const tail = params.slice(dividerIndex + 1)
    const name = head[0] || ''
    const workspace = head[1] || ''
    const rest = head.slice(2)
    if (name.startsWith('-'))
return ['', '', params.slice()]
    return [name, workspace, [...rest, ...tail]]
  }

  // handle flags-only invocation
  if (first.startsWith('-'))
return ['', '', params.slice()]

  // if second arg is flags, treat it as param string
  if (params[1] && params[1].startsWith('-'))
    return [first, '', params.slice(1)]

  return [first, params[1] || '', params.slice(2)]
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
