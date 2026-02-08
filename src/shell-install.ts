import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import colorize from '@simon_he/colorize'
import { isZh, log } from './constants.js'

const AUTO_INSTALL_DISABLE_FLAGS = new Set(['1', 'true', 'yes'])

function isAutoInstallDisabled() {
  const raw
    = process.env.CCOMMAND_NO_AUTO_INSTALL || process.env.NO_AUTO_INSTALL || ''
  return AUTO_INSTALL_DISABLE_FLAGS.has(raw.toLowerCase())
}

function detectShellName() {
  const shellEnv = process.env.SHELL || ''
  return (
    (process.env.FISH_VERSION && 'fish')
    || (process.env.ZSH_VERSION && 'zsh')
    || (process.env.BASH_VERSION && 'bash')
    || (shellEnv ? shellEnv.split('/').pop() || '' : '')
    || ''
  )
}

function resolveRcPath(shellName: string) {
  const home = process.env.HOME || os.homedir()
  if (shellName === 'fish')
    return path.join(home, '.config', 'fish', 'config.fish')
  if (shellName === 'zsh')
return path.join(home, '.zshrc')
  if (shellName === 'bash')
return path.join(home, '.bashrc')
  return ''
}

function buildInstallLine(shellName: string, bin = 'ccommand') {
  const binCommand = bin || 'ccommand'
  const binCheck = binCommand.trim().split(/\s+/)[0] || 'ccommand'
  if (shellName === 'fish') {
    return [
      `if command -q ${binCheck}`,
      `  eval (${binCommand} --init fish)`,
      'end',
    ].join('\n')
}
  return [
    `if command -v ${binCheck} >/dev/null 2>&1; then`,
    `  eval "$(${binCommand} --init ${shellName})"`,
    'fi',
  ].join('\n')
}

function hasInstallLine(content: string) {
  return (
    content.includes('# ccommand init') || content.includes('ccommand --init')
  )
}

export async function ensureShellInitInstalled(
  options: {
    quiet?: boolean
    force?: boolean
    bin?: string
  } = {},
) {
  if (isAutoInstallDisabled())
return false
  const shellName = detectShellName()
  if (!shellName)
return false

  const rcPath = resolveRcPath(shellName)
  if (!rcPath)
return false

  let content = ''
  try {
    content = await fsp.readFile(rcPath, 'utf8')
  }
 catch {
    // file may not exist yet
  }

  if (!options.force && content && hasInstallLine(content))
return false

  const installLine = buildInstallLine(
    shellName,
    options.bin || process.env.CCOMMAND_BIN || 'ccommand',
  )
  const marker = '# ccommand init'
  const next = ['', marker, installLine, ''].join('\n')

  try {
    await fsp.mkdir(path.dirname(rcPath), { recursive: true })
    await fsp.writeFile(rcPath, `${content.trimEnd()}${next}`, 'utf8')
    if (!options.quiet) {
      log(
        colorize({
          color: 'yellow',
          text: isZh
            ? `已自动写入 ${rcPath}，请重新打开终端或执行: source ${rcPath}`
            : `Auto-installed shell hook into ${rcPath}. Please reopen the terminal or run: source ${rcPath}`,
        }),
      )
    }
    return true
  }
 catch {
    return false
  }
}
