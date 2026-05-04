use crate::terminal::{detect_all_terminals, DetectedTerminal};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentReport {
    pub target_os: String,
    pub claude_cli_found: bool,
    pub claude_cli_path: Option<String>,
    pub claude_cli_version: Option<String>,
    pub terminals: Vec<DetectedTerminal>,
}

fn current_target_os() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

fn locate_in_path(name: &str) -> Option<String> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        for ext in ["", ".exe", ".cmd", ".bat"] {
            let cand = dir.join(format!("{}{}", name, ext));
            if cand.exists() {
                return Some(cand.to_string_lossy().to_string());
            }
        }
    }
    None
}

fn run_with_timeout(program: &str, args: &[&str], timeout: Duration) -> Option<String> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = cmd
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .ok()?;
    let start = std::time::Instant::now();
    loop {
        match child.try_wait().ok()? {
            Some(status) if status.success() => {
                let output = child.wait_with_output().ok()?;
                return Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
            }
            Some(_) => return None,
            None => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    return None;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
        }
    }
}

pub fn check_environment() -> EnvironmentReport {
    let target_os = current_target_os();
    let claude_path = locate_in_path("claude");
    let claude_found = claude_path.is_some();
    let claude_version = if claude_found {
        run_with_timeout("claude", &["--version"], Duration::from_secs(5))
    } else {
        None
    };
    let terminals = detect_all_terminals(target_os);

    EnvironmentReport {
        target_os: target_os.to_string(),
        claude_cli_found: claude_found,
        claude_cli_path: claude_path,
        claude_cli_version: claude_version,
        terminals,
    }
}
