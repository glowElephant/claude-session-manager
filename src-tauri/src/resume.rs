use anyhow::{anyhow, Result};
use std::path::{Path, PathBuf};
use std::process::Command;

fn find_git_bash() -> Option<String> {
    if let Ok(p) = std::env::var("GIT_BASH") {
        if Path::new(&p).exists() {
            return Some(p);
        }
    }
    let mut candidates: Vec<PathBuf> = Vec::new();
    for var in ["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432", "LOCALAPPDATA"] {
        if let Ok(base) = std::env::var(var) {
            candidates.push(PathBuf::from(base).join("Git").join("git-bash.exe"));
        }
    }
    candidates.push(PathBuf::from(r"C:\Program Files\Git\git-bash.exe"));
    candidates.push(PathBuf::from(r"C:\Program Files (x86)\Git\git-bash.exe"));
    for c in candidates {
        if c.exists() {
            return Some(c.to_string_lossy().to_string());
        }
    }
    None
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResumePlan {
    pub program: String,
    pub args: Vec<String>,
}

pub fn build_resume_plan(session_id: &str, cwd: Option<&str>, target_os: &str) -> ResumePlan {
    let work_dir = cwd.filter(|p| Path::new(p).exists());
    match target_os {
        "windows" => {
            if let Some(git_bash) = find_git_bash() {
                let cd = work_dir
                    .map(|p| format!("cd '{}' && ", p.replace('\\', "/")))
                    .unwrap_or_default();
                let cmd = format!("{}claude --resume {}; exec bash", cd, session_id);
                ResumePlan { program: git_bash, args: vec!["-c".into(), cmd] }
            } else {
                let cd = work_dir
                    .map(|p| format!("cd /d \"{}\" && ", p))
                    .unwrap_or_default();
                let cmd = format!("start cmd /k \"{}claude --resume {}\"", cd, session_id);
                ResumePlan { program: "cmd".into(), args: vec!["/c".into(), cmd] }
            }
        }
        "macos" => {
            let cd = work_dir
                .map(|p| format!("cd \\\"{}\\\" && ", p))
                .unwrap_or_default();
            let script = format!(
                "tell application \"Terminal\" to do script \"{}claude --resume {}\"",
                cd, session_id
            );
            ResumePlan { program: "osascript".into(), args: vec!["-e".into(), script] }
        }
        _ => {
            let cd = work_dir.map(|p| format!("cd '{}' && ", p)).unwrap_or_default();
            let cmd = format!("{}claude --resume {}; exec bash", cd, session_id);
            ResumePlan {
                program: "x-terminal-emulator".into(),
                args: vec!["-e".into(), "bash".into(), "-c".into(), cmd],
            }
        }
    }
}

pub fn resume_in_new_terminal(session_id: &str, cwd: Option<&str>) -> Result<()> {
    let target = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };
    let plan = build_resume_plan(session_id, cwd, target);

    if target == "linux" {
        for term in &["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"] {
            let args: Vec<&str> = plan.args.iter().map(|s| s.as_str()).collect();
            if Command::new(term).args(&args).spawn().is_ok() {
                return Ok(());
            }
        }
        return Err(anyhow!("no terminal emulator found"));
    }

    Command::new(&plan.program).args(&plan.args).spawn()?;
    Ok(())
}
