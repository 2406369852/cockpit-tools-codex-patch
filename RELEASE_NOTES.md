# v1.3.21-patch.1

这是基于 Cockpit Tools `v1.3.21` 的非官方 Codex API 增强版，面向 Windows x64。

## 本次改动

- 增加 `gpt-image-2` 图片生成/编辑能力识别和友好提示。
- 增加账号 `actual_spend_cny` 成本字段、批量填写及导入/导出保留。
- 增加本地 USD 估算、人民币实价和倍率展示。
- 429、缺少 `Retry-After`、`Retry-After: 0` 走快速重试；多账号自动轮转，单账号按配置重试。
- 增加 `quota_low_first` 低额度优先调度。
- 增加 Sidecar 父进程租约、热交接和失败恢复，降低更新时 API 中断风险。
- 不强制暴露 WM 实验模型。

完整的图片+文字说明见 [`docs/FEATURE_GUIDE.zh-CN.md`](docs/FEATURE_GUIDE.zh-CN.md)。

## 图文预览

请求链路、图片能力判断、429 重试和 Sidecar 热交接：

![请求链路](https://github.com/2406369852/cockpit-tools-codex-patch/blob/main/docs/images/codex-patch-flow.svg?raw=true)

账号额度与成本统计界面：

![账号额度](https://github.com/2406369852/cockpit-tools-codex-patch/blob/main/docs/images/codex_list.png?raw=true)

多实例账号管理界面：

![多实例](https://github.com/2406369852/cockpit-tools-codex-patch/blob/main/docs/images/codex_instances.png?raw=true)

实际额度、用量、实际价格和倍率（敏感信息已打马赛克）：

![额度和成本字段](https://github.com/2406369852/cockpit-tools-codex-patch/blob/main/docs/images/codex_accounts_quota_private-masked.png?raw=true)

![API 用量卡片](https://github.com/2406369852/cockpit-tools-codex-patch/blob/main/docs/images/codex_api_usage_private-masked.png?raw=true)

## Windows 下载

文件：`Cockpit.Tools_1.3.21_x64-setup.exe`

SHA256：

`7F0EA34199403485DCC2E6F33729FF29D93B44CC3AA09E1618EF5C7EB9C6BBB2`

安装包未进行代码签名，Windows SmartScreen 可能显示未知发布者提示。图片权限、账号额度和上游限流仍由上游服务决定；本补丁不会绕过这些限制。

## 已验证

- `cargo check`、`cargo fmt --check`
- Rust 协议、parent lease、supported model 定向测试
- Go auth、registry、OpenAI handler 定向测试
- `npm run typecheck`、TypeScript 测试和 locale 检查

上游基线中仍有 Windows 权限和 antigravity 签名相关测试失败；这些不属于本补丁新增改动。
