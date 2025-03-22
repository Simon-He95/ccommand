import fsp from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { jsShell } from 'lazy-js-utils/node'
import colorize from '@simon_he/colorize'
import { pushHistory } from './history'
import { isZh, log } from './constants'

const execAsync = promisify(exec)

// 缓存可执行程序检查结果
const executableCache: Record<string, boolean> = {}

export async function checkExecutable(command: string): Promise<boolean> {
  // 如果已经缓存了结果，直接返回
  if (executableCache[command] !== undefined)
    return executableCache[command]

  try {
    await execAsync(`which ${command}`)
    executableCache[command] = true
    return true
  }
  catch {
    executableCache[command] = false
    return false
  }
}

// 缓存已确定的TypeScript运行器
let tsRunner: string | null = null

// 初始化TypeScript运行器（供外部调用，可以在程序启动时执行一次）
export async function initTsRunner(): Promise<string | null> {
  if (tsRunner !== null)
    return tsRunner

  if (await checkExecutable('bun'))
    tsRunner = 'bun'
  else if (await checkExecutable('esno'))
    tsRunner = 'esno'
  else if (await checkExecutable('tsx'))
    tsRunner = 'tsx'
  else tsRunner = null

  return tsRunner
}

export async function executeFile(
  filePath: string,
  command: string,
  successText: string,
  failedText: string,
): Promise<void> {
  await pushHistory(`prun ${filePath}`)
  const { status } = await jsShell(command, {
    errorExit: false,
    isLog: false,
    stdio: 'inherit',
  })

  log(
    colorize({
      color: status === 0 ? 'green' : 'red',
      text: `\n"prun ${filePath}" ${status === 0 ? successText : failedText} ${
        status === 0 ? '🎉' : '❌'
      }`,
    }),
  )
}

export async function executeJsFile(
  filePath: string,
  successText: string,
  failedText: string,
): Promise<void> {
  const ext = path.extname(filePath)
  let runner = 'node'

  if (ext === '.ts') {
    // 如果TSRunner尚未初始化，则初始化它
    if (tsRunner === null)
      await initTsRunner()

    if (tsRunner) {
      runner = tsRunner
    }
    else {
      log(
        colorize({
          text: isZh
            ? '没有找到可以直接执行TypeScript的工具，推荐安装下列工具之一：\n- npm install -g bun\n- npm install -g esno\n- npm install -g tsx'
            : 'No TypeScript executor found. Recommend installing one of:\n- npm install -g bun\n- npm install -g esno\n- npm install -g tsx',
          color: 'yellow',
        }),
      )
      return
    }
  }

  const command = `${runner} ${filePath}`
  await executeFile(filePath, command, successText, failedText)
}

export async function findAndExecuteFile(
  filePath: string,
  successText: string,
  failedText: string,
): Promise<boolean> {
  const fileExtensions = ['.js', '.ts', '.mjs', '.cjs']
  const ext = path.extname(filePath)

  // 1. 如果文件路径已经有支持的扩展名并且文件存在，直接执行
  if (ext && fileExtensions.includes(ext) && existsSync(filePath)) {
    await executeJsFile(filePath, successText, failedText)
    return true
  }

  // 2. 如果没有扩展名，尝试添加扩展名
  if (!ext) {
    for (const extension of fileExtensions) {
      const fullPath = `${filePath}${extension}`
      if (existsSync(fullPath)) {
        await executeJsFile(fullPath, successText, failedText)
        return true
      }
    }
  }

  // 3. 检查目录下的索引文件
  if (existsSync(filePath) && (await fsp.stat(filePath)).isDirectory()) {
    for (const extension of fileExtensions) {
      const indexPath = path.join(filePath, `index${extension}`)
      if (existsSync(indexPath)) {
        await executeJsFile(indexPath, successText, failedText)
        return true
      }
    }
  }

  return false
}

export async function handleFileExecution(
  argv0: string,
  successText: string,
  failedText: string,
): Promise<void> {
  if (argv0.endsWith('.py')) {
    await executeFile(argv0, `python ${argv0}`, successText, failedText)
  }
  else if (argv0.endsWith('.rs')) {
    const compileStatus = (await jsShell(`rustc ${argv0}`)).status
    if (compileStatus === 0) {
      await pushHistory(`prun ${argv0}`)
      await jsShell(`./${argv0.slice(0, argv0.length - 3)}`, 'inherit')
      log(
        colorize({
          color: 'green',
          text: `\n"prun ${argv0}" ${successText} 🎉`,
        }),
      )
    }
    else {
      log(
        colorize({
          color: 'red',
          text: `\ncommand "prun ${argv0}" ${failedText} ❌`,
        }),
      )
    }
  }
}
