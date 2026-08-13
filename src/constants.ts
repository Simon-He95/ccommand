import process from 'node:process'

export const log = console.log
export const splitFlag = '__ccommand__split'
// support common env var spellings for language
export const isZh = (process.env.PI_LANG || process.env.LANG || '').startsWith(
  'zh',
)
export const cancelCode = 130
export const cancelledText = isZh ? '已取消...' : 'Cancelled...'
export const notfound = isZh
  ? '当前目录并未找到 package.json 文件'
  : 'package.json file not found in current directory'
export const runMsg = isZh ? '正在为您执行...' : 'is running for you...'

export function cancel(): never {
  // Print a highlighted (yellow) message synchronously using ANSI escapes so
  // it appears before the process exits, without needing an async import.
  const yellow = '\u001B[33m'
  const reset = '\u001B[0m'
  log(`${yellow}${cancelledText}${reset}`)
  // Wait for queued terminal-restore writes (mouse tracking off, cursor show,
  // screen clear) to flush before exiting. A hard process.exit() can drop
  // them on Windows (ConPTY), leaving mouse tracking enabled in the terminal
  // session, which floods the shell's input queue with mouse escape sequences
  // and makes typing laggy after cancelling a selection.
  const stdout = process.stdout
  if (stdout.writableLength > 0) {
    process.exitCode = cancelCode
    const exit = () => process.exit(cancelCode)
    try {
      stdout.write('', exit)
    }
 catch {
      process.exit(cancelCode)
    }
    const timer = setTimeout(exit, 200)
    timer.unref?.()
    return undefined as never
  }
  return process.exit(cancelCode)
}
