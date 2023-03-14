<span><div align="center">![kv](/assets/kv.png)</div></span>

- 高效的执行命令行工具 | Efficient execution of command-line tools
- 基于 [gum](https://github.com/charmbracelet/gum#installation) | Powered by [gum](https://github.com/charmbracelet/gum#installation)

## 介绍 | Introduction

支持 yarn、pnpm、npm、bun

## 安装 | Install

```bash
npm install -g ccommand # 安装ccommand
```

## 指令 ｜ Command

```bash
ccommand -v # 查看版本
ccommand find # 查找workspace
ccommand # 执行当前script
ccommand -help # 查看帮助
```

## 新特性 ｜ Feature

when you run command with search the quick command will be output with tips
当你使用命令通过查找执行, 会在终端输出一个快速执行命令的提示

## 使用 | Usage

- ccommand 选取当前目录下的 package.json 文件中的 scripts 中的命令
- ccommand playground 选取当前目录下的 playground 文件夹下的 package.json 文件中的 scripts 中的命令
- ccommand playground -silent 支持额外的参数传参

https://user-images.githubusercontent.com/57086651/198977837-1b2339dc-38d7-4565-b0b6-ea20ce7b5165.mov

<a href="https://github.com/Simon-He95/sponsor" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" style="height: 51px !important;width: 217px !important;" ></a>

## License

[MIT](./LICENSE) License © 2022 [Simon He](https://github.com/Simon-He95)
