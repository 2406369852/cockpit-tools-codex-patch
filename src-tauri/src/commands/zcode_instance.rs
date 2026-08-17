use std::path::Path;

use crate::models::InstanceProfileView;
use crate::modules;

const DEFAULT_INSTANCE_ID: &str = "__default__";

fn to_view(profile: crate::models::InstanceProfile, pid: Option<u32>) -> InstanceProfileView {
    let initialized =
        modules::zcode_instance::is_profile_initialized(Path::new(&profile.user_data_dir), false);
    let mut view = InstanceProfileView::from_profile(profile, pid.is_some(), initialized);
    view.last_pid = pid;
    view
}

fn default_view() -> Result<InstanceProfileView, String> {
    let store = modules::zcode_instance::load_instance_store()?;
    let settings = store.default_settings;
    let dir = modules::zcode_instance::get_default_user_data_dir()?;
    let pid = modules::zcode_instance::resolve_pid(None, settings.last_pid);
    Ok(InstanceProfileView {
        id: DEFAULT_INSTANCE_ID.to_string(),
        name: String::new(),
        user_data_dir: dir.to_string_lossy().to_string(),
        working_dir: None,
        extra_args: settings.extra_args,
        bind_account_id: settings.bind_account_id,
        created_at: 0,
        last_launched_at: None,
        last_pid: pid,
        running: pid.is_some(),
        initialized: modules::zcode_instance::is_profile_initialized(&dir, true),
        is_default: true,
        follow_local_account: false,
    })
}

