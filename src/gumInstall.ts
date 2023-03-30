import colorize from '@simon_he/colorize'
import { jsShell } from 'lazy-js-utils'
import terminalLink from 'terminal-link'
const log = console.log
export function gumInstall() {
  const { status } = jsShell('gum -v', 'pipe')
  if (status !== 0) {
    log(colorize({ color: 'blue', text: 'install gum...' }))
    const { status } = jsShell('brew install gum')
    if (status !== 0) {
      const { status } = jsShell(`sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://repo.charm.sh/apt/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/charm.gpg
    echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" | sudo tee /etc/apt/sources.list.d/charm.list
    sudo apt update && sudo apt install gum`)
      if (status !== 0) {
        const link = terminalLink(
          'the official website of gum',
          'https://github.com/charmbracelet/gum#installation',
        )
        return log(
          colorize({
            color: 'red',
            text: `gum install error, you can install it yourself through ${colorize(
              { color: 'yellow', text: link, bold: true },
            )}`,
          }),
        )
      }
    }
    log(colorize({ color: 'green', text: 'gum install successfully 🎉' }))
  }
}
