# 核心规则

在进行任何编码工作之前，如果对用户的编码需求有任何不理解、不清晰、不明确的地方，可以先咨询用户，让用户确认。

# UltraEnglish 客户端开发入口

此文件适用于 `ultra-english-client/` 下的工作。父级 `../AGENTS.md` 仍适用；本目录是 Electron 客户端，不是 Web 服务端。

- 当前范围仅包含客户端。不要修改 `../ultra-english-server/`，不要为界面改版启动 MySQL、Spring Boot 或 Docker。
- 开始任务前阅读 [规则索引](ruler/README.md)，再按任务阅读对应规范。这里的 `ruler` 是项目规则文档目录，不依赖同名工具或插件。
- 保持现有学习数据、词汇书、熟词标记、章节进度与自定义设置的兼容性。默认不做破坏性迁移。
- 页面放 `src/renderer/pages/`，共享 UI 放 `components/`，跨进程契约放 `src/shared/`；数据库与文件操作留在 `src/main/`。
- macOS 窗口材质使用当前 Electron 支持的原生 vibrancy；侧边栏与主面板背景使用磨砂半透明，侧边栏更通透，内容卡片与输入控件保持实色。
- 文案必须同时维护简体中文和英文。所有新控件应支持键盘访问与可见焦点。
- 完成相关修改后执行 `npm run typecheck`、`npm run build`，并按 `ruler/06-validation.md` 检查必要流程。
- 每次改动更新 `../Requirement/CHANGELOG.md`，包含日期、说明和准确的文件列表。这是客户端任务允许更新的共享文档。
- 不覆盖用户已有改动，不顺带重构参考项目、服务端或编辑器配置。不提交 `node_modules`、个人数据库、密钥或调试截图。
