<img src="home/brand-logo.webp" alt="UltraEnglish" width="220">

# UltraEnglish 英语学习桌面客户端

听到一句英语，总有几个词跟不上？在 UltraEnglish 里，你可以点字幕跳到原声，选中这几个词反复听，再回到整句跟读。想练拼写时，打开一本词书，从上次停下的章节继续。

**[访问官网](https://xrz-baizer.github.io/UltraEnglish/)** · [体验跟读与拼写](https://xrz-baizer.github.io/UltraEnglish/#experience) · [下载 Mac 客户端](https://xrz-baizer.github.io/UltraEnglish/#download)

![客户端首页，展示拼写练习、跟读练习入口和本地学习进度](docs/screenshots/desktop-home.png)

## 音频跟读与歌曲跟唱

打开内置的《日常高频句子-1》，点击右侧字幕就能跳到对应的原声。长句跟不上时，可以放慢语速，或只循环其中几个词。换成自己的歌曲和歌词字幕，就能按同样的方式逐句跟唱。

![跟读界面，左侧展示当前句子，右侧是带时间戳的字幕，下方是音频波形和播放控件](docs/screenshots/audio-study.png)

## 词库与拼写练习

从词汇资料库挑一本词书，进入章节后用键盘练习拼写。想练自己的材料，也可以把单词或整句整理成 JSON 词表导入。

![词汇资料库，展示按分类整理的雅思词汇、阅读核心词汇和基础词汇书](docs/screenshots/vocabulary-library.png)

## 第一次使用

1. 从官网下载适合 Apple 芯片 Mac 的安装包，打开 DMG，将 UltraEnglish 拖入「应用程序」。
2. 启动后选「跟读练习」，打开内置音频，点一句字幕开始听。第一次体验可以直接使用示例素材。
3. 想换一种练法，就回到首页选「拼写练习」，挑一本词书开始第一章。练习进度保存在本机。

### 使用自己的学习素材

使用本地 Whisper 模型识别英文音频。仓库包含 tiny 模型和两种 Mac 架构的识别引擎。转录和纯文本字幕对齐需要 FFmpeg；使用 Homebrew 的 Mac 可运行 `brew install ffmpeg`。

自定义词库使用 JSON 数组。每项用 `name` 填写英文原文，用 `trans` 保存中文释义数组。

```json
[
  { "name": "curiosity", "trans": ["n. 好奇心；求知欲"] }
]
```

## 本地启动

准备 Node.js 22.x 和 npm。在包含客户端 `package.json` 的目录中执行以下命令。

```bash
npm ci
npm run dev
```

首次启动会创建本地数据库并导入内置词库。如果启动时提示 `sqlite3` 的 `NODE_MODULE_VERSION` 不匹配，关闭客户端，运行 `npm run rebuild` 后重新启动。

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
