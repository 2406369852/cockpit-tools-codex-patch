use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use crate::modules::logger;

#[derive(Debug, Clone, Serialize)]
pub struct ManagedLogFile {
    pub log_file_path: String,
    pub log_file_name: String,
    pub file_size: u64,
    pub modified_at_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LogSnapshot {
    pub log_dir_path: String,
    pub log_file_path: String,
    pub log_file_name: String,
    pub content: String,
    pub line_limit: usize,
    pub file_size: u64,
    pub modified_at_ms: Option<i64>,
    pub available_files: Vec<ManagedLogFile>,
}

fn to_unix_millis(time: std::time::SystemTime) -> Option<i64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis())
        .and_then(|value| i64::try_from(value).ok())
}

fn open_directory(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("打开目录失败: {}", e))?;
    }

    Ok(())
}

fn build_managed_log_file(path: &Path) -> Result<ManagedLogFile, String> {
    let metadata = fs::metadata(path).map_err(|e| format!("读取日志文件元数据失败: {}", e))?;

    Ok(ManagedLogFile {
        log_file_path: path.to_string_lossy().to_string(),
        log_file_name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string(),
        file_size: metadata.len(),
        modified_at_ms: metadata.modified().ok().and_then(to_unix_millis),
    })
}

fn build_available_log_files(paths: Vec<PathBuf>) -> Result<Vec<ManagedLogFile>, String> {
    paths
        .into_iter()
        .map(|path| build_managed_log_file(path.as_path()))
        .collect()
}

#[tauri::command]
pub fn logs_get_snapshot(
    file_name: Option<String>,
    line_limit: Option<usize>,
) -> Result<LogSnapshot, String> {
    let line_limit = logger::clamp_log_tail_lines(line_limit);
    let log_dir = logger::get_log_dir()?;
    let log_file = logger::resolve_managed_log_file(file_name.as_deref())?;
    let content = logger::read_log_tail_lines(&log_file, line_limit)?;
    let metadata = fs::metadata(&log_file).map_err(|e| format!("读取日志文件元数据失败: {}", e))?;
    let available_files = build_available_log_files(logger::list_managed_log_files()?)?;

    Ok(LogSnapshot {
        log_dir_path: log_dir.to_string_lossy().to_string(),
        log_file_path: log_file.to_string_lossy().to_string(),
        log_file_name: log_file
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string(),
        content,
        line_limit,
        file_size: metadata.len(),
        modified_at_ms: metadata.modified().ok().and_then(to_unix_millis),
        available_files,
    })
}

#[tauri::command]
pub fn logs_open_log_directory() -> Result<(), String> {
    let log_dir = logger::get_log_dir()?;
    open_directory(&log_dir)
}
