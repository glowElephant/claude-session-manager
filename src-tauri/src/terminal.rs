use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TerminalKind {
    #[serde(rename = "git-bash")]
    GitBash,
    #[serde(rename = "wt")]
    WindowsTerminal,
    #[serde(rename = "powershell")]
    PowerShell,
    #[serde(rename = "cmd")]
    Cmd,
    #[serde(rename = "terminal")]
    MacTerminal,
    #[serde(rename = "linux-default")]
    LinuxDefault,
}

impl TerminalKind {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "git-bash" | "gitbash" | "bash" => Some(Self::GitBash),
            "wt" | "windows-terminal" => Some(Self::WindowsTerminal),
            "powershell" | "pwsh" => Some(Self::PowerShell),
            "cmd" => Some(Self::Cmd),
            "terminal" | "mac-terminal" => Some(Self::MacTerminal),
            "linux-default" => Some(Self::LinuxDefault),
            _ => None,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::GitBash => "Git Bash",
            Self::WindowsTerminal => "Windows Terminal",
            Self::PowerShell => "PowerShell",
            Self::Cmd => "Command Prompt",
            Self::MacTerminal => "Terminal.app",
            Self::LinuxDefault => "Default terminal",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedTerminal {
    pub kind: TerminalKind,
    pub program: String,
    pub display_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResumePlan {
    pub program: String,
    pub args: Vec<String>,
}

fn first_existing(candidates: &[PathBuf]) -> Option<String> {
    candidates.iter().find(|p| p.exists()).map(|p| p.to_string_lossy().to_string())
}

fn locate_git_bash() -> Option<String> {
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
    first_existing(&candidates)
}

fn locate_windows_terminal() -> Option<String> {
    if let Ok(p) = std::env::var("WINDOWS_TERMINAL") {
        if Path::new(&p).exists() {
            return Some(p);
        }
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let pkgs = PathBuf::from(local).join("Microsoft").join("WindowsApps").join("wt.exe");
        if pkgs.exists() {
            return Some(pkgs.to_string_lossy().to_string());
        }
    }
    if which_in_path("wt.exe").is_some() {
        return Some("wt.exe".into());
    }
    None
}

fn locate_powershell() -> Option<String> {
    if let Some(p) = which_in_path("pwsh.exe") {
        return Some(p);
    }
    let mut candidates = Vec::new();
    for var in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Ok(base) = std::env::var(var) {
            candidates.push(PathBuf::from(&base).join("PowerShell").join("7").join("pwsh.exe"));
        }
    }
    if let Some(p) = first_existing(&candidates) {
        return Some(p);
    }
    if let Some(p) = which_in_path("powershell.exe") {
        return Some(p);
    }
    let sys = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
    let legacy = PathBuf::from(sys)
        .join("System32")
        .join("WindowsPowerShell")
        .join("v1.0")
        .join("powershell.exe");
    if legacy.exists() {
        return Some(legacy.to_string_lossy().to_string());
    }
    None
}

fn locate_cmd() -> Option<String> {
    if let Some(p) = which_in_path("cmd.exe") {
        return Some(p);
    }
    let sys = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
    let p = PathBuf::from(sys).join("System32").join("cmd.exe");
    if p.exists() {
        Some(p.to_string_lossy().to_string())
    } else {
        Some("cmd".into())
    }
}

fn which_in_path(name: &str) -> Option<String> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let cand = dir.join(name);
        if cand.exists() {
            return Some(cand.to_string_lossy().to_string());
        }
    }
    None
}

