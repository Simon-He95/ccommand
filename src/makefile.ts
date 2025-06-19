import fsp from 'node:fs/promises'

export function readMakefile(
  filepath: string,
): Promise<{ name: string, detail: string }[]> {
  return new Promise((resolve) => {
    fsp
      .readFile(filepath, 'utf-8')
      .then((res) => {
        const commandNames: { name: string, detail: string }[] = []
        for (const match of res.matchAll(/.PHONY:\s*([\w\-]+)/g)) {
          let name
          // eslint-disable-next-line no-cond-assign
          if (!match || !(name = match[1]))
continue
          // 根据名字匹配脚本信息
          const commandReg = new RegExp(`^${name}:[\n\\s]*([^\n\\\\;]+)`, 'ms')
          const detailMatcher = res.match(commandReg)
          if (!detailMatcher)
continue
          const detail = `${detailMatcher[1].trim()}...`
          commandNames.push({ name, detail })
        }
        resolve(commandNames)
      })
      .catch(resolve)
  })
}
