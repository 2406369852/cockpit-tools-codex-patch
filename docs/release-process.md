# Release Process (Open Source, No Code Signing)

> 适用于 Cockpit Tools 当前开源发布流程（未接入代码签名）。

## 1. 目标

- 保证每次发布可复现、可验证、可追溯。
- 让用户可以通过哈希校验确认安装包未被篡改。
- 单引擎误报（如 VirusTotal 1/72）时，可快速说明和处理。

## 2. 发布前检查（Preflight）

在仓库根目录执行：

```bash
npm run release:preflight
```

该命令会依次执行：

1. `node scripts/check_locales.cjs`
2. `npm run typecheck`
3. `npm run build`
4. `cargo check`（在 `src-tauri` 下）

可选跳过参数（排障用，不建议正式发布时使用）：

```bash
node scripts/release/preflight.cjs --skip-locales --skip-typecheck --skip-build --skip-cargo
```

## 3. 打包产物（macOS / Windows；Homebrew 推荐）

官方发布目标仅包含 macOS 与 Windows，不再构建或上传 Linux/Ubuntu 安装包。macOS 当前推荐使用 `universal` 安装包（同时兼容 Apple Silicon / Intel），并在上传 GitHub Release 后同步更新 Homebrew cask。

推荐一键脚本（会执行 `universal.dmg` 构建、上传 GitHub Release 资产、更新 `Casks/cockpit-tools.rb`）：

```bash
npm run release:github-and-cask
```

若你已提前手动构建过 `universal.dmg`，可跳过构建步骤：

```bash
npm run release:github-and-cask -- --skip-build
```

脚本前置条件：

1. 已安装并登录 GitHub CLI（`gh auth status` 通过）
2. 本机可执行 macOS Tauri 构建
3. 已安装 Rust Intel target（首次需要）：

```bash
rustup target add x86_64-apple-darwin
```

## 4. 生成 SHA256 校验文件

默认扫描 `src-tauri/target/release/bundle` 和 `dist`，输出到 `release-artifacts/SHA256SUMS.txt`：

```bash
npm run release:checksums
```

如果本次发布使用 `universal` 产物（Homebrew 场景，默认如此），建议显式指定 `universal` bundle 目录，确保 `*_universal.dmg` 被写入校验文件：

```bash
node scripts/release/gen_checksums.cjs \
  --input src-tauri/target/universal-apple-darwin/release/bundle \
  --input dist \
  --output release-artifacts/SHA256SUMS.txt
```

也可按需指定其他输入目录和输出文件：

```bash
node scripts/release/gen_checksums.cjs \
  --input src-tauri/target/release/bundle \
  --output release-artifacts/SHA256SUMS.txt
```

## 5. Release 发布内容规范

每次发布建议至少包含：

1. 下载文件列表（macOS / Windows；macOS/Homebrew 场景建议包含 `*_universal.dmg`）
2. `SHA256SUMS.txt`
3. 更新日志（中英文）
4. VirusTotal 链接（可选但推荐）
5. 已知误报说明（如有）

补充说明（Homebrew 自维护 Tap）：

1. 先上传 GitHub Release 资产，再推送 `Casks/cockpit-tools.rb` 更新，避免 cask 链接短暂 404。
2. `Casks/cockpit-tools.rb` 中的 `version`、`sha256` 必须与 Release 中实际 `*_universal.dmg` 一致。

## 6. VirusTotal 单引擎误报处理

当出现 `1/72` 这类结果时：

1. 先在 Release 明确“仅单引擎命中，其他未检出”。
2. 要求用户只从官方 Release 下载并核对 SHA256。
3. 对命中厂商提交误报（附 hash、下载链接、仓库地址）。
4. 误报修复后在 issue/release 回帖同步结果。

## 7. Git 发版流程（远端完成）

正式发版按“Git 远端完成”判定，建议顺序如下：

1. 更新版本与更新日志（`package.json`、`CHANGELOG.md`、`CHANGELOG.zh-CN.md`）。
2. 执行版本同步：

```bash
npm run sync-version
```

3. 执行发布预检（阻断）：

```bash
npm run release:preflight
```

4. 提交发布改动。
5. 创建与版本一致的标签（例如 `v0.9.2`）。
6. 先推送分支，再推送标签：

```bash
git push origin <branch> && git push origin v<major>.<minor>.<patch>
```

完成判定（阻断）：

1. 远端分支已更新（通常 `origin/main`）。
2. 远端版本标签已存在，且与 `package.json.version` 一致。
3. 满足以上两项即视为发版完成。

补充说明：

1. GitHub Actions、GitHub Release 资产上传、`SHA256SUMS.txt`、Homebrew Cask 更新属于后置异步流程，不作为发版完成的阻断条件。
2. 若需要，可在发版完成后继续观察 Actions 与 Release 资产状态。
