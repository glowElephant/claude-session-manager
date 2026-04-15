use anyhow::{anyhow, Result};
use std::path::Path;
use std::process::Command;

pub fn resume_in_new_terminal(session_id: &str, cwd: Option<&str>) -> Result<()> {
    let work_dir = cwd.filter(|p| Path::new(p).exists());

    #[cfg(target_os = "windows")]
    {
        let git_bash = "C:\\Program Files\\Git\\git-bash.exe";
        if Path::new(git_bash).exists() {
            let cd = work_dir
                .map(|p| format!("cd '{}' && ", p.replace('\\', "/")))
                .unwrap_or_default();
            let cmd = format!("{}claude --resume {}; exec bash", cd, session_id);
            Command::new(git_bash).args(["-c", &cmd]).spawn()?;
            return Ok(());
        }
        // fallback: cmd
        let cd = work_dir
            .map(|p| format!("cd /d \"{}\" && ", p))
            .unwrap_or_default();
        let cmd = format!("start cmd /k \"{}claude --resume {}\"", cd, session_id);
        Command::new("cmd").args(["/c", &cmd]).spawn()?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let cd = work_dir
            .map(|p| format!("cd \\\"{}\\\" && ", p))
            .unwrap_or_default();
        let script = format!(
            "tell application \"Terminal\" to do script \"{}claude --resume {}\"",
            cd, session_id
        );
        Command::new("osascript").args(["-e", &script]).spawn()?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let cd = work_dir.map(|p| format!("cd '{}' && ", p)).unwrap_or_default();
        let cmd = format!("{}claude --resume {}; exec bash", cd, session_id);
        for term in &["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"] {
            if Command::new(term).args(["-e", "bash", "-c", &cmd]).spawn().is_ok() {
                return Ok(());
            }
        }
        return Err(anyhow!("no terminal emulator found"));
    }

    #[allow(unreachable_code)]
    Err(anyhow!("unsupported platform"))
}
