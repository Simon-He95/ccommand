<span><div align="center">![kv](/assets/kv.png)</div></span>

- 高效的执行命令行工具 | Efficient execution of command-line tools
- 内置模糊搜索 Picker | Built-in fuzzy-search picker

## 介绍 | Introduction

支持 yarn、pnpm、npm、bun

## 安装 | Install

```bash
npm install -g ccommand # 安装ccommand install ccommand
```

## 指令 ｜ Command

```bash
ccommand -v # 查看版本 view version
ccommand find # 查找workspace find workspace
ccommand # 执行当前script Execute the current script
ccommand --init # 自动检测当前shell并输出集成脚本 Auto-detect shell and output init script
ccommand --init zsh # 输出shell集成脚本 eval "$(ccommand --init zsh)"
CCOMMAND_BIN="node ./cli.mjs" ccommand --init zsh # 本地调试时指定二进制
ccommand -help # 查看帮助 view help
```

## Shell 集成

```
# 临时生效（当前终端）
eval "$(ccommand --init zsh)"

# 本地调试：未全局安装时，指定可执行命令
eval "$(node ./cli.mjs --init zsh 'node ./cli.mjs')"
```

```
# bash
eval "$(ccommand --init bash)"

# fish
eval (ccommand --init fish)
```

> 说明：由于子进程无法直接修改父 shell 的内存状态，必须通过 `eval`（或写入 shell 配置文件）让函数在当前 shell 生效。

## 语言 ｜ Language

```
# 导出环境变量在你的bash或者zsh中 Export environment variables in your bash or zsh
# 中文 Chinese
export PI_LANG=zh
# 英文 English
export PI_LANG=en

```

## 配置 ｜ Config

```
# 禁用交互选择 (支持 CCOMMAND_NO_PICKER / NO_PICKER，兼容旧的 CCOMMAND_NO_GUM / NO_GUM)
export CCOMMAND_NO_PICKER=1

# 禁用写入 shell history (也支持 NO_HISTORY)
export CCOMMAND_NO_HISTORY=1
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
