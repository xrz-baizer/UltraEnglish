# UltraEnglish 客户端规则

此目录记录客户端的真实结构、边界和开发约定。规则以源码现状为依据；新增模块或改变契约时，同步修改对应文档。适用范围为 `ultra-english-client/`，不包含服务端开发。

| 文件 | 内容 | 何时阅读 |
| --- | --- | --- |
| [01-project.md](01-project.md) | 产品说明、技术栈、运行与构建 | 首次进入项目 |
| [02-architecture.md](02-architecture.md) | 目录、别名、进程职责、组件与路由 | 增加页面、组件、IPC |
| [03-coding.md](03-coding.md) | TypeScript、React、数据、文件与安全规则 | 所有编码任务 |
| [04-design-system.md](04-design-system.md) | macOS 设计、材质、主题、交互与快捷键 | 所有界面任务 |
| [05-features.md](05-features.md) | 功能入口、持久化与现有能力边界 | 调整业务行为 |
| [06-validation.md](06-validation.md) | 验证流程、回归清单与交付要求 | 修改完成前 |

阅读顺序：父级 `../../AGENTS.md` → 客户端 `../AGENTS.md` → 本索引 → 与任务相关的规范。用户在会话中的明确范围优先；本文档不能扩大修改范围。

路径约定：除非另有说明，各文档中的源码路径均相对于 `ultra-english-client/`。共享修改记录位于 `../Requirement/CHANGELOG.md`。


