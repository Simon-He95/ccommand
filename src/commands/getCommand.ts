import { formatShellCommand, isSafeShellArg, shellEscape } from '../utils.js'

export async function getCommand(ctx: {
  termStart: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'make'
  params: string[]
  dirname: string
  argv: string[]
  val: string
  runMsg: string
  isZh: boolean
  pushHistory: (command: string) => Promise<void>
  jsShell: any
  isNeedPrefix: (p: string[]) => boolean
  fuzzyWorkspace?: string
}) {
  let {
    termStart,
    params,
    dirname,
    argv,
    val,
    /* runMsg, */ isZh: _isZh,
    pushHistory,
    jsShell: _jsShell,
    isNeedPrefix,
    fuzzyWorkspace,
  } = ctx

  let prefixArgs = [...(params || [])]
  let commandOverride = ''
  if (
    termStart !== 'npm'
    && prefixArgs.length
    && !prefixArgs[0].startsWith('--')
  ) {
    commandOverride = prefixArgs[0]
    prefixArgs = prefixArgs.slice(1)
  }

  const target = commandOverride || val || fuzzyWorkspace || ''
  val = `${target}`

  const shouldInsertDoubleDash
    = isNeedPrefix(prefixArgs) && prefixArgs.length > 0 && prefixArgs[0] !== '--'

  const commandArgs: string[] = []
  if (termStart === 'npm') {
    commandArgs.push('run')
    if (dirname)
commandArgs.push('--prefix', dirname)
    if (target)
commandArgs.push(target)
    const npmArgs = [...prefixArgs]
    if (npmArgs[0] === '--')
npmArgs.shift()
    if (npmArgs.length)
commandArgs.push('--', ...npmArgs)
  }
 else if (termStart === 'pnpm') {
    commandArgs.push('run')
    if (dirname)
commandArgs.push('--filter', dirname)
    if (target)
commandArgs.push(target)
    if (shouldInsertDoubleDash)
commandArgs.push('--')
    commandArgs.push(...prefixArgs)
  }
 else if (termStart === 'yarn') {
    if (dirname)
commandArgs.push('workspace', dirname)
    if (target)
commandArgs.push(target)
    if (shouldInsertDoubleDash)
commandArgs.push('--')
    commandArgs.push(...prefixArgs)
  }
 else if (termStart === 'bun') {
    commandArgs.push('run')
    if (target)
commandArgs.push(target)
    if (shouldInsertDoubleDash)
commandArgs.push('--')
    commandArgs.push(...prefixArgs)
  }
 else if (termStart === 'make') {
    if (target)
commandArgs.push(target)
    if (shouldInsertDoubleDash)
commandArgs.push('--')
    commandArgs.push(...prefixArgs)
  }

  const result = formatShellCommand([termStart, ...commandArgs])

  const historyArgs: string[] = []
  if (argv[0] === 'find') {
    historyArgs.push('pfind')
    if (dirname)
historyArgs.push(dirname)
  }
 else {
    historyArgs.push('prun')
  }
  if (target)
historyArgs.push(target)
  historyArgs.push(...prefixArgs)

  const historyText = formatShellCommand(historyArgs)
  await pushHistory(historyText)

  const highlighText = historyArgs
    .map((arg, index) => {
      const isLast = index === historyArgs.length - 1
      if (isLast && isSafeShellArg(arg))
return `'${arg}'`
      return shellEscape(arg)
    })
    .join(' ')
  return { command: result, text: highlighText, val }
}
