#[cfg(target_os = "macos")]
use swift_rs::SwiftLinker;

use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug)]
struct GoToolchain {
    executable: PathBuf,
    goroot: PathBuf,
    version: String,
}

#[cfg(target_os = "macos")]
fn link_macos_swift_runtime_rpaths() {
    println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
}

fn go_target_from_rust_target(target: &str) -> Option<(&'static str, &'static str)> {
    let goos = if target.contains("windows") {
        "windows"
    } else if target.contains("apple-darwin") {
        "darwin"
    } else if target.contains("linux") {
        "linux"
    } else {
        return None;
    };

    let goarch = if target.starts_with("x86_64") {
        "amd64"
    } else if target.starts_with("aarch64") {
        "arm64"
    } else if target.starts_with("i686") {
        "386"
    } else if target.starts_with("armv7") {
        "arm"
    } else {
        return None;
    };

    Some((goos, goarch))
}

fn should_skip_sidecar_build(output: &Path) -> bool {
    std::env::var("COCKPIT_SKIP_CLIPROXY_BUILD").ok().as_deref() == Some("1") && output.exists()
}

fn push_unique_path(paths: &mut Vec<PathBuf>, value: impl Into<PathBuf>) {
    let value = value.into();
    let key = value.to_string_lossy().to_lowercase();
    if !paths
        .iter()
        .any(|existing| existing.to_string_lossy().to_lowercase() == key)
    {
        paths.push(value);
    }
}

fn go_executable_name() -> &'static str {
    if cfg!(windows) {
        "go.exe"
    } else {
        "go"
    }
}

fn inspect_go_toolchain(executable: &Path) -> Option<GoToolchain> {
    if executable.is_absolute() && !executable.is_file() {
        return None;
    }

    // Do not let a stale system-wide GOROOT make a complete SDK look broken (or make a
    // bin-only copy look complete). A normal Go installation discovers its own root.
    let output = Command::new(executable)
        .args(["env", "GOROOT", "GOTOOLDIR"])
        .env_remove("GOROOT")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8(output.stdout).ok()?;
    let mut values = stdout
        .lines()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let goroot = PathBuf::from(values.next()?);
    let go_tool_dir = PathBuf::from(values.next()?);
    let compiler = go_tool_dir.join(if cfg!(windows) {
        "compile.exe"
    } else {
        "compile"
    });
    if !goroot.join("src/runtime").is_dir() || !compiler.is_file() {
        return None;
    }

    let version_output = Command::new(executable)
        .arg("version")
        .env("GOROOT", &goroot)
        .output()
        .ok()?;
    if !version_output.status.success() {
        return None;
    }

    Some(GoToolchain {
        executable: executable.to_path_buf(),
        goroot,
        version: String::from_utf8_lossy(&version_output.stdout)
            .trim()
            .to_owned(),
    })
}

fn default_go_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let executable_name = go_executable_name();

    if cfg!(windows) {
        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            // Prefer the complete per-user SDK. Some machines also have a bin-only
            // installation under Programs\Go, which must not win merely because it is on PATH.
            push_unique_path(
                &mut candidates,
                PathBuf::from(local_app_data)
                    .join("Programs")
                    .join("GoSDK")
                    .join("go")
                    .join("bin")
                    .join(executable_name),
            );
        }
        if let Some(user_profile) = std::env::var_os("USERPROFILE") {
            push_unique_path(
                &mut candidates,
                PathBuf::from(user_profile)
                    .join("AppData")
                    .join("Local")
                    .join("Programs")
                    .join("GoSDK")
                    .join("go")
                    .join("bin")
                    .join(executable_name),
            );
        }
    }

    if let Some(goroot) = std::env::var_os("GOROOT") {
        push_unique_path(
            &mut candidates,
            PathBuf::from(goroot).join("bin").join(executable_name),
        );
    }

    if cfg!(windows) {
        for variable in ["ProgramW6432", "ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(program_files) = std::env::var_os(variable) {
                push_unique_path(
                    &mut candidates,
                    PathBuf::from(program_files)
                        .join("Go")
                        .join("bin")
                        .join(executable_name),
                );
            }
        }

        // Inspect every PATH entry independently so an incomplete go.exe earlier on PATH
        // cannot hide a complete SDK later on PATH.
        if let Some(path_value) = std::env::var_os("PATH") {
            for directory in std::env::split_paths(&path_value) {
                push_unique_path(&mut candidates, directory.join(executable_name));
            }
        }

        if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
            push_unique_path(
                &mut candidates,
                PathBuf::from(local_app_data)
                    .join("Programs")
                    .join("Go")
                    .join("bin")
                    .join(executable_name),
            );
        }
    } else {
        push_unique_path(&mut candidates, PathBuf::from(executable_name));
    }

    candidates
}

fn find_go_toolchain() -> GoToolchain {
    if let Some(explicit) = std::env::var_os("COCKPIT_GO") {
        let explicit = PathBuf::from(explicit);
        return inspect_go_toolchain(&explicit).unwrap_or_else(|| {
            panic!(
                "COCKPIT_GO does not point to a complete Go SDK: {}",
                explicit.display()
            )
        });
    }

    for candidate in default_go_candidates() {
        if let Some(toolchain) = inspect_go_toolchain(&candidate) {
            return toolchain;
        }
    }

    panic!(
        "a complete Go SDK was not found; install Go or set COCKPIT_GO to its {} (a bin-only Go directory is not sufficient)",
        go_executable_name()
    );
}

