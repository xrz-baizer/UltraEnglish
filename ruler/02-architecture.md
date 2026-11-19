# 架构、目录与组件

`renderer/lib/theme.ts` 定义浅色、深色、跟随系统的共用 Theme 类型及历史值归一化，由 ThemeProvider、基础设置和 settings-store 共用；历史护眼值仅用于兼容迁移，不再作为可选主题。

## 实际目录

```text
ultra-english-client/
├── AGENTS.md                     # 客户端工作入口
├── ruler/                        # 本目录：项目规则与架构说明
├── electron.vite.config.ts       # 三进程构建、别名、词库资源复制
├── forge.config.js               # 打包与分发
├── tailwind.config.js            # Tailwind 与主题变量映射
├── tsconfig.json                 # TypeScript 严格检查
├── assets/icons/                 # 桌面应用图标
├── assets/dictionaries/          # 内置词库与配置
└── src/
    ├── shared/app-commands.ts    # 跨进程命令、窗口信息、概览 DTO
    ├── main/
    │   ├── index.ts             # 应用生命周期与主窗口
    │   ├── app-menu.ts          # 原生菜单、主导航快捷键
    │   ├── window-appearance.ts # 原生材质与系统无障碍适配
    │   ├── db/index.ts          # Sequelize 模型、初始化、兼容迁移
    │   ├── db/seed.ts           # 词库初始化与文件导入
    │   ├── db/handlers/index.ts # 既有业务 IPC 处理器
    │   └── services/            # whisper.ts、backup.ts
    ├── preload/index.ts         # contextBridge 与 ElectronAPI 类型
    └── renderer/
        ├── index.tsx            # React 挂载
        ├── app.tsx              # HashRouter、应用级弹窗
        ├── assets/              # 前端静态资源
        ├── components/
        │   ├── layouts/        # Layout、Sidebar、TitleBar
        │   ├── ui/dialog.tsx   # Radix Dialog 基础组件
        │   ├── ui/select.tsx   # Radix Select 统一下拉组件
        │   ├── settings/       # 设置弹窗及各类别面板
        │   ├── auth/           # 登录/注册弹窗
        │   ├── audio-waveform.tsx
        │   └── language-switcher.tsx
        ├── context/theme-provider.tsx
        ├── lib/                # utils.ts、sound.ts、voice.ts
        ├── stores/             # settings-store.ts、auth-store.ts
        ├── styles/globals.css  # 设计变量、窗口布局、公共样式
        ├── i18n/               # 初始化与 en/zh-CN 词条
        └── pages/
            ├── home.tsx
            ├── vocabulary/     # 列表、详情、练习、独立导入窗口
            ├── audios/         # 资料库、详情和面板
            └── auth/           # 独立登录、注册页
```

`src/renderer/hooks/` 可在出现可复用行为时按需建立；不要为目录完整而添加空文件。`src/types/` 与 `src/constants/` 是已有配置中的预留别名位置，不是当前已经实现的模块。新增目录必须有实际职责，避免空目录与无用途抽象。

## 进程边界

```text
React 页面 / Zustand
    → window.electronAPI（命名明确的方法）
    → preload contextBridge
    → ipcMain handler
    → Sequelize / 本地文件 / 系统窗口
    ← 可序列化 DTO 或明确结果
```

- **main**：持有数据库、文件系统、Whisper、窗口和系统菜单；不导入 React。
- **preload**：薄桥接、参数类型与事件注销；不实现数据库或业务状态。
- **renderer**：显示数据、收集输入、维护界面状态；不直接调用 Node.js、Electron、SQLite。
- **shared**：纯类型/常量契约；不得依赖 main、Node 系统能力或组件。

新增 IPC 修改顺序：共享类型 → 主进程处理与校验 → preload 白名单方法和类型 → renderer 调用 → 错误反馈与验证。不要把整个 `ipcRenderer` 暴露给页面。

## 路由与组件职责

| 路由/入口 | 组件 | 责任 |
| --- | --- | --- |
| `/` | `pages/home.tsx` | 本地概览、学习入口与已有练习记录 |
| `/vocabulary` | `pages/vocabulary/index.tsx` | 词汇书、分类、搜索、批量管理 |
| `/vocabulary/:bookId` | `pages/vocabulary/book.tsx` | 章节、熟词与书籍设置 |
| `/vocabulary/:bookId/practice` | `pages/vocabulary/practice.tsx` | 打字、默写、发音、进度、快捷键 |
| `/audios` | `pages/audios/index.tsx` | 音频列表、导入、搜索、排序与删除 |
| `/audios/:id` | `pages/audios/detail.tsx` | 音频播放、波形、字幕与转录 |
| `/login`、`/register` | `pages/auth/` | 独立认证页面 |
| `?window=import-vocabulary` | `pages/vocabulary/import-window.tsx` | 独立导入窗口，不经过主布局 |
| 应用级设置 | `components/settings/settings-modal.tsx` | 设置导航及五类设置 |

`Layout` 管理整体分栏、菜单命令订阅和侧边栏展开状态。`Sidebar` 管理顶层目的地与账户/设置入口。`TitleBar` 是网页工具栏，负责页面上下文、侧边栏开关与返回父级；它不是自绘系统窗口按钮。

词汇列表的 `VocabularyHeader` 只接收统计和操作回调，`VocabularyBookGrid` 保留历史导出名但现在展示分组列表，`VocabularyEmptyState` 展示真实空状态。 分类顺序由 `lib/vocabulary-categories.ts` 在列表、管理与独立导入窗口统一计算。拼写字体、精确字号和字重统一由 `components/settings/vocabulary-settings.tsx` 管理，练习页只应用同一份持久化偏好；字体选项位于 `lib/vocabulary-typography.ts`。页面私有组件留在各页面的 `components/`；被多个业务复用时再提升到共享组件。

## 别名

共享 `components/ui/select.tsx` 负责下拉触发器、Portal 菜单、选中标记、长列表滚动及键盘焦点；页面仅传递实际字符串值、选项和变更回调。内部索引标识兼容业务空字符串（跟随全局、未分类），不修改既有持久化格式。用于单书重复次数及音频分类编辑、筛选和排序。

- renderer 代码优先用 `@renderer/...`。
- main 内部使用相对路径或配置中的 `@main/...`。
- 跨进程纯契约使用指向 `src/shared/` 的相对路径。
- `@/` 在 Vite renderer 与 TypeScript 的现有映射不一致，新增代码避免使用它；若修复映射，应在独立任务中同步修改全部配置并检查引用。
- 不使用 `@types/...` 作为自定义运行时模块导入路径，以免与 TypeScript 类型包语义冲突。

音频详情由 `pages/audios/detail.tsx` 和 `components/audio-waveform.tsx` 承载，旧录音面板组件已移除。`src/renderer/env.d.ts` 提供 Vite 静态资源类型。共享品牌 PNG 来自 `assets/icons/`，本地转录引擎来自 `assets/bin/`，Forge 将 bin 作为额外资源复制。

新增音频协作模块：`main/services/audio-storage.ts` 负责已知存储目录与系统选择器；`shared/audio-transcription.ts` 定义句子/词时间戳并合并 tokens；`renderer/hooks/use-audio-clip.ts` 管理源音频解码和当前句 Blob 生命周期；`renderer/lib/audio-clip.ts` 编码句内 PCM。共享 bridge 新增 `getAudioStoragePaths` 与 `chooseAudioStorageDirectory`。
