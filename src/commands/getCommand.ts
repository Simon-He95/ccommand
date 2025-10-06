export async function getCommand(ctx: {
  termStart: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'make'
  params: string
  dirname: string
  argv: string[]
  val: string
  runMsg: string
  isZh: boolean
  pushHistory: (command: string) => Promise<void>
  jsShell: any
  isNeedPrefix: (p: string) => boolean
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
  let dir = ''
  let prefix = ''
  const withRun = termStart !== 'yarn'
  if (termStart === 'npm') {
    prefix = params ? ` -- ${params}` : ''
    dir = dirname ? ` --prefix ${dirname} ` : ' '
  }
 else if (termStart === 'pnpm') {
    prefix = params ? ` ${params}` : ''
    dir = dirname ? ` --filter ${dirname} ` : ' '
  }
 else if (termStart === 'yarn') {
    prefix = params ? ` ${params}` : ''
    dir = dirname ? ` workspace ${dirname} ` : ' '
  }
 else if (termStart === 'bun') {
    prefix = params ? ` ${params}` : ''
    dir = ''
  }
  let command = ''
  let text = ''
  if (prefix && !prefix.startsWith(' --')) {
    const _all = prefix.split(' ').filter(Boolean)
    command = _all[0]
    prefix = _all.slice(1).join(' ')
  }
  const result = `${termStart}${withRun ? ' run' : ' '}${dir} ${
    command || val || fuzzyWorkspace
  } ${isNeedPrefix(prefix) ? `-- ${prefix}` : prefix}`
  val = `${command || val || fuzzyWorkspace}`
  if (argv[0] === 'find') {
    text = `pfind ${dirname} ${val} ${prefix}`.replace(/\s+/g, ' ').trim()
  }
 else {
    text = `prun ${val} ${prefix}`.replace(/\s+/g, ' ').trim()
  }

  await pushHistory(text)
  const texts = text.split(' ')
  const last = texts.slice(-1)[0]
  texts[texts.length - 1] = `'${last}'`
  const highlighText = texts.join(' ')
  return { command: result, text: highlighText, val }
}
