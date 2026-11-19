# whisper.cpp 本地引擎

- 来源：本仓库参考项目 `ReferenceProject/Enjoy-Ultimate/lib/whisper.cpp/` 中现有 macOS arm64 / x64 二进制与 Metal 资源；本次复制到客户端运行资源，不修改参考项目。
- 上游：https://github.com/ggml-org/whisper.cpp
- 许可：MIT，见本目录 `LICENSE`。
- 当前使用 CPU 推理（`-ng`），支持旧系统与无 GPU 环境。通过 `-ojf` 输出包含词级 token 的 JSON 时间戳，`-ml 80 -sow` 限制过长字幕片段并按词切分。
- Forge 将 `assets/bin` 复制到应用 Resources。模型另存于 `assets/models/whisper`，FFmpeg 目前由系统提供，详见 `ruler/05-features.md`。
- 尚未提供 Windows/Linux 引擎。更新二进制需同时核验架构、许可、动态库依赖、CLI 参数兼容性和真实音频转录。
