use claude_session_manager_lib::{config, resume, scanner, types::SessionMeta};
use std::process::ExitCode;

fn print_help() {
    eprintln!(
        "session-cli — headless harness for claude-session-manager\n\n\
USAGE:\n  \
  session-cli list                              List all local sessions (JSON)\n  \
  session-cli get-config                        Print current config (JSON)\n  \
  session-cli set-name <session-id> <name>      Save a name for a session\n  \
  session-cli set-desc <session-id> <desc>      Save a description\n  \
  session-cli delete-meta <session-id>          Remove saved metadata\n  \
  session-cli resume-plan <session-id> [cwd]    Print the resume command (no spawn)\n  \
  session-cli messages <file-path> [n]          Print first N user messages from a JSONL\n  \
  session-cli paths                             Print resolved paths (config, projects)\n"
    );
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = args.first().map(|s| s.as_str()).unwrap_or("help");

    let result: anyhow::Result<()> = (|| match cmd {
        "list" => {
            let sessions = scanner::scan_local_sessions()?;
            println!("{}", serde_json::to_string_pretty(&sessions)?);
            Ok(())
        }
        "get-config" => {
            let cfg = config::load_config();
            println!("{}", serde_json::to_string_pretty(&cfg)?);
            Ok(())
        }
        "set-name" => {
            let id = args.get(1).ok_or_else(|| anyhow::anyhow!("session-id required"))?;
            let name = args.get(2).ok_or_else(|| anyhow::anyhow!("name required"))?;
            config::upsert_session_meta(
                id,
                SessionMeta { name: Some(name.clone()), ..Default::default() },
            )?;
            println!("ok");
            Ok(())
        }
        "set-desc" => {
            let id = args.get(1).ok_or_else(|| anyhow::anyhow!("session-id required"))?;
            let desc = args.get(2).ok_or_else(|| anyhow::anyhow!("desc required"))?;
            config::upsert_session_meta(
                id,
                SessionMeta { description: Some(desc.clone()), ..Default::default() },
            )?;
            println!("ok");
            Ok(())
        }
        "delete-meta" => {
            let id = args.get(1).ok_or_else(|| anyhow::anyhow!("session-id required"))?;
            config::delete_session_meta(id)?;
            println!("ok");
            Ok(())
        }
        "resume-plan" => {
            let id = args.get(1).ok_or_else(|| anyhow::anyhow!("session-id required"))?;
            let cwd = args.get(2).map(|s| s.as_str());
            let target = if cfg!(target_os = "windows") {
                "windows"
            } else if cfg!(target_os = "macos") {
                "macos"
            } else {
                "linux"
            };
            let plan = resume::build_resume_plan(id, cwd, target);
            println!("{}", serde_json::to_string_pretty(&serde_json::json!({
                "program": plan.program,
                "args": plan.args,
                "target": target,
            }))?);
            Ok(())
        }
        "messages" => {
            let file = args.get(1).ok_or_else(|| anyhow::anyhow!("file-path required"))?;
            let n: usize = args.get(2).map(|s| s.parse().unwrap_or(5)).unwrap_or(5);
            let msgs = scanner::get_session_messages(file, n)?;
            println!("{}", serde_json::to_string_pretty(&msgs)?);
            Ok(())
        }
        "paths" => {
            println!("{}", serde_json::to_string_pretty(&serde_json::json!({
                "config_dir": config::config_dir(),
                "config_file": config::config_file(),
                "claude_dir": scanner::claude_dir(),
                "projects_dir": scanner::projects_dir(),
                "home_override": std::env::var("CLAUDE_SESSION_HOME").ok(),
            }))?);
            Ok(())
        }
        _ => {
            print_help();
            if cmd == "help" {
                Ok(())
            } else {
                Err(anyhow::anyhow!("__HELP_EXIT__"))
            }
        }
    })();

    if let Err(ref e) = result {
        if e.to_string() == "__HELP_EXIT__" {
            return ExitCode::from(2);
        }
    }

    if let Err(e) = result {
        eprintln!("error: {:#}", e);
        return ExitCode::from(1);
    }
    ExitCode::SUCCESS
}
