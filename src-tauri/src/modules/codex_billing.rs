//! Durable local storage for manually entered Codex account prices.
//!
//! The encrypted account detail is still the normal source for account data,
//! but updates can recreate that detail from an index or an imported token.
//! Keeping the user-entered price in this small sidecar file means a refresh,
//! migration, or re-import can restore it by stable account ID.

use crate::models::codex::CodexAccount;
use crate::modules::{account, atomic_write, logger};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::sync::{LazyLock, Mutex};

const BILLING_FILE_NAME: &str = "codex_account_billing.json";
const BILLING_FILE_VERSION: u32 = 1;
const MAX_ACTUAL_SPEND_CNY: f64 = 1_000_000.0;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct BillingStore {
    #[serde(default = "default_version")]
    version: u32,
    #[serde(default)]
    accounts: HashMap<String, f64>,
}

fn default_version() -> u32 {
    BILLING_FILE_VERSION
}

static BILLING_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

fn billing_path() -> Result<std::path::PathBuf, String> {
    Ok(account::get_data_dir()?.join(BILLING_FILE_NAME))
}

/// Normalize the value used by both the account field and the sidecar file.
pub(crate) fn normalize_actual_spend_cny(value: Option<f64>) -> Result<Option<f64>, String> {
    let Some(value) = value else {
        return Ok(None);
    };
    if !value.is_finite() || value < 0.0 || value > MAX_ACTUAL_SPEND_CNY {
        return Err("实际花费必须是 0 到 1000000 之间的数字".to_string());
    }
    Ok(Some((value * 100.0).round() / 100.0))
}

fn load_store_unlocked() -> Result<BillingStore, String> {
    let path = billing_path()?;
    if !path.exists() {
        return Ok(BillingStore {
            version: BILLING_FILE_VERSION,
            accounts: HashMap::new(),
        });
    }

    let content =
        fs::read_to_string(&path).map_err(|error| format!("读取 Codex 计费映射失败: {}", error))?;
    let mut store: BillingStore = serde_json::from_str(&content)
        .map_err(|error| format!("解析 Codex 计费映射失败: {}", error))?;
    if store.version == 0 {
        store.version = BILLING_FILE_VERSION;
    }
    if store.version > BILLING_FILE_VERSION {
        return Err(format!(
            "Codex 计费映射版本 {} 高于当前支持版本 {}",
            store.version, BILLING_FILE_VERSION
        ));
    }

    // Drop malformed values instead of allowing a damaged entry to poison
    // every account load. The next successful write compacts the file.
    store.accounts.retain(|id, value| {
        !id.trim().is_empty()
            && normalize_actual_spend_cny(Some(*value))
                .ok()
                .flatten()
                .is_some()
    });
    Ok(store)
}

fn write_store_unlocked(store: &BillingStore) -> Result<(), String> {
    let path = billing_path()?;
    let content = serde_json::to_string_pretty(store)
        .map_err(|error| format!("序列化 Codex 计费映射失败: {}", error))?;
    atomic_write::write_string_atomic(&path, &content)
        .map_err(|error| format!("写入 Codex 计费映射失败: {}", error))
}

fn load_store_or_empty() -> BillingStore {
    match load_store_unlocked() {
        Ok(store) => store,
        Err(error) => {
            logger::log_warn(&format!(
                "[Codex Billing] 计费映射不可用，暂按空映射继续: {}",
                error
            ));
            BillingStore {
                version: BILLING_FILE_VERSION,
                accounts: HashMap::new(),
            }
        }
    }
}

