//! Codex 切号时可选同步 Hermes auth.json（providers / credential_pool）。

use crate::models::codex::CodexAccount;
use crate::modules::atomic_write;
use crate::modules::logger;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

const HERMES_AUTH_FILENAME: &str = "auth.json";
const HERMES_PROVIDER_KEY: &str = "openai-codex";

fn hermes_auth_path() -> Result<PathBuf, String> {
    if let Ok(custom) = std::env::var("HERMES_HOME") {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed).join(HERMES_AUTH_FILENAME));
        }
    }
    let home = dirs::home_dir().ok_or("无法获取 Home 目录")?;
    Ok(home.join(".hermes").join(HERMES_AUTH_FILENAME))
}

/// 将 Codex OAuth 账号投影为 Hermes openai-codex 凭据对象。
pub fn build_hermes_codex_provider_entry(account: &CodexAccount) -> Result<Value, String> {
    if account.is_api_key_auth() {
        return Err("Hermes 切号同步仅支持 Codex OAuth 账号".to_string());
    }
    if account.tokens.access_token.trim().is_empty() {
        return Err("Codex OAuth 账号缺少 access_token，无法同步 Hermes".to_string());
    }
    Ok(json!({
        "type": "oauth",
        "access_token": account.tokens.access_token,
        "refresh_token": account.tokens.refresh_token.clone().unwrap_or_default(),
        "id_token": account.tokens.id_token,
        "account_id": account.account_id,
        "email": account.email,
    }))
}

/// 合并 providers.openai-codex 与 credential_pool.openai-codex。
pub fn merge_hermes_auth_json(existing: &mut Value, provider_entry: Value) -> Result<(), String> {
    if !existing.is_object() {
        *existing = json!({});
    }
    let root = existing
        .as_object_mut()
        .ok_or_else(|| "Hermes auth.json 根节点必须是对象".to_string())?;

    let providers = root
        .entry("providers")
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or_else(|| "Hermes auth.json providers 必须是对象".to_string())?;
    providers.insert(HERMES_PROVIDER_KEY.to_string(), provider_entry.clone());

    let pool = root
        .entry("credential_pool")
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or_else(|| "Hermes auth.json credential_pool 必须是对象".to_string())?;
    match pool.get_mut(HERMES_PROVIDER_KEY) {
        Some(Value::Array(items)) => {
            let email = provider_entry
                .get("email")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            items.retain(|item| item.get("email").and_then(|v| v.as_str()) != Some(email));
            items.insert(0, provider_entry);
        }
        _ => {
            pool.insert(HERMES_PROVIDER_KEY.to_string(), json!([provider_entry]));
        }
    }
    Ok(())
}

fn read_or_default_auth(path: &Path) -> Result<Value, String> {
    if !path.exists() {
        return Ok(json!({}));
    }
    let content =
        fs::read_to_string(path).map_err(|e| format!("读取 Hermes auth.json 失败: {}", e))?;
    if content.trim().is_empty() {
        return Ok(json!({}));
    }
    serde_json::from_str(&content).map_err(|e| format!("解析 Hermes auth.json 失败: {}", e))
}

/// 用当前 Codex OAuth 账号覆盖/写入 Hermes auth.json 中的 openai-codex 凭据。
pub fn replace_openai_codex_entry_from_codex(account: &CodexAccount) -> Result<(), String> {
    let path = hermes_auth_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建 ~/.hermes 失败: {}", e))?;
    }
    let entry = build_hermes_codex_provider_entry(account)?;
    let mut auth = read_or_default_auth(&path)?;
    merge_hermes_auth_json(&mut auth, entry)?;
    let serialized = serde_json::to_string_pretty(&auth)
        .map_err(|e| format!("序列化 Hermes auth 失败: {}", e))?;
    atomic_write::write_string_atomic(&path, &serialized)
        .map_err(|e| format!("写入 Hermes auth.json 失败: {}", e))?;
    logger::log_info(&format!(
        "[Hermes] 已同步 Codex OAuth 到 {}: email={}",
        path.display(),
        account.email
    ));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn merges_provider_and_credential_pool() {
        let mut existing = json!({});
        let entry = json!({
            "type": "oauth",
            "access_token": "access",
            "email": "user@example.com",
        });
        merge_hermes_auth_json(&mut existing, entry).expect("merge");
        assert_eq!(
            existing["providers"]["openai-codex"]["access_token"],
            "access"
        );
        assert_eq!(
            existing["credential_pool"]["openai-codex"][0]["email"],
            "user@example.com"
        );
    }

    #[test]
    fn replaces_same_email_in_pool() {
        let mut existing = json!({
            "credential_pool": {
                "openai-codex": [
                    {"email": "user@example.com", "access_token": "old"},
                    {"email": "other@example.com", "access_token": "keep"}
                ]
            }
        });
        let entry = json!({
            "email": "user@example.com",
            "access_token": "new",
        });
        merge_hermes_auth_json(&mut existing, entry).expect("merge");
        let pool = existing["credential_pool"]["openai-codex"]
            .as_array()
            .expect("array");
        assert_eq!(pool.len(), 2);
        assert_eq!(pool[0]["access_token"], "new");
        assert_eq!(pool[1]["email"], "other@example.com");
    }
}
