# Cockpit Tools Codex Patch

> An unofficial community enhancement build based on [Cockpit Tools](https://github.com/jlcodes99/cockpit-tools) `v1.3.23`, focused on Codex local API routing, persistent cost metadata, and Windows hot-update reliability.

This is not an OpenAI product and is not an official upstream release. The upstream multi-platform account-management features remain available; fork-specific changes are documented in [PATCH_NOTES.md](PATCH_NOTES.md).

## Highlights

- Local OpenAI-compatible Codex API with Responses, Chat Completions, image generation, and image editing endpoints.
- `gpt-image-2` capability detection with actionable image-permission/quota errors and service/account-aware model exposure.
- Per-account `actual_spend_cny` pricing in grid, compact, and table layouts, with batch editing, local USD estimates, and cost multipliers.
- A separate `codex_account_billing.json` map restores manually entered prices after upgrades, refreshes, or migrations without storing tokens.
- Fast 429 handling: immediate retry for bare 429, missing `Retry-After`, or `Retry-After: 0`; account rotation; configured single-account retries; capped positive delays.
- `quota_low_first` routing so accounts with positive remaining quota are preferred over unknown, exhausted, or invalid snapshots.
- Sidecar parent leases and hot handoff: a temporary sidecar keeps the API available during restart, then the new process adopts it before the installed executable is replaced.
- Windows x64 NSIS installer and reproducible Go/Rust/MSVC build scripts.

This release does not force-expose WM / `gpt-5.6-sol-wm`. Image permissions, account quotas, and upstream rate limits remain controlled by upstream services.

## Visual guide

![Codex API enhancement flow](docs/images/codex-patch-flow.png)

![Codex account pricing](docs/images/codex_accounts_actual_price_v1.3.23_private-masked.png)

![Codex API usage and cost](docs/images/codex_api_usage_v1.3.23_private-masked.png)

## Install and build

Download `Cockpit.Tools_1.3.23_x64-setup.exe` from [Releases](../../releases). This is a Windows installer, not a zip archive: double-click it to install, then launch Cockpit Tools from the Start menu or desktop. The installer is currently unsigned, so Windows SmartScreen may warn; verify the SHA256 shown on the Release page.

Requirements: Node.js 18+, npm 9+, Rust, Go, and Windows MSVC Build Tools.

```powershell
npm ci
npm run typecheck
$env:GOFLAGS = "-buildvcs=false"
node scripts/tauri.cjs build --bundles nsis --no-sign --config src-tauri/tauri.ci.conf.json
```

## API and privacy

Enable Codex API Service in the app and read the port and API key from the UI. Use `http://127.0.0.1:<port>/v1` as the client Base URL. Credentials, tokens, API keys, and account statistics remain local; never publish the user data directories.

Local USD estimates and manually entered CNY prices are not official billing data. Retry behavior does not bypass upstream limits, and image availability depends on the upstream account.

## License and acknowledgments

This project follows the upstream [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) license: attribution, non-commercial use, and share-alike are required. Third-party components retain their own licenses, including the MIT license in `sidecars/cockpit-cliproxy/third_party/CLIProxyAPI/LICENSE`.

Thanks to Cockpit Tools, CLIProxyAPI, openai/codex, Antigravity-Manager, sub2api, CC Switch, CodexPlusPlus, Electron, and all upstream contributors.