/// Merge a persisted price into a freshly loaded account, or remember an
/// existing account price in the sidecar file. Returns whether the account
/// object itself changed and therefore should be rewritten.
pub(crate) fn reconcile_loaded_account(account: &mut CodexAccount) -> bool {
    let Ok(_guard) = BILLING_LOCK.lock() else {
        return false;
    };
    let mut store = load_store_or_empty();
    // A value explicitly present in the account detail is authoritative (this
    // keeps imports and the UI edit action working). When an update regenerates
    // a detail without the optional field, fall back to the stable-ID mapping.
    if let Some(value) = normalize_actual_spend_cny(account.actual_spend_cny)
        .ok()
        .flatten()
    {
        account.actual_spend_cny = Some(value);
        if store.accounts.get(&account.id).copied() != Some(value) {
            store.accounts.insert(account.id.clone(), value);
            if let Err(error) = write_store_unlocked(&store) {
                logger::log_warn(&format!(
                    "[Codex Billing] 保存账号价格映射失败，保留账号详情值: {}",
                    error
                ));
            }
        }
        return false;
    }

    if let Some(value) = store.accounts.get(&account.id).copied() {
        account.actual_spend_cny = Some(value);
        return true;
    }
    false
}

/// Update the durable sidecar mapping. `None` intentionally removes the
/// entry, which is how the UI's clear-price action remains possible.
pub(crate) fn set_actual_spend(
    account_id: &str,
    value: Option<f64>,
) -> Result<Option<f64>, String> {
    let account_id = account_id.trim();
    if account_id.is_empty() {
        return Err("账号 ID 不能为空".to_string());
    }
    let normalized = normalize_actual_spend_cny(value)?;
    let _guard = BILLING_LOCK
        .lock()
        .map_err(|_| "Codex 计费映射锁已损坏".to_string())?;
    let mut store = load_store_unlocked()?;
    match normalized {
        Some(value) => {
            if store.accounts.get(account_id).copied() != Some(value) {
                store.accounts.insert(account_id.to_string(), value);
                write_store_unlocked(&store)?;
            }
        }
        None => {
            if store.accounts.remove(account_id).is_some() {
                write_store_unlocked(&store)?;
            }
        }
    }
    Ok(normalized)
}

/// Preserve an existing sidecar value when another account update does not
/// carry the optional pricing field (for example a token refresh).
pub(crate) fn account_for_save(account: &CodexAccount) -> CodexAccount {
    let Ok(_guard) = BILLING_LOCK.lock() else {
        return account.clone();
    };
    let mut account = account.clone();
    let mut store = load_store_or_empty();
    if let Some(value) = normalize_actual_spend_cny(account.actual_spend_cny)
        .ok()
        .flatten()
    {
        account.actual_spend_cny = Some(value);
        if store.accounts.get(&account.id).copied() != Some(value) {
            store.accounts.insert(account.id.clone(), value);
            if let Err(error) = write_store_unlocked(&store) {
                logger::log_warn(&format!(
                    "[Codex Billing] 保存账号前同步价格映射失败: {}",
                    error
                ));
            }
        }
    } else if let Some(value) = store.accounts.get(&account.id).copied() {
        account.actual_spend_cny = Some(value);
    }
    account
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::codex::CodexAccount;
    use std::sync::Mutex;

    static TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn normalizes_and_rounds_prices() {
        assert_eq!(normalize_actual_spend_cny(Some(12.345)), Ok(Some(12.35)));
        assert!(normalize_actual_spend_cny(Some(-1.0)).is_err());
        assert_eq!(normalize_actual_spend_cny(None), Ok(None));
    }

    #[test]
    fn sidecar_restores_price_after_account_detail_is_empty() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|error| error.into_inner());
        let temp = std::env::temp_dir().join(format!(
            "codex-billing-test-{}-{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(&temp).expect("temp dir");
        std::env::set_var("COCKPIT_TOOLS_TEST_DATA_DIR", &temp);

        let account = CodexAccount::new_api_key(
            "billing-test".to_string(),
            "billing-test@example.test".to_string(),
            "sk-test".to_string(),
            crate::models::codex::CodexApiProviderMode::Custom,
            None,
            None,
            None,
            Vec::new(),
        );
        set_actual_spend(&account.id, Some(135.0)).expect("set price");
        let mut reloaded = account.clone();
        reloaded.actual_spend_cny = None;
        assert!(reconcile_loaded_account(&mut reloaded));
        assert_eq!(reloaded.actual_spend_cny, Some(135.0));

        std::env::remove_var("COCKPIT_TOOLS_TEST_DATA_DIR");
        let _ = fs::remove_dir_all(&temp);
    }
}
