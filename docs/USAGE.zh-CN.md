# Windows 安装与使用说明

## 先说结论

Release 里的 `Cockpit.Tools_1.3.21_x64-setup.exe` 是 Windows 安装程序，不是压缩包，也不是“解压后直接运行”的便携版。

下载后直接双击安装；安装完成后，从开始菜单或桌面快捷方式启动 Cockpit Tools。

## 1. 下载、校验和安装

1. 打开 [v1.3.21-patch.1 Release](https://github.com/2406369852/cockpit-tools-codex-patch/releases/tag/v1.3.21-patch.1)。
2. 下载 `Cockpit.Tools_1.3.21_x64-setup.exe`，不要下载图片文件当作程序。
3. 可选：在 PowerShell 中校验 SHA256：

   ```powershell
   (Get-FileHash .\Cockpit.Tools_1.3.21_x64-setup.exe -Algorithm SHA256).Hash
   ```

   结果应为：

   ```text
   7F0EA34199403485DCC2E6F33729FF29D93B44CC3AA09E1618EF5C7EB9C6BBB2
   ```

4. 双击安装程序，按向导完成安装。
5. 安装包目前未做代码签名。如果 SmartScreen 提示未知发布者，请先确认文件来自本 Release 且 SHA256 一致，再选择“更多信息 → 仍要运行”。

## 2. 第一次启动

1. 启动 Cockpit Tools。
2. 打开 Codex 页面，添加账号或导入已有账号。
3. 打开“Codex API 服务”，开启服务开关。
4. 在页面中复制 API 端口和 API Key；端口通常只监听本机 `127.0.0.1`。
5. 回到账号页面刷新额度。账号卡片中的 `5h`、`Weekly`、请求数、用量和重置时间就是本地看到的额度信息。

## 3. 给其他客户端配置

客户端类型选择 OpenAI 兼容接口，填写：

```text
Base URL: http://127.0.0.1:<页面显示的端口>/v1
API Key:  页面显示的 API Key
```

可以先用 `/v1/models` 检查服务是否正常：

```powershell
curl.exe http://127.0.0.1:<端口>/v1/models `
  -H "Authorization: Bearer <API Key>"
```

正常情况下会返回可用模型列表。客户端和 Cockpit Tools 在同一台电脑上时使用 `127.0.0.1`；局域网或远程访问需要自行配置监听地址和防火墙，不建议直接暴露 API Key。

## 4. 图片生成和编辑

使用支持图片的账号时，模型填写 `gpt-image-2`。图片生成和编辑分别对应 `/v1/images/generations`、`/v1/images/edits`，或兼容 Responses 图片工具的客户端。

如果账号套餐、权限或额度不支持图片，界面会给出提示；这不是本地程序可以绕过的限制。

## 5. 更新和卸载

- 更新：下载新版 `*-setup.exe`，先保存工作并退出旧版，再运行安装程序覆盖安装。账号和配置通常保留在本机数据目录。
- 热交接：更新期间程序会尝试让临时 Sidecar 接管本地 API；如果安装器提示文件被占用，退出托盘中的 Cockpit Tools 后再重试。
- 备份：更新前建议备份 `%USERPROFILE%\.antigravity_cockpit`、`%USERPROFILE%\.codex` 和应用本地数据目录。
- 卸载：在 Windows“设置 → 应用 → 已安装的应用”中找到 Cockpit Tools，按系统卸载流程操作。卸载前请自行备份需要保留的账号配置。

## 6. 常见问题

- **双击后没有安装界面**：确认下载的是 `Cockpit.Tools_1.3.21_x64-setup.exe`，不是 `codex_*.png` 或 `.svg` 图片附件。
- **API 返回 401**：检查客户端 API Key 是否与应用内显示的一致。
- **API 返回 429**：上游正在限流或账号额度不足；本补丁会按配置快速重试/轮转账号，但不会绕过上游限制。
- **看不到图片模型**：刷新账号额度并确认账号确实拥有图片权限；模型列表由服务端能力决定。

