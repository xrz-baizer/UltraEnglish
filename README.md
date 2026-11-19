# UltraEnglish 桌面客户端

UltraEnglish 把音频精听、跟读和拼写练习放在同一个桌面应用里。客户端使用 Electron、React、TypeScript 和 SQLite，核心学习功能可在本机独立运行。

## 本地启动

准备 Node.js 22.x 和 npm。从仓库根目录执行以下命令，后续命令均在客户端目录运行。

```bash
cd ultra-english-client
npm ci
npm run dev
```

首次启动会创建本地数据库并导入内置词库。如果启动时提示 `sqlite3` 的 `NODE_MODULE_VERSION` 不匹配，关闭客户端，运行 `npm run rebuild` 后重新启动。

## 开始学习

- **音频精听与跟读**：导入本地音频和字幕，点击字幕跳到对应位置。可以逐句循环、调整语速，也可以只选中难听清的几个词反复练习。
- **生成字幕**：使用本地 Whisper 模型识别英文音频。仓库包含 tiny 模型和两种 Mac 架构的识别引擎。转录和纯文本字幕对齐需要 FFmpeg；使用 Homebrew 的 Mac 可运行 `brew install ffmpeg`。
- **拼写练习**：在词汇资料库选择词书和章节，练习单词或整句，也可以导入自己的 JSON 词库。每项用 `name` 填写英文原文，用 `trans` 保存中文释义数组。

```json
[
  { "name": "curiosity", "trans": ["n. 好奇心；求知欲"] }
]
```

## 制作安装包

`npm run make` 会构建最新源码、打包应用并制作安装包，一条命令即可。使用 Yarn 时可运行 `yarn make`，参数直接跟在后面。两种写法调用同一脚本，脚本内部会用到 npm。首次为某个架构打包时，Forge 会下载对应的 Electron 运行时，之后通常会复用缓存。

### macOS 安装包（DMG）

在 Mac 上按目标芯片选择一组命令。Forge 默认将两种架构的安装包都写入 `out/make/UltraEnglish.dmg`，下面在每次成功后立即改名，方便同时保留两份。

```bash
# Apple Silicon（M 系列）
npm run make -- --arch=arm64 && mv out/make/UltraEnglish.dmg out/make/UltraEnglish-arm64.dmg

# Intel Mac
npm run make -- --arch=x64 && mv out/make/UltraEnglish.dmg out/make/UltraEnglish-x64.dmg
```

Apple Silicon Mac 可以指定 Intel 目标。发布前请在对应架构上打开 DMG，将应用拖入「应用程序」，验证启动、词库读取和音频转录。当前配置尚未包含完整的 Developer ID 签名与公证流程。Mac App Store 分发另见[发布手册](docs/mac-app-store-release.md)。

### Windows 安装包（EXE）

在 Windows x64 电脑或 GitHub Actions 的 Windows 运行器中，进入客户端目录后执行：

```powershell
npm ci
npm run make -- --platform=win32 --arch=x64
```

生成的 `*Setup.exe` 位于 `out/make/squirrel.windows/x64/`。同一条打包命令用 Yarn 写作 `yarn make --platform=win32 --arch=x64`。

`win32` 是 Windows 平台名。若要尝试 32 位构建，运行 `npm run make -- --platform=win32 --arch=ia32`；该目标的原生依赖兼容性仍待验证。当前使用的 [Squirrel.Windows 安装器](https://www.electronforge.io/config/makers/squirrel.windows) 官方支持在 Windows 或装有 Mono 和 Wine 的 Linux 上制作。

正式分发前，请替换 [Forge 配置](forge.config.js) 中的示例图标地址。在干净的 Windows 机器上检查安装与启动，并为音频转录配齐 Windows 版 Whisper 引擎和 FFmpeg。

### 应用目录与版本号

只需测试打包后的应用目录时，运行 `npm run build`，再运行 `npm run package`。源码构建产物位于 `app-build/`，打包后的应用目录位于 `out/`。

应用版本来自 [package.json](package.json) 的 `version` 字段。例如发布 1.0.0 时，先运行 `npm version 1.0.0 --no-git-tag-version`，再执行对应平台的打包命令。`electron-forge make --version` 用于查看工具版本。

## 数据与备份

词库、练习进度和字幕保存在 Electron 用户数据目录下的 `data/ultra-english.db`，部分偏好和笔记保存在 localStorage。备份时先退出应用，复制整个用户数据目录，并保留单独设置的音频和模型目录。

语音转录在本机处理。在线发音会将朗读文本发送至有道，下载 Whisper 模型会访问 Hugging Face，首次使用文本对齐也可能下载所需资源。

## 开发与第三方资源

提交客户端代码前可运行 `npm run typecheck` 和 `npm run build`。代码结构与开发约定见[客户端开发指南](ruler/README.md)。

音频学习和拼写练习分别参考了 [Enjoy](https://github.com/ZuodaoTech/everyone-can-use-english) 与 [qwerty-learner-vscode](https://github.com/RealKai42/qwerty-learner-vscode)。分发时请核对词库、模型、FFmpeg 和其他随包依赖的许可，尤其是用于文本对齐的 Echogarden（GPL-3.0）。随包 Whisper 引擎的许可见 [LICENSE](assets/bin/whisper/LICENSE)。
