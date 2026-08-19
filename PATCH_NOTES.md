# Cockpit Tools Codex Patch

这是基于 [jlcodes99/cockpit-tools](https://github.com/jlcodes99/cockpit-tools) `v1.3.23`
的非官方社区增强版，重点维护 Codex 本地 API 服务、成本持久化与 Windows 发布体验。

## 本分支新增与强化

- 图片能力感知：支持 `gpt-image-2`、`/v1/images/generations`、`/v1/images/edits` 和 Responses 图片工具；账号或上游能力不足时显示可操作提示，不绕过上游权限或额度。
- 成本统计：账号支持记录 `actual_spend_cny`，可批量填写；网格、紧凑、列表布局都显示本地 API 估算 USD、手工 CNY 实价和倍率。该数据不是官方账单。
- 价格持久化：账号详情继续加密保存，同时维护独立 `codex_account_billing.json` 映射；升级、刷新、迁移或重新导入时按账号 ID 自动恢复价格。
- 429 处理：裸 429、缺少 `Retry-After` 或 `Retry-After: 0` 按配置立即重试；正数等待受最大间隔限制；多账号优先轮转，单账号按配置重试。
- `quota_low_first`：有正额度的账号优先，未知、耗尽或异常快照排在后面。
- Sidecar 热交接：应用重启前复制临时 sidecar 并写入父进程租约，新进程接管后再替换安装版；失败时保留健康 sidecar、清理临时文件并恢复旧版。维护脚本额外检测 WebView2 localhost 拒绝连接页，避免把空壳窗口误判为成功。
- Windows 构建：构建脚本自动发现完整 Go/Rust/MSVC 工具链，支持 `GOFLAGS=-buildvcs=false` 构建 NSIS。

本分支不强制暴露 WM / `gpt-5.6-sol-wm`，保留上游通用实验模型机制但不添加 WM 映射。

## 已验证

- `cargo check`、`cargo fmt --check`
- Rust 协议、parent lease、supported model 定向测试
- Go auth、registry、OpenAI handler 定向测试
- `npm run typecheck`、TypeScript 测试和 locale 检查

上游全量 Go 测试仍有 Windows 权限与 antigravity 签名相关基线失败，未将其伪装成补丁问题。