fn inject_bound_account(root: Option<&Path>, account_id: Option<&str>) -> Result<(), String> {
    let Some(account_id) = account_id.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(());
    };
    if let Some(root) = root {
        modules::zcode_account::inject_to_instance_root(account_id, root)?;
    } else {
        modules::zcode_account::inject_to_default(account_id)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn zcode_get_instance_defaults() -> Result<modules::instance::InstanceDefaults, String> {
    modules::zcode_instance::get_instance_defaults()
}

#[tauri::command]
pub async fn zcode_list_instances() -> Result<Vec<InstanceProfileView>, String> {
    let store = modules::zcode_instance::load_instance_store()?;
    let mut values: Vec<InstanceProfileView> = store
        .instances
        .into_iter()
        .map(|profile| {
            let pid = modules::zcode_instance::resolve_pid(
                Some(Path::new(&profile.user_data_dir)),
                profile.last_pid,
            );
            to_view(profile, pid)
        })
        .collect();
    values.push(default_view()?);
    Ok(values)
}

#[tauri::command]
pub async fn zcode_create_instance(
    name: String,
    user_data_dir: String,
    working_dir: Option<String>,
    extra_args: Option<String>,
    bind_account_id: Option<String>,
    copy_source_instance_id: Option<String>,
    init_mode: Option<String>,
) -> Result<InstanceProfileView, String> {
    let profile =
        modules::zcode_instance::create_instance(modules::zcode_instance::CreateInstanceParams {
            name,
            user_data_dir,
            working_dir,
            extra_args: extra_args.unwrap_or_default(),
            bind_account_id,
            copy_source_instance_id,
            init_mode,
        })?;
    Ok(to_view(profile, None))
}

#[tauri::command]
pub async fn zcode_update_instance(
    instance_id: String,
    name: Option<String>,
    working_dir: Option<String>,
    extra_args: Option<String>,
    bind_account_id: Option<Option<String>>,
    follow_local_account: Option<bool>,
) -> Result<InstanceProfileView, String> {
    if instance_id == DEFAULT_INSTANCE_ID {
        modules::zcode_instance::update_default_settings(
            bind_account_id,
            extra_args,
            follow_local_account,
        )?;
        return default_view();
    }
    let profile =
        modules::zcode_instance::update_instance(modules::zcode_instance::UpdateInstanceParams {
            instance_id,
            name,
            working_dir,
            extra_args,
            bind_account_id,
        })?;
    let pid = modules::zcode_instance::resolve_pid(
        Some(Path::new(&profile.user_data_dir)),
        profile.last_pid,
    );
    Ok(to_view(profile, pid))
}

#[tauri::command]
pub async fn zcode_delete_instance(instance_id: String) -> Result<(), String> {
    if instance_id == DEFAULT_INSTANCE_ID {
        return Err("默认实例不可删除".to_string());
    }
    let store = modules::zcode_instance::load_instance_store()?;
    let profile = store
        .instances
        .iter()
        .find(|profile| profile.id == instance_id)
        .ok_or_else(|| "ZCode 实例不存在".to_string())?;
    if modules::zcode_instance::resolve_pid(
        Some(Path::new(&profile.user_data_dir)),
        profile.last_pid,
    )
    .is_some()
    {
        return Err("请先停止 ZCode 实例再删除".to_string());
    }
    modules::zcode_instance::delete_instance(&instance_id)
}

#[tauri::command]
pub async fn zcode_start_instance(instance_id: String) -> Result<InstanceProfileView, String> {
    modules::zcode_instance::resolve_executable()?;
    if instance_id == DEFAULT_INSTANCE_ID {
        let settings = modules::zcode_instance::load_default_settings()?;
        if let Some(pid) = modules::zcode_instance::resolve_pid(None, settings.last_pid) {
            modules::process::close_pid(pid, 20)?;
        }
        inject_bound_account(None, settings.bind_account_id.as_deref())?;
        let args = modules::process::parse_extra_args(&settings.extra_args);
        let pid = modules::zcode_instance::start_default(&args)?;
        modules::zcode_instance::mark_started(None, pid)?;
        return default_view();
    }

    let store = modules::zcode_instance::load_instance_store()?;
    let profile = store
        .instances
        .into_iter()
        .find(|profile| profile.id == instance_id)
        .ok_or_else(|| "ZCode 实例不存在".to_string())?;
    if let Some(pid) = modules::zcode_instance::resolve_pid(
        Some(Path::new(&profile.user_data_dir)),
        profile.last_pid,
    ) {
        modules::process::close_pid(pid, 20)?;
    }
    inject_bound_account(
        Some(Path::new(&profile.user_data_dir)),
        profile.bind_account_id.as_deref(),
    )?;
    let args = modules::process::parse_extra_args(&profile.extra_args);
    let pid = modules::zcode_instance::start_managed(&profile, &args)?;
    modules::zcode_instance::mark_started(Some(&profile.id), pid)?;
    let updated = modules::zcode_instance::load_instance_store()?
        .instances
        .into_iter()
        .find(|item| item.id == profile.id)
        .ok_or_else(|| "ZCode 实例不存在".to_string())?;
    Ok(to_view(updated, Some(pid)))
}

#[tauri::command]
pub async fn zcode_stop_instance(instance_id: String) -> Result<InstanceProfileView, String> {
    if instance_id == DEFAULT_INSTANCE_ID {
        let settings = modules::zcode_instance::load_default_settings()?;
        if let Some(pid) = modules::zcode_instance::resolve_pid(None, settings.last_pid) {
            modules::process::close_pid(pid, 20)?;
        }
        modules::zcode_instance::mark_stopped(None)?;
        return default_view();
    }
    let store = modules::zcode_instance::load_instance_store()?;
    let profile = store
        .instances
        .into_iter()
        .find(|profile| profile.id == instance_id)
        .ok_or_else(|| "ZCode 实例不存在".to_string())?;
    if let Some(pid) = modules::zcode_instance::resolve_pid(
        Some(Path::new(&profile.user_data_dir)),
        profile.last_pid,
    ) {
        modules::process::close_pid(pid, 20)?;
    }
    modules::zcode_instance::mark_stopped(Some(&profile.id))?;
    let updated = modules::zcode_instance::load_instance_store()?
        .instances
        .into_iter()
        .find(|item| item.id == profile.id)
        .ok_or_else(|| "ZCode 实例不存在".to_string())?;
    Ok(to_view(updated, None))
}

#[tauri::command]
pub async fn zcode_open_instance_window(instance_id: String) -> Result<(), String> {
    let pid = if instance_id == DEFAULT_INSTANCE_ID {
        let settings = modules::zcode_instance::load_default_settings()?;
        modules::zcode_instance::resolve_pid(None, settings.last_pid)
    } else {
        let store = modules::zcode_instance::load_instance_store()?;
        let profile = store
            .instances
            .iter()
            .find(|profile| profile.id == instance_id)
            .ok_or_else(|| "ZCode 实例不存在".to_string())?;
        modules::zcode_instance::resolve_pid(
            Some(Path::new(&profile.user_data_dir)),
            profile.last_pid,
        )
    }
    .ok_or_else(|| "ZCode 实例未运行".to_string())?;
    modules::process::focus_process_pid(pid)
        .map(|_| ())
        .map_err(|error| format!("定位 ZCode 实例窗口失败: {}", error))
}

#[tauri::command]
pub async fn zcode_close_all_instances() -> Result<(), String> {
    modules::zcode_instance::close_all()
}
