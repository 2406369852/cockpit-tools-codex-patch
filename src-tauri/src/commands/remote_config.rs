use crate::modules::remote_config;
use crate::modules::remote_config::RemoteConfigState;

#[tauri::command]
pub async fn remote_config_get_state() -> Result<RemoteConfigState, String> {
    remote_config::get_remote_config_state().await
}

#[tauri::command]
pub async fn remote_config_force_refresh() -> Result<RemoteConfigState, String> {
    remote_config::force_refresh_remote_config_state().await
}
