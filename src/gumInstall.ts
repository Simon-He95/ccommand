// colorize is ESM-only in some environments; import dynamically where needed
import { jsShell } from 'lazy-js-utils/node'

const log = console.log

let _colorize: any | null = null
async function getColorize() {
  if (_colorize)
return _colorize
  _colorize = (await import('@simon_he/colorize')).default
  return _colorize
}

export async function gumInstall(isZh: boolean) {
  try {
    const check = await jsShell('gum -v', 'pipe')
    if (check.status === 0)
return

    const colorize = await getColorize()
    log(
      colorize({
        color: 'blue',
        text: isZh ? '正在为您安装gum...' : 'install gum...',
      }),
    )

    // try Homebrew first
    const brew = await jsShell('brew install gum')
    if (brew.status === 0) {
      const c = await getColorize()
      return log(
        c({
          color: 'green',
          text: isZh ? 'gum安装成功  🎉' : 'gum install successfully 🎉',
        }),
      )
    }

    // Try apt-based install (single invocation)
    const aptInstallCmd = `sudo mkdir -p /etc/apt/keyrings && \
curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg && \
echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list && \
sudo apt update && sudo apt install -y gum`
    const apt = await jsShell(aptInstallCmd)
    if (apt.status === 0) {
      const c = await getColorize()
      return log(
        c({
          color: 'green',
          text: isZh ? 'gum安装成功  🎉' : 'gum install successfully 🎉',
        }),
      )
    }

    const terminalLink = (await import('terminal-link')).default
    const link = terminalLink(
      isZh ? 'gum官网链接' : 'the official website of gum',
      'https://github.com/charmbracelet/gum#installation',
    )
    const c = await getColorize()
    return log(
      c({
        color: 'red',
        text: `${
          isZh
            ? 'gum安装失败,你可以自行从以下链接安装'
            : 'gum install error, you can install it yourself through'
        } ${c({ color: 'yellow', text: link, bold: true })}`,
      }),
    )
  }
 catch (err) {
    const c = await getColorize()
    log(c({ color: 'red', text: `gum install check failed: ${String(err)}` }))
  }
}
