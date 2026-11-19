# 编码规范

## 命名、类型与组织

- 文件名使用 kebab-case：`audio-player.tsx`；组件 PascalCase；函数/变量 camelCase；常量 UPPER_SNAKE_CASE。
- 启用并遵守现有 `strict`、`noUnusedLocals`、`noUnusedParameters`。不要为让构建通过而关闭检查。
- 新增代码不使用 `any` 规避契约。外部数据先以 `unknown` 接收并收窄；持久化和 IPC 返回定义清晰 DTO。
- 类型导入使用 `import type`。公开函数参数、返回、单位和可空字段要明确。
- 一个组件解决一个明确职责。优先现有组件、现有状态与库；不为一次性展示引入大型依赖。
- 主进程函数不得通过返回 Sequelize 实例跨进程传递数据；转成 `get({ plain: true })`、`toJSON()` 或手工 DTO。
- 当前遗留的弱类型和模型直接返回不应继续复制。调整相关接口时同时检查调用方，避免默默改变结果形状。

## React 与状态

- 组件保持纯渲染；查询、订阅、持久化等副作用放进 effect 或操作函数。
- effect 必须注销 IPC/媒体查询/DOM 监听器，清理计时器；异步结果应避免更新已卸载组件。
- 每个列表项使用稳定业务 ID，不能以数组序号代替持久对象 ID。
- 页面临时搜索、筛选和选择使用组件状态；共享设置使用 `settings-store`；主题使用 `ThemeProvider`。
- Zustand 更新应保持不可变。异步保存失败要恢复或明确提示，禁止界面显示已成功但实际未落盘。
- loading、empty、error、success 明确区分。数据库不可用时显示错误与重试，不伪造零统计或演示记录。
- 快捷键与原生菜单应触发相同页面行为；保留系统文本编辑快捷键，不拦截 ⌘C/⌘V/⌘Z 等基础行为。

## IPC、窗口与文件

- 新增 bridge 方法必须命名具体、参数最小化。`onAppCommand` 使用固定命令联合类型，不允许任意代码执行。
- 新增事件订阅必须返回注销函数。现有通用 `on` 是兼容接口，新接口优先固定事件名。
- 参数在主进程验证：范围、枚举、ID、文件名、目标目录、数据量，不能只信赖前端 TypeScript。
- 保持 `nodeIntegration: false`、`contextIsolation: true`。当前 `sandbox: false` 是既有配置，不得扩大渲染进程权限；修改安全模型需要独立评估兼容性。
- 外部资源仅在确有功能需求时加载，外链使用系统浏览器；新增外链需限制允许的协议。不要添加远程脚本完成界面效果。
- 用户文件通过系统对话框选择；写文件、数据库与模型下载由 main 执行。不得从 renderer 拼接可执行命令。
- 原生窗口与菜单相关逻辑分别集中于 `main/index.ts`、`main/app-menu.ts`、`main/window-appearance.ts`。
- 新平台 API 先核对本项目 Electron 的类型/版本，不能仅依据“最新文档”使用本地版本没有的能力。

## 数据库与兼容性

- 实际存储是 `app.getPath('userData')/data/ultra-english.db`。不得在源码树内放用户数据库。
- 表名 snake_case；当前 Sequelize 模型字段及时间戳沿用既有 camelCase 映射（如 `createdAt`）。父级通用 snake_case 规范用于新增设计，不能借机重命名已发布客户端字段或破坏已有数据。
- 主键使用 `id`。新增列应可兼容已有数据库，并为历史数据提供默认值；不使用“清空重建”作为升级方案。
- 多条有关联的写入按需要使用事务。保留内置词库不可删除的主进程约束，前端禁用只是第一层反馈。
- 熟词状态以 `word_progress.familiar` 为准；书籍与章节本地键的格式见功能文档，改变键名必须迁移历史值。
- 不把本地 IPC 强行包装成服务端 `{ code, message, data }`，不为客户端查询增加 JWT 或网络依赖。若未来接入远端，再单独定义适配层。

## 文案、样式与反馈

- 新文案同时维护 `src/renderer/i18n/locales/zh-CN.json` 与 `en.json`。日期/数量用 `Intl` 或现有格式化工具。
- 使用 `globals.css` 中的语义变量和现有 Tailwind 色值映射；不要硬编码与主题冲突的背景和文字。
- 控件必须是语义化的 `button`、`a`、`input` 等。图标按钮有可访问名称；输入有 label；筛选按钮有 `aria-pressed`。
- 反馈与操作就近，明确成功、取消与错误。删除使用现有确认流程，普通导航与可逆设置不新增确认弹窗。

## 修改记录

每次改动同步 `../Requirement/CHANGELOG.md`，记录日期、结果和准确文件列表。提交前检查 diff，保留用户其他未提交内容。提交信息沿用 `feat:`、`fix:`、`docs:`、`style:`、`refactor:`、`test:`、`chore:`。

## 本地音频处理

调用本地引擎使用 `execFile` 和参数数组，禁止拼接 shell 命令。每个任务使用独立临时目录并在 finally 清理。新增打开文件夹的能力由主进程选择已知目录，不把通用文件系统权限暴露给页面。数据迁移仅限用户已明确要求删除的分类及书籍，事务成功后记录版本标记。
