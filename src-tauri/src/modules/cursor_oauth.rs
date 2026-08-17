use base64::Engine;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};

use crate::models::cursor::CursorImportPayload;
use crate::modules::logger;

const CURSOR_LOGIN_URL: &str = "https://cursor.com/loginDeepControl";
const CURSOR_POLL_ENDPOINT: &str = "https://api2.cursor.sh/auth/poll";
const OAUTH_POLL_INTERVAL_MS: u64 = 2000;
const OAUTH_MAX_POLLS: u32 = 150;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorOAuthStartResponse {
    pub login_id: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval_seconds: u64,
}

#[derive(Debug, Clone)]
struct PendingOAuthState {
    login_id: String,
    uuid: String,
    code_verifier: String,
    expires_at: i64,
    cancelled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PollResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    auth_id: Option<String>,
}

lazy_static::lazy_static! {
    static ref PENDING_OAUTH_STATE: Arc<Mutex<Option<PendingOAuthState>>> = Arc::new(Mutex::new(None));
}

fn now_timestamp() -> i64 {
    chrono::Utc::now().timestamp()
}

fn generate_code_verifier() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen::<u8>()).collect();
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

fn generate_code_challenge(code_verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let digest = hasher.finalize();
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(digest)
}

fn generate_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn start_login() -> Result<CursorOAuthStartResponse, String> {
    let code_verifier = generate_code_verifier();
    let code_challenge = generate_code_challenge(&code_verifier);
    let login_uuid = generate_uuid();
    let login_id = login_uuid.clone();

    let verification_uri = format!(
        "{}?challenge={}&uuid={}&mode=login",
        CURSOR_LOGIN_URL, code_challenge, login_uuid
    );

    let now = now_timestamp();
    let state = PendingOAuthState {
        login_id: login_id.clone(),
        uuid: login_uuid,
        code_verifier,
        expires_at: now + 300,
        cancelled: false,
    };

    if let Ok(mut pending) = PENDING_OAUTH_STATE.lock() {
        *pending = Some(state);
    }

    logger::log_info(&format!(
        "[Cursor OAuth] 登录会话已创建: login_id={}",
        login_id
    ));

    Ok(CursorOAuthStartResponse {
        login_id,
        verification_uri,
        expires_in: 300,
        interval_seconds: 2,
    })
}

