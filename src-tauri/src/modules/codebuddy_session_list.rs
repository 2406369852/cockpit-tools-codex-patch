//! CodeBuddy local session file listing (vertical slice of #1188).

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodebuddySessionFileEntry {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_at: Option<i64>,
}

fn candidate_session_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(home) = dirs::home_dir() {
        #[cfg(target_os = "macos")]
        {
            dirs.push(home.join("Library/Application Support/CodeBuddy/User/globalStorage"));
            dirs.push(home.join(".codebuddy/sessions"));
        }
        #[cfg(target_os = "windows")]
        {
            if let Ok(roaming) = std::env::var("APPDATA") {
                dirs.push(
                    PathBuf::from(roaming)
                        .join("CodeBuddy")
                        .join("User")
                        .join("globalStorage"),
                );
            }
            dirs.push(home.join(".codebuddy").join("sessions"));
        }
        #[cfg(target_os = "linux")]
        {
            dirs.push(home.join(".config/CodeBuddy/User/globalStorage"));
            dirs.push(home.join(".codebuddy/sessions"));
        }
    }
    dirs
}

fn collect_json_files(dir: &Path, out: &mut Vec<CodebuddySessionFileEntry>, limit: usize) {
    if out.len() >= limit || !dir.is_dir() {
        return;
    }
    let Ok(rd) = fs::read_dir(dir) else {
        return;
    };
    for entry in rd.flatten() {
        if out.len() >= limit {
            break;
        }
        let path = entry.path();
        if path.is_dir() {
            // shallow recurse one level for session-like folders
            if path
                .file_name()
                .and_then(|s| s.to_str())
                .map(|n| n.to_ascii_lowercase().contains("session"))
                .unwrap_or(false)
            {
                collect_json_files(&path, out, limit);
            }
            continue;
        }
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let lower = name.to_ascii_lowercase();
        if !(lower.ends_with(".json") || lower.ends_with(".jsonl") || lower.contains("session")) {
            continue;
        }
        let meta = fs::metadata(&path).ok();
        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = meta.and_then(|m| m.modified().ok()).and_then(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .ok()
                .map(|d| d.as_secs() as i64)
        });
        out.push(CodebuddySessionFileEntry {
            name,
            path: path.display().to_string(),
            size_bytes: size,
            modified_at: modified,
        });
    }
}

/// List candidate local CodeBuddy session-related files (best-effort).
pub fn list_local_session_files(limit: usize) -> Vec<CodebuddySessionFileEntry> {
    let limit = limit.clamp(1, 500);
    let mut out = Vec::new();
    for dir in candidate_session_dirs() {
        collect_json_files(&dir, &mut out, limit);
    }
    out.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    out.truncate(limit);
    out
}

#[cfg(test)]
mod tests {
    use super::list_local_session_files;

    #[test]
    fn list_does_not_panic() {
        let _ = list_local_session_files(10);
    }
}