fn emit_sidecar_rerun_inputs(path: &Path) {
    if path.file_name().and_then(|name| name.to_str()) == Some("bin") {
        return;
    }

    let Ok(metadata) = std::fs::metadata(path) else {
        return;
    };

    if metadata.is_dir() {
        let Ok(entries) = std::fs::read_dir(path) else {
            return;
        };
        for entry in entries.flatten() {
            emit_sidecar_rerun_inputs(&entry.path());
        }
        return;
    }

    let should_track = matches!(
        path.file_name().and_then(|name| name.to_str()),
        Some("go.mod") | Some("go.sum")
    ) || path.extension().and_then(|extension| extension.to_str()) == Some("go");

    if should_track {
        println!("cargo:rerun-if-changed={}", path.display());
    }
}

fn build_go_sidecar(
    go_toolchain: &mut Option<GoToolchain>,
    sidecar_dir: &Path,
    output_dir: &Path,
    rust_target: &str,
    goos: &str,
    goarch: &str,
) -> PathBuf {
    let extension = if goos == "windows" { ".exe" } else { "" };
    let output = output_dir.join(format!("cockpit-cliproxy-{rust_target}{extension}"));
    if should_skip_sidecar_build(&output) {
        return output;
    }

    let go_toolchain = go_toolchain.get_or_insert_with(find_go_toolchain);
    let status = Command::new(&go_toolchain.executable)
        .current_dir(sidecar_dir)
        .env("GOROOT", &go_toolchain.goroot)
        .env("GOOS", goos)
        .env("GOARCH", goarch)
        .env("CGO_ENABLED", "0")
        .arg("build")
        .arg("-trimpath")
        .arg("-ldflags")
        .arg("-s -w")
        .arg("-o")
        .arg(&output)
        .arg(".")
        .status()
        .expect("failed to start go build for cockpit-cliproxy");

    if !status.success() {
        panic!("go build for cockpit-cliproxy failed with status: {status}");
    }

    output
}

fn build_macos_universal_sidecar(
    go_toolchain: &mut Option<GoToolchain>,
    sidecar_dir: &Path,
    output_dir: &Path,
) {
    let output = output_dir.join("cockpit-cliproxy-universal-apple-darwin");
    if should_skip_sidecar_build(&output) {
        return;
    }

    let x86_64_output = build_go_sidecar(
        go_toolchain,
        sidecar_dir,
        output_dir,
        "x86_64-apple-darwin",
        "darwin",
        "amd64",
    );
    let aarch64_output = build_go_sidecar(
        go_toolchain,
        sidecar_dir,
        output_dir,
        "aarch64-apple-darwin",
        "darwin",
        "arm64",
    );

    let status = Command::new("lipo")
        .arg("-create")
        .arg(&x86_64_output)
        .arg(&aarch64_output)
        .arg("-output")
        .arg(&output)
        .status()
        .expect("failed to start lipo for cockpit-cliproxy universal sidecar");

    if !status.success() {
        panic!("lipo for cockpit-cliproxy universal sidecar failed with status: {status}");
    }
}

fn build_cockpit_cliproxy_sidecar() {
    let manifest_dir =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is required"));
    let target = std::env::var("TARGET").expect("TARGET is required");
    println!("cargo:rustc-env=COCKPIT_RUST_TARGET={target}");
    let sidecar_dir = manifest_dir.join("../sidecars/cockpit-cliproxy");
    let output_dir = sidecar_dir.join("bin");
    let mut go_toolchain = None;

    println!("cargo:rerun-if-env-changed=COCKPIT_SKIP_CLIPROXY_BUILD");
    println!("cargo:rerun-if-env-changed=COCKPIT_GO");
    println!("cargo:rerun-if-env-changed=GOROOT");
    println!("cargo:rerun-if-env-changed=LOCALAPPDATA");
    println!("cargo:rerun-if-env-changed=USERPROFILE");
    println!("cargo:rerun-if-env-changed=PATH");
    emit_sidecar_rerun_inputs(&sidecar_dir);
    std::fs::create_dir_all(&output_dir).expect("failed to create cockpit-cliproxy bin dir");

    if cfg!(target_os = "macos") && target == "universal-apple-darwin" {
        build_macos_universal_sidecar(&mut go_toolchain, &sidecar_dir, &output_dir);
        return;
    }

    let Some((goos, goarch)) = go_target_from_rust_target(&target) else {
        panic!("unsupported sidecar build target: {target}");
    };
    build_go_sidecar(
        &mut go_toolchain,
        &sidecar_dir,
        &output_dir,
        &target,
        goos,
        goarch,
    );
    if cfg!(target_os = "macos") && target.contains("apple-darwin") {
        build_macos_universal_sidecar(&mut go_toolchain, &sidecar_dir, &output_dir);
    }

    if let Some(go_toolchain) = go_toolchain {
        println!(
            "cargo:warning=Using Go toolchain: {} ({})",
            go_toolchain.executable.display(),
            go_toolchain.version
        );
    }
}

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    build_cockpit_cliproxy_sidecar();

    #[cfg(target_os = "macos")]
    {
        SwiftLinker::new("12.0")
            .with_package("MacosNativeMenuSwift", "native/macos-native-menu")
            .link();
        link_macos_swift_runtime_rpaths();
    }

    tauri_build::build()
}