pub fn detect_all_terminals(target_os: &str) -> Vec<DetectedTerminal> {
    let mut out = Vec::new();
    let push = |out: &mut Vec<DetectedTerminal>, kind: TerminalKind, program: Option<String>| {
        if let Some(p) = program {
            out.push(DetectedTerminal {
                kind,
                program: p,
                display_name: kind.display_name().to_string(),
            });
        }
    };
    match target_os {
        "windows" => {
            push(&mut out, TerminalKind::GitBash, locate_git_bash());
            push(&mut out, TerminalKind::WindowsTerminal, locate_windows_terminal());
            push(&mut out, TerminalKind::PowerShell, locate_powershell());
            push(&mut out, TerminalKind::Cmd, locate_cmd());
        }
        "macos" => {
            out.push(DetectedTerminal {
                kind: TerminalKind::MacTerminal,
                program: "osascript".into(),
                display_name: TerminalKind::MacTerminal.display_name().into(),
            });
        }
        _ => {
            for term in &["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"] {
                if let Some(p) = which_in_path(term) {
                    out.push(DetectedTerminal {
                        kind: TerminalKind::LinuxDefault,
                        program: p,
                        display_name: format!("Default terminal ({})", term),
                    });
                    break;
                }
            }
        }
    }
    out
}

pub fn pick_terminal(target_os: &str, preferred: Option<&str>) -> Option<DetectedTerminal> {
    let detected = detect_all_terminals(target_os);
    if let Some(pref) = preferred.and_then(TerminalKind::parse) {
        if let Some(found) = detected.iter().find(|d| d.kind == pref).cloned() {
            return Some(found);
        }
    }
    detected.into_iter().next()
}

pub fn build_resume_command(
    term: &DetectedTerminal,
    session_id: &str,
    cwd: Option<&str>,
) -> ResumePlan {
    let work_dir = cwd.filter(|p| Path::new(p).exists());
    match term.kind {
        TerminalKind::GitBash => {
            let cd = work_dir
                .map(|p| format!("cd '{}' && ", p.replace('\\', "/")))
                .unwrap_or_default();
            let cmd = format!("{}claude --resume {}; exec bash", cd, session_id);
            ResumePlan { program: term.program.clone(), args: vec!["-c".into(), cmd] }
        }
        TerminalKind::WindowsTerminal => {
            let mut args = Vec::new();
            args.push("new-tab".into());
            if let Some(p) = work_dir {
                args.push("-d".into());
                args.push(p.to_string());
            }
            args.push("powershell".into());
            args.push("-NoExit".into());
            args.push("-Command".into());
            args.push(format!("claude --resume {}", session_id));
            ResumePlan { program: term.program.clone(), args }
        }
        TerminalKind::PowerShell => {
            let cd = work_dir
                .map(|p| format!("Set-Location -LiteralPath '{}'; ", p.replace('\'', "''")))
                .unwrap_or_default();
            let cmd = format!("{}claude --resume {}", cd, session_id);
            ResumePlan {
                program: term.program.clone(),
                args: vec!["-NoExit".into(), "-Command".into(), cmd],
            }
        }
        TerminalKind::Cmd => {
            let cd = work_dir
                .map(|p| format!("cd /d \"{}\" && ", p))
                .unwrap_or_default();
            let inner = format!("{}claude --resume {}", cd, session_id);
            ResumePlan {
                program: term.program.clone(),
                args: vec!["/k".into(), inner],
            }
        }
        TerminalKind::MacTerminal => {
            let cd = work_dir
                .map(|p| format!("cd \\\"{}\\\" && ", p))
                .unwrap_or_default();
            let script = format!(
                "tell application \"Terminal\" to do script \"{}claude --resume {}\"",
                cd, session_id
            );
            ResumePlan {
                program: term.program.clone(),
                args: vec!["-e".into(), script],
            }
        }
        TerminalKind::LinuxDefault => {
            let cd = work_dir.map(|p| format!("cd '{}' && ", p)).unwrap_or_default();
            let cmd = format!("{}claude --resume {}; exec bash", cd, session_id);
            ResumePlan {
                program: term.program.clone(),
                args: vec!["-e".into(), "bash".into(), "-c".into(), cmd],
            }
        }
    }
}
