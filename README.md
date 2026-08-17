# Cockpit Tools Codex Patch

> 基于 [Cockpit Tools](https://github.com/jlcodes99/cockpit-tools) `v1.3.21` 的非官方社区增强版，主要维护 Codex 本地 API、多账号调度和 Windows 热更新体验。

本项目不是 OpenAI 官方产品，也不代表上游作者。上游的多平台账号管理能力仍然保留；本分支的重点变更记录在 [PATCH_NOTES.md](PATCH_NOTES.md)。

想按截图逐项了解改动，请阅读[中文图文功能说明](docs/FEATURE_GUIDE.zh-CN.md)。

## 主要功能

- Codex 本地 OpenAI 兼容 API，支持 `/v1/responses`、`/v1/chat/completions`、图片生成和图片编辑。
- `gpt-image-2` 图片能力识别；图片生成/编辑能力不可用时提供可操作提示，并按服务开关、账号能力和套餐状态显示或隐藏。
- Codex 账号 `actual_spend_cny` 实际价格记录，支持批量填写以及导入/导出保留；界面同时显示本地 USD 估算和倍率。
- 429 快速处理：裸 429、缺少 `Retry-After` 或 `Retry-After: 0` 按配置立即重试；多账号自动轮转；单账号按配置继续重试；正数等待受最大间隔限制。
- `quota_low_first` 低额度优先调度：有正额度账号优先，未知、耗尽或异常额度排后。
- Sidecar 父进程租约与热更新交接：重启前复制临时 sidecar，新进程接管 API 后再替换安装版；失败时自动恢复，避免 EXE 文件锁和 API 长时间中断。
- Windows x64 NSIS 安装包，以及可复现的 Go/Rust/MSVC 构建脚本。

本发布不强制暴露 WM / `gpt-5.6-sol-wm`；图片权限、账号额度和上游限流仍由上游服务决定，本项目不会绕过这些限制。

## 图文说明

请求链路和增强点如下：

![Codex API 增强请求链路](https://github.com/2406369852/cockpit-tools-codex-patch/blob/main/docs/images/codex-patch-flow.svg?raw=true)

账号额度与多实例管理界面示例：

![Codex 账号额度](https://github.com/2406369852/cockpit-tools-codex-patch/blob/main/docs/images/codex_list.png?raw=true)

![Codex 多实例](https://github.com/2406369852/cockpit-tools-codex-patch/blob/main/docs/images/codex_instances.png?raw=true)

实际额度、用量、实际价格和倍率（敏感信息已打马赛克）：

![Codex 额度和成本字段](https://github.com/2406369852/cockpit-tools-codex-patch/blob/main/docs/images/codex_accounts_quota_private-masked.png?raw=true)

![Codex API 用量卡片](https://github.com/2406369852/cockpit-tools-codex-patch/blob/main/docs/images/codex_api_usage_private-masked.png?raw=true)

## Windows 安装

在 [Releases](../../releases) 下载 `Cockpit.Tools_1.3.21_x64-setup.exe`。当前安装包未进行代码签名，Windows SmartScreen 出现提示属于预期行为；请以 Release 页面公布的 SHA256 为准校验文件。

首次更新前建议备份：

- `%USERPROFILE%\.antigravity_cockpit`
- `%USERPROFILE%\.codex`、`%USERPROFILE%\.grok`（如果使用）
- Cockpit Tools 的系统本地应用数据目录

## Codex API 使用

安装并启动后，在 Cockpit Tools 中启用 Codex API 服务，从应用内读取端口和 API Key。客户端 Base URL 使用：

```text
http://127.0.0.1:<端口>/v1
```

图片请求使用模型 `gpt-image-2`。API Key、账号凭据和统计数据只保存在本机，不要上传或分享用户数据目录。

## 成本统计口径

“已用美元”是经过本地 API 服务的请求估算值；“实际价格”是用户手动填写的人民币价格；“倍率”用于本地成本对比。它不是 OpenAI 官方账单，也不代表官方结算价格。

## 从源码构建

环境要求：Node.js 18+、npm 9+、Rust、Go、Windows MSVC Build Tools。

```powershell
npm ci
npm run typecheck
$env:GOFLAGS = "-buildvcs=false"
npm run tauri -- build -- --bundles nsis
```

安装包输出到 `target/release/bundle/nsis/`。不要提交 `target/`、`node_modules/`、账号数据、token 或临时 handoff 文件。

## 安全、许可证与致谢

请遵守 OpenAI 及各第三方平台的服务条款和当地法律。429 重试不保证最终成功；图片能力由上游账号和服务端决定；作者不对使用本项目造成的损失负责。

本项目沿用上游的 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 许可：保留署名、仅限非商业用途、修改后采用相同方式共享。第三方组件以各自许可证为准，尤其是 `sidecars/cockpit-cliproxy/cdk/CLIProxyAPI/LICENSE` 中的 MIT 许可。

感谢上游 Cockpit Tools、CLIProxyAPI、openai/codex、Antigravity-Manager、sub2api、CC Switch、CodexPlusPlus 和 Electron 等项目。
