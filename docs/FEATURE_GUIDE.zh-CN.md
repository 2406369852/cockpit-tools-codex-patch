# Codex Patch 功能图文说明

这份说明对应 `v1.3.21-patch.1` Windows x64 构建，按“用户能看到什么”和“程序如何处理请求”解释本分支的二开内容。

## 一、图片生成/编辑能力提示

选择 `gpt-image-2` 后，程序会先识别当前服务和账号是否具备图片能力，再决定是否显示图片入口。调用 `/v1/images/generations`、`/v1/images/edits` 或 Responses 图片工具时，如果上游账号没有权限或额度不足，会返回可操作的提示，而不是只显示笼统的“请求失败”。

![图片能力、429 重试和热更新的请求链路](https://github.com/2406369852/cockpit-tools-codex-patch/releases/download/v1.3.21-patch.1/codex-patch-flow.png)

图中“图片能力”分支表示：客户端请求进入本地 Codex API 后，先经过模型/能力判断，再转发到上游。这个判断只改善提示和兼容性，不会绕过上游权限、套餐或额度。

## 二、429 立即重试与账号轮转

遇到限流时，调度器会区分等待时间：

1. 裸 `429`、没有 `Retry-After` 或 `Retry-After: 0`：按配置立即进入下一次尝试。
2. 多账号：优先切换到可用账号，减少单个额度耗尽账号对请求的阻塞。
3. 单账号：按照重试次数继续尝试。
4. 上游给出正数 `Retry-After`：仍会等待，但受本地最大等待间隔限制。

这不会绕过上游限流；如果所有账号都不可用，服务仍会返回明确错误。

## 三、低额度优先调度

开启 `quota_low_first` 后，调度顺序会优先使用仍有正额度的账号；未知、已耗尽或异常额度快照排在后面。这样可以减少请求落到已知不可用账号上的次数，同时保留正常的轮转和失败恢复逻辑。

## 四、账号成本统计

账号卡片保留本地 API 估算的 USD 用量，并新增可手动填写的 `actual_spend_cny`（人民币实际价格）。导入、导出和批量填写都会保留这个字段；倍率只用于本地对比：

```text
倍率 = 实际价格（CNY） ÷ 本地 API 估算值（USD）
```

它不是 OpenAI 官方账单，也不代表官方结算价格。

![Codex 账号额度与卡片视图](https://github.com/2406369852/cockpit-tools-codex-patch/releases/download/v1.3.21-patch.1/codex_list.png)

上图展示账号卡片、5 小时/周额度、重置时间和账号状态。实际价格与倍率在启用成本统计后出现在同一组账号信息中。

下面是本次补丁的实际界面截图（邮箱、接口地址、团队名和用户 ID 已打马赛克）：

![已脱敏的 Codex 额度、价格和倍率界面](https://github.com/2406369852/cockpit-tools-codex-patch/releases/download/v1.3.21-patch.1/codex_accounts_quota_private-masked.png)

这张图中的字段含义是：

- `5h` 和 `Weekly`：5 小时窗口、周窗口的剩余额度百分比和预计重置时间。
- `req`、`M`、`A`：请求数、估算 token/用量和本地 API 估算金额（USD）。
- `已用美元`、`实际价格`、`倍率`：本地估算值、手动填写的人民币价格，以及用于对比的倍率。

![已脱敏的 Codex API 用量和成本卡片](https://github.com/2406369852/cockpit-tools-codex-patch/releases/download/v1.3.21-patch.1/codex_api_usage_private-masked.png)

上面两张截图只用于说明界面字段；其中的账号、额度和金额是示例数据，不代表任何官方账单。

## 五、多实例与并行账号

Codex 实例可以独立配置账号并行运行。实例页面展示运行状态、当前账号、额度摘要、PID 和启动/停止/编辑操作；切换账号不会要求用户手动改配置文件。

![Codex 多实例管理](https://github.com/2406369852/cockpit-tools-codex-patch/releases/download/v1.3.21-patch.1/codex_instances.png)

## 六、Windows 热更新与失败恢复

更新或重启前，主程序会为正在使用的 sidecar 建立父进程租约，并准备临时副本。新版本启动后先接管本地 API，再替换安装目录中的文件；如果接管失败，则保留健康的旧 sidecar 并清理临时文件，避免“软件关了以后 API 也消失”。

简化流程：

```text
旧版运行 → 建立租约/临时副本 → 新版启动并接管 API
                                      ├─ 成功：替换旧文件并清理副本
                                      └─ 失败：恢复旧 sidecar，保持服务可用
```

## 七、WM 模型说明

本分支不强制暴露 WM / `gpt-5.6-sol-wm` 映射。模型列表只展示服务端和账号实际返回的能力，避免用户误以为 WM 是稳定可用的公开模型。

## 使用前的限制

- 图片能力、账号额度和 429 限流由上游服务决定。
- API Key、OAuth 凭据、账号数据和成本统计保存在本机，请勿上传到公开仓库。
- Windows 安装包当前未签名，SmartScreen 可能显示未知发布者提示。