pub async fn complete_login(login_id: &str) -> Result<CursorImportPayload, String> {
    let (uuid, code_verifier) = {
        let pending = PENDING_OAUTH_STATE
            .lock()
            .map_err(|_| "获取 OAuth 状态锁失败".to_string())?;

        let state = pending
            .as_ref()
            .ok_or_else(|| "没有进行中的 Cursor 登录会话".to_string())?;

        if state.login_id != login_id {
            return Err(format!(
                "login_id 不匹配: expected={}, got={}",
                state.login_id, login_id
            ));
        }

        if state.cancelled {
            return Err("登录已取消".to_string());
        }

        if now_timestamp() > state.expires_at {
            return Err("登录会话已过期".to_string());
        }

        (state.uuid.clone(), state.code_verifier.clone())
    };

    logger::log_info(&format!(
        "[Cursor OAuth] 开始轮询: login_id={}, uuid={}",
        login_id, uuid
    ));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    // CURSOR_POLL_ENDPOINT 使用 HTTPS（https://api2.cursor.sh），code_verifier 已通过 TLS 加密传输
    // lgtm[rs/cleartext-transmission] 实际通过 HTTPS 传输，非明文
    let poll_url = format!(
        "{}?uuid={}&verifier={}",
        CURSOR_POLL_ENDPOINT, uuid, code_verifier
    );

    for attempt in 0..OAUTH_MAX_POLLS {
        {
            let pending = PENDING_OAUTH_STATE.lock().ok();
            if let Some(ref guard) = pending {
                if let Some(ref state) = **guard {
                    if state.cancelled {
                        return Err("登录已取消".to_string());
                    }
                    if now_timestamp() > state.expires_at {
                        return Err("登录会话已过期".to_string());
                    }
                }
            }
        }

        let response = client
            .get(&poll_url)
            .header("Accept", "application/json")
            .send()
            .await;

        match response {
            Ok(resp) => {
                let status = resp.status().as_u16();

                if status == 404 {
                    if attempt % 15 == 0 {
                        logger::log_info(&format!(
                            "[Cursor OAuth] 轮询中，等待用户完成登录... (attempt={})",
                            attempt
                        ));
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(OAUTH_POLL_INTERVAL_MS))
                        .await;
                    continue;
                }

                if status != 200 {
                    logger::log_warn(&format!("[Cursor OAuth] 轮询返回异常状态码: {}", status));
                    tokio::time::sleep(std::time::Duration::from_millis(OAUTH_POLL_INTERVAL_MS))
                        .await;
                    continue;
                }

                let body = resp
                    .text()
                    .await
                    .map_err(|e| format!("读取轮询响应失败: {}", e))?;

                let poll_data: PollResponse =
                    serde_json::from_str(&body).map_err(|e| format!("解析轮询响应失败: {}", e))?;

                if let (Some(access_token), Some(refresh_token)) =
                    (poll_data.access_token, poll_data.refresh_token)
                {
                    logger::log_info("[Cursor OAuth] 登录成功，已获取 token");

                    if let Ok(mut pending) = PENDING_OAUTH_STATE.lock() {
                        *pending = None;
                    }

                    let email = poll_data
                        .auth_id
                        .as_deref()
                        .filter(|value| value.contains('@'))
                        .unwrap_or("")
                        .to_string();

                    let mut auth_raw = serde_json::Map::new();
                    auth_raw.insert(
                        "accessToken".to_string(),
                        serde_json::Value::String(access_token.clone()),
                    );
                    auth_raw.insert(
                        "refreshToken".to_string(),
                        serde_json::Value::String(refresh_token.clone()),
                    );
                    if let Some(ref auth_id) = poll_data.auth_id {
                        auth_raw.insert(
                            "authId".to_string(),
                            serde_json::Value::String(auth_id.clone()),
                        );
                    }

                    return Ok(CursorImportPayload {
                        email,
                        auth_id: poll_data.auth_id.clone(),
                        name: None,
                        access_token,
                        refresh_token: Some(refresh_token),
                        membership_type: None,
                        subscription_status: None,
                        sign_up_type: None,
                        cursor_auth_raw: Some(serde_json::Value::Object(auth_raw)),
                        cursor_usage_raw: None,
                        status: None,
                        status_reason: None,
                    });
                }

                logger::log_warn("[Cursor OAuth] 轮询成功但响应缺少 token");
                tokio::time::sleep(std::time::Duration::from_millis(OAUTH_POLL_INTERVAL_MS)).await;
            }
            Err(err) => {
                logger::log_warn(&format!("[Cursor OAuth] 轮询请求失败: {}, 将重试", err));
                tokio::time::sleep(std::time::Duration::from_millis(OAUTH_POLL_INTERVAL_MS * 2))
                    .await;
            }
        }
    }

    if let Ok(mut pending) = PENDING_OAUTH_STATE.lock() {
        *pending = None;
    }

    Err("Cursor 登录轮询超时，请重试".to_string())
}

pub fn cancel_login(login_id: Option<&str>) -> Result<(), String> {
    if let Ok(mut pending) = PENDING_OAUTH_STATE.lock() {
        if let Some(ref mut state) = *pending {
            if login_id.is_none() || login_id == Some(state.login_id.as_str()) {
                state.cancelled = true;
                logger::log_info(&format!(
                    "[Cursor OAuth] 登录已取消: login_id={}",
                    state.login_id
                ));
            }
        }
        *pending = None;
    }
    Ok(())
}
