# 项目说明与技术栈

## 产品与范围

UltraEnglish 是本地优先的英语学习桌面应用，围绕词汇打字练习和音频学习组织内容。应用采用“资料库 + 学习工作区”结构：学习概览负责引导，词汇和音频资料库负责管理，详情页与练习页承载学习。

当前开发范围为客户端。已有登录和注册界面可以保留，但核心本地学习不应依赖登录。服务端目录 `../ultra-english-server/` 的 Spring Boot、MySQL、Thymeleaf、Docker 规范不应套用到客户端。不要为了界面开发建立新的服务端接口或复制服务端业务。

## 技术栈

版本范围以 `package.json` 为准，实际安装解析以 `package-lock.json` 为准。以下为现有依赖的主要系列，不代表自动升级要求。

| 层级 | 技术 | 职责 |
| --- | --- | --- |
| 桌面容器 | Electron 34 | 窗口、菜单、系统集成、IPC |
| 界面 | React 18、TypeScript 5 | 组件与严格类型 |
| 构建 | electron-vite 2、Vite 6 | main/preload/renderer 分别构建 |
| 样式 | Tailwind CSS 3、PostCSS、自定义 CSS 变量 | 工具类与设计令牌 |
| 交互基础 | Radix UI、Lucide React、Sonner | 可访问弹窗、图标、反馈 |
| 导航 | React Router 6，HashRouter | 桌面文件协议下的路由 |
| 状态 | Zustand 5、React Context | 设置、认证状态、主题 |
| 国际化 | i18next、react-i18next | 简体中文、英文 |
| 本地持久化 | SQLite、Sequelize 6、sqlite3 | 词库、单词、进度、音频、设置 |
| 音频 | WaveSurfer.js 7、HTMLAudioElement、whisper.cpp CLI、FFmpeg、Echogarden/Kokoro | 波形、播放、发音、转录、本机语音合成 |
| 分发 | Electron Forge 7 | package/make/publish |

`better-sqlite3`、`electron-store` 等出现在依赖中，但当前主要数据库实现是 `src/main/db/index.ts` 的 Sequelize + sqlite3。不要仅凭依赖列表描述未落地的架构，也不要在本次任务中替换存储引擎。

## 本地命令

在客户端目录执行：

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm start
```

- `dev`：启动 Electron 与前端热更新。
- `typecheck`：严格类型与未使用符号检查。
- `build`：输出 `app-build/main`、`app-build/preload`、`app-build/renderer`，复制内置词库资源。
- `start` / `preview`：预览已构建的应用。
- `package`：Forge 打包。应先构建再打包，不能假设此脚本自行构建。
- `make`：构建并制作平台分发包。
- `publish`：发布；仅在用户明确授权发布时使用。
- `rebuild`：现有脚本针对 sqlite3 重建 Electron 原生依赖，只在出现 ABI 不兼容时使用。

项目同时存在 npm 与 Yarn 锁文件。当前维护默认使用 npm 和 `package-lock.json`；避免同一任务混用包管理器。纯界面改动不升级依赖、不重写锁文件。

## 构建产物与平台

资源目录 `assets/dictionaries/` 是发布资源；源码目录中的 `renderer/assets/` 用于渲染资源。`app-build/` 和 `out/` 是产物，不应手工编写。目前仓库追踪了部分 `app-build/` 文件；除非任务明确要求提交产物，验证结束后恢复仅由构建生成的差异，并保留源代码修改。

macOS 使用系统窗口按钮和 vibrancy。Windows/Linux 使用正常原生标题栏与实色侧边栏，不模拟 macOS 红黄绿按钮。新增系统能力必须有平台判断和降级方案。

本地转录资源及依赖见 [功能规范](05-features.md)；随包的 whisper.cpp 二进制及其 MIT 许可位于 `assets/bin/whisper/`。

语音合成后台入口随主进程构建进入 `app-build/main/`。Forge 将 ONNX Runtime 原生绑定和同目录动态库一起放在 ASAR 外，合成模型和默认音色由客户端按需下载。
