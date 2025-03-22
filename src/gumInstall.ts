import colorize from '@simon_he/colorize'
import { jsShell } from 'lazy-js-utils/node'
import terminalLink from 'terminal-link'

const log = console.log
export async function gumInstall(isZh: boolean) {
  const { status } = await jsShell('gum -v', 'pipe')
  if (status !== 0) {
    log(
      colorize({
        color: 'blue',
        text: isZh ? '正在为您安装gum...' : 'install gum...',
      }),
    )
    const { status } = await jsShell('brew install gum')
    if (status !== 0) {
      const { status } = await jsShell(`sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
    echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
    sudo apt update && sudo apt install gum`)
      if (status !== 0) {
        const link = terminalLink(
          isZh ? 'gum官网链接' : 'the official website of gum',
          'https://github.com/charmbracelet/gum#installation',
        )
        return log(
          colorize({
            color: 'red',
            text: `${
              isZh
                ? 'gum安装失败,你可以自行从以下链接安装'
                : 'gum install error, you can install it yourself through'
            } ${colorize({ color: 'yellow', text: link, bold: true })}`,
          }),
        )
      }
    }
    log(
      colorize({
        color: 'green',
        text: isZh ? 'gum安装成功  🎉' : 'gum install successfully 🎉',
      }),
    )
  }
}
